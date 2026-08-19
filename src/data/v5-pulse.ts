import type {
  ClosureEvaluation,
  ProblemClosureTimeline,
  ProblemOwnerProfile,
  ProblemTrendProfile,
  ProblemTrendSeries,
  PulsePeriodKey,
} from '../types'
import { healthProblems } from './v4-health-center'
import { buildCustomPulseRangeRaw, evaluatePulseClosureRaw } from './v5-pulse-raw.mjs'

export const pulseAsOf = '2026-08-12T17:00:00+08:00'
export const pulseUpdatedAt = '2026-08-12 17:00'
export const pulsePeriodLabels: Record<PulsePeriodKey, string> = {
  today: '日',
  week: '周',
  month: '月',
  custom: '自定义',
}

const dayLabels = Array.from({ length: 10 }, (_, index) => `${String(index + 8).padStart(2, '0')}:00`)

const trendSeed: Record<string, Omit<ProblemTrendProfile, 'problemId' | 'source'>> = {
  'P-QA-01': { metricLabel: '缝皱不良率', unit: '%', definition: '每小时缝皱不良数量 / 每小时检验数量', aggregation: 'average', normalMax: 2, warningMax: 3, decimals: 1, dayCurrent: [1.2, 1.8, 2.4, 1.9, 2.8, 3.4, 3.9, 3.1, 2.7, 2.2], dayComparison: [1.1, 1.4, 1.6, 1.5, 1.9, 2.1, 2.3, 1.8, 1.6, 1.5] },
  'P-SEW-01': { metricLabel: '超时在制', unit: 'pcs', definition: '每小时末在当前工序停留超过管理阈值的在制数量', aggregation: 'peak', normalMax: 180, warningMax: 200, decimals: 0, dayCurrent: [96, 118, 146, 174, 196, 214, 207, 194, 176, 158], dayComparison: [82, 94, 112, 128, 145, 162, 154, 148, 136, 121] },
  'P-CUT-01': { metricLabel: '裁片尺寸偏差率', unit: '%', definition: '每小时尺寸偏差裁片数 / 每小时抽检裁片数', aggregation: 'average', normalMax: 1.2, warningMax: 1.8, decimals: 1, dayCurrent: [0.8, 1.1, 1.5, 2, 1.7, 2.2, 1.9, 1.6, 1.4, 1.3], dayComparison: [0.7, 0.9, 1.1, 1.2, 1.1, 1.4, 1.2, 1, 0.9, 0.8] },
  'P-PACK-01': { metricLabel: '待复核包装', unit: 'pcs', definition: '每小时末标签或装箱信息需要复核的包装数量', aggregation: 'peak', normalMax: 18, warningMax: 30, decimals: 0, dayCurrent: [6, 8, 12, 16, 19, 24, 31, 38, 33, 27], dayComparison: [5, 6, 8, 11, 13, 16, 18, 20, 17, 14] },
  'P-MAT-01': { metricLabel: '待复核物料批次', unit: '批', definition: '每小时末等待复核的面辅料批次数量', aggregation: 'peak', normalMax: 1, warningMax: 2, decimals: 0, dayCurrent: [0, 1, 1, 2, 3, 3, 2, 2, 1, 1], dayComparison: [0, 0, 1, 1, 1, 2, 1, 1, 1, 0] },
  'P-PLAN-01': { metricLabel: '风险工单', unit: '单', definition: '小时达成趋势持续低于管理参考线的工单数量', aggregation: 'peak', normalMax: 1, warningMax: 2, decimals: 0, dayCurrent: [0, 0, 1, 1, 1, 2, 2, 2, 1, 1], dayComparison: [0, 0, 0, 1, 1, 1, 1, 1, 0, 0] },
  'P-BUY-01': { metricLabel: '到料风险订单', unit: '单', definition: '预计到料晚于计划齐套时间的采购订单数量', aggregation: 'peak', normalMax: 0, warningMax: 1, decimals: 0, dayCurrent: [0, 0, 0, 1, 1, 1, 2, 2, 2, 2], dayComparison: [0, 0, 0, 0, 1, 1, 1, 1, 1, 1] },
  'P-SPECIAL-01': { metricLabel: '待复核特殊工艺批次', unit: '批', definition: '每小时末完成工艺后等待品质复核的批次数量', aggregation: 'peak', normalMax: 1, warningMax: 2, decimals: 0, dayCurrent: [0, 1, 1, 1, 2, 2, 3, 3, 2, 2], dayComparison: [0, 0, 1, 1, 1, 1, 2, 1, 1, 1] },
  'P-FIN-01': { metricLabel: '节拍偏差率', unit: '%', definition: '每小时实际节拍相对目标节拍的偏差幅度', aggregation: 'average', normalMax: 5, warningMax: 7, decimals: 1, dayCurrent: [3.8, 4.2, 5.4, 6.1, 4.8, 3.6, 2.9, 2.4, 2, 2.6], dayComparison: [3, 3.2, 3.5, 3.8, 3.3, 3, 2.6, 2.2, 1.9, 2] },
  'P-QA-02': { metricLabel: '终检污渍数量', unit: 'pcs', definition: '每小时终检记录的同类污渍异常数量', aggregation: 'sum', normalMax: 2, warningMax: 4, decimals: 0, dayCurrent: [0, 1, 1, 2, 4, 3, 1, 0, 0, 0], dayComparison: [0, 0, 1, 1, 2, 1, 1, 0, 0, 0] },
  'P-FG-01': { metricLabel: '成品待放行', unit: 'pcs', definition: '每小时末已入库但未取得出货放行状态的成品数量', aggregation: 'peak', normalMax: 50, warningMax: 80, decimals: 0, dayCurrent: [22, 28, 36, 48, 57, 68, 79, 86, 74, 61], dayComparison: [18, 24, 31, 38, 45, 52, 58, 62, 55, 48] },
}

export const problemTrendProfiles: ProblemTrendProfile[] = healthProblems.map((problem) => {
  const seed = trendSeed[problem.id] ?? trendSeed['P-PLAN-01']
  return {
    problemId: problem.id,
    source: problem.facts[0]?.source ?? '演示：MES/QMS问题记录',
    ...seed,
  }
})

export const trendProfileByProblemId = new Map(problemTrendProfiles.map((profile) => [profile.problemId, profile]))

const owners: ProblemOwnerProfile[] = [
  { id: 'OWNER-QA', problemId: 'P-QA-01', displayName: 'QC组长（演示）', department: '品质部', role: '品质异常闭环负责人', avatarAsset: 'assets/avatars/v5-owner-quality.svg', isDemo: true },
  { id: 'OWNER-SEW', problemId: 'P-SEW-01', displayName: '缝制三组组长（演示）', department: '缝制课', role: '在制与线平衡负责人', avatarAsset: 'assets/avatars/v5-owner-sewing.svg', isDemo: true },
  { id: 'OWNER-CUT', problemId: 'P-CUT-01', displayName: '裁断组长（演示）', department: '裁断课', role: '裁片质量负责人', avatarAsset: 'assets/avatars/v5-owner-cutting.svg', isDemo: true },
  { id: 'OWNER-PACK', problemId: 'P-PACK-01', displayName: '包装组长（演示）', department: '包装课', role: '包装复核负责人', avatarAsset: 'assets/avatars/v5-owner-packaging.svg', isDemo: true },
  { id: 'OWNER-MAT', problemId: 'P-MAT-01', displayName: 'IQC组长（演示）', department: '资材部 / 品质部', role: '来料复核负责人', avatarAsset: 'assets/avatars/v5-owner-quality.svg', isDemo: true },
  { id: 'OWNER-PLAN', problemId: 'P-PLAN-01', displayName: '生产主管（演示）', department: '生产管理', role: '计划执行负责人', avatarAsset: 'assets/avatars/v5-owner-sewing.svg', isDemo: true },
  { id: 'OWNER-BUY', problemId: 'P-BUY-01', displayName: '采购担当（演示）', department: '采购部', role: '齐套风险负责人', avatarAsset: 'assets/avatars/v5-owner-packaging.svg', isDemo: true },
  { id: 'OWNER-SPECIAL', problemId: 'P-SPECIAL-01', displayName: '特殊工艺组长（演示）', department: '特殊工艺课', role: '批次复核负责人', avatarAsset: 'assets/avatars/v5-owner-cutting.svg', isDemo: true },
  { id: 'OWNER-FIN', problemId: 'P-FIN-01', displayName: '整理组长（演示）', department: '整理课', role: '节拍观察负责人', avatarAsset: 'assets/avatars/v5-owner-sewing.svg', isDemo: true },
  { id: 'OWNER-QA2', problemId: 'P-QA-02', displayName: '终检组长（演示）', department: '品质部', role: '终检验证负责人', avatarAsset: 'assets/avatars/v5-owner-quality.svg', isDemo: true },
  { id: 'OWNER-FG', problemId: 'P-FG-01', displayName: '成品仓管理员（演示）', department: '成品仓库', role: '放行状态负责人', avatarAsset: 'assets/avatars/v5-owner-packaging.svg', isDemo: true },
]

export const ownerByProblemId = new Map(owners.map((owner) => [owner.problemId, owner]))

const timelines: ProblemClosureTimeline[] = [
  { problemId: 'P-QA-01', ownerId: 'OWNER-QA', occurredAt: '2026-08-12T13:52:00+08:00', responseAt: null, handledAt: null, verifiedAt: null, responseTargetAt: '2026-08-12T14:07:00+08:00', resolutionTargetAt: '2026-08-12T16:00:00+08:00', status: 'pending', actualMeasure: null, verificationEvidence: null, evidenceComplete: false, recurredAt: null, isDemo: true },
  { problemId: 'P-SEW-01', ownerId: 'OWNER-SEW', occurredAt: '2026-08-12T12:46:00+08:00', responseAt: '2026-08-12T13:02:00+08:00', handledAt: '2026-08-12T14:08:00+08:00', verifiedAt: null, responseTargetAt: '2026-08-12T13:06:00+08:00', resolutionTargetAt: '2026-08-12T15:00:00+08:00', status: 'processing', actualMeasure: '核对瓶颈工位并临时拆分超时在制', verificationEvidence: null, evidenceComplete: false, recurredAt: null, isDemo: true },
  { problemId: 'P-QA-02', ownerId: 'OWNER-QA2', occurredAt: '2026-08-12T12:22:00+08:00', responseAt: '2026-08-12T12:28:00+08:00', handledAt: '2026-08-12T12:36:00+08:00', verifiedAt: '2026-08-12T15:00:00+08:00', responseTargetAt: '2026-08-12T12:37:00+08:00', resolutionTargetAt: '2026-08-12T15:22:00+08:00', status: 'verified', actualMeasure: '清洁检验台并调整转运防护', verificationEvidence: '连续两个检验窗口未发现同类污渍', evidenceComplete: true, recurredAt: null, isDemo: true },
  { problemId: 'P-MAT-01', ownerId: 'OWNER-MAT', occurredAt: '2026-08-12T10:38:00+08:00', responseAt: '2026-08-12T11:20:00+08:00', handledAt: '2026-08-12T12:10:00+08:00', verifiedAt: '2026-08-12T15:30:00+08:00', responseTargetAt: '2026-08-12T11:08:00+08:00', resolutionTargetAt: '2026-08-12T16:00:00+08:00', status: 'verified', actualMeasure: '按卷号扩大抽样并完成批次复核', verificationEvidence: '分卷检测值与放行记录完整', evidenceComplete: true, recurredAt: null, isDemo: true },
  { problemId: 'P-CUT-01', ownerId: 'OWNER-CUT', occurredAt: '2026-08-12T11:42:00+08:00', responseAt: '2026-08-12T11:54:00+08:00', handledAt: '2026-08-12T12:20:00+08:00', verifiedAt: '2026-08-12T13:10:00+08:00', responseTargetAt: '2026-08-12T12:02:00+08:00', resolutionTargetAt: '2026-08-12T14:00:00+08:00', status: 'recurred', actualMeasure: '更换刀具并重新确认裁剪文件版本', verificationEvidence: '距上次处理19小时再次触发同一问题身份证', evidenceComplete: true, recurredAt: '2026-08-12T14:06:00+08:00', isDemo: true },
  { problemId: 'P-FIN-01', ownerId: 'OWNER-FIN', occurredAt: '2026-08-12T12:48:00+08:00', responseAt: '2026-08-12T12:55:00+08:00', handledAt: '2026-08-12T13:15:00+08:00', verifiedAt: '2026-08-12T14:00:00+08:00', responseTargetAt: '2026-08-12T13:03:00+08:00', resolutionTargetAt: '2026-08-12T14:30:00+08:00', status: 'verified', actualMeasure: '保持观察并复核下一窗口节拍', verificationEvidence: '下一小时节拍恢复至管理区间', evidenceComplete: true, recurredAt: null, isDemo: true },
  { problemId: 'P-PACK-01', ownerId: 'OWNER-PACK', occurredAt: '2026-08-12T13:28:00+08:00', responseAt: null, handledAt: null, verifiedAt: null, responseTargetAt: '2026-08-12T13:58:00+08:00', resolutionTargetAt: '2026-08-12T15:30:00+08:00', status: 'pending', actualMeasure: null, verificationEvidence: null, evidenceComplete: false, recurredAt: null, isDemo: true },
  { problemId: 'P-PLAN-01', ownerId: 'OWNER-PLAN', occurredAt: '2026-08-12T13:20:00+08:00', responseAt: '2026-08-12T13:42:00+08:00', handledAt: null, verifiedAt: null, responseTargetAt: '2026-08-12T13:50:00+08:00', resolutionTargetAt: '2026-08-12T16:30:00+08:00', status: 'processing', actualMeasure: null, verificationEvidence: null, evidenceComplete: false, recurredAt: null, isDemo: true },
  { problemId: 'P-BUY-01', ownerId: 'OWNER-BUY', occurredAt: '2026-08-12T13:04:00+08:00', responseAt: '2026-08-12T13:34:00+08:00', handledAt: null, verifiedAt: null, responseTargetAt: '2026-08-12T13:34:00+08:00', resolutionTargetAt: '2026-08-12T17:00:00+08:00', status: 'processing', actualMeasure: null, verificationEvidence: null, evidenceComplete: false, recurredAt: null, isDemo: true },
  { problemId: 'P-SPECIAL-01', ownerId: 'OWNER-SPECIAL', occurredAt: '2026-08-12T13:12:00+08:00', responseAt: '2026-08-12T13:30:00+08:00', handledAt: '2026-08-12T14:05:00+08:00', verifiedAt: null, responseTargetAt: '2026-08-12T13:42:00+08:00', resolutionTargetAt: '2026-08-12T16:00:00+08:00', status: 'processing', actualMeasure: '补齐批次工艺与品质交接记录', verificationEvidence: null, evidenceComplete: false, recurredAt: null, isDemo: true },
  { problemId: 'P-FG-01', ownerId: 'OWNER-FG', occurredAt: '2026-08-12T13:36:00+08:00', responseAt: '2026-08-12T13:52:00+08:00', handledAt: null, verifiedAt: null, responseTargetAt: '2026-08-12T14:06:00+08:00', resolutionTargetAt: '2026-08-12T16:30:00+08:00', status: 'processing', actualMeasure: null, verificationEvidence: null, evidenceComplete: false, recurredAt: null, isDemo: true },
]

export const timelineByProblemId = new Map(timelines.map((timeline) => [timeline.problemId, timeline]))

function round(value: number, decimals: number) {
  const scale = 10 ** decimals
  return Math.round(value * scale) / scale
}

function resample(values: number[], length: number, decimals: number, factor: number) {
  return Array.from({ length }, (_, index) => {
    const position = length <= 1 ? 0 : index / (length - 1) * (values.length - 1)
    const lower = Math.floor(position)
    const upper = Math.min(values.length - 1, lower + 1)
    const ratio = position - lower
    const base = values[lower] * (1 - ratio) + values[upper] * ratio
    const pulse = 1 + Math.sin((index + 1) * 1.43) * 0.055
    return round(Math.max(0, base * factor * pulse), decimals)
  })
}

export function getProblemTrendSeries(
  profile: ProblemTrendProfile,
  period: PulsePeriodKey,
  customFrom = '2026-08-01',
  customTo = '2026-08-12',
): ProblemTrendSeries {
  if (period === 'today') {
    return { labels: dayLabels, currentValues: profile.dayCurrent, comparisonValues: profile.dayComparison, currentLabel: '今日', comparisonLabel: '昨日', rangeLabel: '2026-08-12 08:00-17:00', comparisonRangeLabel: '2026-08-11 08:00-17:00', granularity: 'hour' }
  }

  if (period === 'week') {
    const labels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
    return { labels, currentValues: resample(profile.dayCurrent, 7, profile.decimals, 0.92), comparisonValues: resample(profile.dayComparison, 7, profile.decimals, 0.95), currentLabel: '本周', comparisonLabel: '上周同期', rangeLabel: '2026-08-10 至 2026-08-16', comparisonRangeLabel: '2026-08-03 至 2026-08-09', granularity: 'day' }
  }

  if (period === 'month') {
    const labels = Array.from({ length: 12 }, (_, index) => `08/${String(index + 1).padStart(2, '0')}`)
    return { labels, currentValues: resample(profile.dayCurrent, 12, profile.decimals, 0.96), comparisonValues: resample(profile.dayComparison, 12, profile.decimals, 0.98), currentLabel: '本月', comparisonLabel: '上月同期', rangeLabel: '2026-08-01 至 2026-08-12', comparisonRangeLabel: '2026-07-01 至 2026-07-12', granularity: 'day' }
  }

  const custom = buildCustomPulseRangeRaw(customFrom, customTo) ?? buildCustomPulseRangeRaw('2026-08-01', '2026-08-12')!
  return {
    labels: custom.labels,
    currentValues: resample(profile.dayCurrent, custom.labels.length, profile.decimals, 0.94),
    comparisonValues: resample(profile.dayComparison, custom.labels.length, profile.decimals, 0.97),
    currentLabel: '当前区间',
    comparisonLabel: '前一等长区间',
    rangeLabel: custom.currentRangeLabel,
    comparisonRangeLabel: custom.comparisonRangeLabel,
    granularity: custom.granularity as ProblemTrendSeries['granularity'],
  }
}

export function getClosureEvaluation(timeline: ProblemClosureTimeline): ClosureEvaluation {
  return evaluatePulseClosureRaw(timeline, pulseAsOf) as ClosureEvaluation
}

export const closureEvaluationByProblemId = new Map(timelines.map((timeline) => [timeline.problemId, getClosureEvaluation(timeline)]))
