import WebSocket from "ws"
import {
  generateRoomCode,
  deriveRoomKey,
  deriveRoomHash,
  generatePeerId,
  createEnvelope,
  openEnvelope,
} from "../src/lib/crypto"
import { DEFAULT_ROOM_TTL } from "../src/lib/constants"
import type { Message, ServerEvent, MessagePayload, ClientEvent } from "../src/lib/protocol"
import type { RoomInfo, AgentConfig, AgentEvents, ConnectionState } from "./types"

type PendingResolve = (value: RoomInfo) => void
type PendingReject = (reason: Error) => void

export class AnonymousAgent {
  private ws: WebSocket | null = null
  private config: Required<AgentConfig>
  private events: AgentEvents = {}
  private rooms: Map<string, RoomInfo> = new Map()
  private hashToCode: Map<string, string> = new Map()
  private pendingRooms: Map<string, { resolve: PendingResolve; reject: PendingReject; room: RoomInfo }> = new Map()
  private state: ConnectionState = "disconnected"
  private reconnectAttempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null

  constructor(relayUrl: string, config?: Partial<Omit<AgentConfig, "relayUrl">>) {
    this.config = {
      relayUrl,
      name: config?.name ?? `agent-${generatePeerId().slice(0, 6)}`,
      reconnect: config?.reconnect ?? true,
      reconnectInterval: config?.reconnectInterval ?? 3000,
      maxReconnectAttempts: config?.maxReconnectAttempts ?? 10,
    }
  }

  on(events: AgentEvents): this {
    this.events = { ...this.events, ...events }
    return this
  }

  get connectionState(): ConnectionState {
    return this.state
  }

  get activeRooms(): RoomInfo[] {
    return Array.from(this.rooms.values())
  }

  get agentName(): string {
    return this.config.name
  }

  getRoom(roomCode: string): RoomInfo | undefined {
    return this.rooms.get(roomCode)
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.state = "connecting"

      this.ws = new WebSocket(this.config.relayUrl)

      this.ws.on("open", () => {
        this.state = "connected"
        this.reconnectAttempts = 0
        this.startPing()
        this.events.onConnected?.()
        resolve()
      })

      this.ws.on("message", (raw: Buffer) => {
        this.handleServerEvent(raw)
      })

      this.ws.on("close", () => {
        this.state = "disconnected"
        this.stopPing()
        this.rejectAllPending("Connection closed")
        this.events.onDisconnected?.()
        this.attemptReconnect()
      })

      this.ws.on("error", (err: Error) => {
        this.events.onError?.(err.message)
        if (this.state === "connecting") {
          reject(err)
        }
      })
    })
  }

  async createRoom(options?: { ttl?: number; baseUrl?: string }): Promise<RoomInfo> {
    this.ensureConnected()

    const ttl = options?.ttl ?? DEFAULT_ROOM_TTL
    const baseUrl = options?.baseUrl ?? ""
    const code = generateRoomCode()
    const hash = deriveRoomHash(code)
    const key = deriveRoomKey(code)
    const peerId = generatePeerId()

    const room: RoomInfo = {
      code,
      hash,
      key,
      peerId,
      ttl,
      shareUrl: baseUrl ? `${baseUrl}/room/observe#${Buffer.from(code).toString("base64")}` : code,
    }

    this.hashToCode.set(hash, code)

    return new Promise((resolve, reject) => {
      this.pendingRooms.set(hash, { resolve, reject, room })

      this.sendRaw({
        event: "create_room",
        ttl,
        roomHash: hash,
      })

      setTimeout(() => {
        if (this.pendingRooms.has(hash)) {
          this.pendingRooms.delete(hash)
          this.hashToCode.delete(hash)
          reject(new Error("Room creation timed out"))
        }
      }, 10000)
    })
  }

  async joinRoom(roomCode: string): Promise<RoomInfo> {
    this.ensureConnected()

    const hash = deriveRoomHash(roomCode)
    const key = deriveRoomKey(roomCode)
    const peerId = generatePeerId()

    const room: RoomInfo = {
      code: roomCode,
      hash,
      key,
      peerId,
      ttl: 0,
      shareUrl: roomCode,
    }

    this.hashToCode.set(hash, roomCode)

    return new Promise((resolve, reject) => {
      this.pendingRooms.set(hash, { resolve, reject, room })

      this.sendRaw({
        event: "join_room",
        roomHash: hash,
      })

      setTimeout(() => {
        if (this.pendingRooms.has(hash)) {
          this.pendingRooms.delete(hash)
          this.hashToCode.delete(hash)
          reject(new Error("Room join timed out"))
        }
      }, 10000)
    })
  }

  async sendMessage(roomCode: string, content: string, type: Message["type"] = "text"): Promise<void> {
    this.ensureConnected()
    const room = this.getRequiredRoom(roomCode)

    const message: Message = {
      type,
      content,
      agentName: this.config.name,
    }

    const envelope = createEnvelope(room.code, room.peerId, message, room.key)

    this.sendRaw({ event: "message", envelope })
  }

  async send(roomCode: string, message: Message): Promise<void> {
    this.ensureConnected()
    const room = this.getRequiredRoom(roomCode)

    const msg: Message = {
      ...message,
      agentName: message.agentName ?? this.config.name,
    }

    const envelope = createEnvelope(room.code, room.peerId, msg, room.key)

    this.sendRaw({ event: "message", envelope })
  }

  deleteRoom(roomCode: string): void {
    this.ensureConnected()
    const room = this.getRequiredRoom(roomCode)

    if (!room.deleteToken) {
      throw new Error("No delete token. Only the room creator receives a delete token.")
    }

    this.sendRaw({
      event: "delete_room",
      roomHash: room.hash,
      deleteToken: room.deleteToken,
    })
  }

  leaveRoom(roomCode: string): void {
    const room = this.rooms.get(roomCode)
    if (room) {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.sendRaw({ event: "leave_room", roomHash: room.hash })
      }
      room.key.fill(0)
      this.rooms.delete(roomCode)
      this.hashToCode.delete(room.hash)
    }
  }

  leaveAllRooms(): void {
    for (const code of Array.from(this.rooms.keys())) {
      this.leaveRoom(code)
    }
  }

  disconnect(): void {
    this.config.reconnect = false
    this.stopPing()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.rejectAllPending("Disconnected")
    this.leaveAllRooms()
    this.ws?.close()
    this.ws = null
    this.state = "disconnected"
  }

  private resolveRoomCode(roomHash: string): string | undefined {
    return this.hashToCode.get(roomHash)
  }

  private resolvePending(roomHash: string, room: RoomInfo) {
    const pending = this.pendingRooms.get(roomHash)
    if (pending) {
      this.pendingRooms.delete(roomHash)
      this.rooms.set(room.code, room)
      pending.resolve(room)
    }
  }

  private rejectPending(roomHash: string, reason: string) {
    const pending = this.pendingRooms.get(roomHash)
    if (pending) {
      this.pendingRooms.delete(roomHash)
      this.hashToCode.delete(roomHash)
      pending.reject(new Error(reason))
    }
  }

  private rejectAllPending(reason: string) {
    for (const [hash, pending] of this.pendingRooms) {
      this.hashToCode.delete(hash)
      pending.reject(new Error(reason))
    }
    this.pendingRooms.clear()
  }

  private handleServerEvent(raw: Buffer) {
    try {
      const event = JSON.parse(raw.toString()) as ServerEvent

      switch (event.event) {
        case "room_created": {
          const pending = this.pendingRooms.get(event.roomHash)
          if (pending) {
            pending.room.deleteToken = event.deleteToken
            pending.room.peerId = event.peerId
            this.resolvePending(event.roomHash, pending.room)
          }
          break
        }
        case "room_joined": {
          const pending = this.pendingRooms.get(event.roomHash)
          if (pending) {
            pending.room.peerId = event.peerId
            this.resolvePending(event.roomHash, pending.room)
          } else {
            const code = this.resolveRoomCode(event.roomHash)
            if (code) {
              const room = this.rooms.get(code)
              if (room) room.peerId = event.peerId
            }
          }
          break
        }
        case "message": {
          const msg = event as MessagePayload
          const code = this.resolveRoomCode(msg.envelope.room)
          if (code) {
            const room = this.rooms.get(code)
            if (room) {
              const decrypted = openEnvelope(msg.envelope, room.key)
              if (decrypted) {
                this.events.onMessage?.(decrypted, msg.envelope, code)
              }
            }
          }
          break
        }
        case "peer_joined": {
          const code = this.resolveRoomCode(event.roomHash)
          if (code) {
            this.events.onPeerJoined?.(event.peerId, event.peerCount, code)
          }
          break
        }
        case "peer_left": {
          const code = this.resolveRoomCode(event.roomHash)
          if (code) {
            this.events.onPeerLeft?.(event.peerId, event.peerCount, code)
          }
          break
        }
        case "room_expired": {
          const code = this.resolveRoomCode(event.roomHash)
          if (code) {
            const room = this.rooms.get(code)
            if (room) room.key.fill(0)
            this.rooms.delete(code)
            this.hashToCode.delete(event.roomHash)
            this.events.onRoomExpired?.(code)
          }
          break
        }
        case "room_deleted": {
          const code = this.resolveRoomCode(event.roomHash)
          if (code) {
            const room = this.rooms.get(code)
            if (room) room.key.fill(0)
            this.rooms.delete(code)
            this.hashToCode.delete(event.roomHash)
            this.events.onRoomDeleted?.(code)
          }
          break
        }
        case "error": {
          if (event.roomHash && this.pendingRooms.has(event.roomHash)) {
            this.rejectPending(event.roomHash, event.message)
          } else {
            const fallback = this.findPendingForError()
            if (fallback) {
              this.rejectPending(fallback, event.message)
            }
          }
          this.events.onError?.(event.message)
          break
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to parse server event"
      this.events.onError?.(msg)
    }
  }

  private findPendingForError(): string | null {
    if (this.pendingRooms.size === 1) {
      return Array.from(this.pendingRooms.keys())[0]
    }
    return null
  }

  private sendRaw(data: ClientEvent): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }

  private ensureConnected(): void {
    if (this.state !== "connected" || !this.ws) {
      throw new Error("Not connected to relay server")
    }
  }

  private getRequiredRoom(roomCode: string): RoomInfo {
    const room = this.rooms.get(roomCode)
    if (!room) {
      throw new Error(`Not in room "${roomCode}". Call createRoom() or joinRoom() first.`)
    }
    return room
  }

  private attemptReconnect(): void {
    if (
      !this.config.reconnect ||
      this.reconnectAttempts >= this.config.maxReconnectAttempts
    ) {
      return
    }

    this.state = "reconnecting"
    this.reconnectAttempts++

    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1),
      60000
    )

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect()
        for (const room of this.rooms.values()) {
          this.sendRaw({ event: "join_room", roomHash: room.hash })
        }
      } catch {
        this.attemptReconnect()
      }
    }, delay)
  }

  private startPing(): void {
    this.pingTimer = setInterval(() => {
      this.sendRaw({ event: "ping" })
    }, 25000)
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }
}
