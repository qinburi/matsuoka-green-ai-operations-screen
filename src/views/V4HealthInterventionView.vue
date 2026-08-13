<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EChart from '../components/EChart.vue'
import VersionDialog from '../components/VersionDialog.vue'
import { contextOptions, defaultContext, sourceLabels } from '../data/demo'
import {
  alertRuleConfig,
  buildPeriodComparisons,
  currentEmployeeQualitySuggestion,
  currentStabilityAssessment,
  getInterventionCaseForProblem,
  getProblemAnalysisProfile,
  managementInterventionEvidence,
  periodKeys,
  periodLabels,
  periodMetricLabels,
} from '../data/v4-analysis'
import { dataStateLabelsV4, healthProblems, lifecycleById, lifecycleNodes, problemById } from '../data/v4-health-center'
import {
  closureStatusLabels,
  closureStatusSymbols,
  createEmptyInterventionDraft,
  deriveProblemClosureStatus,
  isVerifiedDraftComplete,
  loadInterventionDrafts,
  persistInterventionDrafts,
} from '../data/v4-problem-closure'
import {
  buildActionPriorityOption,
  buildCandidateEvidenceOption,
  buildEvidenceTrendOption,
  buildLifecycleCanvasOption,
  buildManagementEffectivenessOption,
  buildPeriodComparisonOption,
  buildProblemFocusOption,
  buildValidationTimelineOption,
} from '../v4-chart-options'
import type {
  AnalysisStep,
  DataState,
  HealthProblem,
  InterventionDraft,
  InterventionEditorRole,
  LifecycleNodeId,
  PeriodKey,
  PeriodMetric,
  ProblemClosureFilter,
  ProblemClosureStatus,
  ProblemDisplayPhase,
  ProblemListScope,
} from '../types'

const route = useRoute()
const router = useRouter()
const context = reactive({
  ...defaultContext,
  source: typeof route.query.source === 'string' ? route.query.source : defaultContext.source,
})
const legacyFocusMap: Record<string, LifecycleNodeId> = { qc21: 'quality', sewing: 'sewing', cutting: 'cutting' }
const requestedFocus = typeof route.query.focus === 'string' ? route.query.focus : ''
const initialNodeId = lifecycleById.has(requestedFocus as LifecycleNodeId)
  ? requestedFocus as LifecycleNodeId
  : legacyFocusMap[requestedFocus] ?? 'quality'
const selectedNodeId = ref<LifecycleNodeId>(initialNodeId)
const requestedProblem = typeof route.query.problem === 'string' && problemById.has(route.query.problem) ? route.query.problem : null
const selectedProblemId = ref(requestedProblem ?? 'P-QA-01')
const viewMode = ref<'factory' | 'problem'>(requestedProblem ? 'problem' : 'factory')
const filtersOpen = ref(false)
const dataState = ref<DataState>('normal')
const validPeriod = typeof route.query.period === 'string' && periodKeys.includes(route.query.period as PeriodKey)
const selectedPeriod = ref<PeriodKey>(validPeriod ? route.query.period as PeriodKey : 'today')
const periodMetric = ref<PeriodMetric>('count')
const requestedStep = Number(route.query.step)
const analysisStepIndex = ref(Number.isInteger(requestedStep) && requestedStep >= 1 && requestedStep <= 3 ? requestedStep - 1 : 0)
const problemPhase = ref<ProblemDisplayPhase>(viewMode.value === 'problem' && Number.isInteger(requestedStep) && requestedStep >= 1 && requestedStep <= 3 ? 'analysis' : 'relation')
const selectedRelationNodeId = ref<string>(requestedProblem ?? 'P-QA-01')
const problemListScope = ref<ProblemListScope>('node')
const problemListFilter = ref<ProblemClosureFilter>('all')
const editorRole = ref<InterventionEditorRole>('factory-manager')
const interventionDrafts = ref<Record<string, InterventionDraft>>(loadInterventionDrafts())
const editingProblemId = ref<string | null>(null)
const interventionForm = reactive<InterventionDraft>(createEmptyInterventionDraft(''))
const interventionFormError = ref('')
const motionEnabled = ref(true)
let motionPreference: MediaQueryList | null = null
const syncMotionPreference = (event?: MediaQueryListEvent) => {
  motionEnabled.value = !(event?.matches ?? motionPreference?.matches ?? false)
}

onMounted(() => {
  motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
  syncMotionPreference()
  motionPreference.addEventListener('change', syncMotionPreference)
})

onBeforeUnmount(() => {
  motionPreference?.removeEventListener('change', syncMotionPreference)
})

const closureFilters: Array<{ id: ProblemClosureFilter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'pending', label: '待处理' },
  { id: 'processing', label: '处理中' },
  { id: 'verified', label: '已解决' },
  { id: 'recurred', label: '再次复发' },
]
const editorRoleLabels: Record<InterventionEditorRole, string> = {
  'factory-manager': '厂长（演示）',
  'department-owner': '责任部门负责人（演示）',
  viewer: '查看者（只读）',
}

const analysisSteps: Array<{ id: AnalysisStep; label: string; eyebrow: string }> = [
  { id: 'evidence', label: '问题与证据', eyebrow: 'STEP 01' },
  { id: 'cause-solution', label: '原因与方案', eyebrow: 'STEP 02' },
  { id: 'responsibility-validation', label: '责任与验证', eyebrow: 'STEP 03' },
]
const activeNode = computed(() => lifecycleById.get(selectedNodeId.value) ?? lifecycleNodes[7])
const activeProblem = computed(() => problemById.get(selectedProblemId.value) ?? healthProblems[0])
const activeClosureDraft = computed(() => interventionDrafts.value[activeProblem.value.id])
const activeClosureStatus = computed(() => deriveProblemClosureStatus(activeProblem.value, activeClosureDraft.value))
const analysisProfile = computed(() => getProblemAnalysisProfile(activeProblem.value))
const activeInterventionCase = computed(() => getInterventionCaseForProblem(activeProblem.value))
const activeStabilityAssessment = computed(() => activeProblem.value.id === 'P-QA-01'
  ? currentStabilityAssessment
  : { ...currentStabilityAssessment, caseId: activeInterventionCase.value.id })
const employeeSuggestion = computed(() => activeProblem.value.id === 'P-QA-01'
  ? currentEmployeeQualitySuggestion
  : { ...currentEmployeeQualitySuggestion, caseId: activeInterventionCase.value.id, reason: '当前尚未完成干预验证，观察尚未开始；系统不得形成员工素质结论。' })
const latestAlert = computed(() => activeProblem.value.alertEvents[activeProblem.value.alertEvents.length - 1])
const currentAlertLabel = computed(() => activeClosureStatus.value === 'verified'
  ? '已解决 · 验证通过'
  : activeClosureStatus.value === 'recurred' ? '再次复发' : latestAlert.value?.levelLabel)
const priorityAction = computed(() => activeClosureStatus.value === 'verified'
  ? '保持观察并监测同类问题复发'
  : activeProblem.value.plan[0] ?? '先核对问题事实与数据口径')
const sourceLabel = computed(() => sourceLabels[context.source] ?? '综合入口')
const chartState = computed(() => dataState.value)
const canShowConclusion = computed(() => dataState.value === 'normal')
const canOpenRelation = computed(() => dataState.value === 'normal' || dataState.value === 'stale')
const canShowRecommendations = computed(() => dataState.value === 'normal')
const activeStep = computed(() => analysisSteps[analysisStepIndex.value])
const periodData = computed(() => buildPeriodComparisons(activeNode.value, periodMetric.value))
const lifecycleOption = computed(() => buildLifecycleCanvasOption(lifecycleNodes, selectedNodeId.value, motionEnabled.value))
const problemFocusOption = computed(() => buildProblemFocusOption(lifecycleNodes, activeProblem.value, selectedRelationNodeId.value, dataState.value === 'normal'))
const periodOption = computed(() => buildPeriodComparisonOption(periodData.value, periodMetric.value, selectedPeriod.value))
const evidenceTrendOption = computed(() => buildEvidenceTrendOption(analysisProfile.value, activeProblem.value))
const candidateEvidenceOption = computed(() => buildCandidateEvidenceOption(analysisProfile.value.candidateEvidence))
const actionPriorityOption = computed(() => buildActionPriorityOption(analysisProfile.value.actionCandidates))
const managementOption = computed(() => buildManagementEffectivenessOption(managementInterventionEvidence))
const validationTimelineOption = computed(() => buildValidationTimelineOption())
const scopedClosureProblems = computed(() => problemListScope.value === 'factory'
  ? healthProblems
  : healthProblems.filter((problem) => problem.nodeId === selectedNodeId.value))
const closureRows = computed(() => scopedClosureProblems.value.map((problem) => ({
  problem,
  draft: interventionDrafts.value[problem.id],
  status: deriveProblemClosureStatus(problem, interventionDrafts.value[problem.id]),
})))
const closureCounts = computed(() => closureRows.value.reduce<Record<ProblemClosureStatus, number>>((counts, row) => {
  counts[row.status] += 1
  return counts
}, { pending: 0, processing: 0, verified: 0, recurred: 0 }))
const visibleClosureRows = computed(() => problemListFilter.value === 'all'
  ? closureRows.value
  : closureRows.value.filter((row) => row.status === problemListFilter.value))
const editingProblem = computed(() => editingProblemId.value ? problemById.get(editingProblemId.value) ?? null : null)
const canEditIntervention = computed(() => dataState.value === 'normal' && editorRole.value !== 'viewer')
const interventionDisabledReason = computed(() => {
  if (editorRole.value === 'viewer') return '当前角色仅可查看，不能更新演示处理记录。'
  if (dataState.value === 'stale') return '数据已过期，结论复核前禁止确认解决。'
  if (dataState.value !== 'normal') return '数据异常或口径不一致，暂停更新闭环状态。'
  return ''
})
const relationTraceNodes = computed(() => activeProblem.value.traceNodeIds
  .map((nodeId) => lifecycleById.get(nodeId))
  .filter((node): node is NonNullable<typeof node> => Boolean(node)))
const stageSource = computed(() => {
  if (viewMode.value === 'factory') return activeNode.value.dataSource
  if (problemPhase.value === 'relation') return `演示：${activeProblem.value.facts.map((fact) => fact.source.replace('演示：', '')).join(' / ')}`
  if (analysisStepIndex.value === 0) return analysisProfile.value.evidence.source
  if (analysisStepIndex.value === 1) return '演示：设备点检 / 工艺标准 / 物料检验 / 巡检记录'
  return '演示：警报事件 / 管理协调记录 / 验证证据 / 历史闭环案例'
})
const selectedRelationDetail = computed(() => {
  if (selectedRelationNodeId.value === activeProblem.value.id) {
    return { label: activeProblem.value.title, source: activeProblem.value.facts[0]?.source ?? '演示：问题事件记录', detail: activeProblem.value.summary, status: closureStatusLabels[activeClosureStatus.value] }
  }
  if (selectedRelationNodeId.value.startsWith('fact-')) {
    const fact = activeProblem.value.facts[Number(selectedRelationNodeId.value.replace('fact-', ''))]
    if (fact) return { label: fact.label, source: fact.source, detail: `${fact.label}：${fact.value}`, status: '已记录事实' }
  }
  if (selectedRelationNodeId.value.startsWith('context-')) {
    const nodeId = selectedRelationNodeId.value.replace('context-', '') as LifecycleNodeId
    const node = lifecycleById.get(nodeId)
    if (node) return { label: node.label, source: node.dataSource, detail: node.coreMetric.definition, status: activeProblem.value.traceNodeIds.includes(nodeId) ? '追溯范围 · 待现场确认' : '生命周期上下文' }
  }
  return { label: activeProblem.value.title, source: activeProblem.value.facts[0]?.source ?? '演示：问题事件记录', detail: activeProblem.value.summary, status: '严重异常事实' }
})
const relationDisabledCopy = computed(() => dataState.value === 'stale'
  ? '数据已过期，结论复核后可进入分析'
  : '数据恢复且口径一致后可进入分析')
const unavailableCopy = computed(() => {
  if (dataState.value === 'loading') return ['数据更新中', '暂不形成问题判断']
  if (dataState.value === 'empty') return ['当前范围无可用数据', '请调整筛选范围']
  if (dataState.value === 'error') return ['数据加载失败', '恢复数据源后重新分析']
  if (dataState.value === 'forbidden') return ['当前账号无权查看', '请申请对应数据权限']
  if (dataState.value === 'metric-conflict') return ['指标口径存在冲突', '确认口径前暂停结论']
  if (dataState.value === 'stale') return ['数据已过期', '仅展示历史状态，结论待复核']
  return null
})

function routeQuery(problemId?: string, step?: number) {
  const query: Record<string, string | string[] | null | undefined> = {
    ...route.query,
    topic: 'health',
    source: context.source,
    focus: selectedNodeId.value,
    period: selectedPeriod.value,
  }
  if (problemId) {
    query.problem = problemId
    if (step) query.step = String(step)
    else delete query.step
  } else {
    delete query.problem
    delete query.step
  }
  return query
}

function replaceRoute(problemId?: string, step?: number) {
  router.replace({ name: 'analysis', query: routeQuery(problemId, step) })
}

function pushRoute(problemId?: string, step?: number) {
  router.push({ name: 'analysis', query: routeQuery(problemId, step) })
}

function selectNode(nodeId: LifecycleNodeId) {
  selectedNodeId.value = nodeId
  replaceRoute()
}

function selectProblemFromList(problem: HealthProblem) {
  if (canOpenRelation.value) openProblem(problem.id)
}

function openInterventionEditor(problem: HealthProblem) {
  editingProblemId.value = problem.id
  const saved = interventionDrafts.value[problem.id] ?? createEmptyInterventionDraft(problem.id)
  Object.assign(interventionForm, saved, { checkedItemIds: [...saved.checkedItemIds] })
  interventionFormError.value = ''
}

function closeInterventionEditor() {
  editingProblemId.value = null
  interventionFormError.value = ''
}

function toggleInspectionItem(itemId: string) {
  if (!canEditIntervention.value) return
  const next = new Set(interventionForm.checkedItemIds)
  if (next.has(itemId)) next.delete(itemId)
  else next.add(itemId)
  interventionForm.checkedItemIds = [...next]
  if (interventionForm.verificationStatus === 'not-started') interventionForm.verificationStatus = 'pending-verification'
}

function saveInterventionRecord() {
  if (!editingProblem.value || !canEditIntervention.value) return
  if (interventionForm.verificationStatus === 'verified' && !isVerifiedDraftComplete(interventionForm)) {
    interventionFormError.value = '确认已解决前，必须完整填写处理人、实际措施、验证时间和验证证据。'
    return
  }
  const saved: InterventionDraft = {
    ...interventionForm,
    problemId: editingProblem.value.id,
    checkedItemIds: [...interventionForm.checkedItemIds],
    nonRecurrenceDays: interventionForm.verificationStatus === 'verified' ? interventionForm.nonRecurrenceDays : null,
    updatedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    isDemo: true,
  }
  interventionDrafts.value = { ...interventionDrafts.value, [saved.problemId]: saved }
  persistInterventionDrafts(interventionDrafts.value)
  closeInterventionEditor()
}

function selectPeriod(period: PeriodKey) {
  selectedPeriod.value = period
  replaceRoute(viewMode.value === 'problem' ? activeProblem.value.id : undefined, problemPhase.value === 'analysis' ? analysisStepIndex.value + 1 : undefined)
}

function setPeriodMetric(metric: PeriodMetric) {
  periodMetric.value = metric
}

function openProblem(problemId: string) {
  const problem = problemById.get(problemId)
  if (!problem || !canOpenRelation.value) return
  selectedProblemId.value = problem.id
  selectedNodeId.value = problem.nodeId
  viewMode.value = 'problem'
  problemPhase.value = 'relation'
  analysisStepIndex.value = 0
  selectedRelationNodeId.value = problem.id
  pushRoute(problem.id)
}

function handleLifecycleSelect(payload: unknown) {
  const data = payload as { nodeType?: string; nodeId?: LifecycleNodeId; problemId?: string } | null
  if (data?.nodeType === 'issue' && data.problemId) openProblem(data.problemId)
  else if (data?.nodeType === 'lifecycle' && data.nodeId) selectNode(data.nodeId)
}

function handlePeriodSelect(payload: unknown) {
  const period = (payload as { period?: PeriodKey } | null)?.period
  if (period && periodKeys.includes(period)) selectPeriod(period)
}

function handleProblemFocusSelect(payload: unknown) {
  const data = payload as { id?: string; nodeType?: string } | null
  if (data?.id && ['issue-focus', 'fact', 'context'].includes(data.nodeType ?? '')) selectedRelationNodeId.value = data.id
}

function enterAnalysis() {
  if (!canShowRecommendations.value) return
  problemPhase.value = 'analysis'
  analysisStepIndex.value = 0
  pushRoute(activeProblem.value.id, 1)
}

function goToStep(index: number) {
  if (index < 0 || index >= analysisSteps.length || !canShowRecommendations.value && index > 0) return
  analysisStepIndex.value = index
  problemPhase.value = 'analysis'
  pushRoute(activeProblem.value.id, index + 1)
}

function returnToFactory() {
  viewMode.value = 'factory'
  problemPhase.value = 'relation'
  analysisStepIndex.value = 0
  pushRoute()
}

function updateDataState() {
  if (dataState.value === 'loading') {
    window.setTimeout(() => {
      if (dataState.value === 'loading') dataState.value = 'normal'
    }, 900)
  }
  if (dataState.value !== 'normal' && problemPhase.value === 'analysis') {
    problemPhase.value = 'relation'
    analysisStepIndex.value = 0
    replaceRoute(activeProblem.value.id)
  }
}

function backToOverview() {
  router.push({ name: 'overview' })
}

watch(() => [route.query.problem, route.query.step, route.query.period, route.query.focus], ([problemValue, stepValue, periodValue, focusValue]) => {
  if (typeof periodValue === 'string' && periodKeys.includes(periodValue as PeriodKey)) selectedPeriod.value = periodValue as PeriodKey
  if (typeof problemValue === 'string' && problemById.has(problemValue)) {
    selectedProblemId.value = problemValue
    selectedNodeId.value = problemById.get(problemValue)!.nodeId
    selectedRelationNodeId.value = problemValue
    viewMode.value = 'problem'
    const step = Number(stepValue)
    if (Number.isInteger(step) && step >= 1 && step <= 3) {
      problemPhase.value = 'analysis'
      analysisStepIndex.value = step - 1
    } else {
      problemPhase.value = 'relation'
      analysisStepIndex.value = 0
    }
  } else {
    viewMode.value = 'factory'
    problemPhase.value = 'relation'
    if (typeof focusValue === 'string') selectedNodeId.value = lifecycleById.has(focusValue as LifecycleNodeId) ? focusValue as LifecycleNodeId : legacyFocusMap[focusValue] ?? selectedNodeId.value
  }
})
</script>

<template>
  <main class="v4-data-cabin" :class="{ 'is-problem-focus': viewMode === 'problem' }">
    <div class="v4-desktop-required"><strong>请使用桌面大屏查看</strong><span>V4.0.0 蓝白AI生命周期分析画布仅提供桌面端与大屏布局。</span></div>

    <header class="v4-cabin-header">
      <div class="v4-cabin-brand"><button type="button" @click="backToOverview">返回大屏</button><i /><div><small>GREEN AI · LIFECYCLE INTELLIGENCE</small><h1>工厂生命周期分析画布</h1></div></div>
      <div class="v4-cabin-context"><button type="button" @click="filtersOpen = !filtersOpen">筛选条件</button><span>演示数据</span><VersionDialog /><div><small>数据更新时间</small><strong>{{ activeNode.updatedAt }}</strong></div></div>
    </header>

    <Transition name="v4-filter"><section v-if="filtersOpen" class="v4-filter-ribbon"><div><span>进入来源</span><strong>{{ sourceLabel }}</strong></div><label><span>工厂</span><select v-model="context.factory"><option v-for="item in contextOptions.factories" :key="item">{{ item }}</option></select></label><label><span>产线</span><select v-model="context.line"><option v-for="item in contextOptions.lines" :key="item">{{ item }}</option></select></label><label><span>契约 / 品番</span><select v-model="context.contract"><option v-for="item in contextOptions.contracts" :key="item">{{ item }}</option></select></label><label><span>数据状态</span><select v-model="dataState" @change="updateDataState"><option v-for="(label, key) in dataStateLabelsV4" :key="key" :value="key">{{ label }}</option></select></label></section></Transition>

    <section class="v4-conclusion-line" aria-label="老板结论">
      <div class="v4-conclusion-heading"><small>EXECUTIVE CONCLUSION</small><strong>{{ canShowConclusion ? `${periodLabels[selectedPeriod]}首要管理结论` : unavailableCopy?.[0] }}</strong></div>
      <dl><div><dt>首要问题</dt><dd>{{ canShowConclusion ? activeProblem.title : unavailableCopy?.[1] }}</dd></div><div><dt>影响范围</dt><dd>{{ canShowConclusion ? `${activeProblem.impactValue} ${activeProblem.impactUnit} · ${activeProblem.identity.batch}` : '--' }}</dd></div><div><dt>预警等级</dt><dd :class="activeClosureStatus === 'verified' ? 'is-ai' : 'is-danger'">{{ canShowConclusion ? currentAlertLabel : '--' }}</dd></div><div><dt>优先动作</dt><dd>{{ canShowConclusion ? priorityAction : '等待数据恢复' }}</dd></div><div><dt>建议岗位</dt><dd class="is-ai">{{ canShowConclusion ? activeProblem.suggestedRole : '暂不关联岗位' }}</dd></div></dl>
    </section>

    <section class="v4-canvas-stage">
      <div class="v4-stage-aura" aria-hidden="true" />
      <header class="v4-stage-tools">
        <div v-if="viewMode === 'factory'"><span class="is-active">全厂态势</span><i /><span>问题分析</span></div>
        <div v-else-if="problemPhase === 'relation'" class="v4-relation-stage-label"><span>全厂态势</span><i /><span class="is-active">问题关联</span><i /><span>三步分析</span></div>
        <nav v-else class="v4-step-indicator" aria-label="分析步骤"><button v-for="(step, index) in analysisSteps" :key="step.id" type="button" :class="{ 'is-active': index === analysisStepIndex, 'is-complete': index < analysisStepIndex }" :disabled="!canShowRecommendations && index > 0" @click="goToStep(index)"><small>{{ step.eyebrow }}</small><strong>{{ step.label }}</strong></button></nav>
        <button v-if="viewMode === 'problem'" type="button" class="v4-return-factory" @click="returnToFactory">返回全厂</button>
      </header>

      <template v-if="viewMode === 'factory'">
        <div class="v4-lifecycle-chart v4-lifecycle-chart--factory"><EChart :option="lifecycleOption" :state="chartState" @select="handleLifecycleSelect" /></div>
        <div v-if="canOpenRelation" class="v4-issue-rail" aria-label="重点问题标记">
          <button type="button" class="v4-issue-beacon v4-issue-beacon--sewing" aria-label="查看缝制三组在制持续超时" @click="openProblem('P-SEW-01')">
            <span class="v4-alert-beacon" aria-hidden="true">!</span><i aria-hidden="true" /><span class="v4-alert-strip"><em>待干预</em><strong>缝制在制超时</strong><small>214 pcs · 持续 94 分钟</small></span>
          </button>
          <button type="button" class="v4-issue-beacon v4-issue-beacon--quality" aria-label="查看缝皱不良第三次警报" @click="openProblem('P-QA-01')">
            <span class="v4-alert-beacon" aria-hidden="true">!</span><i aria-hidden="true" /><span class="v4-alert-strip"><em>第三次警报</em><strong>缝皱不良</strong><small>46 pcs · 已进入待干预流程态</small></span>
          </button>
        </div>
        <aside class="v4-problem-closure" aria-label="问题闭环清单">
          <header>
            <div><small>PROBLEM CLOSURE</small><strong>问题闭环清单</strong></div>
            <span>演示数据</span>
          </header>
          <div class="v4-closure-scope">
            <button type="button" :class="{ 'is-active': problemListScope === 'node' }" @click="problemListScope = 'node'">当前节点 · {{ activeNode.shortLabel }}</button>
            <button type="button" :class="{ 'is-active': problemListScope === 'factory' }" @click="problemListScope = 'factory'">全厂问题</button>
          </div>
          <div class="v4-closure-filters" aria-label="问题状态筛选">
            <button v-for="filter in closureFilters" :key="filter.id" type="button" :class="{ 'is-active': problemListFilter === filter.id }" @click="problemListFilter = filter.id">
              <span>{{ filter.label }}</span><strong>{{ filter.id === 'all' ? closureRows.length : closureCounts[filter.id] }}</strong>
            </button>
          </div>
          <div class="v4-closure-role"><span>演示角色</span><select v-model="editorRole"><option v-for="(label, role) in editorRoleLabels" :key="role" :value="role">{{ label }}</option></select></div>
          <div class="v4-closure-list">
            <article v-for="row in visibleClosureRows" :key="row.problem.id" class="v4-closure-row" :class="`is-${row.status}`">
              <button type="button" class="v4-closure-main" :aria-label="`查看${row.problem.title}`" @click="selectProblemFromList(row.problem)">
                <span class="v4-closure-symbol" aria-hidden="true">{{ closureStatusSymbols[row.status] }}</span>
                <span class="v4-closure-copy"><strong>{{ row.problem.title }}</strong><small>{{ lifecycleById.get(row.problem.nodeId)?.shortLabel }} · {{ row.problem.impactValue }} {{ row.problem.impactUnit }}</small></span>
                <em>{{ closureStatusLabels[row.status] }}</em>
              </button>
              <div v-if="row.status === 'verified' && row.draft" class="v4-closure-resolved">
                <strong>已验证解决</strong><span>{{ row.draft.verifiedAt }} · {{ row.draft.handler }}</span><small>{{ row.draft.actualMeasure }}</small>
              </div>
              <footer><span>{{ row.status === 'verified' ? `${row.draft?.nonRecurrenceDays ?? 0}天未复发` : row.problem.responseStatus }}</span><button type="button" @click="openInterventionEditor(row.problem)">{{ row.draft ? '查看 / 更新记录' : '记录处理' }}</button></footer>
            </article>
            <div v-if="visibleClosureRows.length === 0" class="v4-closure-empty"><strong>当前范围无此状态问题</strong><span>可切换筛选或查看全厂问题。</span></div>
          </div>
          <footer><span class="v4-closure-legend is-action">✓ 检查项完成</span><strong class="v4-closure-legend is-verified">✓ 问题已验证解决</strong></footer>
        </aside>
        <section class="v4-period-rail">
          <header><div><small>MULTI-PERIOD COMPARISON</small><strong>四周期态势对比</strong></div><nav><button v-for="(label, metric) in periodMetricLabels" :key="metric" type="button" :class="{ 'is-active': periodMetric === metric }" @click="setPeriodMetric(metric)">{{ label }}</button></nav></header>
          <div class="v4-period-chart"><EChart :option="periodOption" :state="chartState" @select="handlePeriodSelect" /></div>
          <footer><button v-for="item in periodData" :key="item.period" type="button" :class="{ 'is-active': selectedPeriod === item.period }" @click="selectPeriod(item.period)"><strong>{{ item.label }}</strong><span>{{ item.currentValue }}{{ item.unit }}</span><em :class="item.changeRate > 0 ? 'is-up' : 'is-down'">{{ item.changeRate > 0 ? '+' : '' }}{{ item.changeRate }}%</em></button></footer>
        </section>
      </template>

      <template v-else-if="problemPhase === 'relation'">
        <div class="v4-lifecycle-chart v4-lifecycle-chart--relation"><EChart :option="problemFocusOption" :state="chartState" @select="handleProblemFocusSelect" /></div>
        <aside class="v4-focus-summary" :class="`is-${activeClosureStatus}`" aria-live="polite">
          <header class="v4-focus-summary__header">
            <span>{{ activeClosureStatus === 'verified' ? '已验证解决 · 演示数据' : activeClosureStatus === 'recurred' ? '再次复发事实' : '待处理问题事实' }}</span>
            <strong>{{ activeProblem.title }}</strong>
            <small>来源：{{ activeProblem.facts[0]?.source ?? '演示：问题事件记录' }}</small>
          </header>

          <p class="v4-focus-summary__lead">{{ activeProblem.summary }}</p>

          <section class="v4-focus-identity" aria-label="问题身份证">
            <header><span>PROBLEM IDENTITY</span><strong>问题身份证</strong></header>
            <dl>
              <div><dt>款号</dt><dd>{{ activeProblem.identity.styleNo }}</dd></div>
              <div><dt>批次</dt><dd>{{ activeProblem.identity.batch }}</dd></div>
              <div><dt>工位</dt><dd>{{ activeProblem.identity.station }}</dd></div>
              <div><dt>时间窗口</dt><dd>{{ activeProblem.identity.timeWindow }}</dd></div>
            </dl>
          </section>

          <section class="v4-focus-facts" aria-label="已记录事实">
            <header><span>RECORDED FACTS</span><strong>{{ activeProblem.facts.length }}项已记录事实</strong></header>
            <dl><div v-for="fact in activeProblem.facts" :key="fact.label"><dt>{{ fact.label }}</dt><dd>{{ fact.value }}</dd></div></dl>
          </section>

          <section v-if="activeClosureDraft" class="v4-focus-closure" :class="`is-${activeClosureStatus}`" aria-label="闭环验证记录">
            <header><span>CLOSURE RECORD</span><strong>{{ closureStatusSymbols[activeClosureStatus] }} {{ closureStatusLabels[activeClosureStatus] }} · 演示数据</strong></header>
            <dl><div><dt>处理人 / 处理时间</dt><dd>{{ activeClosureDraft.handler || '待记录' }} · {{ activeClosureDraft.handledAt || '--' }}</dd></div><div><dt>验证时间 / 未复发</dt><dd>{{ activeClosureDraft.verifiedAt || '待验证' }} · {{ activeClosureDraft.nonRecurrenceDays ?? 0 }}天</dd></div></dl>
            <p><strong>实际措施：</strong>{{ activeClosureDraft.actualMeasure || '待记录' }}</p>
            <p><strong>验证证据：</strong>{{ activeClosureDraft.evidenceNote || '待补充' }}</p>
          </section>

          <section class="v4-focus-trace" aria-label="追溯范围">
            <header><span>TRACE SCOPE</span><strong>追溯范围 · 待现场确认</strong></header>
            <div><span v-for="node in relationTraceNodes" :key="node.id">{{ node.shortLabel }}</span></div>
          </section>

          <section v-if="!activeClosureDraft" class="v4-focus-current" aria-label="当前查看节点">
            <div><span>{{ selectedRelationDetail.status }}</span><strong>{{ selectedRelationDetail.label }}</strong></div>
            <small>{{ selectedRelationDetail.source }}</small>
            <p>{{ selectedRelationDetail.detail }}</p>
          </section>

          <em class="v4-focus-boundary">当前仅展示已记录事实与待确认追溯范围，不认定根因。</em>

          <footer class="v4-focus-action">
            <span>查看原因、方案、责任与验证</span>
            <button type="button" :disabled="!canShowRecommendations" @click="enterAnalysis">进入三步分析</button>
            <small v-if="!canShowRecommendations" class="v4-relation-disabled">{{ relationDisabledCopy }}</small>
          </footer>
        </aside>
      </template>

      <section v-else class="v4-analysis-canvas">
        <div v-if="!canShowRecommendations" class="v4-analysis-paused"><strong>{{ unavailableCopy?.[0] }}</strong><p>{{ unavailableCopy?.[1] }}</p><span>当前只保留生命周期与已记录事实，不生成候选原因、方案、岗位或员工素质建议。</span></div>

        <template v-else-if="analysisStepIndex === 0">
          <article class="v4-analysis-main"><header><div><small>RECORDED FACTS</small><h2>{{ analysisProfile.evidence.title }}</h2></div><span>48小时滚动窗口 · 连续采样去重</span></header><div class="v4-analysis-chart"><EChart :option="evidenceTrendOption" :state="chartState" /></div><footer>来源：{{ analysisProfile.evidence.source }} · 单位：{{ analysisProfile.evidence.unit }} · 时间：今日08:00-14:00 · 阈值：{{ analysisProfile.evidence.threshold }}</footer></article>
          <aside class="v4-analysis-side">
            <section class="v4-alert-progression"><header><small>ALERT PROGRESSION</small><strong>预警状态</strong></header><ol><li v-for="(level, index) in alertRuleConfig.levels" :key="level.level" :class="{ 'is-active': index === Math.min(2, activeProblem.identity.continuousCount - 1) }"><em>{{ level.occurrence }}</em><div><strong>{{ level.label }}</strong><span>{{ level.action }}</span></div></li></ol><p>{{ alertRuleConfig.windowHours }}小时内按同一问题身份证累计；连续异常采样只计一次。</p></section>
            <section class="v4-identity-facts"><span>问题身份证</span><strong>{{ activeProblem.identity.styleNo }} / {{ activeProblem.identity.batch }}</strong><small>{{ activeProblem.identity.station }} · {{ activeProblem.identity.timeWindow }}</small><dl><div v-for="fact in activeProblem.facts" :key="fact.label"><dt>{{ fact.label }}</dt><dd>{{ fact.value }}</dd></div></dl></section>
            <section class="v4-mini-period"><header><strong>四周期证据</strong><nav><button v-for="(label, metric) in periodMetricLabels" :key="metric" type="button" :class="{ 'is-active': periodMetric === metric }" @click="setPeriodMetric(metric)">{{ label }}</button></nav></header><div><EChart :option="periodOption" :state="chartState" @select="handlePeriodSelect" /></div></section>
          </aside>
        </template>

        <template v-else-if="analysisStepIndex === 1">
          <article class="v4-analysis-main"><header><div><small>EXPLAINABLE ANALYSIS</small><h2>候选原因证据矩阵</h2></div><span class="is-pending">全部待现场确认</span></header><div class="v4-analysis-chart"><EChart :option="candidateEvidenceOption" :state="chartState" /></div><footer>证据完整度不等于因果置信度 · 绿色AI只推荐检查顺序，不认定根因</footer></article>
          <aside class="v4-analysis-side v4-analysis-side--solution">
            <section class="v4-solution-chart"><header><div><small>ACTION PRIORITY</small><strong>方案优先级</strong></div><span>气泡=数据条件</span></header><div><EChart :option="actionPriorityOption" :state="chartState" /></div></section>
            <section class="v4-check-sequence"><header><strong>建议检查顺序</strong><span>非正式任务</span></header><ol><li v-for="(item, index) in analysisProfile.actionCandidates.slice(0, 3)" :key="item.id"><em>{{ index + 1 }}</em><div><strong>{{ item.label }}</strong><small>{{ item.category }} · 验证约{{ item.verificationHours }}小时 · 数据{{ item.dataReadiness }}%</small></div></li></ol><p>人员类候选证据完整度不足，不生成员工责任结论。</p></section>
          </aside>
        </template>

        <template v-else>
          <article class="v4-analysis-main"><header><div><small>MANAGEMENT EFFECTIVENESS</small><h2>厂长干预效能 × 改善稳定度</h2></div><span>按问题闭环案例，不评价个人排名</span></header><div class="v4-analysis-chart"><EChart :option="managementOption" :state="chartState" /></div><footer>横轴=厂长响应时长 · 纵轴=验证后无复发天数 · 同期关系，不代表已验证因果关系</footer></article>
          <aside class="v4-analysis-side v4-analysis-side--validation">
            <section class="v4-intervention-state"><header><small>AUTO INTERVENTION STATE</small><strong>系统警报已启动待干预流程</strong></header><dl><div><dt>流程状态</dt><dd>待干预</dd></div><div><dt>建议岗位</dt><dd>{{ activeInterventionCase.suggestedRole }}</dd></div><div><dt>协调动作</dt><dd>{{ activeInterventionCase.coordinationActionsCompleted }}/{{ activeInterventionCase.coordinationActionsTotal }}</dd></div><div><dt>证据完整度</dt><dd>{{ activeInterventionCase.evidenceCompleteness }}%</dd></div></dl><p>仅生成检查顺序、建议岗位和验证窗口；未正式派单或发送消息。</p></section>
            <section class="v4-validation-timeline"><header><strong>验证时间轴</strong><span>7 / 30 / 90天</span></header><div><EChart :option="validationTimelineOption" :state="chartState" /></div></section>
            <section class="v4-stability-status"><div><span>系统改善稳定度</span><strong>{{ activeStabilityAssessment.label }}</strong><small>{{ activeStabilityAssessment.reason }}</small></div><div><span>员工素质等级建议</span><strong>{{ employeeSuggestion.label }}</strong><small>{{ employeeSuggestion.reason }}</small></div><em>厂长复核状态：尚不适用 · 只读展示</em></section>
          </aside>
        </template>
      </section>

      <nav v-if="viewMode === 'problem' && problemPhase === 'analysis' && canShowRecommendations" class="v4-manual-controls" aria-label="手动分析控制"><button type="button" :disabled="analysisStepIndex === 0" @click="goToStep(analysisStepIndex - 1)">上一步</button><span>{{ activeStep.eyebrow }} · {{ activeStep.label }}</span><button type="button" :disabled="analysisStepIndex === analysisSteps.length - 1" @click="goToStep(analysisStepIndex + 1)">下一步</button></nav>
      <footer class="v4-stage-source"><span>数据来源：{{ stageSource }}</span><small>统计口径：{{ viewMode === 'factory' ? periodData.find((item) => item.period === selectedPeriod)?.definition : problemPhase === 'relation' ? '同款、同批次、同问题类型与追溯范围；待确认关系不视为因果' : analysisStepIndex === 0 ? '同问题身份证，48小时滚动累计；连续异常采样去重' : analysisStepIndex === 1 ? '候选原因均待现场确认，不认定因果' : '按问题闭环案例统计，不形成厂长个人评分' }} · {{ context.factory }} · {{ context.line }}</small></footer>
    </section>

    <footer class="v4-cabin-footer"><div><i /><span>冷青：数据事实</span><i class="is-ai" /><span>翡翠绿：AI建议</span><i class="is-pending" /><span>琥珀：待确认</span><i class="is-danger" /><span>红色：严重异常</span></div><strong>抽象演示画布 · 不代表松冈真实生产或人员评价结论</strong></footer>

    <div v-if="editingProblem" class="v4-intervention-overlay" role="presentation" @click.self="closeInterventionEditor">
      <section class="v4-intervention-dialog" role="dialog" aria-modal="true" :aria-label="`${editingProblem.title}处理记录`">
        <header><div><small>DEMO INTERVENTION RECORD</small><h2>{{ editingProblem.title }}</h2><span>{{ lifecycleById.get(editingProblem.nodeId)?.label }} · {{ editingProblem.identity.batch }} · 演示数据</span></div><button type="button" aria-label="关闭处理记录" @click="closeInterventionEditor">×</button></header>
        <div class="v4-intervention-body">
          <section class="v4-intervention-checks">
            <header><strong>标准检查清单</strong><span>小对钩仅代表检查动作完成</span></header>
            <button v-for="item in editingProblem.inspectionItems" :key="item.id" type="button" :class="{ 'is-checked': interventionForm.checkedItemIds.includes(item.id) }" :disabled="!canEditIntervention" @click="toggleInspectionItem(item.id)">
              <i>{{ interventionForm.checkedItemIds.includes(item.id) ? '✓' : '' }}</i><span><strong>{{ item.category }} · {{ item.label }}</strong><small>{{ item.method }} · 所需证据：{{ item.requiredEvidence }}</small></span>
            </button>
          </section>
          <section class="v4-intervention-form">
            <label><span>处理人</span><input v-model="interventionForm.handler" :disabled="!canEditIntervention" placeholder="录入实际处理人" /></label>
            <label><span>处理时间</span><input v-model="interventionForm.handledAt" :disabled="!canEditIntervention" placeholder="YYYY-MM-DD HH:mm" /></label>
            <label class="is-wide"><span>实际措施</span><textarea v-model="interventionForm.actualMeasure" :disabled="!canEditIntervention" rows="2" placeholder="记录已实际执行的措施" /></label>
            <label class="is-wide"><span>验证证据</span><textarea v-model="interventionForm.evidenceNote" :disabled="!canEditIntervention" rows="2" placeholder="记录检验、节拍或连续观察证据" /></label>
            <label><span>验证时间</span><input v-model="interventionForm.verifiedAt" :disabled="!canEditIntervention" placeholder="YYYY-MM-DD HH:mm" /></label>
            <label><span>闭环状态</span><select v-model="interventionForm.verificationStatus" :disabled="!canEditIntervention"><option value="not-started">待处理</option><option value="pending-verification">处理中 / 待验证</option><option value="verifying">验证中</option><option value="verified">验证通过 / 已解决</option><option value="recurred">再次复发</option></select></label>
            <label v-if="interventionForm.verificationStatus === 'verified'"><span>无复发天数</span><input v-model.number="interventionForm.nonRecurrenceDays" type="number" min="0" :disabled="!canEditIntervention" /></label>
          </section>
        </div>
        <footer><div><strong>绿色大对钩规则</strong><span>处理人、实际措施、验证时间和验证证据完整，且状态为“验证通过”时才显示。</span><em v-if="interventionDisabledReason">{{ interventionDisabledReason }}</em><em v-if="interventionFormError" class="is-error">{{ interventionFormError }}</em></div><button type="button" :disabled="!canEditIntervention" @click="saveInterventionRecord">保存演示记录</button></footer>
      </section>
    </div>
  </main>
</template>

<style src="../v4-health-center.css"></style>
