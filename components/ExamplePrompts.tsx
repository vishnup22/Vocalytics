"use client";

export const EXAMPLE_QUESTIONS = [
  {
    text: "Orders by day of week",
    icon: "📅",
    tag: "Trend",
  },
  {
    text: "Top 10 departments by items ordered",
    icon: "🏆",
    tag: "Ranking",
  },
  {
    text: "Reorder rate by department",
    icon: "🔁",
    tag: "Insight",
  },
  {
    text: "Orders per hour of day",
    icon: "⏰",
    tag: "Pattern",
  },
  {
    text: "How are we doing?",
    icon: "💬",
    tag: "Clarify",
  },
] as const;

export default function ExamplePrompts({
  onPick,
  disabled,
}: {
  onPick: (q: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="w-full">
      <p className="mb-3 text-center text-xs font-medium uppercase tracking-widest text-slate-500">
        Try an example · Instacart data
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {EXAMPLE_QUESTIONS.map((item, i) => (
          <button
            key={item.text}
            onClick={() => onPick(item.text)}
            disabled={disabled}
            style={{ animationDelay: `${i * 60}ms` }}
            className="group animate-fade-in-up flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-sm text-slate-200 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-400/40 hover:bg-indigo-500/10 hover:shadow-glow disabled:pointer-events-none disabled:opacity-40"
          >
            <span className="text-base leading-none" aria-hidden>
              {item.icon}
            </span>
            <span className="max-w-[200px] truncate sm:max-w-none">{item.text}</span>
            <span className="hidden rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 group-hover:text-indigo-300 sm:inline">
              {item.tag}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
