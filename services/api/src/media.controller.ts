import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { tableMedia } from "@live-dealr/media";

@Controller("tables")
export class MediaController {
  @Get(":tableId/media")
  getMedia(@Param("tableId") tableId: string) {
    return tableMedia.getSession(tableId);
  }

  @Post(":tableId/media/go-live")
  goLive(
    @Param("tableId") tableId: string,
    @Body() body: { playbackUrl?: string | null },
  ) {
    return tableMedia.goLive({ tableId, playbackUrl: body?.playbackUrl });
  }

  @Post(":tableId/media/end")
  endLive(@Param("tableId") tableId: string) {
    return tableMedia.endLive(tableId);
  }
}
