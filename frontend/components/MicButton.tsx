"use client";

import { useEffect, useRef, useState } from "react";

type RecState = "idle" | "recording" | "transcribing";

const BAR_COUNT = 16;

export default function MicButton({
  onTranscript,
  onError,
  disabled,
}: {
  onTranscript: (text: string) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}) {
  const [state, setState] = useState<RecState>("idle");
  const [levels, setLevels] = useState<number[]>(() =>
    new Array(BAR_COUNT).fill(0.1)
  );

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => stopMeter();
  }, []);

  function startMeter(stream: MediaStream) {
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new Ctx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const next: number[] = [];
        for (let i = 0; i < BAR_COUNT; i++) {
          const v = data[i % data.length] / 255;
          next.push(Math.max(0.08, v));
        }
        setLevels(next);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      void 0;
    }
  }

  function stopMeter() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    analyserRef.current = null;
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
    setLevels(new Array(BAR_COUNT).fill(0.1));
  }

  async function start() {
    if (disabled) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stopMeter();
        stream.getTracks().forEach((t) => t.stop());
        await transcribe();
      };
      recorderRef.current = recorder;
      recorder.start();
      startMeter(stream);
      setState("recording");
    } catch {
      onError(
        "Microphone access was denied. Allow mic permissions or type your question."
      );
    }
  }

  function stop() {
    if (recorderRef.current && state === "recording") {
      recorderRef.current.stop();
      setState("transcribing");
    }
  }

  async function transcribe() {
    try {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      if (blob.size === 0) {
        onError("No audio was captured. Please try again.");
        setState("idle");
        return;
      }
      const form = new FormData();
      form.append("audio", blob, "recording.webm");
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        onError(data.error ?? "Transcription failed.");
        setState("idle");
        return;
      }
      const text = (data.text ?? "").trim();
      if (!text) {
        onError("Could not hear a question. Please try again.");
        setState("idle");
        return;
      }
      onTranscript(text);
    } catch {
      onError("Transcription request failed.");
    } finally {
      setState("idle");
    }
  }

  const recording = state === "recording";
  const label =
    state === "recording"
      ? "Stop recording"
      : state === "transcribing"
      ? "Transcribing"
      : "Voice input";

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-900">{label}</p>
          <p className="mt-1 text-xs text-slate-500">
            {recording ? "Listening now" : "Optional microphone input"}
          </p>
        </div>
        <button
          onClick={recording ? stop : start}
          disabled={disabled || state === "transcribing"}
          aria-label={recording ? "Stop recording" : "Start recording"}
          className={`flex h-11 w-11 items-center justify-center rounded-lg border text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
            recording
              ? "border-red-200 bg-red-600 text-white"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
          }`}
        >
          {state === "transcribing" ? (
            <span className="h-4 w-4 animate-spin-slow rounded-full border-2 border-slate-300 border-t-slate-900" />
          ) : recording ? (
            <StopIcon />
          ) : (
            <MicIcon />
          )}
        </button>
      </div>

      {recording && (
        <div className="mt-4 flex h-8 items-end gap-1">
          {levels.map((lvl, i) => (
            <span
              key={i}
              className="w-1 rounded-full bg-slate-400"
              style={{ height: `${20 + lvl * 70}%`, opacity: 0.45 + lvl * 0.4 }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}
