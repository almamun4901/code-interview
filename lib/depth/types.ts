import type { Question } from "@/lib/questions/types";

export type DepthVerdict = "deep" | "shallow" | "ambiguous";

export interface LayerResult {
  verdict: DepthVerdict;
  confidence: "high" | "low";
  reason: string;
  layer: 1 | 2 | 3;
}

export interface AssessmentResult {
  verdict: "deep" | "shallow";
  layer: 1 | 2 | 3;
  reason: string;
  missingPiece?: string;
}

export interface FollowUpResult {
  text: string;
  isFollowUp: true;
}

export interface AssessAnswerInput {
  question: Question;
  answer: string;
  followUpCount: number;
}

export interface AnswerResponse {
  followUp?: FollowUpResult;
  next?: Question;
  sessionComplete?: boolean;
  assessment: AssessmentResult;
}
