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
import { resolveApiUrl } from "./api";
import { DemoTable } from "./demo-table";
import { usePlayerStore } from "./store";

const API_FALLBACK_MS = 1500;

function startDemo(
  sinks: ConstructorParameters<typeof DemoTable>[0],
  demoRef: { current: DemoTable | null },
  setConnected: (v: boolean) => void,
  setChat: (m: ChatMessage[]) => void,
) {
  const demo = new DemoTable(sinks);
  demoRef.current = demo;
  setConnected(true);
  setChat([]);
  demo.start();
  return () => {
    demo.stop();
    demoRef.current = null;
    setConnected(false);
  };
}

export function useTableSocket(opts?: { enabled?: boolean }) {
  const enabled = opts?.enabled ?? true;
  const socketRef = useRef<Socket | null>(null);
  const demoRef = useRef<DemoTable | null>(null);
  const setConnected = usePlayerStore((s) => s.setConnected);
  const setState = usePlayerStore((s) => s.setState);
  const appendEvent = usePlayerStore((s) => s.appendEvent);
  const setEvents = usePlayerStore((s) => s.setEvents);
  const setChat = usePlayerStore((s) => s.setChat);
  const appendChat = usePlayerStore((s) => s.appendChat);
  const pushReaction = usePlayerStore((s) => s.pushReaction);

  useEffect(() => {
    if (!enabled) return;

    const apiUrl = resolveApiUrl();
    const sinks = {
      onState: setState,
      onEvent: (event: Parameters<typeof appendEvent>[0]) => {
        if (event.type !== "GAME_STATE_UPDATED") appendEvent(event);
      },
      onChat: appendChat,
      onReaction: pushReaction,
    };

    // Production static host (or missing API) → run the full table in the browser.
    if (!apiUrl) {
      return startDemo(sinks, demoRef, setConnected, setChat);
    }

    const socket = createRealtimeSocket(apiUrl);
    socketRef.current = socket;
    let cancelled = false;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let stopDemo: (() => void) | null = null;
    let usingDemo = false;

    const goDemo = () => {
      if (cancelled || usingDemo) return;
      usingDemo = true;
      socket.disconnect();
      socketRef.current = null;
      stopDemo = startDemo(sinks, demoRef, setConnected, setChat);
    };

    fallbackTimer = setTimeout(() => {
      if (!socket.connected) goDemo();
    }, API_FALLBACK_MS);

    socket.on("connect", () => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (usingDemo) return;
      setConnected(true);
      socket.emit(ClientEvents.joinTable, {
        tableId: DEFAULT_TABLE_ID,
        role: "player",
        playerId: DEFAULT_PLAYER_ID,
      });
    });
    socket.on("connect_error", () => {
      goDemo();
    });
    socket.on("disconnect", () => {
      if (!usingDemo) setConnected(false);
    });
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
      cancelled = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      stopDemo?.();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, appendChat, appendEvent, pushReaction, setChat, setConnected, setEvents, setState]);

  return {
    playerId: DEFAULT_PLAYER_ID,
    addChip: (value: number) => {
      if (demoRef.current) {
        demoRef.current.addChip(value);
        return;
      }
      socketRef.current?.emit(ClientEvents.addChip, {
        tableId: DEFAULT_TABLE_ID,
        playerId: DEFAULT_PLAYER_ID,
        value,
      });
    },
    clearBet: () => {
      if (demoRef.current) {
        demoRef.current.clearBet();
        return;
      }
      socketRef.current?.emit(ClientEvents.clearBet, { playerId: DEFAULT_PLAYER_ID });
    },
    confirmBet: () => {
      if (demoRef.current) {
        demoRef.current.confirmBet();
        return;
      }
      socketRef.current?.emit(ClientEvents.closeBetting, {
        tableId: DEFAULT_TABLE_ID,
      });
    },
    sendAction: (action: PlayerActionType) => {
      if (demoRef.current) {
        demoRef.current.sendAction(action);
        return;
      }
      socketRef.current?.emit(ClientEvents.playerAction, {
        tableId: DEFAULT_TABLE_ID,
        playerId: DEFAULT_PLAYER_ID,
        action,
      });
    },
    follow: (next: boolean) => {
      // Following is client-side store state; the socket call is fire-and-forget on API hosts.
      socketRef.current?.emit(ClientEvents.followDealer, {
        playerId: DEFAULT_PLAYER_ID,
        follow: next,
      });
    },
    sendReaction: (kind: ReactionKind, emoji: string, toSeat: number | null = null) => {
      if (demoRef.current) {
        demoRef.current.sendReaction(kind, emoji, toSeat);
        return;
      }
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
      if (demoRef.current) {
        demoRef.current.claimReward(payload);
        return;
      }
      socketRef.current?.emit(ClientEvents.claimReward, {
        tableId: DEFAULT_TABLE_ID,
        playerId: DEFAULT_PLAYER_ID,
        ...payload,
      });
    },
    tip: (amount: number) => {
      if (demoRef.current) {
        demoRef.current.tip(amount);
        return;
      }
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

export type TableActions = ReturnType<typeof useTableSocket>;
