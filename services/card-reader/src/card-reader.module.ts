import { Global, Module } from "@nestjs/common";
import { CARD_READER_PORT } from "./card-reader.port";
import { CardReaderService } from "./card-reader.service";
import { ShoeSimulatorAdapter } from "./shoe-simulator.adapter";

@Global()
@Module({
  providers: [
    ShoeSimulatorAdapter,
    {
      provide: CARD_READER_PORT,
      useExisting: ShoeSimulatorAdapter,
    },
    CardReaderService,
  ],
  exports: [CardReaderService, CARD_READER_PORT, ShoeSimulatorAdapter],
})
export class CardReaderModule {}
