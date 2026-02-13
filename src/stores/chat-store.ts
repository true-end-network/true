import { create } from "zustand"
import type { Message, MessagePayload, ServerEvent, RoomJoinedResponse } from "@/lib/protocol"
import {
  deriveRoomKey,
  deriveRoomHash,
  generatePeerId,
  openEnvelope,
} from "@/lib/crypto"
import { RELAY_URL, MAX_CLIENT_MESSAGES } from "@/lib/constants"

export interface ChatMessage {
  id: string
  from: string
  message: Message
  timestamp: number
}

type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting"

interface ChatStore {
  messages: ChatMessage[]
  connectionState: ConnectionState
  roomHash: string | null
  roomKey: Uint8Array | null
  peerId: string | null
  peerCount: number
  error: string | null
  roomCodePreview: string | null

  connect: (roomCode: string) => void
  disconnect: () => void
  clearError: () => void
}

let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectAttempts = 0
let currentRoomCode: string | null = null

const MAX_RECONNECT_ATTEMPTS = 10
const RECONNECT_BASE_DELAY = 3000
const RECONNECT_MAX_DELAY = 60000

function clearReconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  reconnectAttempts = 0
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  connectionState: "disconnected",
  roomHash: null,
  roomKey: null,
  peerId: null,
  peerCount: 0,
  error: null,
  roomCodePreview: null,

  connect: (roomCode: string) => {
    if (ws) {
      ws.close()
    }
    clearReconnect()

    currentRoomCode = roomCode
    const roomHash = deriveRoomHash(roomCode)
    const roomKey = deriveRoomKey(roomCode)
    const peerId = generatePeerId()
    const preview = roomCode.slice(0, 4) + "..." + roomCode.slice(-4)

    const isReconnect = get().roomHash === roomHash && get().messages.length > 0

    set({
      connectionState: isReconnect ? "reconnecting" : "connecting",
      roomHash,
      roomKey,
      peerId,
      roomCodePreview: preview,
      ...(!isReconnect && { messages: [] }),
      error: null,
    })

    ws = new WebSocket(RELAY_URL)

    ws.onopen = () => {
      reconnectAttempts = 0
      set({ connectionState: "connected" })
      ws?.send(JSON.stringify({ event: "join_room", roomHash }))
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as ServerEvent
        const state = get()

        switch (data.event) {
          case "room_created":
            set({ peerCount: 1 })
            break
          case "room_joined":
            set({ peerCount: (data as RoomJoinedResponse).peerCount })
            break
          case "message": {
            const msg = data as MessagePayload
            if (state.roomKey) {
              const decrypted = openEnvelope(msg.envelope, state.roomKey)
              if (decrypted) {
                set((s) => {
                  const updated = [
                    ...s.messages,
                    {
                      id: `${msg.envelope.ts}-${msg.envelope.from}`,
                      from: msg.envelope.from,
                      message: decrypted,
                      timestamp: msg.envelope.ts,
                    },
                  ]
                  return {
                    messages: updated.length > MAX_CLIENT_MESSAGES
                      ? updated.slice(-MAX_CLIENT_MESSAGES)
                      : updated,
                  }
                })
              }
            }
            break
          }
          case "peer_joined":
            set({ peerCount: data.peerCount })
            break
          case "peer_left":
            set({ peerCount: data.peerCount })
            break
          case "room_expired":
            currentRoomCode = null
            set({
              connectionState: "disconnected",
              roomHash: null,
              roomKey: null,
              error: "Room expired",
            })
            ws?.close()
            ws = null
            break
          case "room_deleted":
            currentRoomCode = null
            set({
              connectionState: "disconnected",
              roomHash: null,
              roomKey: null,
              error: "Room deleted",
            })
            ws?.close()
            ws = null
            break
          case "error":
            if (data.code === "ROOM_ERROR" && state.roomHash) {
              ws?.send(JSON.stringify({ event: "create_room", roomHash: state.roomHash, ttl: 3600 }))
            } else {
              set({ error: data.message })
            }
            break
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to process message"
        set({ error: msg })
      }
    }

    ws.onclose = () => {
      ws = null
      const state = get()
      if (currentRoomCode && state.roomHash) {
        attemptReconnect()
      } else {
        set({ connectionState: "disconnected" })
      }
    }

    ws.onerror = () => {
      ws = null
    }
  },

  disconnect: () => {
    const state = get()
    currentRoomCode = null
    clearReconnect()
    if (ws) {
      if (ws.readyState === WebSocket.OPEN && state.roomHash) {
        ws.send(JSON.stringify({ event: "leave_room", roomHash: state.roomHash }))
      }
      ws.close()
    }
    ws = null
    set({
      connectionState: "disconnected",
      roomHash: null,
      roomKey: null,
      peerId: null,
      peerCount: 0,
      messages: [],
      error: null,
      roomCodePreview: null,
    })
  },

  clearError: () => set({ error: null }),
}))

function attemptReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS || !currentRoomCode) {
    useChatStore.setState({
      connectionState: "disconnected",
      error: "Connection lost",
    })
    return
  }

  useChatStore.setState({ connectionState: "reconnecting" })
  reconnectAttempts++

  const delay = Math.min(
    RECONNECT_BASE_DELAY * Math.pow(1.5, reconnectAttempts - 1),
    RECONNECT_MAX_DELAY
  )

  reconnectTimer = setTimeout(() => {
    if (currentRoomCode) {
      useChatStore.getState().connect(currentRoomCode)
    }
  }, delay)
}
