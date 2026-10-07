"use client";

import { useState } from "react";

export function ChatComposer({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState("");

  return (
    <form
      className="flex h-11 items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 backdrop-blur-md"
      onSubmit={(event) => {
        event.preventDefault();
        const next = text.trim();
        if (!next) {
          return;
        }
        onSend(next);
        setText("");
      }}
    >
      <input
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Say something…"
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/35"
        maxLength={160}
      />
      <button className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">Send</button>
    </form>
  );
}
