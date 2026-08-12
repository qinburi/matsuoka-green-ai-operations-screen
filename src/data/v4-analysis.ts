import type {
  AlertRuleConfig,
  EmployeeQualitySuggestion,
  HealthProblem,
  InterventionCase,
  LifecycleNode,
  ManagementInterventionEvidence,
  PeriodComparison,
  PeriodKey,
  PeriodMetric,
  StabilityAssessment,
} from '../types'
import { alertRuleConfigRaw, calculateStabilityAssessmentRaw } from './v4-rules-raw.mjs'

export const periodKeys: PeriodKey[] = ['yesterday', 'today', 'week', 'month']
export const periodLabels: Record<PeriodKey, string> = { yesterday: '昨日', today: '今日', week: '本周', month: '本月' }
export const periodMetricLabels: Record<PeriodMetric, string> = { count: '问题次数', impact: '影响数量', duration: '平均响应时长' }

const periodDefinitions: Record<PeriodKey, { cutoffAt: string; definition: string }> = {
  yesterday: { cutoffAt: '昨日生产日结束', definition: '前一完整生产日，对比前第二个完整生产日' },
  today: { cutoffAt: '今日 14:22', definition: '今日截至当前，对比昨日相同生产时间窗' },
  week: { cutoffAt: '本周三 14:22', definition: '周初至当前，对比上周相同星期与时间范围' },
  month: { cutoffAt: '本月12日 14:22', definition: '月初至当前，对比上月相同日期与时间范围' },
}

const qualityValues: Record<PeriodMetric, Array<[number, number]>> = {
  count: [[9, 7], [12, 8], [31, 24], [86, 72]],
  impact: [[35, 28], [46, 29], [128, 94], [362, 295]],
  duration: [[38, 42], [52, 39], [47, 44], [43, 41]],
}

export function buildPeriodComparisons(node: LifecycleNode, metric: PeriodMetric): PeriodComparison[] {
  const qualityScale = node.id === 'quality' ? 1 : Math.max(0.28, node.impactIndex / 94)
  const unit = metric === 'count' ? '次' : metric === 'impact' ? 'pcs' : '分钟'
  return periodKeys.map((period, index) => {
    const [qualityCurrent, qualityPrevious] = qualityValues[metric][index]
    const currentValue = Math.max(1, Math.round(qualityCurrent * qualityScale))
    const comparisonValue = Math.max(1, Math.round(qualityPrevious * qualityScale))
    return {
      period,
      label: periodLabels[period],
      currentValue,
      comparisonValue,
      changeRate: Math.round((currentValue - comparisonValue) / comparisonValue * 1000) / 10,
      cutoffAt: periodDefinitions[period].cutoffAt,
      definition: periodDefinitions[period].definition,
      unit,
      nodeId: node.id,
    }
  })
}

export const alertRuleConfig = alertRuleConfigRaw as AlertRuleConfig

export const currentInterventionCase: InterventionCase = {
  id: 'IC-QA-01', problemId: 'P-QA-01', alertEventId: 'A-QA-01-3', status: 'pending-intervention',
  generatedAt: '2026-08-12 13:52', suggestedChecks: ['设备参数核查', '工艺首件复核', '物料批次比对'],
  suggestedRole: 'QC组长 / 缝制三组组长', verificationCondition: '连续2个检验窗口、每窗口不少于30件，未再触发缝皱不良',
  interventionStartedAt: null, verifiedAt: null, actualMeasureRecorded: false, requiredEvidenceComplete: false,
  evidenceCompleteness: 42, coordinationActionsCompleted: 1, coordinationActionsTotal: 4,
}

const currentStabilityResult = calculateStabilityAssessmentRaw({
  verifiedAt: currentInterventionCase.verifiedAt,
  actualMeasureRecorded: currentInterventionCase.actualMeasureRecorded,
  requiredEvidenceComplete: currentInterventionCase.requiredEvidenceComplete,
  metricConflict: false,
  asOf: '2026-08-12T14:22:00+08:00',
  recurredAt: null,
}) as Omit<StabilityAssessment, 'caseId' | 'verifiedAt' | 'recurredAt'>

export const currentStabilityAssessment: StabilityAssessment = {
  caseId: currentInterventionCase.id,
  verifiedAt: currentInterventionCase.verifiedAt,
  recurredAt: null,
  ...currentStabilityResult,
}

export const managementInterventionEvidence: ManagementInterventionEvidence[] = [
  { caseId: 'IC-CUT-07', problemLabel: '裁片尺寸偏差', managerResponseMinutes: 32, nonRecurrenceDays: 19, impactValue: 28, stabilityLevel: 'recurred', coordinationActionsCompleted: 3, coordinationActionsTotal: 4, evidenceCompleteness: 78, plannedVerificationAt: '2026-07-24 16:00', actualVerificationAt: '2026-07-24 16:18' },
  { caseId: 'IC-SEW-11', problemLabel: '针距偏差', managerResponseMinutes: 18, nonRecurrenceDays: 14, impactValue: 36, stabilityLevel: 'pass', coordinationActionsCompleted: 4, coordinationActionsTotal: 4, evidenceCompleteness: 92, plannedVerificationAt: '2026-07-29 15:00', actualVerificationAt: '2026-07-29 14:52' },
  { caseId: 'IC-MAT-04', problemLabel: '面料色差', managerResponseMinutes: 41, nonRecurrenceDays: 45, impactValue: 64, stabilityLevel: 'good', coordinationActionsCompleted: 3, coordinationActionsTotal: 3, evidenceCompleteness: 88, plannedVerificationAt: '2026-06-28 11:00', actualVerificationAt: '2026-06-28 11:26' },
  { caseId: 'IC-PACK-02', problemLabel: '标签错贴', managerResponseMinutes: 12, nonRecurrenceDays: 102, impactValue: 22, stabilityLevel: 'excellent', coordinationActionsCompleted: 5, coordinationActionsTotal: 5, evidenceCompleteness: 100, plannedVerificationAt: '2026-05-02 10:00', actualVerificationAt: '2026-05-02 09:48' },
]

export const currentEmployeeQualitySuggestion: EmployeeQualitySuggestion = {
  caseId: currentInterventionCase.id,
  suggestedLevel: null,
  label: '未生成员工素质等级建议',
  status: 'not-generated',
  applicable: false,
  prerequisites: ['现场确认原因涉及人员标准执行', '责任岗位或人员关联已确认', '措施与验证证据完整', '观察期达到至少7天'],
  evidenceRefs: [],
  reason: '当前尚未完成干预验证，观察尚未开始；系统不得形成员工素质结论。',
}

export const candidateEvidence = [
  { category: '设备', completeness: 82, priority: 96, dataCondition: 76, label: '压脚压力与送布同步' },
  { category: '物料', completeness: 48, priority: 64, dataCondition: 52, label: '面料批次与缩水特性' },
  { category: '工艺', completeness: 74, priority: 91, dataCondition: 88, label: '针距、线张力与操作顺序' },
  { category: '人员', completeness: 35, priority: 42, dataCondition: 39, label: '换款后参数确认步骤' },
  { category: '管理', completeness: 61, priority: 68, dataCondition: 71, label: '巡检间隔覆盖异常窗口' },
] as const

export const actionCandidates = [
  { id: 'AC-01', label: '设备参数核查', difficulty: 22, impact: 92, verificationHours: 1, dataReadiness: 86, category: '设备' },
  { id: 'AC-02', label: '恢复首件复核', difficulty: 34, impact: 84, verificationHours: 2, dataReadiness: 92, category: '工艺' },
  { id: 'AC-03', label: '面料批次比对', difficulty: 48, impact: 63, verificationHours: 4, dataReadiness: 58, category: '物料' },
  { id: 'AC-04', label: '核对换款确认', difficulty: 38, impact: 51, verificationHours: 3, dataReadiness: 44, category: '人员' },
  { id: 'AC-05', label: '缩短巡检间隔', difficulty: 56, impact: 72, verificationHours: 8, dataReadiness: 76, category: '管理' },
] as const

export function findProblemCase(problem: HealthProblem) {
  return problem.id === currentInterventionCase.problemId ? currentInterventionCase : null
}
