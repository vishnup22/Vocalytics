import { randomUUID } from "node:crypto";

export type LogLevel = "info" | "warn" | "error";

export function requestId(): string {
  return randomUUID();
}

export function nowMs(): number {
  return Date.now();
}

export function elapsedMs(start: number): number {
  return Date.now() - start;
}

export function logEvent(
  level: LogLevel,
  event: string,
  fields: Record<string, unknown> = {}
) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
}
