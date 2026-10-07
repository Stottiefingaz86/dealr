export interface TableSpot {
  x: number;
  y: number;
}

/** Overlays aligned to the physical camera / felt. Edited in Admin → Table studio. */
export interface TableLayout {
  /** Dealer hand total badge — sit over where dealer cards land */
  dealer: TableSpot;
  /** Seat count badges (1–5). Seat 1 is the local player by default. */
  seats: [TableSpot, TableSpot, TableSpot, TableSpot, TableSpot];
  /** Main bet pad center */
  bet: TableSpot;
}

export const DEFAULT_TABLE_LAYOUT: TableLayout = {
  /** Dealer cards land on the far edge of the virtual table */
  dealer: { x: 50, y: 61 },
  /**
   * Seats arc along the near edge of the virtual table (lower ~45% of screen).
   * Seat 1 = local (center). Admin can drag these later.
   */
  seats: [
    { x: 50, y: 81 },
    { x: 30, y: 75 },
    { x: 70, y: 75 },
    { x: 13, y: 67 },
    { x: 87, y: 67 },
  ],
  bet: { x: 50, y: 81 },
};

export type LayoutSpotId = "dealer" | "bet" | `seat-${1 | 2 | 3 | 4 | 5}`;

export function clampSpot(spot: TableSpot): TableSpot {
  return {
    x: Math.min(94, Math.max(6, spot.x)),
    y: Math.min(94, Math.max(6, spot.y)),
  };
}

export function getSeat(layout: TableLayout, seat: 1 | 2 | 3 | 4 | 5): TableSpot {
  return layout.seats[seat - 1];
}

export function setLayoutSpot(
  layout: TableLayout,
  id: LayoutSpotId,
  spot: Partial<TableSpot>,
): TableLayout {
  if (id === "dealer") {
    return { ...layout, dealer: clampSpot({ ...layout.dealer, ...spot }) };
  }
  if (id === "bet") {
    return { ...layout, bet: clampSpot({ ...layout.bet, ...spot }) };
  }
  const index = Number(id.split("-")[1]) - 1;
  const seats = [...layout.seats] as TableLayout["seats"];
  seats[index] = clampSpot({ ...seats[index], ...spot });
  return { ...layout, seats };
}

export function normalizeTableLayout(input?: Partial<TableLayout> | null): TableLayout {
  const base = DEFAULT_TABLE_LAYOUT;
  const seats = (input?.seats ?? base.seats).map((spot, index) =>
    clampSpot(spot ?? base.seats[index]),
  ) as TableLayout["seats"];
  return {
    dealer: clampSpot(input?.dealer ?? base.dealer),
    bet: clampSpot(input?.bet ?? base.bet),
    seats,
  };
}
