import type { Rank, Suit } from "@live-dealr/shared-types";
import type { CardDetectionHandler, CardReaderPort, PhysicalCardDetection } from "./card-reader.port";

export class ShoeSimulatorAdapter implements CardReaderPort {
  readonly adapterKind = "simulator" as const;
  readonly deviceId = "shoe-sim-dev-001";

  private tableId: string | null = null;
  private shoeId: string | null = null;
  private readonly handlers = new Set<CardDetectionHandler>();

  async connect(tableId: string, shoeId: string): Promise<void> {
    this.tableId = tableId;
    this.shoeId = shoeId;
  }

  async disconnect(): Promise<void> {
    this.tableId = null;
    this.shoeId = null;
  }

  onDetection(handler: CardDetectionHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  injectPhysicalCard(rank: Rank, suit: Suit): PhysicalCardDetection {
    if (!this.tableId || !this.shoeId) {
      throw new Error("Shoe simulator is not connected to a table");
    }

    const detection: PhysicalCardDetection = {
      tableId: this.tableId,
      shoeId: this.shoeId,
      rank,
      suit,
      detectedAt: new Date().toISOString(),
      deviceId: this.deviceId,
    };

    for (const handler of this.handlers) {
      handler(detection);
    }

    return detection;
  }
}
