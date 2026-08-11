export type TopicId = 'efficiency' | 'quality' | 'improvement'
export type Severity = 'critical' | 'warning' | 'attention'
export type DataState = 'normal' | 'empty' | 'error' | 'forbidden' | 'stale'
export type ExperienceMode = 'guided' | 'explore'
export type ZoneHealth = 'normal' | 'attention' | 'warning' | 'critical'
export type RelationType = 'fact' | 'correlation' | 'ai-hypothesis' | 'confirmed-cause'
export type ConfirmationState = 'confirmed' | 'pending'
export type ProcessAnimationState = 'ambient' | 'warning' | 'selected' | 'diagnosing' | 'improving' | 'recovered'
export type AiAnalysisStage = 'idle' | 'scan' | 'lock' | 'evidence' | 'hypothesis' | 'solution' | 'responsibility'
export type ProcessVisualKind =
  | 'cutting'
  | 'sewing'
  | 'inspection-inbound'
  | 'special-cell'
  | 'inspection-queue'
  | 'finishing'
  | 'inspection-final'
  | 'folding'
  | 'warehouse'

export interface MetricDefinition {
  id: string
  label: string
  value: number
  unit: string
  trend: number
  trendLabel: string
  status: 'good' | 'warning' | 'critical'
  definition: string
  source: string
}

export interface Reason {
  title: string
  description: string
  evidence: string
}

export interface Solution {
  title: string
  description: string
  validation: string
}

export interface Responsibility {
  department: string
  role: string
  confirmation: string
}

export interface Evidence {
  label: string
  value: string
  source: string
}

export interface KnowledgeReference {
  id: string
  title: string
  version: string
}

export interface Issue {
  id: string
  topic: TopicId
  title: string
  shortLabel: string
  stage: string
  severity: Severity
  metric: string
  impact: number
  impactUnit: string
  occurrence: number
  confidence: number
  summary: string
  reasons: Reason[]
  solutions: Solution[]
  responsibility: Responsibility
  evidence: Evidence[]
  knowledgeRefs: KnowledgeReference[]
  dataGaps: string[]
}

export interface TopicDataset {
  id: TopicId
  label: string
  kicker: string
  description: string
  bossConclusion: string
  bossAction: string
  metrics: MetricDefinition[]
  issues: Issue[]
  trend: number[]
  trendLabels: string[]
}

export interface AnalysisContext {
  factory: string
  line: string
  period: string
  contract: string
  source: string
  dataState: DataState
}

export interface CameraPreset {
  position: [number, number, number]
  target: [number, number, number]
  duration: number
}

export interface CameraShot extends CameraPreset {
  framing: 'overview' | 'zone' | 'relationship'
  pathLift: number
}

export interface ProcessRuntimeState {
  throughputRate: number
  capacityPerHour: number
  wip: number
  queue: number
  starvationRate: number
  severity: number
}

export interface ProcessPort {
  position: [number, number, number]
  direction: [number, number, number]
}

export interface ProcessModelProfile {
  footprint: [number, number]
  elevation: number
  materialFamily: 'production' | 'inspection' | 'logistics'
  desktopDetail: number
  mobileDetail: number
}

export interface ProductionFlowSnapshot {
  throughputScale: number
  queueScale: number
  starvationScale: number
  bottleneckZoneId: string | null
}

export interface ImprovementSnapshot {
  status: 'inactive' | 'simulation' | 'recovered'
  queueBefore: number
  queueAfter: number
  completionBefore: number
  completionAfter: number
  disclaimer: string
}

export interface ProcessNodeVisual {
  kind: ProcessVisualKind
  scale: number
  offset: [number, number, number]
  motionRate: number
}

export interface FactoryZone {
  id: string
  label: string
  shortLabel: string
  stage: string
  position: [number, number, number]
  health: ZoneHealth
  metric: string
  metricValue: string
  issueIds: string[]
  stationCount: number
  visual: ProcessNodeVisual
  inputPort: ProcessPort
  outputPort: ProcessPort
  runtime: ProcessRuntimeState
  model: ProcessModelProfile
}

export interface SceneNode {
  id: string
  zoneId: string
  kind: 'zone' | 'station' | 'signal'
  position: [number, number, number]
  issueIds: string[]
}

export interface IssueRelation {
  id: string
  sourceIssueId: string
  targetIssueId: string
  type: RelationType
  confidence: number
  label: string
  evidence: string[]
  confirmation: ConfirmationState
}

export interface DemoChapter {
  id: string
  order: number
  title: string
  kicker: string
  duration: number
  narrative: string
  focusZoneId: string | null
  focusIssueId: string | null
  camera: CameraShot
  evidenceMode: 'hidden' | 'metrics' | 'relationship' | 'actions' | 'summary'
  aiStage: AiAnalysisStage
  flow: ProductionFlowSnapshot
  improvement: ImprovementSnapshot
}

export interface DemoScenario {
  id: string
  title: string
  totalDuration: number
  chapters: DemoChapter[]
}
