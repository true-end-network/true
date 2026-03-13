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

// --- Contact pairing crypto ---

const SHA512_BLOCK_SIZE = 128

function hmacSha512(key: Uint8Array, message: Uint8Array): Uint8Array {
  let k = key
  if (k.length > SHA512_BLOCK_SIZE) {
    k = nacl.hash(k)
  }
  const paddedKey = new Uint8Array(SHA512_BLOCK_SIZE)
  paddedKey.set(k)

  const ipad = new Uint8Array(SHA512_BLOCK_SIZE)
  const opad = new Uint8Array(SHA512_BLOCK_SIZE)
  for (let i = 0; i < SHA512_BLOCK_SIZE; i++) {
    ipad[i] = paddedKey[i] ^ 0x36
    opad[i] = paddedKey[i] ^ 0x5c
  }

  const inner = new Uint8Array(SHA512_BLOCK_SIZE + message.length)
  inner.set(ipad)
  inner.set(message, SHA512_BLOCK_SIZE)
  const innerHash = nacl.hash(inner)

  const outer = new Uint8Array(SHA512_BLOCK_SIZE + innerHash.length)
  outer.set(opad)
  outer.set(innerHash, SHA512_BLOCK_SIZE)
  return nacl.hash(outer)
}

export function generateSharedSecret(): string {
  return encodeBase64(nacl.randomBytes(32))
}

export function deriveContactRoomCode(sharedSecret: string, date: string, sequence: number): string {
  const keyBytes = decodeBase64(sharedSecret)
  const message = decodeUTF8(`true:contact:${date}:${sequence}`)
  const hash = hmacSha512(keyBytes, message)

  const result: string[] = []
  let idx = 0
  while (result.length < ROOM_CODE_LENGTH) {
    const b = hash[idx % hash.length]
    idx++
    if (b < REJECTION_THRESHOLD) {
      result.push(ROOM_CODE_ALPHABET[b % ALPHABET_LEN])
    }
    if (idx > hash.length * 4) {
      // Extra entropy if needed
      const extra = hmacSha512(keyBytes, decodeUTF8(`true:contact:${date}:${sequence}:${idx}`))
      for (const eb of extra) {
        if (eb < REJECTION_THRESHOLD && result.length < ROOM_CODE_LENGTH) {
          result.push(ROOM_CODE_ALPHABET[eb % ALPHABET_LEN])
        }
      }
    }
  }
  return result.join("")
}

export function encodePairingUrl(baseUrl: string, sharedSecret: string): string {
  return `${baseUrl}/pair#${sharedSecret}`
}

export function decodePairingFragment(fragment: string): string | null {
  try {
    const bytes = decodeBase64(fragment)
    if (bytes.length !== 32) return null
    return fragment
  } catch {
    return null
  }
}

export function getTodayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}
