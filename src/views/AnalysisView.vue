<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EChart from '../components/EChart.vue'
import FactoryTwinScene from '../components/FactoryTwinScene.vue'
import FactoryTwinSceneV21 from '../components/FactoryTwinSceneV21.vue'
import VersionDialog from '../components/VersionDialog.vue'
import { buildRankingOption, buildTrendOption } from '../chart-options'
import { contextOptions, defaultContext, sourceLabels, stateLabels, topics } from '../data/demo'
import { demoScenario, factoryZones, issueRelations, zoneById } from '../data/factory-scene'
import type { AiAnalysisStage, CameraShot, DataState, ExperienceMode, Issue, ProcessAnimationState, TopicId } from '../types'

const route = useRoute()
const router = useRouter()
const topicIds: TopicId[] = ['efficiency', 'quality', 'improvement']
const allIssues = Object.values(topics).flatMap((dataset) => dataset.issues)
const issueById = new Map(allIssues.map((issue) => [issue.id, issue]))
const aiStages: { id: AiAnalysisStage; label: string }[] = [
  { id: 'scan', label: '扫描' },
  { id: 'lock', label: '锁定' },
  { id: 'evidence', label: '证据' },
  { id: 'hypothesis', label: '假设' },
  { id: 'solution', label: '措施' },
  { id: 'responsibility', label: '责任' },
]

const initialTopic = topicIds.includes(route.query.topic as TopicId)
  ? route.query.topic as TopicId
  : 'efficiency'
const initialMode: ExperienceMode = route.query.mode === 'explore'
  ? 'explore'
  : route.query.mode === 'guided' || route.query.source === 'green-ai-entry'
    ? 'guided'
    : 'explore'

const currentTopicId = ref<TopicId>(initialTopic)
const experienceMode = ref<ExperienceMode>(initialMode)
const context = reactive({
  ...defaultContext,
  source: typeof route.query.source === 'string' ? route.query.source : defaultContext.source,
})
const dataState = ref<DataState>('normal')
const analyzing = ref(false)
const analysisStep = ref(4)
const filtersOpen = ref(false)
const evidencePinned = ref(false)
const sceneRenderer = ref<'webgl' | 'fallback'>('webgl')
const lastUpdated = ref(new Date())
const selectedZoneId = ref(typeof route.query.focus === 'string' && route.query.focus ? route.query.focus : null)
const selectedIssueId = ref<string | null>(null)
const currentChapterIndex = ref(initialMode === 'guided' ? 0 : 1)
const elapsedSeconds = ref(initialMode === 'guided' ? 0 : 8)
const playing = ref(initialMode === 'guided')

let storyFrame = 0
let lastStoryTick = 0
const analysisTimers: number[] = []

const currentDataset = computed(() => topics[currentTopicId.value])
const currentChapter = computed(() => demoScenario.chapters[currentChapterIndex.value])
const isV21 = computed(() => route.meta.uiVersion === 'v2.1.0')
const sourceLabel = computed(() => sourceLabels[context.source] ?? '综合入口')
const displayData = computed(() => dataState.value === 'normal' || dataState.value === 'stale')
const sceneState = computed<DataState | 'loading'>(() => analyzing.value ? 'loading' : dataState.value)
const updatedText = computed(() => new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
}).format(lastUpdated.value))

const activeZoneId = computed(() => {
  if (selectedZoneId.value) return selectedZoneId.value
  return experienceMode.value === 'guided' ? currentChapter.value.focusZoneId : null
})
const activeZone = computed(() => activeZoneId.value ? zoneById.get(activeZoneId.value) ?? null : null)
const activeIssue = computed<Issue | null>(() => {
  const topicIssueId = activeZone.value?.issueIds.find((issueId) => (
    issueById.get(issueId)?.topic === currentTopicId.value
  ))
  const issueId = selectedIssueId.value
    ?? (experienceMode.value === 'guided' ? currentChapter.value.focusIssueId : null)
    ?? topicIssueId
    ?? activeZone.value?.issueIds[0]
    ?? null
  return issueId ? issueById.get(issueId) ?? null : null
})
const activeRelation = computed(() => {
  if (!activeIssue.value) return null
  return issueRelations.find((relation) => (
    relation.sourceIssueId === activeIssue.value?.id || relation.targetIssueId === activeIssue.value?.id
  )) ?? null
})

const storyProgress = computed(() => Math.min(100, elapsedSeconds.value / demoScenario.totalDuration * 100))
const chapterProgress = computed(() => {
  const start = chapterStart(currentChapterIndex.value)
  return Math.max(0, Math.min(1, (elapsedSeconds.value - start) / currentChapter.value.duration))
})
const improvementProgress = computed(() => {
  if (currentChapter.value.improvement.status === 'simulation') return chapterProgress.value
  if (currentChapter.value.improvement.status === 'recovered') return 1
  return 0
})
const activeAiStageIndex = computed(() => aiStages.findIndex((stage) => stage.id === currentChapter.value.aiStage))
const zoneStates = computed<Record<string, ProcessAnimationState>>(() => {
  const result = Object.fromEntries(factoryZones.map((zone) => [
    zone.id,
    zone.health === 'critical' || zone.health === 'warning' ? 'warning' : 'ambient',
  ])) as Record<string, ProcessAnimationState>
  if (!displayData.value) return Object.fromEntries(factoryZones.map((zone) => [zone.id, 'ambient'])) as Record<string, ProcessAnimationState>
  const chapterId = currentChapter.value.id
  if (chapterId === 'qc21') {
    result.qc21 = 'diagnosing'
    result.sewing = 'warning'
    result.finishing = 'warning'
  } else if (chapterId === 'sewing' || chapterId === 'explain') {
    result.sewing = 'diagnosing'
    result.qc21 = 'warning'
    result.finishing = 'warning'
  } else if (chapterId === 'actions') {
    result.qc21 = 'improving'
    result.sewing = 'improving'
    result.finishing = 'improving'
  } else if (chapterId === 'summary') {
    result.qc21 = 'recovered'
    result.sewing = 'recovered'
    result.finishing = 'recovered'
  }
  if (experienceMode.value === 'explore' && activeZoneId.value) result[activeZoneId.value] = 'selected'
  return result
})
const evidenceRailVisible = computed(() => (
  evidencePinned.value
  || ['relationship', 'actions'].includes(currentChapter.value.evidenceMode)
))
const evidenceTopic = computed<TopicId>(() => {
  if (activeIssue.value) return activeIssue.value.topic
  return currentTopicId.value
})
const evidenceDataset = computed(() => topics[evidenceTopic.value])
const trendOption = computed(() => buildTrendOption(evidenceDataset.value))
const rankingOption = computed(() => buildRankingOption(evidenceTopic.value, evidenceDataset.value.issues))

const overviewMetrics = computed(() => [
  topics.efficiency.metrics.find((metric) => metric.id === 'completion')!,
  topics.quality.metrics.find((metric) => metric.id === 'defectRate')!,
  topics.efficiency.metrics.find((metric) => metric.id === 'riskQty')!,
])

const decisionTitle = computed(() => {
  if (!displayData.value) return stateLabels[dataState.value]
  return activeIssue.value?.title ?? '当日优先关注生产节拍与质量联动'
})
const decisionSummary = computed(() => {
  if (!displayData.value) return '当前状态下不生成AI判断。'
  return activeIssue.value?.summary
    ?? 'QC2-1等待与缝制三组在制堆积是当日优先复核对象，质量信号仅作为同期关联线索。'
})
const unavailableGuidance = computed(() => {
  if (dataState.value === 'empty') return {
    impact: '当前筛选范围无记录',
    evidence: '调整时间、产线或契约条件后重新分析',
    action: '扩大筛选范围',
    validation: '出现有效 MES / QMS 记录后恢复判断',
    owner: '数据管理员',
    role: '检查数据同步范围与筛选口径',
    boundary: '无有效数据，不生成原因、措施或责任建议。',
  }
  if (dataState.value === 'error') return {
    impact: '数据服务加载失败',
    evidence: '当前未取得可验证的生产与质量证据',
    action: '重试分析并检查数据服务',
    validation: '数据服务恢复且校验通过后重新生成结论',
    owner: '系统运维 / 数据管理员',
    role: '检查接口、任务与数据服务状态',
    boundary: '加载失败期间不沿用上一次AI判断。',
  }
  if (dataState.value === 'forbidden') return {
    impact: '当前账号无数据权限',
    evidence: '系统未读取受限产线与质量明细',
    action: '申请对应组织与数据范围权限',
    validation: '授权生效后重新进入分析',
    owner: '系统管理员 / 数据责任人',
    role: '复核角色、组织与数据权限范围',
    boundary: '未授权数据不参与分析，也不展示历史判断。',
  }
  return null
})
const primaryImpact = computed(() => activeIssue.value
  ? `${activeIssue.value.impact} ${activeIssue.value.impactUnit}`
  : '286 pcs')
const primaryAction = computed(() => activeIssue.value?.solutions[0]?.title
  ?? '复核QC2-1队列与缝制三组节拍')
const responsibility = computed(() => activeIssue.value?.responsibility ?? {
  department: '品质部 / 生产部',
  role: 'QC2组长 / 生产调度',
  confirmation: '建议关联，待客户确认',
})

const cameraPreset = computed<CameraShot>(() => {
  if (experienceMode.value === 'guided' && !selectedZoneId.value) return currentChapter.value.camera
  if (activeZone.value) {
    const [x, , z] = activeZone.value.position
    return { position: [x + 5.6, 6.8, z + 7.4], target: [x, 0.35, z], duration: 920, framing: 'zone', pathLift: 1.8 }
  }
  return demoScenario.chapters[1].camera
})

function chapterStart(index: number) {
  return demoScenario.chapters.slice(0, index).reduce((sum, chapter) => sum + chapter.duration, 0)
}

function chapterAt(seconds: number) {
  let total = 0
  for (let index = 0; index < demoScenario.chapters.length; index += 1) {
    total += demoScenario.chapters[index].duration
    if (seconds < total) return index
  }
  return demoScenario.chapters.length - 1
}

function storyLoop(now: number) {
  storyFrame = window.requestAnimationFrame(storyLoop)
  if (!lastStoryTick) lastStoryTick = now
  const delta = Math.min(0.25, (now - lastStoryTick) / 1000)
  lastStoryTick = now
  if (!playing.value || experienceMode.value !== 'guided') return
  elapsedSeconds.value = Math.min(demoScenario.totalDuration, elapsedSeconds.value + delta)
  currentChapterIndex.value = chapterAt(elapsedSeconds.value)
  if (elapsedSeconds.value >= demoScenario.totalDuration) playing.value = false
}

function updateRoute() {
  const routeName = route.meta.uiVersion === 'v2.1.0'
    ? 'v21-analysis'
    : route.meta.uiVersion === 'v2.0.0'
      ? 'v2-analysis'
      : 'analysis'
  router.replace({
    name: routeName,
    query: {
      topic: currentTopicId.value,
      source: context.source,
      mode: experienceMode.value,
      scenario: demoScenario.id,
      focus: selectedZoneId.value || undefined,
      renderer: route.query.renderer === '2d' ? '2d' : undefined,
    },
  })
}

function pauseForInteraction() {
  playing.value = false
}

function backToOverview() {
  const routeName = route.meta.uiVersion === 'v2.1.0'
    ? 'v21-overview'
    : route.meta.uiVersion === 'v2.0.0'
      ? 'v2-overview'
      : 'overview'
  router.push({ name: routeName })
}

function selectZone(zoneId: string) {
  if (!displayData.value) return
  selectedZoneId.value = zoneId
  const zone = zoneById.get(zoneId)
  selectedIssueId.value = zone?.issueIds.find((issueId) => issueById.get(issueId)?.topic === currentTopicId.value)
    ?? zone?.issueIds[0]
    ?? null
  pauseForInteraction()
  updateRoute()
}

function selectIssue(payload: unknown) {
  const issueId = (payload as { issueId?: string } | null)?.issueId
  if (!issueId || !displayData.value) return
  const issue = issueById.get(issueId)
  if (!issue) return
  selectedIssueId.value = issueId
  const zone = factoryZones.find((item) => item.issueIds.includes(issueId))
  if (zone) selectedZoneId.value = zone.id
  pauseForInteraction()
}

function chooseTopic(topic: TopicId) {
  if (topic === currentTopicId.value && experienceMode.value === 'explore') return
  currentTopicId.value = topic
  experienceMode.value = 'explore'
  playing.value = false
  selectedIssueId.value = null
  selectedZoneId.value = topic === 'quality' ? 'sewing' : topic === 'improvement' ? 'special' : 'qc21'
  context.source = 'green-ai-entry'
  updateRoute()
}

function seekChapter(index: number, autoplay = false) {
  const safeIndex = Math.max(0, Math.min(demoScenario.chapters.length - 1, index))
  experienceMode.value = 'guided'
  currentChapterIndex.value = safeIndex
  elapsedSeconds.value = chapterStart(safeIndex)
  selectedZoneId.value = null
  selectedIssueId.value = null
  playing.value = autoplay
  updateRoute()
}

function togglePlayback() {
  if (experienceMode.value === 'explore') {
    seekChapter(currentChapterIndex.value, true)
    return
  }
  if (elapsedSeconds.value >= demoScenario.totalDuration) seekChapter(0, true)
  else playing.value = !playing.value
}

function restartStory() {
  seekChapter(0, true)
}

function exitStory() {
  experienceMode.value = 'explore'
  playing.value = false
  selectedZoneId.value = activeZoneId.value
  if (!selectedZoneId.value) selectedZoneId.value = 'qc21'
  updateRoute()
}

function clearAnalysisTimers() {
  while (analysisTimers.length) window.clearTimeout(analysisTimers.pop())
}

function runAnalysis() {
  clearAnalysisTimers()
  if (dataState.value !== 'normal' && dataState.value !== 'stale') {
    analyzing.value = false
    analysisStep.value = 4
    return
  }
  analyzing.value = true
  analysisStep.value = 0
  ;[420, 840, 1260].forEach((delay, index) => {
    analysisTimers.push(window.setTimeout(() => { analysisStep.value = index + 1 }, delay))
  })
  analysisTimers.push(window.setTimeout(() => {
    analyzing.value = false
    analysisStep.value = 4
    lastUpdated.value = new Date()
  }, 1760))
}

function updateDataState() {
  context.dataState = dataState.value
  selectedIssueId.value = null
  runAnalysis()
}

function formatStoryTime(seconds: number) {
  const value = Math.max(0, Math.min(demoScenario.totalDuration, Math.floor(seconds)))
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}

watch(() => route.query, (query) => {
  const topic = query.topic as TopicId
  const nextTopic = topicIds.includes(topic) ? topic : currentTopicId.value
  const nextFocus = typeof query.focus === 'string' && query.focus ? query.focus : null
  if (nextTopic !== currentTopicId.value || nextFocus !== selectedZoneId.value) selectedIssueId.value = null
  currentTopicId.value = nextTopic
  if (query.mode === 'guided' && experienceMode.value !== 'guided') {
    currentChapterIndex.value = 0
    elapsedSeconds.value = 0
    playing.value = true
  } else if (query.mode === 'explore' && experienceMode.value !== 'explore') {
    currentChapterIndex.value = 1
    elapsedSeconds.value = 8
    playing.value = false
  }
  if (query.mode === 'guided' || query.mode === 'explore') experienceMode.value = query.mode
  if (typeof query.source === 'string') context.source = query.source
  selectedZoneId.value = nextFocus
}, { deep: true })

onMounted(() => {
  storyFrame = window.requestAnimationFrame(storyLoop)
  if (initialMode === 'guided') runAnalysis()
})

onBeforeUnmount(() => {
  window.cancelAnimationFrame(storyFrame)
  clearAnalysisTimers()
})
</script>

<template>
  <main class="command-center" :class="{ 'has-evidence': evidenceRailVisible, 'command-center--v21': isV21 }">
    <header class="command-header">
      <div class="command-brand">
        <button type="button" class="back-command" @click="backToOverview">返回大屏</button>
        <span class="brand-rule" />
        <div>
          <span>MATSUOKA · GREEN AI</span>
          <h1>三维生产指挥舱</h1>
        </div>
      </div>

      <nav class="command-topics" aria-label="分析主题">
        <button
          v-for="topic in topicIds"
          :key="topic"
          type="button"
          :class="{ 'is-active': currentTopicId === topic && experienceMode === 'explore' }"
          @click="chooseTopic(topic)"
        >
          {{ topics[topic].label }}
        </button>
      </nav>

      <div class="command-meta">
        <button type="button" class="filter-command" :aria-expanded="filtersOpen" @click="filtersOpen = !filtersOpen">
          筛选
        </button>
        <VersionDialog />
        <span class="demo-badge">演示数据</span>
        <div class="update-stamp"><small>数据更新</small><strong>{{ updatedText }}</strong></div>
      </div>
    </header>

    <Transition name="filter-ribbon">
      <section v-if="filtersOpen" class="context-ribbon" aria-label="分析筛选条件">
        <div class="entry-context"><span>入口上下文</span><strong>{{ sourceLabel }}</strong></div>
        <label><span>工厂</span><select v-model="context.factory" @change="runAnalysis"><option v-for="item in contextOptions.factories" :key="item">{{ item }}</option></select></label>
        <label><span>车间 / 产线</span><select v-model="context.line" @change="runAnalysis"><option v-for="item in contextOptions.lines" :key="item">{{ item }}</option></select></label>
        <label><span>时间范围</span><select v-model="context.period" @change="runAnalysis"><option v-for="item in contextOptions.periods" :key="item">{{ item }}</option></select></label>
        <label><span>契约 / 品番</span><select v-model="context.contract" @change="runAnalysis"><option v-for="item in contextOptions.contracts" :key="item">{{ item }}</option></select></label>
        <label><span>演示状态</span><select v-model="dataState" @change="updateDataState"><option v-for="(label, key) in stateLabels" :key="key" :value="key">{{ label }}</option></select></label>
        <button type="button" class="reanalyze-command" :disabled="analyzing" @click="runAnalysis">{{ analyzing ? '分析中' : '重新分析' }}</button>
      </section>
    </Transition>

    <section class="command-stage">
      <FactoryTwinSceneV21
        v-if="isV21"
        :zones="factoryZones"
        :active-zone-id="activeZoneId"
        :camera="cameraPreset"
        :data-state="sceneState"
        :zone-states="zoneStates"
        :ai-stage="currentChapter.aiStage"
        :chapter-progress="chapterProgress"
        :flow-snapshot="currentChapter.flow"
        :improvement-progress="improvementProgress"
        :force-fallback="route.query.renderer === '2d'"
        @select-zone="selectZone"
        @manual-interaction="pauseForInteraction"
        @render-state="sceneRenderer = $event"
      />
      <FactoryTwinScene
        v-else
        :zones="factoryZones"
        :active-zone-id="activeZoneId"
        :camera="cameraPreset"
        :data-state="sceneState"
        :force-fallback="route.query.renderer === '2d'"
        @select-zone="selectZone"
        @manual-interaction="pauseForInteraction"
        @render-state="sceneRenderer = $event"
      />

      <aside class="narrative-rail" aria-label="引导演示章节">
        <header>
          <span>{{ currentChapter.kicker }}</span>
          <strong>0{{ currentChapter.order }} / 07</strong>
        </header>
        <h2>{{ currentChapter.title }}</h2>
        <p>{{ currentChapter.narrative }}</p>

        <dl class="pulse-metrics">
          <div v-for="metric in overviewMetrics" :key="metric.id">
            <dt>{{ metric.label }}</dt>
            <dd>
              <strong>{{ displayData ? metric.value : '--' }}</strong>
              <small>{{ metric.unit }}</small>
            </dd>
          </div>
        </dl>

        <div class="green-ai-status" :class="{ 'is-running': analyzing || currentChapter.id === 'boot' }">
          <div><span>GREEN AI</span><strong>CPU小模型·无需GPU</strong></div>
          <ol>
            <li v-for="(label, index) in ['数据校验', '知识召回', '轻量推理', '建议生成']" :key="label" :class="{ 'is-done': analysisStep > index || !analyzing, 'is-active': analysisStep === index && analyzing }">
              <span>0{{ index + 1 }}</span>{{ label }}
            </li>
          </ol>
        </div>

        <div v-if="isV21" class="ai-reasoning-sequence" :class="`is-${currentChapter.aiStage}`">
          <header><span>AI ANALYSIS CHAIN</span><strong>{{ currentChapter.aiStage === 'idle' ? '生产态势监测' : '可解释分析推进' }}</strong></header>
          <ol>
            <li
              v-for="(stage, index) in aiStages"
              :key="stage.id"
              :class="{ 'is-active': currentChapter.aiStage === stage.id, 'is-past': activeAiStageIndex > index }"
            >
              <i />
              <span>{{ stage.label }}</span>
            </li>
          </ol>
          <small>事实、相关性、AI假设与待确认项分层展示</small>
        </div>

        <div class="mobile-zone-jump" aria-label="工序快速选择">
          <button
            v-for="zone in factoryZones"
            :key="zone.id"
            type="button"
            :class="{ 'is-active': activeZoneId === zone.id }"
            @click="selectZone(zone.id)"
          >
            {{ zone.shortLabel }}
          </button>
        </div>
      </aside>

      <aside class="decision-rail" aria-label="AI决策舱">
        <header class="decision-heading">
          <div><span>AI DECISION DECK</span><strong>管理决策摘要</strong></div>
          <span class="confidence-mark">{{ displayData && activeIssue ? `AI ${Math.round(activeIssue.confidence * 100)}%` : displayData ? '综合判断' : '暂不判断' }}</span>
        </header>

        <div class="decision-focus">
          <span>{{ activeZone?.label ?? '全厂态势' }}</span>
          <h2>{{ decisionTitle }}</h2>
          <p>{{ decisionSummary }}</p>
        </div>

        <dl class="decision-facts">
          <div><dt>业务影响</dt><dd><strong>{{ displayData ? primaryImpact : '--' }}</strong><small>{{ displayData ? activeIssue?.metric ?? '延误风险量' : unavailableGuidance?.impact }}</small></dd></div>
          <div><dt>判断依据</dt><dd><strong>{{ displayData ? activeIssue?.reasons[0]?.title ?? '待检队列与在制高点' : '暂无可验证依据' }}</strong><small>{{ displayData ? activeIssue?.reasons[0]?.evidence ?? '演示MES/QMS联合切片' : unavailableGuidance?.evidence }}</small></dd></div>
          <div><dt>优先措施</dt><dd><strong>{{ displayData ? primaryAction : unavailableGuidance?.action }}</strong><small>{{ displayData ? activeIssue?.solutions[0]?.validation ?? '执行后按确认阈值验证' : unavailableGuidance?.validation }}</small></dd></div>
          <div><dt>建议关注</dt><dd><strong>{{ displayData ? responsibility.department : unavailableGuidance?.owner }}</strong><small>{{ displayData ? `${responsibility.role}·${responsibility.confirmation}` : unavailableGuidance?.role }}</small></dd></div>
        </dl>

        <div v-if="activeRelation && displayData" class="relation-boundary">
          <header><span>{{ activeRelation.label }}</span><strong>{{ Math.round(activeRelation.confidence * 100) }}%</strong></header>
          <p>{{ activeRelation.evidence.join('；') }}</p>
          <small>未经现场数据验证，不视为已确认因果。</small>
        </div>

        <div v-if="isV21 && improvementProgress > 0 && displayData" class="decision-simulation">
          <header><span>IMPROVEMENT SIMULATION</span><strong>{{ currentChapter.improvement.status === 'recovered' ? '模拟恢复态' : '措施生效演示' }}</strong></header>
          <div>
            <span>QC2-1待检</span>
            <strong>{{ Math.round(currentChapter.improvement.queueBefore - (currentChapter.improvement.queueBefore - currentChapter.improvement.queueAfter) * improvementProgress) }} pcs</strong>
            <i><b :style="{ width: `${100 - improvementProgress * 55}%` }" /></i>
          </div>
          <div>
            <span>计划达成率</span>
            <strong>{{ (currentChapter.improvement.completionBefore + (currentChapter.improvement.completionAfter - currentChapter.improvement.completionBefore) * improvementProgress).toFixed(1) }}%</strong>
            <i><b class="is-positive" :style="{ width: `${75 + improvementProgress * 20}%` }" /></i>
          </div>
          <small>{{ currentChapter.improvement.disclaimer }}</small>
        </div>

        <div class="decision-boundary">
          <strong>结论边界</strong>
          <span>{{ displayData ? activeIssue?.dataGaps[0] ?? '所有结论基于演示数据，需客户现场复核。' : unavailableGuidance?.boundary }}</span>
        </div>
      </aside>

      <Transition name="evidence-rail">
        <section v-if="evidenceRailVisible" class="evidence-rail" aria-label="分析证据轨道">
          <header>
            <div><span>EVIDENCE TRACK</span><strong>{{ evidenceDataset.label }}·演示证据</strong></div>
            <small>来源：演示 MES + QMS + 内部知识库·{{ context.period }}·{{ context.line }}</small>
          </header>
          <div class="evidence-charts">
            <article>
              <span>{{ evidenceTopic === 'quality' ? '不良率趋势' : '计划达成率趋势' }}</span>
              <EChart :option="trendOption" :state="sceneState" />
            </article>
            <article>
              <span>{{ evidenceTopic === 'quality' ? '不良影响排名' : '异常影响排名' }}</span>
              <EChart :option="rankingOption" :state="sceneState" @select="selectIssue" />
            </article>
            <aside>
              <span>KNOWLEDGE TRACE</span>
              <strong>{{ displayData ? activeIssue?.knowledgeRefs[0]?.id ?? 'KB-DEMO-001' : '--' }}</strong>
              <p>{{ displayData ? activeIssue?.knowledgeRefs[0]?.title ?? '成衣制造异常分类与处置指引' : '当前状态下不引用知识结论' }}</p>
              <small>{{ displayData ? '演示版知识·只读引用' : '等待数据恢复后重新召回' }}</small>
            </aside>
          </div>
        </section>
      </Transition>
    </section>

    <footer class="story-dock">
      <div class="story-status">
        <span>{{ experienceMode === 'guided' ? '引导演示' : '自由探索' }}</span>
        <strong>{{ formatStoryTime(elapsedSeconds) }} / 01:30</strong>
        <small>{{ sceneRenderer === 'webgl' ? '3D WEBGL' : '2D FALLBACK' }}</small>
      </div>
      <div class="story-controls" aria-label="演示播放控制">
        <button type="button" title="上一阶段" @click="seekChapter(currentChapterIndex - 1)">上一段</button>
        <button type="button" class="primary-story-command" :title="playing ? '暂停演示' : '播放演示'" @click="togglePlayback">{{ playing ? '暂停' : '播放' }}</button>
        <button type="button" title="下一阶段" @click="seekChapter(currentChapterIndex + 1)">下一段</button>
        <button type="button" title="重新开始90秒演示" @click="restartStory">重新开始</button>
        <button v-if="experienceMode === 'guided'" type="button" title="退出引导演示" @click="exitStory">退出演示</button>
      </div>
      <ol class="story-timeline">
        <li v-for="(chapter, index) in demoScenario.chapters" :key="chapter.id" :class="{ 'is-active': currentChapterIndex === index, 'is-past': currentChapterIndex > index }">
          <button type="button" :title="chapter.title" @click="seekChapter(index)"><span>0{{ index + 1 }}</span><strong>{{ chapter.title }}</strong></button>
        </li>
        <i :style="{ width: `${storyProgress}%` }" />
      </ol>
      <button type="button" class="evidence-command" :aria-pressed="evidencePinned" @click="evidencePinned = !evidencePinned">
        {{ evidenceRailVisible ? '收起证据' : '证据轨道' }}
      </button>
    </footer>
  </main>
</template>
