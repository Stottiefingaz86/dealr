/**
 * Peer-to-peer friends table. The host runs TableRuntime in-browser; guests
 * sync over PeerJS (public signalling). Share `/real?g=GAMEID` — up to 5 seats.
 * (`?room=` still accepted as an alias.)
 */

import Peer, { type DataConnection } from "peerjs";
import { InMemoryEventStore } from "@live-dealr/table-controller/event-store";
import { TableRuntime } from "@live-dealr/table-controller/runtime";
import {
  DEFAULT_SHOE_ID,
  DEFAULT_TABLE_ID,
  RANKS,
  SUITS,
  type GameState,
  type PlayerActionType,
  type Rank,
  type Suit,
} from "@live-dealr/shared-types";
import type { ChatMessage, ReactionKind, ReactionMessage } from "@live-dealr/realtime";
import { DEALER_POSTS } from "@live-dealr/websocket/bot-crowd";

const AUTO_DEAL_MS = 550;
const PEER_PREFIX = "dealr-live-";

/** STUN helps friends behind home NATs (3rd+ join was failing on default PeerJS). */
const PEER_OPTS = {
  debug: 0 as const,
  config: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  },
};

export function peerIdForRoom(code: string): string {
  return `${PEER_PREFIX}${code.toLowerCase()}`;
}

export function generateRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export type LiveWire =
  | { t: "hello"; name: string; playerId: string; avatarUrl?: string }
  | { t: "welcome"; playerId: string; seat: number; state: GameState }
  | { t: "reject"; message: string }
  | { t: "state"; state: GameState }
  | { t: "chat"; message: ChatMessage }
  | { t: "reaction"; reaction: ReactionMessage }
  | { t: "addChip"; value: number }
  | { t: "clearBet" }
  | { t: "confirmBet" }
  | { t: "action"; action: PlayerActionType }
  | { t: "tip"; amount: number }
  | { t: "sendChat"; text: string }
  | { t: "sendReaction"; kind: ReactionKind; emoji: string; toSeat: number | null }
  | { t: "follow"; following: boolean }
  | { t: "claimReward"; missionId: string; missionTitle: string; amount: number; unlockLabel?: string };

export type LiveSinks = {
  onState: (state: GameState) => void;
  onChat: (message: ChatMessage) => void;
  onReaction: (reaction: ReactionMessage) => void;
  onStatus: (status: string) => void;
  onError: (message: string) => void;
};

function send(conn: DataConnection, msg: LiveWire) {
  conn.send(msg);
}

export class LiveHost {
  private peer: Peer | null = null;
  private runtime: TableRuntime | null = null;
  private autoDealTimer: ReturnType<typeof setTimeout> | null = null;
  private dealerPromoTimer: ReturnType<typeof setTimeout> | null = null;
  private dealerPromoIndex = 0;
  private unsub: (() => void) | null = null;
  private conns = new Map<string, DataConnection>();
  private playerId: string;
  readonly roomCode: string;

  constructor(
    roomCode: string,
    private readonly name: string,
    private readonly sinks: LiveSinks,
    private readonly avatarUrl?: string,
  ) {
    this.roomCode = roomCode.toUpperCase();
    this.playerId = `p-${crypto.randomUUID().slice(0, 8)}`;
  }

  get localPlayerId() {
    return this.playerId;
  }

  async start(): Promise<void> {
    this.sinks.onStatus("Opening table…");
    this.runtime = new TableRuntime(new InMemoryEventStore(), DEFAULT_TABLE_ID, "live");
    this.runtime.open();
    this.runtime.connectShoe(DEFAULT_SHOE_ID, "live-shoe", "simulator");
    this.runtime.claimSeat(this.name, this.playerId, this.avatarUrl);
    this.unsub = this.runtime.subscribe((_event, state) => {
      this.sinks.onState(state);
      this.broadcast({ t: "state", state });
      if (state.round?.nextCardRecipient) this.scheduleAutoDeal();
    });
    this.sinks.onState(this.runtime.getState());

    await new Promise<void>((resolve, reject) => {
      const peer = new Peer(peerIdForRoom(this.roomCode), PEER_OPTS);
      this.peer = peer;
      peer.on("open", () => {
        this.sinks.onStatus("Table live — share the link");
        this.runtime!.openBetting();
        this.scheduleDealerPromo(2500);
        resolve();
      });
      peer.on("error", (err) => {
        this.sinks.onError(err.message || "Could not open table (code taken?)");
        reject(err);
      });
      peer.on("connection", (conn) => this.onGuest(conn));
    });
  }

  stop(): void {
    this.unsub?.();
    if (this.autoDealTimer) clearTimeout(this.autoDealTimer);
    if (this.dealerPromoTimer) clearTimeout(this.dealerPromoTimer);
    for (const c of this.conns.values()) c.close();
    this.conns.clear();
    this.peer?.destroy();
    this.peer = null;
    this.runtime = null;
  }

  /** Dealer-channel promos — follow page, game of the week, clips. */
  private scheduleDealerPromo(firstWait?: number) {
    const wait = firstWait ?? 28000 + Math.random() * 20000;
    this.dealerPromoTimer = setTimeout(() => {
      const text = DEALER_POSTS[this.dealerPromoIndex % DEALER_POSTS.length];
      this.dealerPromoIndex += 1;
      if (text && this.runtime) {
        const dealer = this.runtime.getState().dealer;
        this.announceChat(
          dealer.id,
          dealer.profile.displayName.split(" ")[0] ?? dealer.profile.displayName,
          text,
          "system",
        );
      }
      this.scheduleDealerPromo();
    }, wait);
  }

  private onGuest(conn: DataConnection) {
    // Accept immediately — PeerJS can drop the 3rd link if we wait to wire handlers.
    conn.on("data", (raw) => this.onGuestMessage(conn, raw as LiveWire));
    conn.on("close", () => {
      for (const [id, c] of this.conns) {
        if (c === conn) {
          this.conns.delete(id);
          this.runtime?.releaseSeat(id);
          this.broadcast({ t: "state", state: this.runtime!.getState() });
          this.announce("A seat opened up");
          break;
        }
      }
    });
    conn.on("error", () => {
      /* closed via close handler */
    });
  }

  private onGuestMessage(conn: DataConnection, msg: LiveWire) {
    if (!this.runtime) return;
    if (msg.t === "hello") {
      try {
        const player = this.runtime.claimSeat(msg.name, msg.playerId, msg.avatarUrl);
        this.conns.set(player.id, conn);
        send(conn, { t: "welcome", playerId: player.id, seat: player.seat, state: this.runtime.getState() });
        this.announce(`${player.displayName} sat at seat ${player.seat}`);
        this.broadcast({ t: "state", state: this.runtime.getState() });
      } catch (e) {
        send(conn, { t: "reject", message: e instanceof Error ? e.message : "Table full" });
        conn.close();
      }
      return;
    }
    const playerId = [...this.conns.entries()].find(([, c]) => c === conn)?.[0];
    if (!playerId) return;
    this.handleAction(playerId, msg);
  }

  private handleAction(playerId: string, msg: LiveWire) {
    if (!this.runtime) return;
    try {
      switch (msg.t) {
        case "addChip":
          this.runtime.addChip(playerId, msg.value);
          break;
        case "clearBet":
          this.runtime.clearBet(playerId);
          break;
        case "confirmBet": {
          const me = this.runtime.getState().players.find((p) => p.id === playerId);
          if (me && me.currentBet >= 1) this.runtime.closeBetting();
          break;
        }
        case "action":
          this.runtime.submitPlayerAction(playerId, msg.action);
          break;
        case "tip": {
          const paid = this.runtime.tipDealer(playerId, msg.amount);
          const state = this.runtime.getState();
          const name = state.players.find((p) => p.id === playerId)?.displayName ?? "Player";
          this.announceChat(playerId, name, `tipped ${state.dealer.profile.displayName} $${paid}`, "tip");
          break;
        }
        case "sendChat":
          this.announceChat(
            playerId,
            this.runtime.getState().players.find((p) => p.id === playerId)?.displayName ?? "Player",
            msg.text,
            "chat",
          );
          break;
        case "follow": {
          if (!msg.following) break;
          const state = this.runtime.getState();
          const name = state.players.find((p) => p.id === playerId)?.displayName ?? "Player";
          this.announceChat(
            playerId,
            name,
            `followed ${state.dealer.profile.displayName}`,
            "follow",
          );
          break;
        }
        case "sendReaction": {
          const me = this.runtime.getState().players.find((p) => p.id === playerId);
          const reaction: ReactionMessage = {
            id: `rx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            tableId: DEFAULT_TABLE_ID,
            senderId: playerId,
            senderName: me?.displayName ?? "Player",
            kind: msg.kind,
            emoji: msg.emoji,
            fromSeat: me?.seat ?? 1,
            toSeat: msg.toSeat,
            timestamp: new Date().toISOString(),
          };
          this.sinks.onReaction(reaction);
          this.broadcast({ t: "reaction", reaction });
          break;
        }
        case "claimReward":
          if (msg.amount > 0) this.runtime.deposit(playerId, msg.amount);
          this.announceChat(
            playerId,
            this.runtime.getState().players.find((p) => p.id === playerId)?.displayName ?? "Player",
            msg.amount > 0
              ? `completed "${msg.missionTitle}" · $${msg.amount} cashback`
              : `completed "${msg.missionTitle}" · unlocked ${msg.unlockLabel ?? "a reward"}`,
            "tip",
          );
          break;
        default:
          break;
      }
    } catch (e) {
      // Guest sent an illegal action — ignore
      console.warn(e);
    }
  }

  private announce(text: string) {
    this.announceChat("system", "Table", text, "system");
  }

  private announceChat(
    senderId: string,
    senderName: string,
    text: string,
    kind: ChatMessage["kind"],
  ) {
    const message: ChatMessage = {
      id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tableId: DEFAULT_TABLE_ID,
      senderId,
      senderName,
      text,
      kind,
      timestamp: new Date().toISOString(),
    };
    this.sinks.onChat(message);
    this.broadcast({ t: "chat", message });
  }

  private broadcast(msg: LiveWire) {
    for (const c of this.conns.values()) {
      if (c.open) send(c, msg);
    }
  }

  private scheduleAutoDeal(): void {
    if (this.autoDealTimer) clearTimeout(this.autoDealTimer);
    this.autoDealTimer = setTimeout(() => {
      this.autoDealTimer = null;
      const state = this.runtime?.getState();
      if (!state?.round?.nextCardRecipient || state.table.paused) return;
      const rank = RANKS[Math.floor(Math.random() * RANKS.length)] as Rank;
      const suit = SUITS[Math.floor(Math.random() * SUITS.length)] as Suit;
      try {
        this.runtime?.onCardDetected({
          tableId: DEFAULT_TABLE_ID,
          shoeId: DEFAULT_SHOE_ID,
          rank,
          suit,
          detectedAt: new Date().toISOString(),
          deviceId: "live-shoe",
        });
      } catch {
        /* race */
      }
    }, AUTO_DEAL_MS);
  }

  // Host local actions
  addChip(value: number) {
    this.runtime?.addChip(this.playerId, value);
  }
  clearBet() {
    this.runtime?.clearBet(this.playerId);
  }
  confirmBet() {
    this.handleAction(this.playerId, { t: "confirmBet" });
  }
  sendAction(action: PlayerActionType) {
    this.runtime?.submitPlayerAction(this.playerId, action);
  }
  tip(amount: number) {
    this.handleAction(this.playerId, { t: "tip", amount });
  }
  claimReward(payload: {
    missionId: string;
    missionTitle: string;
    amount: number;
    unlockLabel?: string;
  }) {
    this.handleAction(this.playerId, { t: "claimReward", ...payload });
  }
  sendReaction(kind: ReactionKind, emoji: string, toSeat: number | null) {
    this.handleAction(this.playerId, { t: "sendReaction", kind, emoji, toSeat });
  }
  sendChat(text: string) {
    this.handleAction(this.playerId, { t: "sendChat", text });
  }
  follow(next: boolean) {
    this.handleAction(this.playerId, { t: "follow", following: next });
  }
}

export class LiveGuest {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private playerId: string;
  readonly roomCode: string;

  constructor(
    roomCode: string,
    private readonly name: string,
    private readonly sinks: LiveSinks,
    private readonly avatarUrl?: string,
  ) {
    this.roomCode = roomCode.toUpperCase();
    this.playerId =
      typeof window !== "undefined"
        ? window.sessionStorage.getItem(`dealr.pid.${this.roomCode}`) ??
          `p-${crypto.randomUUID().slice(0, 8)}`
        : `p-${crypto.randomUUID().slice(0, 8)}`;
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(`dealr.pid.${this.roomCode}`, this.playerId);
    }
  }

  get localPlayerId() {
    return this.playerId;
  }

  async start(): Promise<void> {
    this.sinks.onStatus("Connecting…");
    await new Promise<void>((resolve, reject) => {
      const peer = new Peer(PEER_OPTS);
      this.peer = peer;
      let settled = false;
      const fail = (message: string) => {
        if (settled) return;
        settled = true;
        this.sinks.onError(message);
        reject(new Error(message));
      };
      peer.on("error", (err) => {
        fail(err.message || "Connection failed");
      });
      peer.on("open", () => {
        const hostId = peerIdForRoom(this.roomCode);
        let attempt = 0;
        const connect = () => {
          attempt += 1;
          this.sinks.onStatus(attempt > 1 ? `Retrying join (${attempt}/4)…` : "Connecting…");
          const conn = peer.connect(hostId, { reliable: true, serialization: "json" });
          this.conn = conn;
          const timer = window.setTimeout(() => {
            if (conn.open || settled) return;
            try {
              conn.close();
            } catch {
              /* ignore */
            }
            if (attempt < 4) connect();
            else fail("Table didn’t answer — ask the host to keep the page open");
          }, 9000);
          conn.on("open", () => {
            window.clearTimeout(timer);
            send(conn, {
              t: "hello",
              name: this.name,
              playerId: this.playerId,
              avatarUrl: this.avatarUrl,
            });
            this.sinks.onStatus("Joined table");
            if (!settled) {
              settled = true;
              resolve();
            }
          });
          conn.on("data", (raw) => this.onHostMessage(raw as LiveWire));
          conn.on("close", () => {
            if (!settled) return;
            this.sinks.onError("Host left the table");
          });
          conn.on("error", (err) => {
            window.clearTimeout(timer);
            if (settled) this.sinks.onError(err.message || "Link dropped");
            else if (attempt < 4) connect();
            else fail(err.message || "Could not join table");
          });
        };
        connect();
      });
    });
  }

  stop(): void {
    this.conn?.close();
    this.peer?.destroy();
    this.conn = null;
    this.peer = null;
  }

  private onHostMessage(msg: LiveWire) {
    switch (msg.t) {
      case "welcome":
        this.playerId = msg.playerId;
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(`dealr.pid.${this.roomCode}`, this.playerId);
        }
        this.sinks.onState(msg.state);
        break;
      case "state":
        this.sinks.onState(msg.state);
        break;
      case "chat":
        this.sinks.onChat(msg.message);
        break;
      case "reaction":
        this.sinks.onReaction(msg.reaction);
        break;
      case "reject":
        this.sinks.onError(msg.message);
        break;
      default:
        break;
    }
  }

  private emit(msg: LiveWire) {
    if (this.conn?.open) send(this.conn, msg);
  }

  addChip(value: number) {
    this.emit({ t: "addChip", value });
  }
  clearBet() {
    this.emit({ t: "clearBet" });
  }
  confirmBet() {
    this.emit({ t: "confirmBet" });
  }
  sendAction(action: PlayerActionType) {
    this.emit({ t: "action", action });
  }
  tip(amount: number) {
    this.emit({ t: "tip", amount });
  }
  claimReward(payload: {
    missionId: string;
    missionTitle: string;
    amount: number;
    unlockLabel?: string;
  }) {
    this.emit({ t: "claimReward", ...payload });
  }
  sendReaction(kind: ReactionKind, emoji: string, toSeat: number | null) {
    this.emit({ t: "sendReaction", kind, emoji, toSeat });
  }
  sendChat(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    // Optimistic local echo
    this.sinks.onChat({
      id: `local-${Date.now()}`,
      tableId: DEFAULT_TABLE_ID,
      senderId: this.playerId,
      senderName: this.name,
      text: trimmed,
      kind: "chat",
      timestamp: new Date().toISOString(),
    });
    this.emit({ t: "sendChat", text: trimmed });
  }
  follow(next: boolean) {
    this.emit({ t: "follow", following: next });
  }
}

export type LiveSession = LiveHost | LiveGuest;
