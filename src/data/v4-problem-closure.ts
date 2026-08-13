import type { HealthProblem, InterventionDraft, ProblemClosureStatus } from '../types'
import {
  deriveProblemClosureStatusRaw,
  interventionDraftStorageKey,
  isVerifiedDraftCompleteRaw,
  sanitizeInterventionDraftsRaw,
} from './v4-problem-closure-raw.mjs'

export const defaultInterventionDrafts: Record<string, InterventionDraft> = {
  'P-QA-02': {
    problemId: 'P-QA-02',
    checkedItemIds: ['QA2-1', 'QA2-2', 'QA2-3'],
    handler: '终检组长（演示）',
    handledAt: '2026-08-12 12:36',
    actualMeasure: '清洁检验台并调整转运防护',
    evidenceNote: '连续两个检验窗口未发现同类污渍，清洁点检与抽检记录完整。',
    verifiedAt: '2026-08-12 15:00',
    verificationStatus: 'verified',
    nonRecurrenceDays: 1,
    updatedAt: '2026-08-13 09:30',
    isDemo: true,
  },
  'P-SEW-01': {
    problemId: 'P-SEW-01',
    checkedItemIds: ['SEW-1', 'SEW-2'],
    handler: '缝制三组组长（演示）',
    handledAt: '2026-08-12 14:08',
    actualMeasure: '已核对瓶颈工位并临时拆分超时在制',
    evidenceNote: '下一小时节拍与在制变化尚待完成验证。',
    verifiedAt: '',
    verificationStatus: 'pending-verification',
    nonRecurrenceDays: null,
    updatedAt: '2026-08-12 14:18',
    isDemo: true,
  },
  'P-CUT-01': {
    problemId: 'P-CUT-01',
    checkedItemIds: ['CUT-1', 'CUT-3'],
    handler: '裁断组长（演示）',
    handledAt: '2026-08-11 16:32',
    actualMeasure: '更换刀具并重新确认裁剪文件版本',
    evidenceNote: '距上次处理19小时再次触发同一问题身份证。',
    verifiedAt: '2026-08-11 18:00',
    verificationStatus: 'recurred',
    nonRecurrenceDays: 0,
    updatedAt: '2026-08-12 11:42',
    isDemo: true,
  },
}

export const closureStatusLabels: Record<ProblemClosureStatus, string> = {
  pending: '待处理',
  processing: '处理中 / 待验证',
  verified: '已解决',
  recurred: '再次复发',
}

export const closureStatusSymbols: Record<ProblemClosureStatus, string> = {
  pending: '!',
  processing: '●',
  verified: '✓',
  recurred: '↻',
}

export function deriveProblemClosureStatus(problem: HealthProblem, draft?: InterventionDraft): ProblemClosureStatus {
  return deriveProblemClosureStatusRaw(problem, draft) as ProblemClosureStatus
}

export function isVerifiedDraftComplete(draft?: InterventionDraft | null): boolean {
  return isVerifiedDraftCompleteRaw(draft)
}

export function createEmptyInterventionDraft(problemId: string): InterventionDraft {
  return {
    problemId,
    checkedItemIds: [],
    handler: '',
    handledAt: '',
    actualMeasure: '',
    evidenceNote: '',
    verifiedAt: '',
    verificationStatus: 'not-started',
    nonRecurrenceDays: null,
    updatedAt: '',
    isDemo: true,
  }
}

export function loadInterventionDrafts(): Record<string, InterventionDraft> {
  if (typeof window === 'undefined') return { ...defaultInterventionDrafts }
  try {
    const stored = window.localStorage.getItem(interventionDraftStorageKey)
    if (!stored) return { ...defaultInterventionDrafts }
    return sanitizeInterventionDraftsRaw(JSON.parse(stored), defaultInterventionDrafts) as Record<string, InterventionDraft>
  } catch {
    return { ...defaultInterventionDrafts }
  }
}

export function persistInterventionDrafts(drafts: Record<string, InterventionDraft>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(interventionDraftStorageKey, JSON.stringify(drafts))
  } catch {
    // The prototype remains usable with in-memory records when storage is unavailable.
  }
}
