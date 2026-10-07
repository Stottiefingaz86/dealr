import { io, type Socket } from "socket.io-client";
import { SOCKET_PATH } from "./index";

export function createRealtimeSocket(url: string): Socket {
  return io(url, {
    path: SOCKET_PATH,
    transports: ["websocket"],
    autoConnect: true,
  });
}
