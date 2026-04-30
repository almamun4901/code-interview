import type { Question } from "@/lib/questions/types";

import type { LayerResult } from "./types";

const TRADEOFF_SIGNALS = [
  "however",
  "alternatively",
  "trade-off",
  "tradeoff",
  "downside",
  "upside",
  "instead",
  "could have",
  "considered",
  "decided against",
  "ruled out",
  "the reason",
  "the reason we",
  "because",
  "because of",
  "due to",
  "given that",
  "at the time",
  "after trying",
  "we ended up",
  "performance",
  "latency",
  "scale",
  "cost",
  "complexity",
  "maintainability",
  "we needed",
  "requirement",
  "requirements",
  "constraint",
  "boundary",
  "acceptable",
  "the issue was",
  "the problem was",
];

const SHALLOW_SIGNALS = [
  "best practice",
  "industry standard",
  "everyone does",
  "it's common",
  "common pattern",
  "i just",
  "we just",
  "it was easy",
  "it was simple",
  "it worked",
  "worked well",
  "made sense",
  "reasonable",
  "i don't know",
  "i'm not sure",
  "i don't remember",
  "not sure why",
  "just felt right",
  "seemed like",
  "probably",
];

const ALTERNATIVE_PATTERNS = [
  /\b(?:considered|looked at|tried|started at|could have|alternative(?:ly)?|instead|decided against|ruled out)\b/i,
  /\b(?:but|rather than)\b/i,
];

const FAILURE_PATTERNS = [
  /\b(?:break|breaks|fail|failure|edge case|fallback|stale|thrash|miss|invalidation|wrong|risk|worried)\b/i,
];

const CONSTRAINT_PATTERNS = [
  /\b(?:sla|deadline|requirement|constraint|limit|budget|latency|p99|performance|scale|cost|maintainability)\b/i,
  /\b(?:needed|had to|couldn't|could not|acceptable|ruled out)\b/i,
];

const CONCRETE_PATTERNS = [
  /\d+\s*(?:ms|milliseconds|seconds|minutes|hours|days|%|percent|mb|gb|requests|users|x|call sites|keys|connections)/i,
  /\b\d+x\b/i,
  /\bO\([^)]+\)/,
  /\b(?:v\d|version \d)\b/i,
  /\bline \d+\b/i,
];

const CODE_PATTERN = /`[^`]+`|```[\s\S]+?```/;
const MIN_WORDS_WITHOUT_CODE = 80;
const MIN_WORDS_WITH_CODE = 40;

function countMatches(patterns: RegExp[], answer: string): number {
  return patterns.filter((pattern) => pattern.test(answer)).length;
}

function countDepthSignals(answer: string): number {
  return [
    countMatches(CONSTRAINT_PATTERNS, answer) > 0,
    countMatches(ALTERNATIVE_PATTERNS, answer) > 0,
    countMatches(FAILURE_PATTERNS, answer) > 0,
    countMatches(CONCRETE_PATTERNS, answer) > 0,
  ].filter(Boolean).length;
}

function wordCount(answer: string): number {
  const trimmed = answer.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

export function runLayer1(answer: string, _question: Question): LayerResult {
  void _question;

  const normalized = answer.toLowerCase();
  const words = wordCount(answer);
  const tradeoffHits = TRADEOFF_SIGNALS.filter((sig) =>
    normalized.includes(sig),
  );
  const shallowHits = SHALLOW_SIGNALS.filter((sig) => normalized.includes(sig));
  const depthSignalCount = countDepthSignals(answer);

  if (shallowHits.length >= 2 && tradeoffHits.length === 0) {
    return {
      verdict: "shallow",
      confidence: "high",
      reason: `Answer uses deflection language (${shallowHits.slice(0, 2).join(", ")}) with no trade-off signal`,
      layer: 1,
    };
  }

  if (tradeoffHits.length === 0 && words < 40) {
    return {
      verdict: "shallow",
      confidence: "high",
      reason: "Short answer with no trade-off or reasoning signal words",
      layer: 1,
    };
  }

  if (depthSignalCount >= 2 && tradeoffHits.length >= 3) {
    return {
      verdict: "deep",
      confidence: "high",
      reason: `Answer contains ${depthSignalCount} depth signals and ${tradeoffHits.length} trade-off signal words`,
      layer: 1,
    };
  }

  return {
    verdict: "ambiguous",
    confidence: "low",
    reason: `Layer 1 inconclusive: ${tradeoffHits.length} trade-off signals, ${shallowHits.length} shallow signals`,
    layer: 1,
  };
}

export function runLayer2(answer: string, _question: Question): LayerResult {
  void _question;

  const words = wordCount(answer);
  const hasCode = CODE_PATTERN.test(answer);
  const specificityMatches = CONCRETE_PATTERNS.filter((pattern) =>
    pattern.test(answer),
  );
  const depthSignalCount = countDepthSignals(answer);
  const hasSpecificity = specificityMatches.length > 0;
  const hasAlternative = countMatches(ALTERNATIVE_PATTERNS, answer) > 0;

  if (depthSignalCount >= 2 && (words >= MIN_WORDS_WITH_CODE || hasCode)) {
    return {
      verdict: "deep",
      confidence: "high",
      reason: `Answer provides ${depthSignalCount} depth signals across constraints, alternatives, failure modes, or concrete evidence`,
      layer: 2,
    };
  }

  if (depthSignalCount === 1 && hasAlternative) {
    return {
      verdict: "ambiguous",
      confidence: "low",
      reason:
        "Answer mentions an alternative but does not clearly explain the trade-off, so Layer 3 should decide",
      layer: 2,
    };
  }

  if (words < MIN_WORDS_WITHOUT_CODE && !hasCode && !hasSpecificity) {
    return {
      verdict: "shallow",
      confidence: "high",
      reason: `Answer is ${words} words with no code, no numbers, no specific references`,
      layer: 2,
    };
  }

  if (words < MIN_WORDS_WITH_CODE && !hasCode && !hasSpecificity) {
    return {
      verdict: "shallow",
      confidence: "high",
      reason: `Answer is only ${words} words`,
      layer: 2,
    };
  }

  if (depthSignalCount === 0 && words < 120) {
    return {
      verdict: "shallow",
      confidence: "high",
      reason: `Answer is ${words} words but gives no trade-off, alternative, failure mode, or concrete reason`,
      layer: 2,
    };
  }

  if (hasCode && words >= MIN_WORDS_WITH_CODE) {
    return {
      verdict: "ambiguous",
      confidence: "low",
      reason: `Answer contains code (${words} words) and needs reasoning-quality assessment`,
      layer: 2,
    };
  }

  if (words >= MIN_WORDS_WITHOUT_CODE || depthSignalCount === 1) {
    return {
      verdict: "ambiguous",
      confidence: "low",
      reason: `Answer has ${depthSignalCount} depth signal(s) across ${words} words, so Layer 3 should decide`,
      layer: 2,
    };
  }

  return {
    verdict: "shallow",
    confidence: "low",
    reason: `Answer is ${words} words with insufficient depth signals`,
    layer: 2,
  };
}
