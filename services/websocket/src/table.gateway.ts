import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { tableMedia } from "@live-dealr/media";
import {
  ClientEvents,
  ServerEvents,
  SOCKET_PATH,
  type AddChipPayload,
  type DealerGoLivePayload,
  type JoinTablePayload,
  type PlayerActionPayload,
  type PlaceBetPayload,
  type SendChatPayload,
  type SendReactionPayload,
  type ReactionMessage,
  type StartRoundPayload,
  type TipDealerPayload,
  type ClaimRewardPayload,
} from "@live-dealr/realtime";
import { DEFAULT_PLAYER_ID, DEFAULT_TABLE_ID } from "@live-dealr/shared-types";
import type { TableControllerService } from "@live-dealr/table-controller";
import { ChatRoom } from "./chat-room";
import { BotCrowd, type CrowdReaction } from "./bot-crowd";

let tables: TableControllerService | null = null;

export function bindTableGateway(service: TableControllerService): void {
  tables = service;
}

function requireTables(): TableControllerService {
  if (!tables) {
    throw new Error("Table controller is not bound to the gateway");
  }
  return tables;
}

@WebSocketGateway({
  path: SOCKET_PATH,
  cors: { origin: true, credentials: true },
})
export class TableGateway implements OnGatewayInit {
  @WebSocketServer()
  server!: Server;

  private readonly chat = new ChatRoom();
  private readonly crowd = new BotCrowd({
    say: (bot, text) => {
      this.broadcastChat({
        tableId: DEFAULT_TABLE_ID,
        senderId: bot.id,
        senderName: bot.displayName,
        text,
        kind: "chat",
      });
    },
    react: (reaction) => this.broadcastReaction(DEFAULT_TABLE_ID, reaction),
    dealerPost: (text) => {
      const dealer = requireTables().getState().dealer;
      this.broadcastChat({
        tableId: DEFAULT_TABLE_ID,
        senderId: dealer.id,
        senderName: dealer.profile.displayName.split(" ")[0] ?? dealer.profile.displayName,
        text,
        kind: "system",
      });
    },
  });

  afterInit(): void {
    const host = requireTables();
    host.subscribe((event, state) => {
      const tableRoom = `table:${state.table.id}`;
      this.server.to(tableRoom).emit(ServerEvents.tableEvent, { event });
      this.server.to(tableRoom).emit(ServerEvents.tableState, { state });
      this.crowd.observe(event, state);
    });
    this.crowd.start(host.getState());
    tableMedia.subscribe((session) => {
      this.server.to(`table:${session.tableId}`).emit(ServerEvents.mediaState, session);
    });
  }

  @SubscribeMessage(ClientEvents.joinTable)
  handleJoin(@ConnectedSocket() client: Socket, @MessageBody() body: JoinTablePayload) {
    const room = `table:${body.tableId}`;
    void client.join(room);
    if (body.displayName?.trim()) {
      requireTables().setLocalProfile(body.displayName, body.avatarUrl ?? null);
    }
    client.emit(ServerEvents.tableState, { state: requireTables().getState() });
    client.emit(ServerEvents.tableEvents, { events: requireTables().getEvents() });
    client.emit(ServerEvents.chatHistory, { messages: this.chat.list() });
    client.emit(ServerEvents.mediaState, tableMedia.getSession(body.tableId));
    return { ok: true };
  }

  @SubscribeMessage(ClientEvents.dealerGoLive)
  handleGoLive(@MessageBody() body: DealerGoLivePayload) {
    const session = tableMedia.goLive({
      tableId: body.tableId,
      playbackUrl: body.playbackUrl,
    });
    this.server.to(`table:${session.tableId}`).emit(ServerEvents.mediaState, session);
    return session;
  }

  @SubscribeMessage(ClientEvents.dealerEndLive)
  handleEndLive(@MessageBody() body: { tableId: string }) {
    const session = tableMedia.endLive(body.tableId);
    this.server.to(`table:${session.tableId}`).emit(ServerEvents.mediaState, session);
    return session;
  }

  @SubscribeMessage(ClientEvents.startRound)
  handleStart(@MessageBody() body: StartRoundPayload) {
    try {
      requireTables().closeBetting();
      return { ok: true, tableId: body.tableId };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Unable to start" };
    }
  }

  @SubscribeMessage(ClientEvents.addChip)
  handleChip(@MessageBody() body: AddChipPayload) {
    try {
      requireTables().addChip(body.playerId, body.value);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Unable to bet" };
    }
  }

  @SubscribeMessage(ClientEvents.clearBet)
  handleClear(@MessageBody() body: { playerId: string }) {
    try {
      requireTables().clearBet(body.playerId);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Unable to clear" };
    }
  }

  @SubscribeMessage(ClientEvents.closeBetting)
  handleCloseBetting() {
    requireTables().closeBetting();
    return { ok: true };
  }

  @SubscribeMessage(ClientEvents.placeBet)
  handleBet(@MessageBody() body: PlaceBetPayload) {
    try {
      requireTables().addChip(body.playerId, body.amount);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Unable to bet" };
    }
  }

  @SubscribeMessage(ClientEvents.playerAction)
  handleAction(@MessageBody() body: PlayerActionPayload) {
    try {
      requireTables().placeAction(body.playerId, body.action);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Action rejected" };
    }
  }

  @SubscribeMessage(ClientEvents.followDealer)
  handleFollow(@MessageBody() body: { playerId?: string; follow: boolean }) {
    const playerId = body.playerId ?? DEFAULT_PLAYER_ID;
    const host = requireTables();
    const status = body.follow ? host.followDealer(playerId) : host.unfollowDealer(playerId);
    this.server.to(`table:${host.getState().table.id}`).emit("dealer:follow-state", status);
    if (body.follow) {
      this.broadcastChat({
        tableId: DEFAULT_TABLE_ID,
        senderId: playerId,
        senderName: "You",
        text: "followed Isla",
        kind: "follow",
      });
    }
    return status;
  }

  @SubscribeMessage(ClientEvents.tipDealer)
  handleTip(@MessageBody() body: TipDealerPayload) {
    try {
      const host = requireTables();
      const amount = host.tipDealer(body.playerId ?? DEFAULT_PLAYER_ID, body.amount);
      const player = host.getState().players.find((p) => p.id === body.playerId);
      this.broadcastChat({
        tableId: body.tableId ?? DEFAULT_TABLE_ID,
        senderId: body.playerId,
        senderName: player?.displayName ?? "You",
        text: `tipped ${host.getState().dealer.profile.displayName} $${amount}`,
        kind: "tip",
      });
      return { ok: true, amount };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Tip failed" };
    }
  }

  @SubscribeMessage(ClientEvents.claimReward)
  handleClaimReward(@MessageBody() body: ClaimRewardPayload) {
    try {
      const host = requireTables();
      const playerId = body.playerId ?? DEFAULT_PLAYER_ID;
      const amount = Math.max(0, Math.round(body.amount ?? 0));
      if (amount > 0) {
        host.deposit(playerId, amount);
      }
      const player = host.getState().players.find((p) => p.id === playerId);
      this.broadcastChat({
        tableId: body.tableId ?? DEFAULT_TABLE_ID,
        senderId: playerId,
        senderName: player?.displayName ?? "You",
        text:
          amount > 0
            ? `completed "${body.missionTitle}" · $${amount} cashback`
            : `completed "${body.missionTitle}" · unlocked ${body.unlockLabel ?? "a reward"}`,
        kind: "tip",
      });
      return { ok: true, amount };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Claim failed" };
    }
  }

  @SubscribeMessage(ClientEvents.sendReaction)
  handleReaction(@MessageBody() body: SendReactionPayload) {
    const player = requireTables()
      .getState()
      .players.find((p) => p.id === body.senderId);
    this.broadcastReaction(body.tableId ?? DEFAULT_TABLE_ID, {
      senderId: body.senderId,
      senderName: player?.displayName ?? "You",
      kind: body.kind,
      emoji: String(body.emoji).slice(0, 8),
      fromSeat: player?.seat ?? 1,
      toSeat: body.kind === "throw" ? (body.toSeat ?? null) : null,
    });
    return { ok: true };
  }

  private broadcastReaction(tableId: string, reaction: CrowdReaction) {
    const message: ReactionMessage = {
      id: crypto.randomUUID(),
      tableId,
      ...reaction,
      timestamp: new Date().toISOString(),
    };
    this.server.to(`table:${tableId}`).emit(ServerEvents.reaction, { reaction: message });
  }

  @SubscribeMessage(ClientEvents.sendChat)
  handleChat(@MessageBody() body: SendChatPayload) {
    this.broadcastChat({
      tableId: body.tableId,
      senderId: body.senderId,
      senderName: body.senderName,
      text: body.text,
      kind: "chat",
    });
    return { ok: true };
  }

  private broadcastChat(input: {
    tableId: string;
    senderId: string;
    senderName: string;
    text: string;
    kind?: "chat" | "system" | "follow" | "tip";
  }) {
    const message = this.chat.push(input);
    if (!message) {
      return;
    }
    this.server.to(`table:${input.tableId}`).emit(ServerEvents.chatMessage, { message });
  }
}
