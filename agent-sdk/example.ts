import { AnonymousAgent } from "./client"

const RELAY = process.env.RELAY_URL || "ws://localhost:3001"
const BASE_URL = process.env.BASE_URL || "http://localhost:3000"

async function main() {
  // --- Standard flow: create room → share link → wait for human → talk ---

  const agent = new AnonymousAgent(RELAY, { name: "Coordinator" })

  agent.on({
    onConnected: () => console.log("[Coordinator] Connected"),
    onMessage: (msg, _, roomCode) =>
      console.log(`[Coordinator][${roomCode.slice(0, 6)}] ${msg.agentName}: ${msg.content}`),
    onError: (err) => console.error("[Coordinator] Error:", err),
  })

  await agent.connect()

  // 1. Create the room
  const room = await agent.createRoom({ ttl: 3600, baseUrl: BASE_URL })
  console.log(`\n[Coordinator] Room created: ${room.code}`)
  console.log(`[Coordinator] Share this link with the human observer:`)
  console.log(`  ${room.shareUrl}\n`)

  // 2. Wait for the human (or another peer) to join before sending messages
  console.log("[Coordinator] Waiting for a peer to join...")
  const { peerCount } = await agent.waitForPeer(room.code, { timeout: 120000 })
  console.log(`[Coordinator] Peer joined! (${peerCount} peers in room)\n`)

  // 3. Now the human can see everything — start the conversation
  await agent.sendMessage(room.code, "Welcome! The session has started.")
  await agent.sendMessage(room.code, "All messages from this point are visible to the observer.")

  // --- Multi-agent example: workers join after the human is already observing ---

  const workerA = new AnonymousAgent(RELAY, { name: "Worker-A" })
  const workerB = new AnonymousAgent(RELAY, { name: "Worker-B" })

  workerA.on({
    onMessage: (msg, _, roomCode) =>
      console.log(`[Worker-A][${roomCode.slice(0, 6)}] ${msg.agentName}: ${msg.content}`),
  })

  workerB.on({
    onMessage: (msg, _, roomCode) =>
      console.log(`[Worker-B][${roomCode.slice(0, 6)}] ${msg.agentName}: ${msg.content}`),
  })

  await workerA.connect()
  await workerB.connect()

  await workerA.joinRoom(room.code)
  await workerB.joinRoom(room.code)

  await new Promise((r) => setTimeout(r, 500))

  await agent.sendMessage(room.code, "Workers, begin your tasks.")
  await workerA.sendMessage(room.code, "Task X started.")
  await workerB.sendMessage(room.code, "Task Y started.")

  await new Promise((r) => setTimeout(r, 1000))

  await workerA.sendMessage(room.code, "Task X complete!")
  await workerB.sendMessage(room.code, "Task Y complete!")
  await agent.sendMessage(room.code, "All tasks done. Session ending.")

  await new Promise((r) => setTimeout(r, 300))

  console.log("\n[demo] Conversation complete. Disconnecting...")
  agent.disconnect()
  workerA.disconnect()
  workerB.disconnect()
  process.exit(0)
}

main().catch(console.error)
