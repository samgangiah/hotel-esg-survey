import type { Answers, AnswerValue, Condition, Question } from "./schema";

export function evaluateCondition(
  condition: Condition,
  scope: Answers
): boolean {
  const actual = scope[condition.questionId];
  const expected = condition.value;

  switch (condition.operator) {
    case "equals":
      return normaliseScalar(actual) === expected;
    case "notEquals":
      return normaliseScalar(actual) !== expected;
    case "includes":
      return Array.isArray(actual) && (actual as unknown[]).includes(expected);
    case "notIncludes":
      return Array.isArray(actual) && !(actual as unknown[]).includes(expected);
    case "greaterThan":
      return typeof actual === "number" && actual > Number(expected);
    case "lessThan":
      return typeof actual === "number" && actual < Number(expected);
    default:
      return false;
  }
}

export function isQuestionVisible(
  question: Question,
  scope: Answers
): boolean {
  if (!question.showWhen || question.showWhen.length === 0) return true;
  return question.showWhen.every((c) => evaluateCondition(c, scope));
}

function normaliseScalar(v: AnswerValue): string | number | boolean | null | undefined {
  if (Array.isArray(v)) return undefined;
  if (typeof v === "object") return undefined;
  return v;
}
