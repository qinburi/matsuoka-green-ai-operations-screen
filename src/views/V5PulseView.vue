<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EChart from '../components/EChart.vue'
import VersionDialog from '../components/VersionDialog.vue'
import { contextOptions, sourceLabels, stateLabels } from '../data/demo'
import { healthProblems, lifecycleById, problemById } from '../data/v4-health-center'
import {
  closureEvaluationByProblemId,
  getProblemTrendSeries,
  ownerByProblemId,
  pulseAsOf,
  pulsePeriodLabels,
  pulseUpdatedAt,
  timelineByProblemId,
  trendProfileByProblemId,
} from '../data/v5-pulse'
import { buildPulseEfficiencyGaugeOption, buildPulseTrendOption } from '../v5-chart-options'
import type { ClosureEvaluation, DataState, ProblemClosureTimeline, PulseCaseStatus, PulsePeriodKey } from '../types'

const router = useRouter()
const route = useRoute()
const motionEnabled = ref(true)
let motionMedia: MediaQueryList | null = null
let loadingTimer = 0

const focusProblemMap: Record<string, string> = {
  quality: 'P-QA-01',
  qc21: 'P-QA-01',
  sewing: 'P-SEW-01',
  cutting: 'P-CUT-01',
}

function queryValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function problemIdFromRoute() {
  const requested = queryValue(route.query.problem)
  if (problemById.has(requested)) return requested
  return focusProblemMap[queryValue(route.query.focus)] ?? 'P-QA-01'
}

function normalizePeriod(value: unknown): PulsePeriodKey {
  return ['today', 'week', 'month', 'custom'].includes(String(value)) ? value as PulsePeriodKey : 'today'
}

const selectedProblemId = ref(problemIdFromRoute())
const selectedPeriod = ref<PulsePeriodKey>(normalizePeriod(route.query.period))
const customFrom = ref(queryValue(route.query.from) || '2026-08-01')
const customTo = ref(queryValue(route.query.to) || '2026-08-12')
const dataState = ref<DataState>('normal')
const listFilter = ref<'all' | PulseCaseStatus>('all')
const factory = ref(contextOptions.factories[0])
const line = ref(contextOptions.lines[0])

const fallbackProblem = problemById.get('P-QA-01')!
const activeProblem = computed(() => problemById.get(selectedProblemId.value) ?? fallbackProblem)
const activeProfile = computed(() => trendProfileByProblemId.get(activeProblem.value.id) ?? trendProfileByProblemId.get('P-QA-01')!)
const activeTimeline = computed(() => timelineByProblemId.get(activeProblem.value.id) ?? timelineByProblemId.get('P-QA-01')!)
const activeOwner = computed(() => ownerByProblemId.get(activeProblem.value.id) ?? ownerByProblemId.get('P-QA-01')!)
const activeEvaluation = computed(() => closureEvaluationByProblemId.get(activeProblem.value.id) ?? closureEvaluationByProblemId.get('P-QA-01')!)
const trendSnapshot = computed(() => getProblemTrendSeries(activeProfile.value, selectedPeriod.value, customFrom.value, customTo.value))
const chartOption = computed(() => buildPulseTrendOption(activeProfile.value, trendSnapshot.value, activeTimeline.value, motionEnabled.value))
const activeProcess = computed(() => lifecycleById.get(activeProblem.value.nodeId)?.label ?? activeProblem.value.identity.process)
const sourceLabel = computed(() => sourceLabels[queryValue(route.query.source)] ?? '绿色AI综合入口')
const canEvaluate = computed(() => dataState.value === 'normal')

function minutesBetween(start: string | null, end: string | null) {
  if (!start || !end) return null
  const value = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
  return Number.isFinite(value) && value >= 0 ? value : null
}

const elapsedMinutes = computed(() => minutesBetween(activeTimeline.value.occurredAt, activeTimeline.value.verifiedAt ?? pulseAsOf) ?? 0)
const targetMinutes = computed(() => minutesBetween(activeTimeline.value.occurredAt, activeTimeline.value.resolutionTargetAt))
const gaugeOption = computed(() => buildPulseEfficiencyGaugeOption(elapsedMinutes.value, targetMinutes.value, activeEvaluation.value.overdue, motionEnabled.value))
const activeAvatarUrl = computed(() => `${import.meta.env.BASE_URL}${activeOwner.value.avatarAsset}`)

const closureRows = computed(() => healthProblems.flatMap((problem) => {
  const timeline = timelineByProblemId.get(problem.id)
  const owner = ownerByProblemId.get(problem.id)
  const evaluation = closureEvaluationByProblemId.get(problem.id)
  if (!timeline || !owner || !evaluation) return []
  return [{ problem, timeline, owner, evaluation }]
}))

const filteredRows = computed(() => listFilter.value === 'all'
  ? closureRows.value
  : closureRows.value.filter((row) => row.timeline.status === listFilter.value))

const summary = computed(() => ({
  pending: closureRows.value.filter((row) => row.timeline.status === 'pending').length,
  processing: closureRows.value.filter((row) => row.timeline.status === 'processing').length,
  overdue: closureRows.value.filter((row) => row.evaluation.overdue).length,
  resolved: closureRows.value.filter((row) => row.timeline.status === 'verified' && row.evaluation.isResolved).length,
}))

const listFilters: Array<{ id: 'all' | PulseCaseStatus; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'pending', label: '待处理' },
  { id: 'processing', label: '处理中' },
  { id: 'verified', label: '已解决' },
  { id: 'recurred', label: '再次复发' },
]

const periodItems = (Object.keys(pulsePeriodLabels) as PulsePeriodKey[]).map((id) => ({ id, label: pulsePeriodLabels[id] }))

const timelineSteps = computed(() => {
  const timeline = activeTimeline.value
  return [
    { id: 'occurred', label: '问题发生', at: timeline.occurredAt, note: '系统记录异常事实', state: 'done' },
    { id: 'response', label: '首次响应', at: timeline.responseAt, note: timeline.responseAt ? `用时 ${activeEvaluation.value.responseMinutes ?? '--'} 分钟` : activeEvaluation.value.overdue ? '尚未响应 · 已超时' : '等待响应', state: timeline.responseAt ? 'done' : 'active' },
    { id: 'handled', label: '实际处理', at: timeline.handledAt, note: timeline.actualMeasure ?? '等待记录实际措施', state: timeline.handledAt ? 'done' : timeline.responseAt ? 'active' : 'pending' },
    { id: 'verified', label: '验证完成', at: timeline.verifiedAt, note: timeline.verificationEvidence ?? (timeline.status === 'recurred' ? '验证后再次复发' : '等待验证证据'), state: timeline.status === 'recurred' || timeline.status === 'failed' ? 'failed' : timeline.verifiedAt ? 'done' : timeline.handledAt ? 'active' : 'pending' },
  ]
})

function displayDateTime(value: string | null) {
  if (!value) return '--'
  const date = new Date(value)
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function avatarUrl(asset: string) {
  return `${import.meta.env.BASE_URL}${asset}`
}

function updateMotionPreference() {
  motionEnabled.value = !motionMedia?.matches
}

function evaluationLabel(evaluation: ClosureEvaluation) {
  if (dataState.value === 'stale') return '待复核'
  if (!canEvaluate.value) return '暂停评价'
  return evaluation.label
}

function statusLabel(timeline: ProblemClosureTimeline, evaluation: ClosureEvaluation) {
  if (timeline.status === 'verified' && evaluation.isResolved) return '已解决'
  if (timeline.status === 'recurred') return '再次复发'
  if (evaluation.overdue) return '已超时'
  if (timeline.status === 'processing') return '处理中'
  return '待处理'
}

function statusSymbol(timeline: ProblemClosureTimeline, evaluation: ClosureEvaluation) {
  if (timeline.status === 'verified' && evaluation.isResolved) return '✓'
  if (timeline.status === 'recurred') return '↻'
  if (timeline.status === 'processing') return '●'
  return '!'
}

async function selectProblem(problemId: string) {
  if (problemId === selectedProblemId.value) return
  selectedProblemId.value = problemId
  await router.push({ query: { ...route.query, problem: problemId, period: selectedPeriod.value, step: undefined } })
}

async function selectPeriod(period: PulsePeriodKey) {
  selectedPeriod.value = period
  const query = { ...route.query, period, step: undefined }
  if (period === 'custom') {
    Object.assign(query, { from: customFrom.value, to: customTo.value })
  } else {
    Object.assign(query, { from: undefined, to: undefined })
  }
  await router.replace({ query })
}

async function applyCustomRange() {
  if (customFrom.value > customTo.value) customTo.value = customFrom.value
  selectedPeriod.value = 'custom'
  await router.replace({ query: { ...route.query, period: 'custom', from: customFrom.value, to: customTo.value, step: undefined } })
}

function updateDataState() {
  window.clearTimeout(loadingTimer)
  if (dataState.value === 'loading') {
    loadingTimer = window.setTimeout(() => {
      if (dataState.value === 'loading') dataState.value = 'normal'
    }, 900)
  }
}

watch([() => route.query.problem, () => route.query.focus], () => {
  selectedProblemId.value = problemIdFromRoute()
})

watch(() => route.query.period, (value) => {
  selectedPeriod.value = normalizePeriod(value)
})

watch([() => route.query.from, () => route.query.to], ([from, to]) => {
  const nextFrom = queryValue(from)
  const nextTo = queryValue(to)
  if (nextFrom) customFrom.value = nextFrom
  if (nextTo) customTo.value = nextTo
})

onMounted(() => {
  motionMedia = window.matchMedia('(prefers-reduced-motion: reduce)')
  updateMotionPreference()
  motionMedia.addEventListener('change', updateMotionPreference)
})

onBeforeUnmount(() => {
  window.clearTimeout(loadingTimer)
  motionMedia?.removeEventListener('change', updateMotionPreference)
})
</script>

<template>
  <main class="v5-pulse-screen" data-ui-version="v5.0.0">
    <div class="v5-desktop-required">
      <strong>请使用桌面大屏查看</strong>
      <span>V5.0.0 态势感知与敏捷管控中心仅提供桌面端与大屏布局。</span>
    </div>

    <header class="v5-topbar">
      <button class="v5-back" type="button" @click="router.push({ name: 'overview', query: { ...route.query } })">返回大屏</button>
      <div class="v5-brand">
        <span>MATSUOKA GREEN AI · DEMO</span>
        <h1>态势感知 · 敏捷管控中心</h1>
      </div>
      <label class="v5-compact-field"><span>工厂</span><select v-model="factory"><option v-for="item in contextOptions.factories" :key="item">{{ item }}</option></select></label>
      <label class="v5-compact-field"><span>产线</span><select v-model="line"><option v-for="item in contextOptions.lines" :key="item">{{ item }}</option></select></label>
      <div class="v5-top-meta"><span>演示数据</span><strong>{{ pulseUpdatedAt }}</strong></div>
      <VersionDialog />
    </header>

    <section class="v5-control-strip" aria-label="周期与数据范围">
      <div class="v5-period-tabs" role="tablist" aria-label="统计周期">
        <button v-for="item in periodItems" :key="item.id" type="button" :class="{ 'is-active': selectedPeriod === item.id }" @click="selectPeriod(item.id)">{{ item.label }}</button>
      </div>
      <div v-if="selectedPeriod === 'custom'" class="v5-custom-range">
        <input v-model="customFrom" type="date" aria-label="自定义开始日期" @change="applyCustomRange" />
        <span>至</span>
        <input v-model="customTo" type="date" aria-label="自定义结束日期" @change="applyCustomRange" />
      </div>
      <div v-else class="v5-range-label"><strong>{{ trendSnapshot.rangeLabel }}</strong><span>对比 {{ trendSnapshot.comparisonRangeLabel }}</span></div>
      <div class="v5-control-spacer" />
      <span class="v5-source">来源：{{ sourceLabel }}</span>
      <label class="v5-state-select"><span>数据状态</span><select v-model="dataState" @change="updateDataState"><option v-for="(label, key) in stateLabels" :key="key" :value="key">{{ label }}</option></select></label>
    </section>

    <section class="v5-summary-strip" aria-label="问题闭环摘要">
      <article><span>待处理</span><strong>{{ dataState === 'normal' || dataState === 'stale' ? summary.pending : '--' }}</strong><small>等待首次响应</small></article>
      <article><span>处理中</span><strong>{{ dataState === 'normal' || dataState === 'stale' ? summary.processing : '--' }}</strong><small>已响应待验证</small></article>
      <article class="is-danger"><span>已超时</span><strong>{{ dataState === 'normal' || dataState === 'stale' ? summary.overdue : '--' }}</strong><small>超过解决目标</small></article>
      <article class="is-resolved"><span>今日已解决</span><strong>{{ dataState === 'normal' || dataState === 'stale' ? summary.resolved : '--' }}</strong><small>验证通过且证据完整</small></article>
    </section>

    <section class="v5-workspace">
      <section class="v5-main-stage">
        <header class="v5-problem-heading">
          <div>
            <span class="v5-severity" :class="`is-${activeProblem.severity}`">{{ statusLabel(activeTimeline, activeEvaluation) }}</span>
            <small>{{ activeProcess }} · {{ activeProblem.id }}</small>
            <h2>{{ activeProblem.title }}</h2>
          </div>
          <div class="v5-problem-impact">
            <span>当前影响</span>
            <strong>{{ activeProblem.impactValue }}<small>{{ activeProblem.impactUnit }}</small></strong>
            <em :class="{ 'is-up': activeProblem.changeFromYesterday > 0 }">较昨日 {{ activeProblem.changeFromYesterday > 0 ? '+' : '' }}{{ activeProblem.changeFromYesterday }}</em>
          </div>
        </header>

        <section class="v5-trend-panel" aria-label="当前问题脉搏曲线">
          <div class="v5-chart-title">
            <div><span>PROBLEM PULSE</span><h3>{{ activeProfile.metricLabel }}变化曲线</h3></div>
            <p>{{ trendSnapshot.currentLabel }}与{{ trendSnapshot.comparisonLabel }}同期对比</p>
          </div>
          <EChart :option="chartOption" :state="dataState" empty-text="当前问题在所选时间范围内没有趋势记录" />
          <footer class="v5-chart-meta">
            <span><b>来源</b>{{ activeProfile.source }}</span>
            <span><b>指标</b>{{ activeProfile.definition }}</span>
            <span><b>口径</b>{{ activeProfile.aggregation === 'peak' ? '周期峰值' : activeProfile.aggregation === 'sum' ? '周期累计' : '周期均值' }}</span>
            <span><b>单位</b>{{ activeProfile.unit }}</span>
          </footer>
        </section>

        <section class="v5-timeline-panel" aria-label="问题闭环时间轴">
          <header><div><span>CLOSURE TIMELINE</span><h3>问题闭环时间节点</h3></div><p>评价对象为本次问题闭环，不评价个人能力或态度</p></header>
          <div class="v5-timeline">
            <article v-for="step in timelineSteps" :key="step.id" :class="`is-${step.state}`">
              <i>{{ step.state === 'done' ? '✓' : step.state === 'failed' ? '×' : step.state === 'active' ? '●' : '' }}</i>
              <div><span>{{ step.label }}</span><strong>{{ displayDateTime(step.at) }}</strong><small>{{ step.note }}</small></div>
            </article>
          </div>
        </section>
      </section>

      <aside class="v5-side-panel">
        <section class="v5-owner-panel">
          <header><div><span>RESPONSIBLE OWNER</span><h2>当前责任人</h2></div><em>演示关联</em></header>
          <div class="v5-owner-main">
            <img :src="activeAvatarUrl" :alt="`${activeOwner.displayName}通用人物头像`" />
            <div><strong>{{ activeOwner.displayName }}</strong><span>{{ activeOwner.department }}</span><small>{{ activeOwner.role }}</small></div>
          </div>
          <div class="v5-owner-performance">
            <div class="v5-gauge"><EChart :option="gaugeOption" :state="dataState" /></div>
            <div class="v5-evaluation" :class="`is-${canEvaluate ? activeEvaluation.level : 'pending'}`">
              <span>闭环评价</span>
              <strong>{{ evaluationLabel(activeEvaluation) }}</strong>
              <p>{{ canEvaluate ? activeEvaluation.reason : '当前数据状态不允许生成闭环评价' }}</p>
              <small v-if="activeEvaluation.overdue">解决目标已超时，完成验证前仍保持待评价</small>
            </div>
          </div>
        </section>

        <section class="v5-problem-list">
          <header><div><span>PROBLEM QUEUE</span><h2>问题清单</h2></div><strong>{{ filteredRows.length }}</strong></header>
          <div class="v5-list-filters">
            <button v-for="filter in listFilters" :key="filter.id" type="button" :class="{ 'is-active': listFilter === filter.id }" @click="listFilter = filter.id">{{ filter.label }}</button>
          </div>
          <div class="v5-list-scroll">
            <button v-for="row in filteredRows" :key="row.problem.id" type="button" class="v5-problem-row" :class="[`is-${row.timeline.status}`, { 'is-selected': row.problem.id === activeProblem.id, 'is-resolved': row.evaluation.isResolved }]" @click="selectProblem(row.problem.id)">
              <span class="v5-row-symbol">{{ statusSymbol(row.timeline, row.evaluation) }}</span>
              <span class="v5-row-content"><strong>{{ row.problem.title }}</strong><small>{{ displayDateTime(row.timeline.occurredAt) }} · {{ row.problem.impactValue }}{{ row.problem.impactUnit }}</small><em>{{ statusLabel(row.timeline, row.evaluation) }}</em></span>
              <img :src="avatarUrl(row.owner.avatarAsset)" alt="" aria-hidden="true" />
              <span class="v5-row-owner"><strong>{{ row.owner.displayName.replace('（演示）', '') }}</strong><small>{{ evaluationLabel(row.evaluation) }}</small></span>
            </button>
            <div v-if="filteredRows.length === 0" class="v5-list-empty">当前筛选状态下没有问题记录</div>
          </div>
        </section>
      </aside>
    </section>
  </main>
</template>

<style src="../v5-pulse.css"></style>
