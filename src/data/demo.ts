import type { AnalysisContext, ExperienceMode, TopicDataset, TopicId } from '../types'
import { demoContextOptions, hotspotContexts, rawTopics } from './demo-raw.mjs'

export const topics = rawTopics as Record<TopicId, TopicDataset>
export const contextOptions = demoContextOptions as {
  factories: string[]
  lines: string[]
  periods: string[]
  contracts: string[]
}
export const entryContexts = hotspotContexts as Record<string, {
  topic: TopicId
  source: string
  mode: ExperienceMode
  scenario: string
  focus: string
}>

export const defaultContext: AnalysisContext = {
  factory: contextOptions.factories[0],
  line: contextOptions.lines[0],
  period: contextOptions.periods[0],
  contract: contextOptions.contracts[0],
  source: 'green-ai-entry',
  dataState: 'normal',
}

export const sourceLabels: Record<string, string> = {
  'green-ai-entry': '综合入口',
  'production-performance': '生产实绩',
  'defect-top5': '不良原因 Top5',
  'process-progress': '工程进度',
}

export const stateLabels = {
  normal: '正常演示',
  loading: '加载中',
  empty: '空数据',
  error: '加载失败',
  forbidden: '无权限',
  stale: '数据过期',
  'metric-conflict': '口径冲突',
} as const
