import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Res,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { Response } from "express";
import { DealerVoiceService } from "./dealer-voice.service";

const voice = new DealerVoiceService();

@Controller("dealer")
export class DealerVoiceController {
  @Get("voice")
  status() {
    return { enabled: voice.enabled(), model: "flux-hannah-en" };
  }

  @Post("speak")
  @HttpCode(200)
  @Header("Cache-Control", "public, max-age=86400")
  async speak(@Body() body: { text?: string }, @Res() res: Response) {
    const text = typeof body?.text === "string" ? body.text : "";
    if (!text.trim()) {
      throw new ServiceUnavailableException("text is required");
    }
    const audio = await voice.synthesize(text);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", String(audio.length));
    res.send(audio);
  }
}
