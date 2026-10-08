"use client";

import { useEffect, useRef } from "react";
import { ChevronLeft } from "lucide-react";
import type { ChatMessage } from "@live-dealr/realtime";
import { cn } from "@live-dealr/ui/lib/utils";
import { ChatComposer } from "@/components/chat-composer";
import { DockOrDrawer } from "@/components/dock-or-drawer";
import { useDrawerDirection } from "@/hooks/use-mobile";

export function ChatDrawer({
  open,
  onOpenChange,
  messages,
  onSend,
  dealerId,
  onDealerTap,
  docked = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: ChatMessage[];
  onSend: (text: string) => void;
  dealerId?: string;
  onDealerTap?: () => void;
  docked?: boolean;
}) {
  const direction = useDrawerDirection();
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const node = scrollerRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, open]);

  return (
    <DockOrDrawer
      open={open}
      onOpenChange={onOpenChange}
      docked={docked}
      direction={direction}
      overlayClassName={cn(
        "border-white/8 bg-[#121218]/96 shadow-[0_-12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl",
        direction === "bottom"
          ? "inset-x-0 bottom-0 h-[min(42dvh,22rem)] max-h-[42dvh] rounded-t-[14px]"
          : "inset-y-0 right-0 h-full w-full max-w-sm border-l",
      )}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-white/8 px-4 py-3">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="-ml-1 flex size-9 items-center justify-center rounded-full hover:bg-white/8"
          aria-label="Close"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div>
          <h2 className="text-base font-semibold">Chat</h2>
          <p className="text-[11px] text-white/40">Table room</p>
        </div>
      </header>

      <div
        ref={scrollerRef}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4"
        data-drawer-persist
      >
        {messages.length === 0 ? (
          <p className="text-sm text-white/40">No messages yet. Say hi to the table.</p>
        ) : (
          messages.map((message) => {
            const fromDealer =
              Boolean(dealerId && message.senderId === dealerId) || message.kind === "system";
            if (fromDealer && onDealerTap) {
              return (
                <button
                  key={message.id}
                  type="button"
                  onClick={onDealerTap}
                  className={cn(
                    "block w-fit max-w-[92%] rounded-2xl px-3 py-2 text-left text-[13px] transition hover:brightness-125",
                    bubbleClass(message),
                  )}
                >
                  <span className="mr-1 inline-block size-1.5 -translate-y-px rounded-full bg-[#f0c43a]" />
                  <span className="font-semibold text-[#f0c43a]">{message.senderName}</span>
                  <span className="text-white/85"> {message.text}</span>
                  <span className="mt-1 block text-[11px] text-[#f0c43a]/80">View profile →</span>
                </button>
              );
            }
            return (
              <div
                key={message.id}
                className={cn(
                  "w-fit max-w-[92%] rounded-2xl px-3 py-2 text-[13px]",
                  bubbleClass(message),
                )}
              >
                {fromDealer ? (
                  <span className="mr-1 inline-block size-1.5 -translate-y-px rounded-full bg-[#f0c43a]" />
                ) : null}
                <span className={cn("font-semibold", fromDealer && "text-[#f0c43a]")}>
                  {message.senderName}
                </span>
                <span className="text-white/85"> {message.text}</span>
              </div>
            );
          })
        )}
      </div>

      <div className="shrink-0 border-t border-white/8 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <ChatComposer onSend={onSend} />
      </div>
    </DockOrDrawer>
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
    return "border border-[#f0c43a]/35 bg-[#1c170a]";
  }
  return "bg-[#2f6dff]/90 text-white";
}
