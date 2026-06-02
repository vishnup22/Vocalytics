"use client";

import { useState } from "react";
import type { ChartSpec, Nl2SqlResult, QueryResult } from "@/lib/types";
import Chart from "@/components/Chart";
import SqlPanel from "@/components/SqlPanel";
import ExamplePrompts from "@/components/ExamplePrompts";
import MicButton from "@/components/MicButton";

type Phase = "idle" | "transcribing" | "thinking" | "querying" | "done";

interface Resolved {
  question: string;
  sql: string;
  chart: ChartSpec;
  explanation: string;
  result: QueryResult;
}

const PIPELINE = [
  { key: "transcribing", label: "Listen", icon: "🎙" },
  { key: "thinking", label: "Generate SQL", icon: "✨" },
  { key: "querying", label: "Query DB", icon: "⚡" },
  { key: "done", label: "Visualize", icon: "📊" },
] as const;

export default function Home() {
  const [question, setQuestion] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [clarification, setClarification] = useState<string | null>(null);
  const [resolved, setResolved] = useState<Resolved | null>(null);

  const busy = phase !== "idle" && phase !== "done";

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
        body: JSON.stringify({ question: trimmed }),
      });
      const nl: Nl2SqlResult & { error?: string } = await nlRes.json();
      if (!nlRes.ok) {
        setError(nl.error ?? "Could not generate SQL.");
        setPhase("done");
        return;
      }
      if (nl.needsClarification || !nl.sql || !nl.chart) {
        setClarification(
          nl.clarificationQuestion ??
            "Could you rephrase that with a specific metric and time range?"
        );
        setPhase("done");
        return;
      }

      setPhase("querying");
      const qRes = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: nl.sql }),
      });
      const qData: QueryResult & { error?: string } = await qRes.json();
      if (!qRes.ok) {
        setError(qData.error ?? "The query was rejected or failed.");
        setResolved({
          question: trimmed,
          sql: nl.sql,
          chart: nl.chart,
          explanation: nl.explanation,
          result: { columns: [], rows: [], rowCount: 0 },
        });
        setPhase("done");
        return;
      }

      setResolved({
        question: trimmed,
        sql: nl.sql,
        chart: nl.chart,
        explanation: nl.explanation,
        result: qData,
      });
      setPhase("done");
    } catch {
      setError("Something went wrong. Please try again.");
      setPhase("done");
    }
  }

  const activeStep =
    phase === "transcribing"
      ? 0
      : phase === "thinking"
      ? 1
      : phase === "querying"
      ? 2
      : phase === "done" && resolved
      ? 3
      : -1;

  return (
    <main className="relative mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="animate-fade-in-up text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-slate-400 backdrop-blur">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Instacart · Voice-to-SQL · Read-only
        </div>
        <h1 className="gradient-text text-5xl font-extrabold tracking-tight sm:text-6xl">
          VocalLytics
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
          Ask a business question by voice or text. Get an interactive chart — and
          the exact SQL behind it.
        </p>
      </header>

      <section className="card animate-fade-in-up p-6 sm:p-8" style={{ animationDelay: "80ms" }}>
        <MicButton
          onTranscript={(t) => ask(t)}
          onError={(m) => {
            setError(m);
            setPhase("done");
          }}
          disabled={busy}
        />

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          <span className="text-xs font-medium uppercase tracking-widest text-slate-600">
            or type
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        </div>

        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
        >
          <div className="gradient-border flex-1">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Top 10 departments by items ordered"
              className="w-full rounded-[15px] bg-[#0a0f1e]/90 px-4 py-3.5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              disabled={busy}
            />
          </div>
          <button
            type="submit"
            disabled={busy || !question.trim()}
            className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-500 px-8 py-3.5 font-semibold text-white shadow-glow transition hover:scale-[1.02] hover:shadow-glow-cyan disabled:scale-100 disabled:opacity-40"
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              {busy ? (
                <>
                  <span className="h-4 w-4 animate-spin-slow rounded-full border-2 border-white/30 border-t-white" />
                  Working…
                </>
              ) : (
                <>
                  Ask
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </>
              )}
            </span>
          </button>
        </form>

        <div className="mt-8">
          <ExamplePrompts onPick={(q) => ask(q)} disabled={busy} />
        </div>
      </section>

      {busy && (
        <div className="card animate-scale-in p-5">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {PIPELINE.map((step, i) => {
              const active = i === activeStep;
              const done = i < activeStep;
              return (
                <div key={step.key} className="flex flex-1 flex-col items-center gap-2">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg transition-all duration-500 ${
                      active
                        ? "scale-110 bg-gradient-to-br from-indigo-500 to-cyan-500 shadow-glow"
                        : done
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-white/5 text-slate-600"
                    }`}
                  >
                    {done ? "✓" : step.icon}
                  </div>
                  <span
                    className={`hidden text-center text-[10px] font-medium uppercase tracking-wide sm:block ${
                      active ? "text-indigo-300" : done ? "text-emerald-400/80" : "text-slate-600"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-center text-sm text-slate-400">
            {phase === "transcribing" && "Transcribing your question…"}
            {phase === "thinking" && "Claude is generating schema-grounded SQL…"}
            {phase === "querying" && "Running validated query on Postgres…"}
          </p>
        </div>
      )}

      {clarification && (
        <div className="animate-fade-in-up rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 backdrop-blur">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-lg">
              💡
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                Needs clarification
              </p>
              <p className="mt-1 text-slate-200">{clarification}</p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="animate-fade-in-up rounded-2xl border border-red-500/30 bg-red-500/5 p-5 backdrop-blur">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/20 text-lg">
              ⚠️
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-red-400">
                Something needs attention
              </p>
              <p className="mt-1 text-slate-200">{error}</p>
            </div>
          </div>
        </div>
      )}

      {resolved && (
        <section className="flex animate-fade-in-up flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
                Your question
              </p>
              <p className="mt-1 text-lg font-medium text-slate-100">
                &ldquo;{resolved.question}&rdquo;
              </p>
            </div>
            {resolved.result.rowCount > 0 && (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                {resolved.result.rowCount} rows
              </span>
            )}
          </div>

          <div className="card overflow-hidden p-1">
            <div className="rounded-[14px] bg-[#0a0f1e]/50 p-2 sm:p-4">
              {resolved.chart.title && (
                <h2 className="mb-2 px-2 text-center text-sm font-medium text-slate-400">
                  {resolved.chart.title}
                </h2>
              )}
              {resolved.result.rows.length > 0 ? (
                <Chart spec={resolved.chart} rows={resolved.result.rows} />
              ) : (
                <p className="p-12 text-center text-slate-500">
                  No data to chart for this question.
                </p>
              )}
            </div>
          </div>

          {resolved.explanation && (
            <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 backdrop-blur">
              <span className="mt-0.5 text-lg">💬</span>
              <p className="text-slate-300 leading-relaxed">{resolved.explanation}</p>
            </div>
          )}

          <SqlPanel sql={resolved.sql} />
        </section>
      )}

      <footer className="mt-auto flex flex-wrap items-center justify-center gap-4 pb-6 pt-4 text-center text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <ShieldIcon />
          Read-only SQL
        </span>
        <span className="hidden h-3 w-px bg-white/10 sm:block" />
        <span>Table allowlist enforced</span>
        <span className="hidden h-3 w-px bg-white/10 sm:block" />
        <span>5s statement timeout</span>
      </footer>
    </main>
  );
}

function ShieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
