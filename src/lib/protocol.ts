export interface Envelope {
  room: string
  from: string
  payload: string
  nonce: string
  ts: number
}

export interface Message {
  type: "text" | "system" | "action"
  content: string
  agentName?: string
  metadata?: Record<string, unknown>
}

export interface CreateRoomPayload {
  event: "create_room"
  ttl: number
  roomHash: string
}

export interface JoinRoomPayload {
  event: "join_room"
  roomHash: string
}

export interface LeaveRoomPayload {
  event: "leave_room"
  roomHash: string
}

export interface DeleteRoomPayload {
  event: "delete_room"
  roomHash: string
  deleteToken: string
}

export interface MessagePayload {
  event: "message"
  envelope: Envelope
}

export interface RoomCreatedResponse {
  event: "room_created"
  roomHash: string
  peerId: string
  deleteToken: string
  expiresAt: number
}

export interface RoomJoinedResponse {
  event: "room_joined"
  roomHash: string
  peerId: string
  peerCount: number
  expiresAt: number
  locked: boolean
}

export interface PeerEvent {
  event: "peer_joined" | "peer_left"
  roomHash: string
  peerId: string
  peerCount: number
}

export interface RoomExpiredEvent {
  event: "room_expired"
  roomHash: string
}

export interface RoomDeletedEvent {
  event: "room_deleted"
  roomHash: string
}

export interface ErrorResponse {
  event: "error"
  message: string
  code: string
  roomHash?: string
}

export interface PongResponse {
  event: "pong"
}

// Room control events
export interface LockRoomPayload {
  event: "lock_room"
  roomHash: string
  deleteToken: string
}

export interface UnlockRoomPayload {
  event: "unlock_room"
  roomHash: string
  deleteToken: string
}

export interface UpdateTtlPayload {
  event: "update_ttl"
  roomHash: string
  deleteToken: string
  ttl: number
}

export interface KickPeerPayload {
  event: "kick_peer"
  roomHash: string
  deleteToken: string
  peerId: string
}

export interface RoomLockedEvent {
  event: "room_locked"
  roomHash: string
}

export interface RoomUnlockedEvent {
  event: "room_unlocked"
  roomHash: string
}

export interface TtlUpdatedEvent {
  event: "ttl_updated"
  roomHash: string
  ttl: number
  expiresAt: number
}

export interface PeerKickedEvent {
  event: "peer_kicked"
  roomHash: string
  peerId: string
  peerCount: number
}

export type ServerEvent =
  | RoomCreatedResponse
  | RoomJoinedResponse
  | PeerEvent
  | RoomExpiredEvent
  | RoomDeletedEvent
  | RoomLockedEvent
  | RoomUnlockedEvent
  | TtlUpdatedEvent
  | PeerKickedEvent
  | ErrorResponse
  | MessagePayload
  | PongResponse

export type ClientEvent =
  | CreateRoomPayload
  | JoinRoomPayload
  | LeaveRoomPayload
  | DeleteRoomPayload
  | LockRoomPayload
  | UnlockRoomPayload
  | UpdateTtlPayload
  | KickPeerPayload
  | MessagePayload
  | { event: "ping" }
