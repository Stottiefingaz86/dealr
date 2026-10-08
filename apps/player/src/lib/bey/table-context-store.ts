/**
 * Latest table snapshot per session — written by the player client,
 * readable by the dealer-agent worker.
 */

export type BeyTableSnapshot = {
  updatedAt: string;
  phase?: string;
  actingSeat?: number | null;
  actingName?: string | null;
  dealerTotal?: string | null;
  dealerCards?: string[];
  /** Seconds left on betting clock (null if not betting). */
  bettingRemaining?: number | null;
  /** Seconds left on current actor's clock. */
  actionRemaining?: number | null;
  localSeat?: number | null;
  localName?: string | null;
  seats: Array<{
    seat: number;
    name: string | null;
    isLocal?: boolean;
    bet?: number;
    cards?: string[];
    total?: string | null;
  }>;
  recentChat: Array<{ name: string; text: string; kind?: string }>;
  /** Structured beats — facts only (throws, wins, tips…). */
  beats?: Array<{
    id: string;
    kind: string;
    name?: string;
    /** Multiple names for table-wide outcomes (e.g. everyone won). */
    names?: string[];
    emoji?: string;
    amount?: number;
    /** Optional hand context at the moment of the beat. */
    hand?: string;
    total?: string;
  }>;
  summary: string;
};

const store = new Map<string, BeyTableSnapshot>();

export function putTableSnapshot(sessionId: string, snap: BeyTableSnapshot) {
  store.set(sessionId, snap);
}

export function getTableSnapshot(sessionId: string): BeyTableSnapshot | null {
  return store.get(sessionId) ?? null;
}

export function formatSnapshotForPrompt(snap: BeyTableSnapshot): string {
  return snap.summary;
}
