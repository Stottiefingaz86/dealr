import type { Rank, Suit } from "@live-dealr/shared-types";
import { ShoeSimulatorAdapter } from "./shoe-simulator.adapter";

export class CardReaderService {
  constructor(private readonly port: ShoeSimulatorAdapter) {}

  get adapterKind(): "simulator" | "physical" {
    return this.port.adapterKind;
  }

  get deviceId(): string {
    return this.port.deviceId;
  }

  connect(tableId: string, shoeId: string): Promise<void> {
    return this.port.connect(tableId, shoeId);
  }

  injectSimulatedCard(rank: Rank, suit: Suit) {
    return this.port.injectPhysicalCard(rank, suit);
  }

  onDetection(handler: Parameters<ShoeSimulatorAdapter["onDetection"]>[0]) {
    return this.port.onDetection(handler);
  }
}
