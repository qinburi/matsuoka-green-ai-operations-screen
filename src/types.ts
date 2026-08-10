export type TopicId = 'efficiency' | 'quality' | 'improvement'
export type Severity = 'critical' | 'warning' | 'attention'
export type DataState = 'normal' | 'empty' | 'error' | 'forbidden' | 'stale'

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
