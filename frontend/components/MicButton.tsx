"use client";

import { useEffect, useRef, useState } from "react";

type RecState = "idle" | "recording" | "transcribing";

const BAR_COUNT = 24;

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

  const label =
    state === "recording"
      ? "Tap to stop"
      : state === "transcribing"
      ? "Transcribing…"
      : "Tap to speak";

  const recording = state === "recording";

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex h-28 w-28 items-center justify-center">
        {!recording && state !== "transcribing" && (
          <span className="absolute inset-0 rounded-full border border-dashed border-white/15 animate-[spin-slow_8s_linear_infinite]" />
        )}
        {recording && (
          <div className="absolute inset-0 flex items-center justify-center gap-[2px]">
            {levels.map((lvl, i) => (
              <span
                key={i}
                className="wave-bar"
                style={{
                  height: `${20 + lvl * 60}%`,
                  animationDelay: `${i * 0.04}s`,
                  opacity: 0.5 + lvl * 0.5,
                }}
              />
            ))}
          </div>
        )}

        <button
          onClick={recording ? stop : start}
          disabled={disabled || state === "transcribing"}
          aria-label={recording ? "Stop recording" : "Start recording"}
          className={`relative z-10 flex h-20 w-20 items-center justify-center rounded-full text-white transition-all duration-300 disabled:opacity-50 ${
            recording
              ? "recording-pulse scale-95 bg-gradient-to-br from-red-500 to-rose-600"
              : state === "transcribing"
              ? "bg-gradient-to-br from-indigo-500 to-cyan-500"
              : "mic-breathe bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-500 hover:scale-105"
          }`}
        >
          {state === "transcribing" ? (
            <span className="h-7 w-7 animate-spin-slow rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <MicIcon active={recording} />
          )}
        </button>
      </div>
      <span
        className={`text-sm font-medium tracking-wide transition-colors ${
          recording ? "text-rose-300" : "text-slate-400"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

function MicIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {active ? (
        <rect x="7" y="7" width="10" height="10" rx="2.5" fill="currentColor" />
      ) : (
        <>
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </>
      )}
    </svg>
  );
}
