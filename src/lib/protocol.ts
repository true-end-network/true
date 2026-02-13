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
}

export interface RoomJoinedResponse {
  event: "room_joined"
  roomHash: string
  peerId: string
  peerCount: number
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

export type ServerEvent =
  | RoomCreatedResponse
  | RoomJoinedResponse
  | PeerEvent
  | RoomExpiredEvent
  | RoomDeletedEvent
  | ErrorResponse
  | MessagePayload
  | PongResponse

export type ClientEvent =
  | CreateRoomPayload
  | JoinRoomPayload
  | LeaveRoomPayload
  | DeleteRoomPayload
  | MessagePayload
  | { event: "ping" }
