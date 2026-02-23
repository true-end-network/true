export const RELAY_PORT = parseInt(process.env.RELAY_PORT || "3001", 10)

// Base relay URL for server-side / SDK usage
export const RELAY_URL = process.env.NEXT_PUBLIC_RELAY_URL || `ws://localhost:${RELAY_PORT}`
export const DEFAULT_ROOM_TTL = 3600
export const MAX_ROOM_TTL = 86400
export const ROOM_CODE_LENGTH = 12
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
export const MAX_MESSAGE_SIZE = 65536
export const HEARTBEAT_INTERVAL = 30000
export const ROOM_CLEANUP_INTERVAL = 10000
export const MESSAGE_BUFFER_SIZE = 200

export const MAX_ROOMS = 10000
export const MAX_PEERS_PER_ROOM = 50
export const HTTP_PEER_TIMEOUT = 120000
export const MAX_CLIENT_MESSAGES = 500

export const RATE_LIMIT_WINDOW = 60000
export const RATE_LIMIT_CREATE = 5
export const RATE_LIMIT_JOIN = 20
export const RATE_LIMIT_MESSAGE = 60

export const CORS_ORIGIN = process.env.CORS_ORIGIN || "*"

export const WS_EVENTS = {
  CREATE_ROOM: "create_room",
  JOIN_ROOM: "join_room",
  LEAVE_ROOM: "leave_room",
  DELETE_ROOM: "delete_room",
  MESSAGE: "message",
  ROOM_CREATED: "room_created",
  ROOM_JOINED: "room_joined",
  ROOM_EXPIRED: "room_expired",
  ROOM_DELETED: "room_deleted",
  PEER_JOINED: "peer_joined",
  PEER_LEFT: "peer_left",
  ERROR: "error",
  PING: "ping",
  PONG: "pong",
} as const
