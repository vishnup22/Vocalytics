"use client";

import dynamic from "next/dynamic";
import type { ChartSpec } from "@/lib/types";

const Plot = dynamic(() => import("@/frontend/components/plotly"), {
  ssr: false,
  loading: () => <div className="p-8 text-center text-slate-400">Loading chart…</div>,
}) as unknown as React.ComponentType<{
  data: unknown[];
  layout: Record<string, unknown>;
  config?: Record<string, unknown>;
  style?: React.CSSProperties;
  useResizeHandler?: boolean;
}>;

type Row = Record<string, unknown>;

const PALETTE = ["#6366f1", "#22d3ee", "#f472b6", "#facc15", "#34d399", "#fb923c"];

const axisStyle = {
  gridcolor: "rgba(148,163,184,0.08)",
  linecolor: "rgba(148,163,184,0.2)",
  tickfont: { color: "#64748b" },
};

const baseLayout: Record<string, unknown> = {
  paper_bgcolor: "rgba(0,0,0,0)",
  plot_bgcolor: "rgba(0,0,0,0)",
  font: { color: "#94a3b8", family: "Inter, system-ui, sans-serif", size: 12 },
  margin: { l: 56, r: 20, t: 40, b: 52 },
  xaxis: axisStyle,
  yaxis: axisStyle,
  legend: { orientation: "h", y: -0.15, font: { color: "#94a3b8" } },
};

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  return NaN;
}

function isDateLike(v: unknown): boolean {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v);
}

function isNumericLike(v: unknown): boolean {
  if (typeof v === "number") return true;
  return typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v));
}

function inferXAxisType(
  chartType: ChartSpec["type"],
  sampleX: unknown
): "category" | "date" | "linear" {
  if (chartType === "bar") return "category";
  if (isDateLike(sampleX)) return "date";
  if (isNumericLike(sampleX)) return "linear";
  return "category";
}

function groupBy(rows: Row[], key: string): Map<string, Row[]> {
  const map = new Map<string, Row[]>();
  for (const row of rows) {
    const k = String(row[key]);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(row);
  }
  return map;
}

export default function Chart({ spec, rows }: { spec: ChartSpec; rows: Row[] }) {
  if (!rows.length) {
    return (
      <div className="p-8 text-center text-slate-400">
        The query returned no rows.
      </div>
    );
  }

  if (spec.type === "table") {
    return <DataTable rows={rows} />;
  }

  const { x, y, series } = spec;
  const layout = { ...baseLayout, title: { text: spec.title } };

  if (spec.type === "pie" && x && y) {
    const data = [
      {
        type: "pie",
        labels: rows.map((r) => String(r[x])),
        values: rows.map((r) => toNumber(r[y])),
        marker: { colors: PALETTE },
      },
    ];
    return (
      <Plot
        data={data}
        layout={layout}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: "100%", height: "420px" }}
        useResizeHandler
      />
    );
  }

  if (!x || !y) {
    return <DataTable rows={rows} />;
  }

  const plotType = spec.type === "bar" ? "bar" : "scatter";
  const mode = spec.type === "line" ? "lines+markers" : spec.type === "scatter" ? "markers" : undefined;

  let data: Record<string, unknown>[];
  if (series) {
    const groups = groupBy(rows, series);
    data = Array.from(groups.entries()).map(([name, groupRows], i) => ({
      type: plotType,
      mode,
      name,
      x: groupRows.map((r) => r[x]),
      y: groupRows.map((r) => toNumber(r[y])),
      marker: { color: PALETTE[i % PALETTE.length] },
    }));
  } else {
    data = [
      {
        type: plotType,
        mode,
        x: rows.map((r) => r[x]),
        y: rows.map((r) => toNumber(r[y])),
        marker: { color: PALETTE[0] },
      },
    ];
  }

  const cartesianLayout = {
    ...baseLayout,
    title: { text: spec.title },
    xaxis: {
      ...axisStyle,
      type: inferXAxisType(spec.type, rows[0]?.[x]),
      autorange: true,
    },
    yaxis: { ...axisStyle, type: "linear", autorange: true },
  };

  return (
    <Plot
      data={data}
      layout={cartesianLayout}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: "100%", height: "420px" }}
      useResizeHandler
    />
  );
}

function DataTable({ rows }: { rows: Row[] }) {
  const columns = Object.keys(rows[0] ?? {});
  return (
    <div className="max-h-[420px] overflow-auto rounded-lg border border-white/10">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-panel">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-3 py-2 font-medium text-slate-300">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-white/5">
              {columns.map((c) => (
                <td key={c} className="px-3 py-2 text-slate-200">
                  {String(row[c] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
