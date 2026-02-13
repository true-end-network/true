import nacl from "tweetnacl"
import {
  encodeBase64,
  decodeBase64,
  encodeUTF8,
  decodeUTF8,
} from "tweetnacl-util"
import type { Envelope, Message } from "./protocol"
import { ROOM_CODE_LENGTH, ROOM_CODE_ALPHABET } from "./constants"

const ALPHABET_LEN = ROOM_CODE_ALPHABET.length
const REJECTION_THRESHOLD = Math.floor(256 / ALPHABET_LEN) * ALPHABET_LEN

export function generateRoomCode(): string {
  const result: string[] = []
  while (result.length < ROOM_CODE_LENGTH) {
    const bytes = nacl.randomBytes(ROOM_CODE_LENGTH * 2)
    for (const b of bytes) {
      if (b < REJECTION_THRESHOLD && result.length < ROOM_CODE_LENGTH) {
        result.push(ROOM_CODE_ALPHABET[b % ALPHABET_LEN])
      }
    }
  }
  return result.join("")
}

export function deriveRoomKey(roomCode: string): Uint8Array {
  const encoded = decodeUTF8("true:key:" + roomCode)
  return nacl.hash(encoded).slice(0, nacl.secretbox.keyLength)
}

export function deriveRoomHash(roomCode: string): string {
  const encoded = decodeUTF8("true:hash:" + roomCode)
  return encodeBase64(nacl.hash(encoded).slice(0, 32))
}

export function generatePeerId(): string {
  return encodeBase64(nacl.randomBytes(16))
}

export function validateRoomCode(code: string): boolean {
  if (code.length !== ROOM_CODE_LENGTH) return false
  for (const ch of code) {
    if (!ROOM_CODE_ALPHABET.includes(ch)) return false
  }
  return true
}

export function encryptMessage(
  message: Message,
  roomKey: Uint8Array
): { payload: string; nonce: string } {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength)
  const messageBytes = decodeUTF8(JSON.stringify(message))
  const encrypted = nacl.secretbox(messageBytes, nonce, roomKey)
  return {
    payload: encodeBase64(encrypted),
    nonce: encodeBase64(nonce),
  }
}

export function decryptMessage(
  payload: string,
  nonce: string,
  roomKey: Uint8Array
): Message | null {
  try {
    const encrypted = decodeBase64(payload)
    const nonceBytes = decodeBase64(nonce)
    const decrypted = nacl.secretbox.open(encrypted, nonceBytes, roomKey)
    if (!decrypted) return null
    return JSON.parse(encodeUTF8(decrypted)) as Message
  } catch {
    return null
  }
}

export function createEnvelope(
  roomCode: string,
  peerId: string,
  message: Message,
  roomKey: Uint8Array
): Envelope {
  const { payload, nonce } = encryptMessage(message, roomKey)
  return {
    room: deriveRoomHash(roomCode),
    from: peerId,
    payload,
    nonce,
    ts: Date.now(),
  }
}

export function openEnvelope(
  envelope: Envelope,
  roomKey: Uint8Array
): Message | null {
  return decryptMessage(envelope.payload, envelope.nonce, roomKey)
}

export function encodeRoomUrl(baseUrl: string, roomCode: string): string {
  const code = encodeBase64(decodeUTF8(roomCode))
  return `${baseUrl}/room/observe#${code}`
}

export function decodeRoomFragment(fragment: string): string | null {
  try {
    const decoded = encodeUTF8(decodeBase64(fragment))
    if (!validateRoomCode(decoded)) return null
    return decoded
  } catch {
    return null
  }
}
