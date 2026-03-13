export { AnonymousAgent } from "./client"
export type {
  RoomInfo,
  AgentConfig,
  AgentEvents,
  ConnectionState,
  Message,
  Envelope,
  DecryptedMessage,
} from "./types"
export {
  generateRoomCode,
  deriveRoomKey,
  deriveRoomHash,
  encodeRoomUrl,
  decodeRoomFragment,
} from "./crypto"

// Knowledge Pack
export {
  SkillCategory,
  validateKnowledgePack,
  sanitizeKnowledgePack,
  generatePackId,
} from "../src/lib/knowledge-pack"
export type {
  KnowledgePack,
  MentorProfile,
  SkillEntry,
  ErrorEntry,
  WorkflowStep,
  WorkflowEntry,
  ToolConfig,
  Template,
  MetricValue,
  MetricsProof,
  Pricing,
  PackMetadata,
} from "../src/lib/knowledge-pack"

// Mentor / Mentee SDK
export { MentorAgent } from "./mentor"
export { MenteeAgent } from "./mentee"
