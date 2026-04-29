import { generateQuestions } from "../lib/questions";

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(filename: string) {
  const envPath = resolve(process.cwd(), filename);
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");

    process.env[key] = value;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

const [, , repo, sha] = process.argv;

if (!repo || !sha) {
  console.error("Usage: npx tsx scripts/test-questions.ts <owner/repo> <sha>");
  process.exit(1);
}

const githubToken = process.env.GITHUB_TOKEN;
if (!githubToken) {
  console.error("Set GITHUB_TOKEN env var");
  process.exit(1);
}

const targetRepo = repo;
const targetSha = sha;
const token = githubToken;

async function main() {
  console.log(`\nGenerating questions for ${targetRepo} @ ${targetSha}\n`);
  console.log("-".repeat(60));

  const result = await generateQuestions(token, targetRepo, targetSha);

  if (!result.ok) {
    console.error("Generation failed:", result.error);
    process.exit(1);
  }

  const { questions, promptVersion, generatedAt } = result.data;
  console.log(`Prompt version: ${promptVersion}`);
  console.log(`Generated at:   ${generatedAt}`);
  console.log(`Question count: ${questions.length}`);
  console.log("-".repeat(60));

  questions.forEach((question, index) => {
    console.log(
      `\nQ${index + 1} [${question.targetDepth}] - anchored to: ${question.artifactReferenced}`,
    );
    console.log(
      `Tradeoff: ${question.tradeoffExposed} | Failure mode: ${question.failureModeProbed}`,
    );
    console.log(`\n  "${question.text}"`);
    console.log(`\n  Shallow looks like: ${question.shallowAnswerLooksLike}`);
    console.log(`  Deep looks like:    ${question.deepAnswerLooksLike}`);
    console.log("-".repeat(60));
  });

  console.log("\nQUALITY CHECKS");
  questions.forEach((question, index) => {
    const issues: string[] = [];

    if (!question.artifactReferenced) {
      issues.push("No artifact referenced");
    }
    if (!question.text.includes(question.artifactReferenced)) {
      issues.push("Artifact not mentioned in question text");
    }
    if (question.text.split(" ").length < 10) {
      issues.push("Question too short");
    }
    if (!question.text.endsWith("?")) {
      issues.push("Does not end with ?");
    }

    console.log(
      issues.length > 0
        ? `Q${index + 1} warning: ${issues.join(", ")}`
        : `Q${index + 1} pass`,
    );
  });

  const hasTradeoff = questions.some((question) => question.tradeoffExposed);
  const hasFailureMode = questions.some((question) => question.failureModeProbed);
  console.log(`\nSet-level: tradeoff=${hasTradeoff} failureMode=${hasFailureMode}`);
  console.log(
    hasTradeoff && hasFailureMode
      ? "\nPasses set-level constraints"
      : "\nFails set-level constraints",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
