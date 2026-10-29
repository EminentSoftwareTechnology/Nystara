"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { buttonClass } from "@/components/ui";

const RATES = [1, 1.25, 1.5, 0.85];
const noop = () => () => undefined;

/** Splits text into sentence-sized pieces; some browsers stop long utterances part-way. */
export function speechChunks(text: string, max = 220): string[] {
  const sentences = text.replace(/\s+/g, " ").trim().match(/[^.!?]+[.!?]*\s*/g) ?? [];
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (current && (current + sentence).length > max) {
      chunks.push(current.trim());
      current = "";
    }
    if (sentence.length > max) {
      for (let i = 0; i < sentence.length; i += max) chunks.push(sentence.slice(i, i + max).trim());
      continue;
    }
    current += sentence;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(Boolean);
}

/** Reads the story aloud with the browser's own voices. Nothing is sent to a server. */
export default function ListenButton({ pro, targetId }: { pro: boolean; targetId: string }) {
  const supported = useSyncExternalStore(noop, () => "speechSynthesis" in window, () => false);
  const [state, setState] = useState<"idle" | "playing" | "paused">("idle");
  const [rate, setRate] = useState(1);
  const run = useRef(0);

  useEffect(() => () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  if (!supported) return null;
  if (!pro)
    return (
      <Link href="/pricing" className={buttonClass("secondary", "sm")}>
        Listen <span className="text-xs text-muted">· Pro</span>
      </Link>
    );

  function play() {
    const synth = window.speechSynthesis;
    synth.cancel();
    const text = document.getElementById(targetId)?.innerText ?? "";
    const chunks = speechChunks(text);
    if (!chunks.length) return;
    const id = ++run.current;
    chunks.forEach((chunk, index) => {
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.rate = rate;
      if (index === chunks.length - 1) utterance.onend = () => { if (run.current === id) setState("idle"); };
      synth.speak(utterance);
    });
    setState("playing");
  }

  function stop() {
    run.current++;
    window.speechSynthesis.cancel();
    setState("idle");
  }

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Listen to this story">
      {state === "idle" && (
        <button type="button" className={buttonClass("secondary", "sm")} onClick={play}>
          Listen
        </button>
      )}
      {state === "playing" && (
        <button type="button" className={buttonClass("secondary", "sm")} onClick={() => { window.speechSynthesis.pause(); setState("paused"); }}>
          Pause
        </button>
      )}
      {state === "paused" && (
        <button type="button" className={buttonClass("secondary", "sm")} onClick={() => { window.speechSynthesis.resume(); setState("playing"); }}>
          Resume
        </button>
      )}
      {state !== "idle" && (
        <button type="button" className={buttonClass("ghost", "sm")} onClick={stop}>
          Stop
        </button>
      )}
      <button
        type="button"
        disabled={state !== "idle"}
        className={buttonClass("ghost", "sm")}
        aria-label={`Reading speed ${rate}x. Change speed`}
        onClick={() => setRate(RATES[(RATES.indexOf(rate) + 1) % RATES.length])}
      >
        {rate}x
      </button>
    </div>
  );
}
