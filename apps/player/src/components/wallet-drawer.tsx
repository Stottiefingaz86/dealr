"use client";

import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { DEFAULT_PLAYER_ID } from "@live-dealr/shared-types";
import { cn } from "@live-dealr/ui/lib/utils";
import { Drawer, DrawerContent, DrawerHandle } from "@/components/ui/drawer";
import { useDrawerDirection } from "@/hooks/use-mobile";
import { resolveApiUrl } from "@/lib/api";
import { formatMoney } from "@/lib/chips";

const AMOUNTS = [25, 50, 100, 250, 500, 1000];

export function WalletDrawer({
  open,
  onOpenChange,
  balance,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balance: number;
}) {
  const direction = useDrawerDirection();
  const [action, setAction] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState(100);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setMessage(null);
    try {
      const api = resolveApiUrl();
      if (!api) {
        setMessage("Wallet API isn’t available on this table.");
        return;
      }
      const path = action === "deposit" ? "/wallet/deposit" : "/wallet/withdraw";
      const response = await fetch(`${api}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: DEFAULT_PLAYER_ID, amount }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setMessage(action === "deposit" ? "Credits added." : "Withdrawal requested.");
    } catch {
      setMessage("Could not complete that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction={direction}
      shouldScaleBackground={false}
      dismissible={false}
    >
      <DrawerContent
        className={cn(
          "border-white/10 bg-[#0e0e12]",
          direction === "bottom"
            ? "inset-x-0 bottom-0 h-[70dvh] max-h-[70dvh] rounded-t-2xl"
            : "inset-y-0 right-0 h-full w-full max-w-xs border-l",
        )}
      >
        {direction === "bottom" ? <DrawerHandle /> : null}

        <header className="flex shrink-0 items-center gap-2 px-4 py-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="-ml-1 flex size-8 items-center justify-center rounded-full text-white/80 hover:bg-white/8"
            aria-label="Close"
          >
            <ChevronLeft className="size-5" strokeWidth={1.5} />
          </button>
          <h2 className="text-sm font-medium tracking-wide">Balance</h2>
          <p className="ml-auto text-sm tabular-nums text-primary">${formatMoney(balance)}</p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex gap-1 rounded-full bg-white/5 p-1">
            {(
              [
                ["deposit", "Add"],
                ["withdraw", "Cash out"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setAction(id);
                  setMessage(null);
                }}
                className={cn(
                  "h-9 flex-1 rounded-full text-xs font-medium transition",
                  action === id ? "bg-white text-black" : "text-white/55 hover:text-white/80",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <p className="mt-6 text-[11px] tracking-[0.22em] text-white/40 uppercase">Amount</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {AMOUNTS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setAmount(value)}
                className={cn(
                  "h-11 rounded-full text-sm tabular-nums transition",
                  amount === value
                    ? "bg-primary text-primary-foreground"
                    : "bg-white/5 text-white/80 hover:bg-white/8",
                )}
              >
                ${value}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={busy || (action === "withdraw" && amount > balance)}
            onClick={() => void submit()}
            className="mt-6 h-12 w-full rounded-full bg-white text-sm font-semibold text-black disabled:opacity-35"
          >
            {busy
              ? "…"
              : action === "deposit"
                ? `Add $${formatMoney(amount)}`
                : `Cash out $${formatMoney(amount)}`}
          </button>

          {message ? <p className="mt-4 text-center text-sm text-white/50">{message}</p> : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
