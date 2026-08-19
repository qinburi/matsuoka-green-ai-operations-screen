const minuteMs = 60 * 1000
const dayMs = 24 * 60 * minuteMs

function timestamp(value) {
  if (!value) return null
  const result = new Date(value).getTime()
  return Number.isFinite(result) ? result : null
}

function diffMinutes(start, end) {
  const startTime = timestamp(start)
  const endTime = timestamp(end)
  if (startTime === null || endTime === null || endTime < startTime) return null
  return Math.round((endTime - startTime) / minuteMs)
}

export function evaluatePulseClosureRaw(input, asOf) {
  const responseMinutes = diffMinutes(input.occurredAt, input.responseAt)
  const handlingMinutes = diffMinutes(input.responseAt, input.handledAt)
  const verificationMinutes = diffMinutes(input.handledAt, input.verifiedAt)
  const totalMinutes = diffMinutes(input.occurredAt, input.verifiedAt)
  const responseTime = timestamp(input.responseAt)
  const responseTarget = timestamp(input.responseTargetAt)
  const verifiedTime = timestamp(input.verifiedAt)
  const resolutionTarget = timestamp(input.resolutionTargetAt)
  const responseOnTime = responseTime === null || responseTarget === null ? null : responseTime <= responseTarget
  const resolutionOnTime = verifiedTime === null || resolutionTarget === null ? null : verifiedTime <= resolutionTarget
  const now = timestamp(asOf)
  const overdue = input.status !== 'verified'
    && input.status !== 'recurred'
    && resolutionTarget !== null
    && now !== null
    && now > resolutionTarget

  const shared = {
    responseMinutes,
    handlingMinutes,
    verificationMinutes,
    totalMinutes,
    responseOnTime,
    resolutionOnTime,
    overdue,
  }

  if (input.status === 'recurred' || input.status === 'failed' || input.recurredAt) {
    return {
      ...shared,
      level: 'unqualified',
      label: '不合格',
      reason: input.status === 'recurred' || input.recurredAt ? '验证后再次复发，需重新处理' : '验证未通过',
      isResolved: false,
    }
  }

  const canEvaluate = input.status === 'verified'
    && input.evidenceComplete
    && responseTime !== null
    && verifiedTime !== null
    && responseTarget !== null
    && resolutionTarget !== null

  if (!canEvaluate) {
    return {
      ...shared,
      level: 'pending',
      label: '待评价',
      reason: input.status === 'verified' ? '缺少目标时间或必要验证证据' : overdue ? '已超过解决目标，等待验证结果' : '问题尚未完成验证',
      isResolved: false,
    }
  }

  if (responseOnTime && resolutionOnTime) {
    return { ...shared, level: 'excellent', label: '优秀', reason: '响应、解决均按时且验证证据完整', isResolved: true }
  }

  return { ...shared, level: 'good', label: '良好', reason: '验证通过且证据完整，但响应或解决存在超时', isResolved: true }
}

function parseDateOnly(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '')
  if (!match) return null
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

function formatDate(value) {
  const date = new Date(value)
  return `${String(date.getUTCMonth() + 1).padStart(2, '0')}/${String(date.getUTCDate()).padStart(2, '0')}`
}

export function buildCustomPulseRangeRaw(from, to) {
  const start = parseDateOnly(from)
  const end = parseDateOnly(to)
  if (start === null || end === null || end < start) return null

  const days = Math.floor((end - start) / dayMs) + 1
  const comparisonEnd = start - dayMs
  const comparisonStart = comparisonEnd - (days - 1) * dayMs
  const granularity = days === 1 ? 'hour' : days <= 31 ? 'day' : 'week'
  let labels

  if (granularity === 'hour') {
    labels = Array.from({ length: 10 }, (_, index) => `${String(index + 8).padStart(2, '0')}:00`)
  } else if (granularity === 'day') {
    labels = Array.from({ length: days }, (_, index) => formatDate(start + index * dayMs))
  } else {
    labels = Array.from({ length: Math.ceil(days / 7) }, (_, index) => `第${index + 1}周`)
  }

  return {
    labels,
    days,
    granularity,
    currentRangeLabel: `${from} 至 ${to}`,
    comparisonRangeLabel: `${new Date(comparisonStart).toISOString().slice(0, 10)} 至 ${new Date(comparisonEnd).toISOString().slice(0, 10)}`,
  }
}
