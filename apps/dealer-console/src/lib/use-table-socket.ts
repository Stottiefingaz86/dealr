"use client";

import { useEffect } from "react";
import {
  ClientEvents,
  ServerEvents,
  createRealtimeSocket,
  type TableEventMessage,
  type TableEventsSnapshot,
  type TableStateMessage,
} from "@live-dealr/realtime";
import { DEFAULT_TABLE_ID } from "@live-dealr/shared-types";
import { API_URL } from "./api";
import { useDealerStore } from "./store";

export function useDealerSocket() {
  const setConnected = useDealerStore((s) => s.setConnected);
  const setState = useDealerStore((s) => s.setState);
  const appendEvent = useDealerStore((s) => s.appendEvent);
  const setEvents = useDealerStore((s) => s.setEvents);

  useEffect(() => {
    const socket = createRealtimeSocket(API_URL);
    socket.on("connect", () => {
      setConnected(true);
      socket.emit(ClientEvents.joinTable, { tableId: DEFAULT_TABLE_ID, role: "dealer" });
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on(ServerEvents.tableState, (message: TableStateMessage) => setState(message.state));
    socket.on(ServerEvents.tableEvent, (message: TableEventMessage) => {
      if (message.event.type !== "GAME_STATE_UPDATED") {
        appendEvent(message.event);
      }
    });
    socket.on(ServerEvents.tableEvents, (message: TableEventsSnapshot) => {
      setEvents(message.events.filter((event) => event.type !== "GAME_STATE_UPDATED"));
    });
    return () => {
      socket.disconnect();
    };
  }, [appendEvent, setConnected, setEvents, setState]);
}
