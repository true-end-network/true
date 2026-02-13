import { AnonymousAgent } from "./client"

const RELAY = process.env.RELAY_URL || "ws://localhost:3001"

async function main() {
  const coordinator = new AnonymousAgent(RELAY, { name: "Coordinator" })
  const workerA = new AnonymousAgent(RELAY, { name: "Worker-A" })
  const workerB = new AnonymousAgent(RELAY, { name: "Worker-B" })

  coordinator.on({
    onConnected: () => console.log("[Coordinator] Connected"),
    onMessage: (msg, _, roomCode) =>
      console.log(`[Coordinator][${roomCode.slice(0, 6)}] ${msg.agentName}: ${msg.content}`),
    onPeerJoined: (_, count, roomCode) =>
      console.log(`[Coordinator][${roomCode.slice(0, 6)}] Peer joined (total: ${count})`),
  })

  workerA.on({
    onMessage: (msg, _, roomCode) =>
      console.log(`[Worker-A][${roomCode.slice(0, 6)}] ${msg.agentName}: ${msg.content}`),
  })

  workerB.on({
    onMessage: (msg, _, roomCode) =>
      console.log(`[Worker-B][${roomCode.slice(0, 6)}] ${msg.agentName}: ${msg.content}`),
  })

  await coordinator.connect()
  await workerA.connect()
  await workerB.connect()

  const roomA = await coordinator.createRoom({ ttl: 300 })
  const roomB = await coordinator.createRoom({ ttl: 300 })
  console.log(`[Coordinator] Room A: ${roomA.code}`)
  console.log(`[Coordinator] Room B: ${roomB.code}`)
  console.log(`[Coordinator] Active rooms: ${coordinator.activeRooms.length}`)

  await new Promise((r) => setTimeout(r, 500))

  await workerA.joinRoom(roomA.code)
  await workerB.joinRoom(roomB.code)

  await new Promise((r) => setTimeout(r, 500))

  await coordinator.sendMessage(roomA.code, "Worker-A, process task X")
  await coordinator.sendMessage(roomB.code, "Worker-B, process task Y")

  await new Promise((r) => setTimeout(r, 300))

  await workerA.sendMessage(roomA.code, "Task X complete!")
  await workerB.sendMessage(roomB.code, "Task Y complete!")

  await new Promise((r) => setTimeout(r, 300))

  console.log("\n[demo] Multi-room conversation complete. Disconnecting...")
  coordinator.disconnect()
  workerA.disconnect()
  workerB.disconnect()
  process.exit(0)
}

main().catch(console.error)
