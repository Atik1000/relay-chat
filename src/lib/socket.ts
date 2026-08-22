"use client";

import { io, type Socket } from "socket.io-client";
import { API_ORIGIN } from "./api";

/**
 * The socket lives at the host ROOT, not under /api — connecting to the REST
 * base silently fails the handshake.
 *
 * It is used as an inbound stream only. `message:send` is deliberately unused:
 * its ack returns `{ ok: true }` without the created message, and the server
 * never echoes a message back to its own sender, so sending over the socket
 * would leave us with no server id and no confirmed timestamp. See docs/API.md.
 */
export type ConnectionState = "connecting" | "online" | "offline";

export function createSocket(token: string): Socket {
  return io(API_ORIGIN, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
  });
}
