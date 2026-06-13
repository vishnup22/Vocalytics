"use client";

import { useState } from "react";

const KEYWORDS =
  /\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|HAVING|JOIN|LEFT JOIN|RIGHT JOIN|INNER JOIN|ON|AS|AND|OR|NOT|LIMIT|OFFSET|SUM|COUNT|AVG|MIN|MAX|ROUND|CASE|WHEN|THEN|ELSE|END|DESC|ASC|IN|BETWEEN|IS|NULL)\b/gi;

function highlight(sql: string): string {
  const escaped = sql
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .replace(/'([^']*)'/g, "<span class='text-emerald-400'>'$1'</span>")
    .replace(KEYWORDS, "<span class='text-indigo-300 font-semibold'>$1</span>");
}

export default function SqlPanel({ sql }: { sql: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      void 0;
    }
  }

  return (
    <div className="animate-fade-in-up overflow-hidden rounded-2xl border border-white/10 bg-[#0a0f1e]/90 shadow-card backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-500/80" />
            <span className="h-3 w-3 rounded-full bg-amber-400/80" />
            <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-slate-500">query.sql</span>
            <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
              validated / read-only
            </span>
          </div>
        </div>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-indigo-400/40 hover:bg-indigo-500/10 hover:text-white"
        >
          {copied ? (
            <>
              <CheckIcon />
              Copied
            </>
          ) : (
            <>
              <CopyIcon />
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="overflow-auto p-5 font-mono text-sm leading-relaxed text-slate-300">
        <code dangerouslySetInnerHTML={{ __html: highlight(sql) }} />
      </pre>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
