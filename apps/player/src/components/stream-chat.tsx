"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ChatMessage } from "@live-dealr/realtime";

/** How long a bubble stays on screen before fading out. */
const LINGER_MS = 10000;
const MAX_VISIBLE = 5;

/**
 * Ephemeral stream overlay: new messages slide in top-left and fade out after
 * a few seconds, so the table never ends up under a wall of chat. The full
 * history lives in the side drawer.
 */
export function StreamChat({
  messages,
  dealerId,
  onDealerTap,
}: {
  messages: ChatMessage[];
  dealerId?: string;
  onDealerTap?: () => void;
}) {
  // When each message first appeared on *this* client (history is never shown).
  const appeared = useRef<Map<string, number>>(new Map());
  const primed = useRef(false);
  const [, tick] = useState(0);

  useEffect(() => {
    const now = Date.now();
    if (!primed.current) {
      // First batch is history — mark it as already expired.
      for (const m of messages) appeared.current.set(m.id, 0);
      primed.current = true;
      return;
    }
    for (const m of messages) {
      if (!appeared.current.has(m.id)) {
        appeared.current.set(m.id, now);
      }
    }
  }, [messages]);

  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 500);
    return () => window.clearInterval(id);
  }, []);

  const now = Date.now();
  const visible = messages
    .filter((m) => {
      const at = appeared.current.get(m.id);
      return at !== undefined && now - at < LINGER_MS;
    })
    .slice(-MAX_VISIBLE);

  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-[4.4rem] z-20 flex max-w-[70%] flex-col justify-end gap-1.5 sm:top-24 sm:bottom-auto sm:justify-start">
      <AnimatePresence initial={false}>
        {visible.map((message) => (
          <motion.div
            key={message.id}
            layout
            initial={{ x: -28, opacity: 0, filter: "blur(6px)" }}
            animate={{ x: 0, opacity: 1, filter: "blur(0px)" }}
            exit={{ x: -12, opacity: 0, transition: { duration: 0.45, ease: "easeOut" } }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className={`w-fit max-w-full rounded-full px-3 py-1.5 text-[13px] shadow-[0_8px_24px_rgba(0,0,0,0.35)] ${bubbleClass(message)} ${
              dealerId && message.senderId === dealerId && onDealerTap
                ? "pointer-events-auto cursor-pointer hover:brightness-110"
                : ""
            }`}
            onClick={dealerId && message.senderId === dealerId ? onDealerTap : undefined}
          >
            {dealerId && message.senderId === dealerId ? (
              <span className="mr-1 inline-block size-1.5 -translate-y-px rounded-full bg-[#f0c43a]" />
            ) : null}
            <span className="font-semibold">{message.senderName}</span>
            <span className="text-white/85"> {message.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function bubbleClass(message: ChatMessage): string {
  if (message.kind === "follow") {
    return "bg-[#6d4aff]/90 text-white";
  }
  if (message.kind === "tip") {
    return "bg-[#ee3536]/90 text-white";
  }
  if (message.kind === "system") {
    return "border border-[#f0c43a]/40 bg-[#1c170a]/85 text-white backdrop-blur-md";
  }
  return "bg-black/55 text-white backdrop-blur-md";
}
