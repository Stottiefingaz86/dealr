"use client";

import { useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";
import {
  ClientEvents,
  ServerEvents,
  createRealtimeSocket,
  type ChatMessage,
  type ReactionKind,
  type ReactionMessage,
  type TableEventMessage,
  type TableEventsSnapshot,
  type TableStateMessage,
} from "@live-dealr/realtime";
import {
  DEFAULT_PLAYER_ID,
  DEFAULT_TABLE_ID,
  type PlayerActionType,
} from "@live-dealr/shared-types";
import { API_URL } from "./api";
import { usePlayerStore } from "./store";

export function useTableSocket() {
  const socketRef = useRef<Socket | null>(null);
  const setConnected = usePlayerStore((s) => s.setConnected);
  const setState = usePlayerStore((s) => s.setState);
  const appendEvent = usePlayerStore((s) => s.appendEvent);
  const setEvents = usePlayerStore((s) => s.setEvents);
  const setChat = usePlayerStore((s) => s.setChat);
  const appendChat = usePlayerStore((s) => s.appendChat);
  const pushReaction = usePlayerStore((s) => s.pushReaction);

  useEffect(() => {
    const socket = createRealtimeSocket(API_URL);
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit(ClientEvents.joinTable, {
        tableId: DEFAULT_TABLE_ID,
        role: "player",
        playerId: DEFAULT_PLAYER_ID,
      });
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on(ServerEvents.tableState, (message: TableStateMessage) => {
      setState(message.state);
    });
    socket.on(ServerEvents.tableEvent, (message: TableEventMessage) => {
      if (message.event.type !== "GAME_STATE_UPDATED") {
        appendEvent(message.event);
      }
    });
    socket.on(ServerEvents.tableEvents, (message: TableEventsSnapshot) => {
      setEvents(message.events.filter((event) => event.type !== "GAME_STATE_UPDATED"));
    });
    socket.on(ServerEvents.chatHistory, (payload: { messages: ChatMessage[] }) => {
      setChat(payload.messages);
    });
    socket.on(ServerEvents.chatMessage, (payload: { message: ChatMessage }) => {
      appendChat(payload.message);
    });
    socket.on(ServerEvents.reaction, (payload: { reaction: ReactionMessage }) => {
      pushReaction(payload.reaction);
    });

    return () => {
      socket.disconnect();
    };
  }, [appendChat, appendEvent, pushReaction, setChat, setConnected, setEvents, setState]);

  return {
    addChip: (value: number) => {
      socketRef.current?.emit(ClientEvents.addChip, {
        tableId: DEFAULT_TABLE_ID,
        playerId: DEFAULT_PLAYER_ID,
        value,
      });
    },
    clearBet: () => {
      socketRef.current?.emit(ClientEvents.clearBet, { playerId: DEFAULT_PLAYER_ID });
    },
    sendAction: (action: PlayerActionType) => {
      socketRef.current?.emit(ClientEvents.playerAction, {
        tableId: DEFAULT_TABLE_ID,
        playerId: DEFAULT_PLAYER_ID,
        action,
      });
    },
    follow: (next: boolean) => {
      socketRef.current?.emit(ClientEvents.followDealer, {
        playerId: DEFAULT_PLAYER_ID,
        follow: next,
      });
    },
    sendReaction: (kind: ReactionKind, emoji: string, toSeat: number | null = null) => {
      socketRef.current?.emit(ClientEvents.sendReaction, {
        tableId: DEFAULT_TABLE_ID,
        senderId: DEFAULT_PLAYER_ID,
        kind,
        emoji,
        toSeat,
      });
    },
    claimReward: (payload: {
      missionId: string;
      missionTitle: string;
      amount: number;
      unlockLabel?: string;
    }) => {
      socketRef.current?.emit(ClientEvents.claimReward, {
        tableId: DEFAULT_TABLE_ID,
        playerId: DEFAULT_PLAYER_ID,
        ...payload,
      });
    },
    tip: (amount: number) => {
      socketRef.current?.emit(ClientEvents.tipDealer, {
        tableId: DEFAULT_TABLE_ID,
        playerId: DEFAULT_PLAYER_ID,
        amount,
      });
    },
    sendChat: (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }
      // Optimistic local echo so the panel updates even if the socket is slow.
      appendChat({
        id: `local-${Date.now()}`,
        tableId: DEFAULT_TABLE_ID,
        senderId: DEFAULT_PLAYER_ID,
        senderName: "You",
        text: trimmed,
        kind: "chat",
        timestamp: new Date().toISOString(),
      });
      socketRef.current?.emit(ClientEvents.sendChat, {
        tableId: DEFAULT_TABLE_ID,
        senderId: DEFAULT_PLAYER_ID,
        senderName: "You",
        text: trimmed,
      });
    },
  };
}
