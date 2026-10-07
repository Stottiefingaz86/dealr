import { BadRequestException, Body, Controller, Get, Param, Post } from "@nestjs/common";
import { DEFAULT_PLAYER_ID, type PlayerActionType } from "@live-dealr/shared-types";
import { tableController } from "./kernel";

@Controller("tables")
export class TablesController {
  @Get(":tableId")
  getTable(@Param("tableId") _tableId: string) {
    return tableController.getState();
  }

  @Get(":tableId/events")
  getEvents(@Param("tableId") _tableId: string) {
    return tableController.getEvents();
  }

  @Post(":tableId/chips")
  addChip(@Body() body: { playerId?: string; value: number }) {
    try {
      return tableController.addChip(body.playerId ?? DEFAULT_PLAYER_ID, body.value);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Unable to bet");
    }
  }

  @Post(":tableId/bets/clear")
  clearBet(@Body() body: { playerId?: string }) {
    try {
      return tableController.clearBet(body.playerId ?? DEFAULT_PLAYER_ID);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Unable to clear");
    }
  }

  @Post(":tableId/betting/close")
  closeBetting() {
    return tableController.closeBetting();
  }

  @Post(":tableId/actions")
  action(@Body() body: { playerId?: string; action: PlayerActionType }) {
    try {
      return tableController.placeAction(body.playerId ?? DEFAULT_PLAYER_ID, body.action);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Action rejected");
    }
  }
}
