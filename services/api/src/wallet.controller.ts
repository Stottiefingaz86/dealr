import { BadRequestException, Body, Controller, Post } from "@nestjs/common";
import { DEFAULT_PLAYER_ID } from "@live-dealr/shared-types";
import { tableController } from "./kernel";

@Controller("wallet")
export class WalletController {
  @Post("deposit")
  deposit(@Body() body: { playerId?: string; amount: number; method?: string }) {
    try {
      return tableController.deposit(body.playerId ?? DEFAULT_PLAYER_ID, body.amount);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Deposit failed");
    }
  }

  @Post("withdraw")
  withdraw(@Body() body: { playerId?: string; amount: number }) {
    try {
      return tableController.withdraw(body.playerId ?? DEFAULT_PLAYER_ID, body.amount);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Withdraw failed");
    }
  }
}
