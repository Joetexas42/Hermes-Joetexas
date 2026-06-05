"use client";

import { Mic } from "lucide-react";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";

/** Push-to-talk dictation button. Calls `onTranscript` with each finalized chunk. */
export function MicButton({
  onTranscript,
  size = 36,
}: {
  onTranscript: (text: string) => void;
  size?: number;
}) {
  const speech = useSpeechRecognition(onTranscript);
  return (
    <button
      type="button"
      onClick={speech.toggle}
      disabled={!speech.supported}
      title={
        !speech.supported
          ? "Voice input needs Chrome, Edge, or Safari"
          : speech.listening
            ? "Stop dictation"
            : "Click to talk"
      }
      style={{ height: size, width: size }}
      className={`relative grid shrink-0 place-items-center rounded-full border transition-colors disabled:opacity-30 ${
        speech.listening
          ? "border-red-500/40 bg-red-500/20 text-red-400"
          : "border-[var(--border-strong)] text-[var(--faint)] hover:text-fg"
      }`}
    >
      {speech.listening && (
        <span className="absolute inset-0 animate-ping rounded-full bg-red-500/25" />
      )}
      <Mic className="h-[18px] w-[18px]" />
    </button>
  );
}
