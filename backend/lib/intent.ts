import { dataset, type DatasetConfig } from "@/lib/dataset";

const vaguePattern = /^\s*(how are we doing|performance|what happened|insights?|dashboard)\??\s*$/i;

export function clarifyKnownLimitations(
  question: string,
  config: DatasetConfig = dataset
): string | null {
  const q = question.toLowerCase();
  const unavailable = config.unavailableConcepts.filter((concept) =>
    new RegExp(`\\b${escapeRegExp(concept)}\\b`, "i").test(q)
  );
  if (unavailable.length) {
    return `${config.name} does not include ${unavailable.join(", ")}. Ask about one of the configured metrics or dimensions instead.`;
  }
  if (vaguePattern.test(q)) {
    const examples = config.exampleQuestions
      .filter((item) => item.tag.toLowerCase() !== "clarify")
      .slice(0, 4)
      .map((item) => item.text)
      .join(", ");
    return `Which analysis should I run? For example: ${examples}.`;
  }
  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
