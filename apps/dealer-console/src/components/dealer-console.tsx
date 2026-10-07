"use client";

import { useState } from "react";
import { formatEventForInspector } from "@live-dealr/physical-game-events";
import { RANKS, SUITS, SUIT_SYMBOL, type Suit } from "@live-dealr/shared-types";
import { PlayingCard } from "@live-dealr/ui/game/playing-card";
import { Button } from "@live-dealr/ui/components/button";
import { closeBetting, detectCard, endLive, goLive } from "@/lib/api";
import { useDealerStore } from "@/lib/store";
import { useDealerSocket } from "@/lib/use-table-socket";

export function DealerConsole() {
  useDealerSocket();
  const state = useDealerStore((s) => s.state);
  const events = useDealerStore((s) => s.events);
  const connected = useDealerStore((s) => s.connected);
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const player = state?.players[0];
  const playerHand = player?.hands[0];

  async function toggleLive() {
    setBusy(true);
    try {
      if (live) {
        await endLive();
        setLive(false);
      } else {
        await goLive(process.env.NEXT_PUBLIC_DEALER_STREAM_URL || null);
        setLive(true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh bg-[#07070a] px-6 py-5 text-foreground">
      <header className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] tracking-[0.3em] text-primary uppercase">Live Dealr</p>
          <h1 className="font-display text-4xl">Table {state?.table.id ?? "BJ-001"}</h1>
        </div>
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <Status label="Shoe" value={state?.shoe.status ?? "—"} />
          <Status label="Round" value={state?.table.phase ?? "—"} />
          <Status label="Link" value={connected ? "on" : "off"} />
          <Button onClick={() => void toggleLive()} disabled={busy} variant={live ? "outline" : "default"}>
            {live ? "End live" : "Go live"}
          </Button>
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="flex min-h-[420px] flex-col rounded-[28px] border border-white/8 bg-[#101017] p-8">
          <p className="text-[11px] tracking-[0.28em] text-muted-foreground uppercase">Current player action</p>
          <p className="mt-6 font-display text-[clamp(4rem,12vw,9rem)] leading-[0.85] tracking-wide text-primary">
            {state?.dealerInstruction.label ?? "WAITING"}
          </p>
          <div className="mt-auto grid gap-8 pt-10 md:grid-cols-2">
            <HandBlock
              title="Dealer"
              total={state?.dealer.hand.cards.some((c) => !c.hidden) ? state.dealer.hand.total : undefined}
              cards={state?.dealer.hand.cards ?? []}
            />
            <HandBlock
              title="Player"
              total={playerHand?.total}
              cards={playerHand?.cards ?? []}
            />
          </div>
          <div className="mt-8">
            <p className="text-sm text-muted-foreground">
              Bet ${player?.currentBet ?? 0} · {player?.chipStack?.length ?? 0} chips
            </p>
            <Button
              variant="outline"
              onClick={() => void closeBetting()}
              disabled={state?.table.phase !== "betting"}
            >
              Close bets
            </Button>
          </div>
        </section>

        <div className="flex flex-col gap-5">
          <ShoeSimulator
            disabled={
              !state ||
              state.table.paused ||
              (state.table.phase !== "dealing" && state.table.phase !== "dealer_action")
            }
          />
          <EventInspector events={events} />
        </div>
      </div>
    </main>
  );
}

function Status({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] tracking-[0.22em] uppercase">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

function HandBlock({
  title,
  total,
  cards,
}: {
  title: string;
  total?: number;
  cards: Parameters<typeof PlayingCard>[0]["card"][];
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm tracking-[0.2em] uppercase">{title}</h2>
        <span className="font-display text-3xl">{total ?? ""}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {cards.map((card) => (
          <PlayingCard key={card.id} card={card} size="sm" />
        ))}
      </div>
    </div>
  );
}

function ShoeSimulator({ disabled }: { disabled: boolean }) {
  return (
    <section className="rounded-[28px] border border-white/8 bg-[#101017] p-5">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-[11px] tracking-[0.28em] text-primary uppercase">Shoe simulator</p>
          <p className="text-sm text-muted-foreground">Emits CARD_DETECTED. Does not write UI state.</p>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {SUITS.map((suit) =>
          RANKS.map((rank) => (
            <button
              key={`${rank}-${suit}`}
              disabled={disabled}
              className="h-11 rounded-xl border border-white/10 bg-white/5 text-sm disabled:opacity-30"
              onClick={() => void detectCard(rank, suit)}
            >
              {rank}
              {SUIT_SYMBOL[suit as Suit]}
            </button>
          )),
        )}
      </div>
    </section>
  );
}

function EventInspector({ events }: { events: ReturnType<typeof useDealerStore.getState>["events"] }) {
  return (
    <section className="flex max-h-[420px] flex-col rounded-[28px] border border-white/8 bg-[#101017] p-5">
      <p className="mb-3 text-[11px] tracking-[0.28em] text-primary uppercase">Event inspector</p>
      <ol className="flex flex-col gap-1 overflow-auto font-mono text-xs leading-6 text-muted-foreground">
        {events.map((event) => (
          <li key={event.id}>{formatEventForInspector(event)}</li>
        ))}
      </ol>
    </section>
  );
}
