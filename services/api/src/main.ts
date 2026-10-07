import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { bindTableGateway } from "@live-dealr/websocket";
import { AppModule } from "./app.module";
import { startTable, tableController } from "./kernel";

async function bootstrap() {
  await startTable();
  bindTableGateway(tableController);
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true, credentials: true });
  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  console.log(`Live Dealr API listening on http://localhost:${port}`);
}

void bootstrap();
