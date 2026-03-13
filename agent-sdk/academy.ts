import { MentorAgent } from "./mentor"
import { MenteeAgent } from "./mentee"
import type { KnowledgePack } from "../src/lib/knowledge-pack"
import type { PackListing, PackDetail, KnowledgeModule, ReceivedKnowledge, SaveResult } from "./mentee"
import type { PlatformMetrics, VerificationResult, MentorSession, MentorStats, DeliveryResult } from "./mentor"

// ---------------------------------------------------------------------------
// AcademyClient types
// ---------------------------------------------------------------------------

export interface MentorOpts {
  /** Mentor name shown in the relay */
  name?: string
  /** Base URL for share links */
  relayBaseUrl?: string
  /** ms to pause between modules during delivery */
  pauseBetweenModules?: number
  /** Enable interactive Q&A pauses */
  interactive?: boolean
}

export interface ProofData {
  platform: "x" | "instagram" | "tiktok" | "youtube"
  type: "screenshot" | "api_verified"
  screenshotPath?: string
  metrics: PlatformMetrics
}

export interface SessionInfo {
  sessionId: string
  roomCode: string
  packId: string
}

export interface MentorRanking {
  mentorId: string
  name: string
  platform: string
  rating: number
  sessions: number
  packCount: number
}

export interface TeachResult {
  sessionId: string
  delivery: DeliveryResult
}

export interface LearnResult {
  knowledge: ReceivedKnowledge
  saved?: SaveResult
}

// ---------------------------------------------------------------------------
// AcademyClient — convenience wrapper
// ---------------------------------------------------------------------------

/**
 * High-level client that combines mentor and mentee functionality.
 * Manages its own agent instances internally.
 */
export class AcademyClient {
  private _mentor: MentorAgent | null = null
  private _mentee: MenteeAgent | null = null

  constructor(
    private readonly relayUrl: string,
    private readonly apiUrl: string
  ) {}

  // ---------------------------------------------------------------------------
  // Internal agent accessors (lazy + connected)
  // ---------------------------------------------------------------------------

  private async mentor(name?: string): Promise<MentorAgent> {
    if (!this._mentor) {
      this._mentor = new MentorAgent(this.relayUrl, { name })
      await this._mentor.connect()
    }
    return this._mentor
  }

  private async mentee(name?: string): Promise<MenteeAgent> {
    if (!this._mentee) {
      this._mentee = new MenteeAgent(this.relayUrl, { name })
      await this._mentee.connect()
    }
    return this._mentee
  }

  // ---------------------------------------------------------------------------
  // Browse / discovery
  // ---------------------------------------------------------------------------

  /** Search packs by keyword. */
  async search(query: string): Promise<PackListing[]> {
    const agent = await this.mentee()
    return agent.browsePacks(this.apiUrl, { search: query })
  }

  /** Return top-rated / featured packs. */
  async featured(): Promise<PackListing[]> {
    const agent = await this.mentee()
    return agent.browsePacks(this.apiUrl, { sort: "rating", minRating: 4 })
  }

  /** Return mentor leaderboard. */
  async leaderboard(): Promise<MentorRanking[]> {
    const res = await fetch(`${this.apiUrl}/api/marketplace/leaderboard`)
    if (!res.ok) {
      throw new Error(`Failed to fetch leaderboard: ${res.status} ${await res.text()}`)
    }
    return res.json() as Promise<MentorRanking[]>
  }

  // ---------------------------------------------------------------------------
  // Mentor flow
  // ---------------------------------------------------------------------------

  /**
   * Register a knowledge pack on the marketplace and return its ID.
   */
  async registerPack(pack: KnowledgePack, opts: MentorOpts = {}): Promise<string> {
    const agent = await this.mentor(opts.name)
    return agent.registerAsMentor(this.apiUrl, pack)
  }

  /**
   * Upload engagement proof for a registered pack.
   */
  async uploadProof(packId: string, proof: ProofData): Promise<VerificationResult> {
    const agent = await this.mentor()
    return agent.uploadEngagementProof(this.apiUrl, packId, proof)
  }

  /**
   * Wait for a student session request for the given pack.
   * Polls the sessions API until a pending session appears.
   */
  async waitForStudent(
    packId: string,
    opts: { mentorId: string; pollIntervalMs?: number; timeoutMs?: number } = { mentorId: "" }
  ): Promise<SessionInfo> {
    const pollInterval = opts.pollIntervalMs ?? 5000
    const timeout = opts.timeoutMs ?? 300_000
    const deadline = Date.now() + timeout
    const agent = await this.mentor()

    while (Date.now() < deadline) {
      const sessions: MentorSession[] = await agent.listMySessions(this.apiUrl, opts.mentorId)
      const pending = sessions.find((s) => s.packId === packId && s.status === "pending")
      if (pending) {
        await agent.acceptSession(this.apiUrl, pending.sessionId)
        return { sessionId: pending.sessionId, roomCode: pending.roomCode, packId }
      }
      await new Promise((r) => setTimeout(r, pollInterval))
    }
    throw new Error(`Timed out waiting for a student for pack ${packId}`)
  }

  /**
   * Deliver a knowledge pack to a student in the given session room.
   */
  async teach(session: SessionInfo, pack: KnowledgePack, opts: MentorOpts = {}): Promise<TeachResult> {
    const agent = await this.mentor(opts.name)
    await agent.createRoom({ baseUrl: opts.relayBaseUrl })
    // Join the session room
    await agent.joinRoom(session.roomCode)
    await agent.startMentorSession(session.roomCode, pack)
    const delivery = await agent.deliverFullPack(session.roomCode, {
      pauseBetweenModules: opts.pauseBetweenModules,
      interactive: opts.interactive,
    })
    return { sessionId: session.sessionId, delivery }
  }

  // ---------------------------------------------------------------------------
  // Mentee flow
  // ---------------------------------------------------------------------------

  /**
   * Request a session for the given pack and join the room.
   * Returns a SessionInfo ready for learn().
   */
  async enroll(packId: string): Promise<SessionInfo> {
    const agent = await this.mentee()
    const { sessionId, roomCode } = await agent.requestSession(this.apiUrl, packId)
    await agent.joinRoom(roomCode)
    return { sessionId, roomCode, packId }
  }

  /**
   * Receive and optionally save the knowledge delivered in a session.
   */
  async learn(
    session: SessionInfo,
    memoryDir?: string,
    opts?: {
      onProgress?: (stage: string, percent: number) => void
      onModuleReceived?: (module: KnowledgeModule) => void
    }
  ): Promise<LearnResult> {
    const agent = await this.mentee()
    const knowledge = await agent.receiveMentorSession(session.roomCode, {
      onProgress: opts?.onProgress,
      onModuleReceived: opts?.onModuleReceived,
      autoSave: !!memoryDir,
      memoryDir,
    })

    let saved: SaveResult | undefined
    if (memoryDir) {
      saved = await agent.saveToMemory(knowledge.pack, memoryDir)
    }

    return { knowledge, saved }
  }

  /**
   * Submit a star-rating + comment review for a completed session.
   */
  async review(sessionId: string, rating: number, comment: string): Promise<void> {
    const agent = await this.mentee()
    await agent.submitReview(this.apiUrl, sessionId, { rating, comment })
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /** Disconnect all internal agents. */
  disconnect(): void {
    this._mentor?.disconnect()
    this._mentee?.disconnect()
    this._mentor = null
    this._mentee = null
  }
}

// Re-export types for consumers who import from academy.ts
export type { PackListing, PackDetail, KnowledgeModule, ReceivedKnowledge, SaveResult }
export type { PlatformMetrics, VerificationResult, MentorSession, MentorStats, DeliveryResult }
