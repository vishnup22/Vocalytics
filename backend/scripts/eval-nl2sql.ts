import { config as loadEnv } from "dotenv";
import { generateSql } from "../lib/anthropic";
import { dataset, type EvalCase } from "../lib/dataset";
import { clarifyKnownLimitations } from "../lib/intent";
import { guardSql } from "../lib/sql-guard";
import { validateGeneratedQuery } from "../lib/sql-validation";

loadEnv({ path: ".env.local" });
loadEnv();

interface EvalResult {
  id: string;
  passed: boolean;
  checks: Record<string, boolean>;
  notes: string[];
}

function includesAll(actual: string[], expected: string[]): boolean {
  return expected.every((table) => actual.includes(table));
}

async function runCase(testCase: EvalCase): Promise<EvalResult> {
  const notes: string[] = [];
  const checks: Record<string, boolean> = {};
  const deterministicClarification = clarifyKnownLimitations(testCase.question);

  if (!process.env.ANTHROPIC_API_KEY) {
    checks.clarification =
      testCase.shouldClarify === Boolean(deterministicClarification);
    if (!checks.clarification) {
      notes.push("No ANTHROPIC_API_KEY; deterministic clarification did not match expectation.");
    }
    return {
      id: testCase.id,
      passed: Object.values(checks).every(Boolean),
      checks,
      notes,
    };
  }

  if (deterministicClarification) {
    checks.clarification = testCase.shouldClarify;
    return {
      id: testCase.id,
      passed: Object.values(checks).every(Boolean),
      checks,
      notes,
    };
  }

  const result = await generateSql(testCase.question, testCase.context ?? []);
  checks.clarification = result.needsClarification === testCase.shouldClarify;

  if (!result.needsClarification && result.sql && result.chart) {
    const guard = guardSql(result.sql);
    checks.sqlSafe = guard.ok;
    if (!guard.ok) {
      notes.push(`guard rejected SQL: ${guard.reason}`);
    } else {
      checks.tables = includesAll(guard.tables, testCase.expectedTables);
      checks.chartType = testCase.expectedChartType
        ? result.chart.type === testCase.expectedChartType
        : true;
      const validation = validateGeneratedQuery(
        testCase.question,
        guard.safeSql,
        result.chart
      );
      checks.validation = validation.ok;
      notes.push(...validation.warnings);
    }
  } else {
    checks.sqlSafe = testCase.shouldClarify;
    checks.tables = testCase.expectedTables.length === 0;
    checks.chartType = true;
    checks.validation = true;
  }

  return {
    id: testCase.id,
    passed: Object.values(checks).every(Boolean),
    checks,
    notes,
  };
}

async function main() {
  const results: EvalResult[] = [];
  for (const testCase of dataset.evalCases as EvalCase[]) {
    results.push(await runCase(testCase));
  }

  const passed = results.filter((result) => result.passed).length;
  const total = results.length;
  console.log(`NL-to-SQL eval: ${passed}/${total} passed`);
  for (const result of results) {
    const status = result.passed ? "PASS" : "FAIL";
    console.log(`\n${status} ${result.id}`);
    console.log(JSON.stringify(result.checks, null, 2));
    for (const note of result.notes) console.log(`- ${note}`);
  }

  if (passed !== total) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
