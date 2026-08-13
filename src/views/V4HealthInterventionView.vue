<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EChart from '../components/EChart.vue'
import VersionDialog from '../components/VersionDialog.vue'
import { contextOptions, defaultContext, sourceLabels } from '../data/demo'
import {
  actionCandidates,
  alertRuleConfig,
  buildPeriodComparisons,
  candidateEvidence,
  currentEmployeeQualitySuggestion,
  currentInterventionCase,
  currentStabilityAssessment,
  managementInterventionEvidence,
  periodKeys,
  periodLabels,
  periodMetricLabels,
} from '../data/v4-analysis'
import { dataStateLabelsV4, healthProblems, lifecycleById, lifecycleNodes, problemById } from '../data/v4-health-center'
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
import type { AnalysisStep, DataState, LifecycleNodeId, PeriodKey, PeriodMetric, ProblemDisplayPhase } from '../types'

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
const selectedProblemId = ref('P-QA-01')
const viewMode = ref<'factory' | 'problem'>(route.query.problem === 'P-QA-01' ? 'problem' : 'factory')
const filtersOpen = ref(false)
const dataState = ref<DataState>('normal')
const validPeriod = typeof route.query.period === 'string' && periodKeys.includes(route.query.period as PeriodKey)
const selectedPeriod = ref<PeriodKey>(validPeriod ? route.query.period as PeriodKey : 'today')
const periodMetric = ref<PeriodMetric>('count')
const requestedStep = Number(route.query.step)
const analysisStepIndex = ref(Number.isInteger(requestedStep) && requestedStep >= 1 && requestedStep <= 3 ? requestedStep - 1 : 0)
const problemPhase = ref<ProblemDisplayPhase>(viewMode.value === 'problem' && Number.isInteger(requestedStep) && requestedStep >= 1 && requestedStep <= 3 ? 'analysis' : 'relation')
const selectedRelationNodeId = ref<string>('P-QA-01')

const analysisSteps: Array<{ id: AnalysisStep; label: string; eyebrow: string }> = [
  { id: 'evidence', label: '问题与证据', eyebrow: 'STEP 01' },
  { id: 'cause-solution', label: '原因与方案', eyebrow: 'STEP 02' },
  { id: 'responsibility-validation', label: '责任与验证', eyebrow: 'STEP 03' },
]
const activeNode = computed(() => lifecycleById.get(selectedNodeId.value) ?? lifecycleNodes[7])
const activeProblem = computed(() => problemById.get(selectedProblemId.value) ?? healthProblems[0])
const latestAlert = computed(() => activeProblem.value.alertEvents[activeProblem.value.alertEvents.length - 1])
const sourceLabel = computed(() => sourceLabels[context.source] ?? '综合入口')
const chartState = computed(() => dataState.value)
const canShowConclusion = computed(() => dataState.value === 'normal')
const canOpenRelation = computed(() => dataState.value === 'normal' || dataState.value === 'stale')
const canShowRecommendations = computed(() => dataState.value === 'normal')
const activeStep = computed(() => analysisSteps[analysisStepIndex.value])
const periodData = computed(() => buildPeriodComparisons(activeNode.value, periodMetric.value))
const lifecycleOption = computed(() => buildLifecycleCanvasOption(lifecycleNodes, selectedNodeId.value, activeProblem.value))
const problemFocusOption = computed(() => buildProblemFocusOption(lifecycleNodes, activeProblem.value, selectedRelationNodeId.value, dataState.value === 'normal'))
const periodOption = computed(() => buildPeriodComparisonOption(periodData.value, periodMetric.value, selectedPeriod.value))
const evidenceTrendOption = computed(() => buildEvidenceTrendOption(activeProblem.value))
const candidateEvidenceOption = computed(() => buildCandidateEvidenceOption(candidateEvidence))
const actionPriorityOption = computed(() => buildActionPriorityOption(actionCandidates))
const managementOption = computed(() => buildManagementEffectivenessOption(managementInterventionEvidence))
const validationTimelineOption = computed(() => buildValidationTimelineOption())
const relationTraceNodes = computed(() => activeProblem.value.traceNodeIds
  .map((nodeId) => lifecycleById.get(nodeId))
  .filter((node): node is NonNullable<typeof node> => Boolean(node)))
const stageSource = computed(() => {
  if (viewMode.value === 'factory') return activeNode.value.dataSource
  if (problemPhase.value === 'relation') return '演示：QC2-1检验记录 / 质量预警事件 / 批次追溯关系'
  if (analysisStepIndex.value === 0) return '演示：QC2-1检验记录 / 质量预警事件 / 批次追溯关系'
  if (analysisStepIndex.value === 1) return '演示：设备点检 / 工艺标准 / 物料检验 / 巡检记录'
  return '演示：警报事件 / 管理协调记录 / 验证证据 / 历史闭环案例'
})
const selectedRelationDetail = computed(() => {
  if (selectedRelationNodeId.value === activeProblem.value.id) {
    return { label: activeProblem.value.title, source: '演示：质量预警事件', detail: activeProblem.value.summary, status: '严重异常事实' }
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
  return { label: activeProblem.value.title, source: '演示：质量预警事件', detail: activeProblem.value.summary, status: '严重异常事实' }
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
      <dl><div><dt>首要问题</dt><dd>{{ canShowConclusion ? activeProblem.title : unavailableCopy?.[1] }}</dd></div><div><dt>影响范围</dt><dd>{{ canShowConclusion ? `${activeProblem.impactValue} ${activeProblem.impactUnit} · ${activeProblem.identity.batch}` : '--' }}</dd></div><div><dt>预警等级</dt><dd class="is-danger">{{ canShowConclusion ? latestAlert?.levelLabel : '--' }}</dd></div><div><dt>优先动作</dt><dd>{{ canShowConclusion ? '隔离批次，先核查设备与工艺参数' : '等待数据恢复' }}</dd></div><div><dt>建议岗位</dt><dd class="is-ai">{{ canShowConclusion ? activeProblem.suggestedRole : '暂不关联岗位' }}</dd></div></dl>
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
        <button v-if="canOpenRelation" type="button" class="v4-issue-beacon" aria-label="查看缝皱不良第三次警报" @click="openProblem('P-QA-01')"><span>严重异常 · 第三次警报</span><strong>缝皱不良</strong><small>46 pcs · 自动进入待干预流程态</small></button>
        <section class="v4-period-rail">
          <header><div><small>MULTI-PERIOD COMPARISON</small><strong>四周期态势对比</strong></div><nav><button v-for="(label, metric) in periodMetricLabels" :key="metric" type="button" :class="{ 'is-active': periodMetric === metric }" @click="setPeriodMetric(metric)">{{ label }}</button></nav></header>
          <div class="v4-period-chart"><EChart :option="periodOption" :state="chartState" @select="handlePeriodSelect" /></div>
          <footer><button v-for="item in periodData" :key="item.period" type="button" :class="{ 'is-active': selectedPeriod === item.period }" @click="selectPeriod(item.period)"><strong>{{ item.label }}</strong><span>{{ item.currentValue }}{{ item.unit }}</span><em :class="item.changeRate > 0 ? 'is-up' : 'is-down'">{{ item.changeRate > 0 ? '+' : '' }}{{ item.changeRate }}%</em></button></footer>
        </section>
      </template>

      <template v-else-if="problemPhase === 'relation'">
        <div class="v4-lifecycle-chart v4-lifecycle-chart--relation"><EChart :option="problemFocusOption" :state="chartState" @select="handleProblemFocusSelect" /></div>
        <aside class="v4-focus-summary" aria-live="polite">
          <header class="v4-focus-summary__header">
            <span>严重异常事实</span>
            <strong>{{ activeProblem.title }}</strong>
            <small>来源：演示质量预警事件</small>
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
            <header><span>RECORDED FACTS</span><strong>三项已记录事实</strong></header>
            <dl><div v-for="fact in activeProblem.facts" :key="fact.label"><dt>{{ fact.label }}</dt><dd>{{ fact.value }}</dd></div></dl>
          </section>

          <section class="v4-focus-trace" aria-label="追溯范围">
            <header><span>TRACE SCOPE</span><strong>追溯范围 · 待现场确认</strong></header>
            <div><span v-for="node in relationTraceNodes" :key="node.id">{{ node.shortLabel }}</span></div>
          </section>

          <section class="v4-focus-current" aria-label="当前查看节点">
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
          <article class="v4-analysis-main"><header><div><small>RECORDED FACTS</small><h2>不良率趋势与三次预警事件</h2></div><span>48小时滚动窗口 · 连续采样去重</span></header><div class="v4-analysis-chart"><EChart :option="evidenceTrendOption" :state="chartState" /></div><footer>来源：演示QC2-1检验记录 · 单位：% · 时间：今日08:00-14:00 · 阈值：单窗口&gt;2.0%</footer></article>
          <aside class="v4-analysis-side">
            <section class="v4-alert-progression"><header><small>ALERT PROGRESSION</small><strong>三级预警状态</strong></header><ol><li v-for="(level, index) in alertRuleConfig.levels" :key="level.level" :class="{ 'is-active': index === 2 }"><em>{{ level.occurrence }}</em><div><strong>{{ level.label }}</strong><span>{{ level.action }}</span></div></li></ol><p>{{ alertRuleConfig.windowHours }}小时内按同一问题身份证累计；连续异常采样只计一次。</p></section>
            <section class="v4-identity-facts"><span>问题身份证</span><strong>{{ activeProblem.identity.styleNo }} / {{ activeProblem.identity.batch }}</strong><small>{{ activeProblem.identity.station }} · {{ activeProblem.identity.timeWindow }}</small><dl><div v-for="fact in activeProblem.facts" :key="fact.label"><dt>{{ fact.label }}</dt><dd>{{ fact.value }}</dd></div></dl></section>
            <section class="v4-mini-period"><header><strong>四周期证据</strong><nav><button v-for="(label, metric) in periodMetricLabels" :key="metric" type="button" :class="{ 'is-active': periodMetric === metric }" @click="setPeriodMetric(metric)">{{ label }}</button></nav></header><div><EChart :option="periodOption" :state="chartState" @select="handlePeriodSelect" /></div></section>
          </aside>
        </template>

        <template v-else-if="analysisStepIndex === 1">
          <article class="v4-analysis-main"><header><div><small>EXPLAINABLE ANALYSIS</small><h2>候选原因证据矩阵</h2></div><span class="is-pending">全部待现场确认</span></header><div class="v4-analysis-chart"><EChart :option="candidateEvidenceOption" :state="chartState" /></div><footer>证据完整度不等于因果置信度 · 绿色AI只推荐检查顺序，不认定根因</footer></article>
          <aside class="v4-analysis-side v4-analysis-side--solution">
            <section class="v4-solution-chart"><header><div><small>ACTION PRIORITY</small><strong>方案优先级</strong></div><span>气泡=数据条件</span></header><div><EChart :option="actionPriorityOption" :state="chartState" /></div></section>
            <section class="v4-check-sequence"><header><strong>建议检查顺序</strong><span>非正式任务</span></header><ol><li v-for="(item, index) in actionCandidates.slice(0, 3)" :key="item.id"><em>{{ index + 1 }}</em><div><strong>{{ item.label }}</strong><small>{{ item.category }} · 验证约{{ item.verificationHours }}小时 · 数据{{ item.dataReadiness }}%</small></div></li></ol><p>人员类候选证据完整度不足，不生成员工责任结论。</p></section>
          </aside>
        </template>

        <template v-else>
          <article class="v4-analysis-main"><header><div><small>MANAGEMENT EFFECTIVENESS</small><h2>厂长干预效能 × 改善稳定度</h2></div><span>按问题闭环案例，不评价个人排名</span></header><div class="v4-analysis-chart"><EChart :option="managementOption" :state="chartState" /></div><footer>横轴=厂长响应时长 · 纵轴=验证后无复发天数 · 同期关系，不代表已验证因果关系</footer></article>
          <aside class="v4-analysis-side v4-analysis-side--validation">
            <section class="v4-intervention-state"><header><small>AUTO INTERVENTION STATE</small><strong>系统警报已启动待干预流程</strong></header><dl><div><dt>流程状态</dt><dd>待干预</dd></div><div><dt>建议岗位</dt><dd>{{ currentInterventionCase.suggestedRole }}</dd></div><div><dt>协调动作</dt><dd>{{ currentInterventionCase.coordinationActionsCompleted }}/{{ currentInterventionCase.coordinationActionsTotal }}</dd></div><div><dt>证据完整度</dt><dd>{{ currentInterventionCase.evidenceCompleteness }}%</dd></div></dl><p>仅生成检查顺序、建议岗位和验证窗口；未正式派单或发送消息。</p></section>
            <section class="v4-validation-timeline"><header><strong>验证时间轴</strong><span>7 / 30 / 90天</span></header><div><EChart :option="validationTimelineOption" :state="chartState" /></div></section>
            <section class="v4-stability-status"><div><span>系统改善稳定度</span><strong>{{ currentStabilityAssessment.label }}</strong><small>{{ currentStabilityAssessment.reason }}</small></div><div><span>员工素质等级建议</span><strong>{{ currentEmployeeQualitySuggestion.label }}</strong><small>{{ currentEmployeeQualitySuggestion.reason }}</small></div><em>厂长复核状态：尚不适用 · 只读展示</em></section>
          </aside>
        </template>
      </section>

      <nav v-if="viewMode === 'problem' && problemPhase === 'analysis' && canShowRecommendations" class="v4-manual-controls" aria-label="手动分析控制"><button type="button" :disabled="analysisStepIndex === 0" @click="goToStep(analysisStepIndex - 1)">上一步</button><span>{{ activeStep.eyebrow }} · {{ activeStep.label }}</span><button type="button" :disabled="analysisStepIndex === analysisSteps.length - 1" @click="goToStep(analysisStepIndex + 1)">下一步</button></nav>
      <footer class="v4-stage-source"><span>数据来源：{{ stageSource }}</span><small>统计口径：{{ viewMode === 'factory' ? periodData.find((item) => item.period === selectedPeriod)?.definition : problemPhase === 'relation' ? '同款、同批次、同问题类型与追溯范围；待确认关系不视为因果' : analysisStepIndex === 0 ? '同问题身份证，48小时滚动累计；连续异常采样去重' : analysisStepIndex === 1 ? '候选原因均待现场确认，不认定因果' : '按问题闭环案例统计，不形成厂长个人评分' }} · {{ context.factory }} · {{ context.line }}</small></footer>
    </section>

    <footer class="v4-cabin-footer"><div><i /><span>冷青：数据事实</span><i class="is-ai" /><span>翡翠绿：AI建议</span><i class="is-pending" /><span>琥珀：待确认</span><i class="is-danger" /><span>红色：严重异常</span></div><strong>抽象演示画布 · 不代表松冈真实生产或人员评价结论</strong></footer>
  </main>
</template>

<style src="../v4-health-center.css"></style>
