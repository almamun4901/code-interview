// All input and output types for the question generation module.

export interface CommitContext {
  // Identifiers
  repoFullName: string;
  repoLanguage: string;
  commitSha: string;
  shortSha: string;

  // The commit itself
  commitMessage: string;
  commitDate: string;
  diff: string;
  filePaths: string[];

  // Optional enrichment
  prDescription?: string;
  parentCommitMessage?: string;
}

export interface Question {
  id: string;
  text: string;
  targetDepth: "surface" | "deep";
  artifactReferenced: string;
  tradeoffExposed: boolean;
  failureModeProbed: boolean;

  // Used by follow-up logic (not shown to candidate)
  shallowAnswerLooksLike: string;
  deepAnswerLooksLike: string;
}

export interface QuestionSet {
  questions: Question[];
  commitSha: string;
  generatedAt: string;
  promptVersion: string;
}

export interface GenerationError {
  type: "parse_failure" | "validation_failure" | "api_error" | "context_error";
  message: string;
  rawResponse?: string;
}
