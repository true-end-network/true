import {
  generateRoomCode,
  deriveRoomKey,
  deriveRoomHash,
  generatePeerId,
  encodeRoomUrl,
} from "./crypto"
import { DEFAULT_ROOM_TTL, MAX_ROOM_TTL } from "./constants"

export interface RoomCredentials {
  code: string
  hash: string
  key: Uint8Array
  peerId: string
  ttl: number
  shareUrl: string
}

export function createRoomCredentials(
  ttl: number = DEFAULT_ROOM_TTL,
  baseUrl: string = typeof window !== "undefined" ? window.location.origin : ""
): RoomCredentials {
  const clampedTtl = Math.min(Math.max(ttl, 60), MAX_ROOM_TTL)
  const code = generateRoomCode()
  return {
    code,
    hash: deriveRoomHash(code),
    key: deriveRoomKey(code),
    peerId: generatePeerId(),
    ttl: clampedTtl,
    shareUrl: encodeRoomUrl(baseUrl, code),
  }
}

export function joinRoomFromCode(code: string): Omit<RoomCredentials, "ttl" | "shareUrl"> {
  return {
    code,
    hash: deriveRoomHash(code),
    key: deriveRoomKey(code),
    peerId: generatePeerId(),
  }
}
