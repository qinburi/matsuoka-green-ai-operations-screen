export const alertRuleConfigRaw = {
  windowHours: 48,
  identityFields: ['问题类型', '工厂', '工序', '款号', '批次', '设备/工位'],
  dedupeRule: '连续异常采样使用同一episodeId，只计一次越限事件；恢复后再次越限生成新episodeId。',
  resetRule: '验证通过后结束原累计并开启无复发观察；观察期内再次触发直接标记复发。',
  levels: [
    { occurrence: 1, level: 'first', label: '普通提示', action: '进入观察并保留事实证据' },
    { occurrence: 2, level: 'second', label: '加强警示', action: '提高检查优先级并提醒建议岗位' },
    { occurrence: 3, level: 'third', label: '系统警报', action: '自动进入待干预流程态' },
  ],
}

const hourMs = 60 * 60 * 1000
const dayMs = 24 * hourMs

export function evaluateAlertSequenceRaw(samples, asOf, verifiedAt = null) {
  const now = new Date(asOf).getTime()
  const windowStart = now - alertRuleConfigRaw.windowHours * hourMs
  const verifiedTime = verifiedAt ? new Date(verifiedAt).getTime() : null
  const episodes = new Map()

  for (const sample of samples) {
    const occurredAt = new Date(sample.occurredAt).getTime()
    if (!sample.exceeded || occurredAt < windowStart || occurredAt > now) continue
    if (!episodes.has(sample.episodeId)) episodes.set(sample.episodeId, occurredAt)
  }

  const uniqueEvents = [...episodes.values()].sort((a, b) => a - b)
  if (verifiedTime && uniqueEvents.some((occurredAt) => occurredAt > verifiedTime)) {
    return { count: uniqueEvents.length, level: 'recurring', label: '再次复发', startsIntervention: true }
  }

  const count = uniqueEvents.length
  if (count >= 3) return { count, level: 'third', label: '系统警报', startsIntervention: true }
  if (count === 2) return { count, level: 'second', label: '加强警示', startsIntervention: false }
  if (count === 1) return { count, level: 'first', label: '普通提示', startsIntervention: false }
  return { count: 0, level: 'normal', label: '正常', startsIntervention: false }
}

export function calculateStabilityAssessmentRaw(input) {
  const incomplete = !input.verifiedAt || !input.actualMeasureRecorded || !input.requiredEvidenceComplete || input.metricConflict
  if (incomplete) {
    return {
      level: 'unavailable', label: '暂不评价', nonRecurrenceDays: null, eligible: false,
      reason: input.metricConflict ? '指标口径冲突' : '缺少验证时间、实际措施或必要证据',
    }
  }

  const verified = new Date(input.verifiedAt).getTime()
  const end = new Date(input.recurredAt || input.asOf).getTime()
  const days = Math.max(0, Math.floor((end - verified) / dayMs))
  if (input.recurredAt) return { level: 'recurred', label: '再次复发', nonRecurrenceDays: days, eligible: false, reason: `干预后${days}天再次复发，需重新干预` }
  if (days >= 90) return { level: 'excellent', label: '稳定度优秀', nonRecurrenceDays: days, eligible: true, reason: '连续90天及以上未复发' }
  if (days >= 30) return { level: 'good', label: '稳定度良好', nonRecurrenceDays: days, eligible: true, reason: '连续30至89天未复发' }
  if (days >= 7) return { level: 'pass', label: '稳定度及格', nonRecurrenceDays: days, eligible: true, reason: '连续7至29天未复发' }
  return { level: 'observing', label: '观察中', nonRecurrenceDays: days, eligible: false, reason: '未满7天，不形成等级' }
}
