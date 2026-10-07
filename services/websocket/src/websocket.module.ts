import { Module } from "@nestjs/common";
import { TableGateway } from "./table.gateway";

@Module({
  providers: [TableGateway],
  exports: [TableGateway],
})
export class WebsocketModule {}
