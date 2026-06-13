"use client";

import { dataset } from "@/lib/dataset";

interface PromptItem {
  text: string;
  tag: string;
}

export default function ExamplePrompts({
  onPick,
  disabled,
  items = dataset.exampleQuestions,
}: {
  onPick: (q: string) => void;
  disabled?: boolean;
  items?: PromptItem[];
}) {
  return (
    <div className="w-full">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        Starter questions
      </p>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <button
            key={item.text}
            onClick={() => onPick(item.text)}
            disabled={disabled}
            className="flex w-full items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5 text-left text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50"
          >
            <span>{item.text}</span>
            <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
              {item.tag}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
