export type TopicId = 'efficiency' | 'quality' | 'improvement'
export type Severity = 'critical' | 'warning' | 'attention'
export type DataState = 'normal' | 'loading' | 'empty' | 'error' | 'forbidden' | 'stale' | 'metric-conflict'
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

export type V3ChartId =
  | 'health-radar'
  | 'issue-scatter'
  | 'process-heatmap'
  | 'completion-trend'
  | 'defect-trend'
  | 'defect-pareto'
  | 'queue-area'
  | 'evidence-timeline'
  | 'causal-graph'
  | 'reason-waterfall'
  | 'action-matrix'
  | 'improvement-compare'
  | 'responsibility-sankey'
  | 'validation-progress'

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

export interface ChartStoryChapter {
  id: string
  order: number
  title: string
  kicker: string
  duration: number
  narrative: string
  conclusion: string
  chartIds: V3ChartId[]
  focusIssueId: string
}

export interface ChartInteractionContext {
  topic: TopicId
  issueId: string
  zoneId: string | null
  timeWindow: string | null
  batch: string | null
  actionPackageId: string | null
}

export interface CausalNode {
  id: string
  type: 'issue' | 'evidence' | 'reason' | 'hypothesis' | 'solution' | 'responsibility'
  label: string
  detail: string
  issueId: string
}

export interface CausalEdge {
  source: string
  target: string
  relationType: RelationType
  confidence: number
  evidenceRef: string
  confirmation: ConfirmationState
}

export interface ActionPackage {
  id: string
  issueId: string
  title: string
  actions: string[]
  prerequisites: string[]
  validationMetrics: string[]
  responsibility: Responsibility
  improvement: ImprovementSnapshot | null
  disclaimer: string
}

export type LifecycleNodeId =
  | 'order-plan'
  | 'procurement'
  | 'material-warehouse'
  | 'cutting'
  | 'sewing'
  | 'special-process'
  | 'finishing'
  | 'quality'
  | 'packing'
  | 'finished-warehouse'

export type LifecycleHealth = 'normal' | 'notice' | 'warning' | 'critical'
export type AlertLevel = 'normal' | 'first' | 'second' | 'third' | 'intervention' | 'verifying' | 'resolved' | 'recurring'
export type ThresholdType = 'standard' | 'management' | 'trend'
export type RecurrenceState = 'continuous' | 'recurring' | 'similar' | 'not-recurred' | 'pending'
export type ChecklistCategory = '设备' | '物料' | '工艺' | '人员' | '管理'
export type ActionPriority = 'P1' | 'P2' | 'P3'
export type ActionStatus = '待响应' | '已响应' | '验证中' | '已完成'
export type PeriodKey = 'yesterday' | 'today' | 'week' | 'month'
export type PeriodMetric = 'count' | 'impact' | 'duration'
export type ProblemDisplayPhase = 'relation' | 'analysis'
export type AnalysisStep = 'evidence' | 'cause-solution' | 'responsibility-validation'
export type StabilityLevel = 'unavailable' | 'observing' | 'pass' | 'good' | 'excellent' | 'recurred'

export interface LifecycleMetric {
  label: string
  value: number
  unit: string
  definition: string
}

export interface LifecycleNode {
  id: LifecycleNodeId
  order: number
  label: string
  shortLabel: string
  department: string
  dataSource: string
  health: LifecycleHealth
  impactIndex: number
  issueCount: number
  coreMetric: LifecycleMetric
  updatedAt: string
  issueIds: string[]
}

export interface ProblemIdentity {
  problemType: string
  factory: string
  process: string
  styleNo: string
  batch: string
  station: string
  timeWindow: string
  continuousCount: number
  firstOccurredAt: string
  lastOccurredAt: string
  recurrenceState: RecurrenceState
}

export interface AlertEvent {
  id: string
  occurredAt: string
  level: AlertLevel
  levelLabel: string
  triggerRule: string
  period: string
  thresholdType: ThresholdType
  threshold: string
  evidence: string
}

export interface InspectionItem {
  id: string
  category: ChecklistCategory
  label: string
  method: string
  requiredEvidence: string
  selected: boolean
}

export interface InterventionRecord {
  id: string
  problemId: string
  handler: string
  checkedItemIds: string[]
  actualMeasure: string
  handledAt: string
  verifyAt: string
  recurrenceResult: '待验证' | '未复发' | '再次复发'
  isDemo: boolean
}

export interface SolutionEffectiveness {
  id: string
  problemType: string
  measure: string
  usageCount: number | null
  nonRecurrenceCount: number | null
  averageRecurrenceInterval: string | null
  applicableConditions: string[]
  baselineStatus: 'available' | 'pending'
}

export interface ManagementAction {
  id: string
  problemId: string
  priority: ActionPriority
  action: string
  triggerBasis: string
  suggestedRole: string
  expectedVerificationAt: string
  status: ActionStatus
}

export interface DutyFact {
  label: '应响应' | '已响应' | '超时' | '缺记录' | '待验证' | '重复发生'
  count: number
  definition: string
}

export interface PeriodComparison {
  period: PeriodKey
  label: string
  currentValue: number
  comparisonValue: number
  changeRate: number
  cutoffAt: string
  definition: string
  unit: string
  nodeId: LifecycleNodeId
}

export interface AlertRuleConfig {
  windowHours: number
  identityFields: readonly string[]
  dedupeRule: string
  resetRule: string
  levels: readonly {
    occurrence: 1 | 2 | 3
    level: 'first' | 'second' | 'third'
    label: string
    action: string
  }[]
}

export interface InterventionCase {
  id: string
  problemId: string
  alertEventId: string
  status: 'pending-intervention' | 'checking' | 'verifying' | 'reopened' | 'stable'
  generatedAt: string
  suggestedChecks: string[]
  suggestedRole: string
  verificationCondition: string
  interventionStartedAt: string | null
  verifiedAt: string | null
  actualMeasureRecorded: boolean
  requiredEvidenceComplete: boolean
  evidenceCompleteness: number
  coordinationActionsCompleted: number
  coordinationActionsTotal: number
}

export interface StabilityAssessment {
  caseId: string
  level: StabilityLevel
  label: string
  nonRecurrenceDays: number | null
  verifiedAt: string | null
  recurredAt: string | null
  eligible: boolean
  reason: string
}

export interface ManagementInterventionEvidence {
  caseId: string
  problemLabel: string
  managerResponseMinutes: number
  nonRecurrenceDays: number
  impactValue: number
  stabilityLevel: Exclude<StabilityLevel, 'unavailable'>
  coordinationActionsCompleted: number
  coordinationActionsTotal: number
  evidenceCompleteness: number
  plannedVerificationAt: string
  actualVerificationAt: string | null
}

export interface EmployeeQualitySuggestion {
  caseId: string
  suggestedLevel: 'pass' | 'good' | 'excellent' | null
  label: string
  status: 'not-generated' | 'pending-review' | 'confirmed' | 'rejected'
  applicable: boolean
  prerequisites: readonly string[]
  evidenceRefs: readonly string[]
  reason: string
}

export interface HealthProblem {
  id: string
  nodeId: LifecycleNodeId
  title: string
  problemType: string
  alertLevel: AlertLevel
  severity: LifecycleHealth
  impactValue: number
  impactUnit: string
  changeFromYesterday: number
  responseStatus: '待响应' | '已响应' | '超时' | '缺记录' | '待验证'
  summary: string
  identity: ProblemIdentity
  facts: Evidence[]
  alertEvents: AlertEvent[]
  inspectionItems: InspectionItem[]
  plan: string[]
  suggestedDepartment: string
  suggestedRole: string
  verificationRequirement: string
  dataGaps: string[]
  traceNodeIds: LifecycleNodeId[]
  traceConfirmation: 'confirmed' | 'pending'
}
