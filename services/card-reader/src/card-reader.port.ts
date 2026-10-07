import type { Rank, Suit } from "@live-dealr/shared-types";

export const CARD_READER_PORT = Symbol("CARD_READER_PORT");

export interface PhysicalCardDetection {
  tableId: string;
  shoeId: string;
  rank: Rank;
  suit: Suit;
  detectedAt: string;
  deviceId: string;
}

export type CardDetectionHandler = (detection: PhysicalCardDetection) => void;

export interface CardReaderPort {
  readonly adapterKind: "simulator" | "physical";
  readonly deviceId: string;
  connect(tableId: string, shoeId: string): Promise<void>;
  disconnect(): Promise<void>;
  onDetection(handler: CardDetectionHandler): () => void;
}
