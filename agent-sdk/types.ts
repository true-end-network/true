export type { Envelope, Message, ServerEvent, ClientEvent } from "../src/lib/protocol"

export interface RoomInfo {
  code: string
  hash: string
  key: Uint8Array
  peerId: string
  ttl: number
  shareUrl: string
  deleteToken?: string
}

export interface AgentConfig {
  relayUrl: string
  name?: string
  reconnect?: boolean
  reconnectInterval?: number
  maxReconnectAttempts?: number
}

export interface AgentEvents {
  onMessage?: (message: Message, envelope: Envelope, roomCode: string) => void
  onPeerJoined?: (peerId: string, peerCount: number, roomCode: string) => void
  onPeerLeft?: (peerId: string, peerCount: number, roomCode: string) => void
  onRoomExpired?: (roomCode: string) => void
  onRoomDeleted?: (roomCode: string) => void
  onConnected?: () => void
  onDisconnected?: () => void
  onError?: (error: string) => void
}

export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting"

export type { Message as DecryptedMessage } from "../src/lib/protocol"
