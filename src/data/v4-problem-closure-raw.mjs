export const interventionDraftStorageKey = 'v4-intervention-drafts'

export function isVerifiedDraftCompleteRaw(draft) {
  return Boolean(
    draft
    && draft.handler?.trim()
    && draft.actualMeasure?.trim()
    && draft.evidenceNote?.trim()
    && draft.verifiedAt?.trim(),
  )
}

export function deriveProblemClosureStatusRaw(problem, draft) {
  if (draft?.verificationStatus === 'recurred' || problem.alertLevel === 'recurring' || problem.identity?.recurrenceState === 'recurring') return 'recurred'
  if (draft?.verificationStatus === 'verified' && isVerifiedDraftCompleteRaw(draft)) return 'verified'
  if (draft && (
    draft.checkedItemIds?.length
    || draft.handler?.trim()
    || draft.actualMeasure?.trim()
    || ['pending-verification', 'verifying', 'verified'].includes(draft.verificationStatus)
  )) return 'processing'
  if (['已响应', '待验证'].includes(problem.responseStatus) || ['verifying', 'resolved'].includes(problem.alertLevel)) return 'processing'
  return 'pending'
}

export function sanitizeInterventionDraftsRaw(input, defaults) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ...defaults }
  const sanitized = { ...defaults }
  for (const [problemId, draft] of Object.entries(input)) {
    if (!draft || typeof draft !== 'object' || draft.problemId !== problemId || draft.isDemo !== true) continue
    if (!Array.isArray(draft.checkedItemIds) || !['not-started', 'pending-verification', 'verifying', 'verified', 'recurred'].includes(draft.verificationStatus)) continue
    sanitized[problemId] = {
      problemId,
      checkedItemIds: draft.checkedItemIds.filter((item) => typeof item === 'string'),
      handler: typeof draft.handler === 'string' ? draft.handler : '',
      handledAt: typeof draft.handledAt === 'string' ? draft.handledAt : '',
      actualMeasure: typeof draft.actualMeasure === 'string' ? draft.actualMeasure : '',
      evidenceNote: typeof draft.evidenceNote === 'string' ? draft.evidenceNote : '',
      verifiedAt: typeof draft.verifiedAt === 'string' ? draft.verifiedAt : '',
      verificationStatus: draft.verificationStatus,
      nonRecurrenceDays: Number.isFinite(draft.nonRecurrenceDays) ? Math.max(0, Math.floor(draft.nonRecurrenceDays)) : null,
      updatedAt: typeof draft.updatedAt === 'string' ? draft.updatedAt : '',
      isDemo: true,
    }
  }
  return sanitized
}
