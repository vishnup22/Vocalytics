"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type {
  ChartSpec,
  ConversationTurn,
  InsightResult,
  Nl2SqlResult,
  QueryResult,
} from "@/lib/types";
import { dataset } from "@/lib/dataset";
import Chart from "@/frontend/components/Chart";
import SqlPanel from "@/frontend/components/SqlPanel";
import ExamplePrompts from "@/frontend/components/ExamplePrompts";
import MicButton from "@/frontend/components/MicButton";

type Phase = "idle" | "transcribing" | "thinking" | "querying" | "insighting" | "done";

interface Resolved {
  question: string;
  sql: string;
  chart: ChartSpec;
  explanation: string;
  insight: string | null;
  validationWarnings: string[];
  schemaTables: string[];
  result: QueryResult;
}

interface DatasetSummary {
  id: string;
  name: string;
  createdAt?: string;
  rowCount?: number;
  columns?: string[];
}

const PIPELINE = [
  { key: "thinking", label: "SQL" },
  { key: "querying", label: "Query" },
  { key: "insighting", label: "Insight" },
  { key: "done", label: "Chart" },
] as const;

export default function Home() {
  const [question, setQuestion] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [clarification, setClarification] = useState<string | null>(null);
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [history, setHistory] = useState<ConversationTurn[]>([]);
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [datasetId, setDatasetId] = useState(dataset.id);
  const [uploading, setUploading] = useState(false);

  const busy = phase !== "idle" && phase !== "done";
  const activeDataset =
    datasets.find((item) => item.id === datasetId) ?? datasets[0];
  const starterQuestions =
    activeDataset?.id && activeDataset.id !== dataset.id && activeDataset.columns?.length
      ? activeDataset.columns.slice(0, 5).map((column) => ({
          text: `Count rows by ${column}`,
          tag: "Group",
        }))
      : dataset.exampleQuestions;

  useEffect(() => {
    void refreshDatasets();
  }, []);

  async function refreshDatasets() {
    try {
      const res = await fetch("/api/datasets");
      const data = await res.json();
      if (res.ok && Array.isArray(data.datasets)) {
        setDatasets(data.datasets);
        if (!data.datasets.some((item: DatasetSummary) => item.id === datasetId)) {
          setDatasetId(data.datasets[0]?.id ?? dataset.id);
        }
      }
    } catch {
      void 0;
    }
  }

  async function uploadDataset(file: File | null) {
    if (!file || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/datasets", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Dataset upload failed.");
        return;
      }
      await refreshDatasets();
      setDatasetId(data.dataset.id);
      setHistory([]);
      setResolved(null);
    } catch {
      setError("Dataset upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function reset() {
    setError(null);
    setClarification(null);
    setResolved(null);
  }

  async function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed || busy) return;
    setQuestion(trimmed);
    reset();

    try {
      setPhase("thinking");
      const nlRes = await fetch("/api/nl2sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          context: history.slice(-4),
          datasetId,
        }),
      });
      const nl: Nl2SqlResult & { error?: string } = await nlRes.json();
      if (!nlRes.ok) {
        setError(nl.error ?? "Could not generate SQL.");
        setPhase("done");
        return;
      }
      if (nl.needsClarification || !nl.sql || !nl.chart) {
        const message =
          nl.clarificationQuestion ??
          `Could you rephrase that with a specific ${dataset.name} metric?`;
        setClarification(message);
        setHistory((items) =>
          [...items, { question: trimmed, sql: null, summary: message }].slice(-6)
        );
        setPhase("done");
        return;
      }

      setPhase("querying");
      const qRes = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: nl.sql, datasetId }),
      });
      const qData: QueryResult & { error?: string } = await qRes.json();
      if (!qRes.ok) {
        setError(qData.error ?? "The query was rejected or failed.");
        setResolved({
          question: trimmed,
          sql: nl.sql,
          chart: nl.chart,
          explanation: nl.explanation,
          insight: null,
          validationWarnings: nl.validationWarnings ?? [],
          schemaTables: nl.schemaTables ?? [],
          result: { columns: [], rows: [], rowCount: 0 },
        });
        setPhase("done");
        return;
      }

      let insight: string | null = null;
      if (qData.rows.length > 0) {
        setPhase("insighting");
        try {
          const iRes = await fetch("/api/insight", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question: trimmed,
              sql: nl.sql,
              chart: nl.chart,
              columns: qData.columns,
              rows: qData.rows.slice(0, 100),
            }),
          });
          const iData: InsightResult & { error?: string } = await iRes.json();
          if (iRes.ok) insight = iData.insight;
        } catch {
          insight = null;
        }
      }

      const nextResolved = {
        question: trimmed,
        sql: nl.sql,
        chart: nl.chart,
        explanation: nl.explanation,
        insight,
        validationWarnings: nl.validationWarnings ?? [],
        schemaTables: nl.schemaTables ?? [],
        result: qData,
      };
      setResolved(nextResolved);
      setHistory((items) =>
        [
          ...items,
          {
            question: trimmed,
            sql: nl.sql,
            chartTitle: nl.chart?.title,
            columns: qData.columns,
            summary: insight ?? nl.explanation,
          },
        ].slice(-6)
      );
      setPhase("done");
    } catch {
      setError("Something went wrong. Please try again.");
      setPhase("done");
    }
  }

  const activeStep =
    phase === "thinking"
      ? 0
      : phase === "querying"
      ? 1
      : phase === "insighting"
      ? 2
      : phase === "done" && resolved
      ? 3
      : -1;

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-slate-950">
      <header className="border-b border-slate-200 bg-white/90">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950 font-mono text-xs font-semibold text-white">
                VL
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-normal text-slate-950">
                  VocalLytics
                </h1>
                <p className="text-xs text-slate-500">
                  Voice analytics for {dataset.name}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <StatusDot label="SQL guarded" />
            <StatusDot label="Read-only" />
            <StatusDot label="Sample ready" />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-6 sm:px-8 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Dataset
            </p>
            <select
              value={datasetId}
              onChange={(event) => {
                setDatasetId(event.target.value);
                setHistory([]);
                setResolved(null);
              }}
              className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
            >
              {datasets.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <label className="mt-3 flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
              {uploading ? "Uploading..." : "Upload CSV"}
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                disabled={uploading}
                onChange={(event) => {
                  void uploadDataset(event.target.files?.[0] ?? null);
                  event.currentTarget.value = "";
                }}
              />
            </label>
            {activeDataset && (
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                {typeof activeDataset.rowCount === "number"
                  ? `${activeDataset.rowCount} rows`
                  : "Configured database dataset"}
              </p>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Ask a question
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Use voice or type a metric-focused question.
              </p>
            </div>

            <MicButton
              onTranscript={(t) => ask(t)}
              onError={(m) => {
                setError(m);
                setPhase("done");
              }}
              disabled={busy}
            />

            <form
              className="mt-5 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                ask(question);
              }}
            >
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={
                  activeDataset?.columns?.[0]
                    ? `Count rows by ${activeDataset.columns[0]}`
                    : dataset.exampleQuestions[0]?.text ?? "Ask a question"
                }
                className="min-h-24 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                disabled={busy}
              />
              <button
                type="submit"
                disabled={busy || !question.trim()}
                className="flex w-full items-center justify-center rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {busy ? "Working..." : "Run analysis"}
              </button>
            </form>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <ExamplePrompts
              onPick={(q) => ask(q)}
              disabled={busy}
              items={starterQuestions}
            />
          </section>

          {history.length > 0 && (
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Recent context
                </p>
                <button
                  className="text-xs font-medium text-slate-500 hover:text-slate-950"
                  onClick={() => setHistory([])}
                >
                  Clear
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {history.slice(-4).map((turn, i) => (
                  <div
                    key={`${turn.question}-${i}`}
                    className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-700"
                  >
                    {turn.question}
                  </div>
                ))}
              </div>
            </section>
          )}
        </aside>

        <section className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Analysis workspace
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-normal text-slate-950">
                  {resolved ? resolved.chart.title || "Query result" : "Ready to analyze"}
                </h2>
              </div>
              {(busy || resolved) && (
                <div className="flex items-center gap-2">
                  {PIPELINE.map((step, i) => (
                    <StepPill
                      key={step.key}
                      label={step.label}
                      active={i === activeStep}
                      done={i < activeStep || (phase === "done" && !!resolved)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {clarification && (
            <Notice tone="amber" title="Clarification needed" message={clarification} />
          )}

          {error && (
            <Notice tone="red" title="Needs attention" message={error} />
          )}

          {!resolved && !busy && !clarification && !error && (
            <div className="grid gap-4 md:grid-cols-3">
              <EmptyMetric label="Available metrics" value="Orders, items, reorder rate" />
              <EmptyMetric label="Dataset" value={activeDataset?.name ?? dataset.name} />
              <EmptyMetric label="Runtime" value="Guarded SQL" />
            </div>
          )}

          {busy && (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
              <div className="mx-auto h-8 w-8 animate-spin-slow rounded-full border-2 border-slate-200 border-t-slate-950" />
              <p className="mt-4 text-sm font-medium text-slate-700">
                {phase === "thinking" && "Generating SQL"}
                {phase === "querying" && "Running the guarded query"}
                {phase === "insighting" && "Summarizing the result"}
              </p>
            </div>
          )}

          {resolved && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Metric label="Rows" value={String(resolved.result.rowCount)} />
                <Metric
                  label="Latency"
                  value={
                    typeof resolved.result.latencyMs === "number"
                      ? `${resolved.result.latencyMs} ms`
                      : "n/a"
                  }
                />
                <Metric
                  label="Source"
                  value={resolved.result.demo ? "Sample data" : "Postgres"}
                />
              </div>

              {(resolved.schemaTables.length > 0 ||
                resolved.validationWarnings.length > 0 ||
                resolved.result.warning) && (
                <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm shadow-sm">
                  {resolved.schemaTables.length > 0 && (
                    <p className="text-slate-600">
                      Retrieved schema:{" "}
                      <span className="font-medium text-slate-900">
                        {resolved.schemaTables.join(", ")}
                      </span>
                    </p>
                  )}
                  {resolved.validationWarnings.length > 0 && (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-amber-700">
                      {resolved.validationWarnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  )}
                  {resolved.result.warning && (
                    <p className="mt-3 text-slate-500">{resolved.result.warning}</p>
                  )}
                </div>
              )}

              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                {resolved.result.rows.length > 0 ? (
                  <Chart spec={resolved.chart} rows={resolved.result.rows} />
                ) : (
                  <p className="p-12 text-center text-slate-500">
                    No data to chart for this question.
                  </p>
                )}
              </div>

              {(resolved.insight || resolved.explanation) && (
                <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Analyst note
                  </p>
                  {resolved.insight && (
                    <p className="mt-2 text-sm leading-relaxed text-slate-900">
                      {resolved.insight}
                    </p>
                  )}
                  {resolved.explanation && (
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">
                      {resolved.explanation}
                    </p>
                  )}
                </div>
              )}

              <SqlPanel sql={resolved.sql} />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function StatusDot({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      {label}
    </span>
  );
}

function StepPill({
  label,
  active,
  done,
}: {
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-medium ${
        active
          ? "border-slate-950 bg-slate-950 text-white"
          : done
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-50 text-slate-500"
      }`}
    >
      {label}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function EmptyMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-slate-700">{value}</p>
    </div>
  );
}

function Notice({
  tone,
  title,
  message,
}: {
  tone: "amber" | "red";
  title: string;
  message: string;
}) {
  const styles =
    tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-red-200 bg-red-50 text-red-900";
  return (
    <div className={`rounded-lg border px-5 py-4 shadow-sm ${styles}`}>
      <p className="text-xs font-semibold uppercase tracking-wide">{title}</p>
      <p className="mt-1 text-sm">{message}</p>
    </div>
  );
}
