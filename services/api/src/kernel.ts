import { CardReaderService, ShoeSimulatorAdapter } from "@live-dealr/card-reader";
import { TableControllerService } from "@live-dealr/table-controller";

const adapter = new ShoeSimulatorAdapter();
const cardReader = new CardReaderService(adapter);
export const tableController = new TableControllerService(cardReader);

export async function startTable(): Promise<void> {
  await tableController.boot();
}
