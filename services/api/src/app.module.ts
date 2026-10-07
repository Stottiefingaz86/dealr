import { Module } from "@nestjs/common";
import { WebsocketModule } from "@live-dealr/websocket";
import { DealerVoiceController } from "./dealer-voice.controller";
import { HealthController } from "./health.controller";
import { LayoutController } from "./layout.controller";
import { MediaController } from "./media.controller";
import { ShoeSimulatorController } from "./shoe-simulator.controller";
import { TablesController } from "./tables.controller";
import { WalletController } from "./wallet.controller";

@Module({
  imports: [WebsocketModule],
  controllers: [
    HealthController,
    TablesController,
    LayoutController,
    MediaController,
    ShoeSimulatorController,
    WalletController,
    DealerVoiceController,
  ],
})
export class AppModule {}
