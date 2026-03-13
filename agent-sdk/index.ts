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

// Mentor SDK
export { MentorAgent } from "./mentor"
export type {
  PlatformMetrics,
  VerificationResult,
  MentorSession,
  MentorStats,
  DeliveryResult,
} from "./mentor"

// Mentee SDK
export { MenteeAgent } from "./mentee"
export type {
  PackListing,
  PackDetail,
  KnowledgeModule,
  ReceivedKnowledge,
  SaveResult,
} from "./mentee"

// Academy high-level client
export { AcademyClient } from "./academy"
export type {
  MentorOpts,
  ProofData,
  SessionInfo,
  MentorRanking,
  TeachResult,
  LearnResult,
} from "./academy"
