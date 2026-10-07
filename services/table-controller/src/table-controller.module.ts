import { Global, Module } from "@nestjs/common";
import { CardReaderModule } from "@live-dealr/card-reader";
import { TableControllerService } from "./table-controller.service";

@Global()
@Module({
  imports: [CardReaderModule],
  providers: [TableControllerService],
  exports: [TableControllerService],
})
export class TableControllerModule {}
