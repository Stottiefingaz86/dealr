import { BadRequestException, Body, Controller, Post } from "@nestjs/common";
import type { Rank, Suit } from "@live-dealr/shared-types";
import { tableController } from "./kernel";

interface DetectCardBody {
  rank: Rank;
  suit: Suit;
}

@Controller("dev/shoe")
export class ShoeSimulatorController {
  @Post("detect")
  detect(@Body() body: DetectCardBody) {
    try {
      return tableController.detectCard(body.rank, body.suit);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Card rejected");
    }
  }
}
