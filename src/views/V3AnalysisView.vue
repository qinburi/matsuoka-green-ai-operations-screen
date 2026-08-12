<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AiAtmosphereV3 from '../components/AiAtmosphereV3.vue'
import EChart from '../components/EChart.vue'
import VersionDialog from '../components/VersionDialog.vue'
import { buildV3ChartOption } from '../v3-chart-options'
import { contextOptions, defaultContext, sourceLabels, stateLabels, topics } from '../data/demo'
import { factoryZones, issueRelations } from '../data/factory-scene'
import { actionPackages, defaultActionPackage, v3ChartMeta, v3StoryChapters, v3StoryDuration } from '../data/v3-dashboard'
import type { ActionPackage, DataState, ExperienceMode, Issue, TopicId, V3ChartId } from '../types'

const route = useRoute()
const router = useRouter()
const topicIds: TopicId[] = ['efficiency', 'quality', 'improvement']
const allIssues = Object.values(topics).flatMap((dataset) => dataset.issues)
const issueById = new Map(allIssues.map((issue) => [issue.id, issue]))
const zoneForIssue = (issueId: string) => factoryZones.find((zone) => zone.issueIds.includes(issueId)) ?? null

const initialTopic = topicIds.includes(route.query.topic as TopicId) ? route.query.topic as TopicId : 'efficiency'
const initialMode: ExperienceMode = route.query.mode === 'explore' ? 'explore' : 'guided'
const currentTopicId = ref<TopicId>(initialTopic)
const experienceMode = ref<ExperienceMode>(initialMode)
const context = reactive({ ...defaultContext, source: typeof route.query.source === 'string' ? route.query.source : defaultContext.source })
const dataState = ref<DataState>('normal')
const analyzing = ref(false)
const filtersOpen = ref(false)
const issueSort = ref<'severity' | 'impact' | 'occurrence' | 'confidence'>('severity')
const compareMode = ref<'before' | 'after'>('before')
const selectedActionPackageId = ref(defaultActionPackage.id)
const currentChapterIndex = ref(0)
const elapsedSeconds = ref(0)
const playing = ref(initialMode === 'guided')
const lastUpdated = ref(new Date())
const selectedIssueId = ref<string | null>(null)
let storyFrame = 0
let lastStoryTick = 0
let analysisTimer = 0

const currentDataset = computed(() => topics[currentTopicId.value])
const currentChapter = computed(() => v3StoryChapters[currentChapterIndex.value])
const displayData = computed(() => dataState.value === 'normal' || dataState.value === 'stale')
const chartState = computed<DataState | 'loading'>(() => analyzing.value ? 'loading' : dataState.value)
const sourceLabel = computed(() => sourceLabels[context.source] ?? '综合入口')
const updatedText = computed(() => new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(lastUpdated.value))

const initialIssueFromFocus = () => {
  const focus = typeof route.query.focus === 'string' ? route.query.focus : ''
  if (issueById.has(focus)) return focus
  const zone = factoryZones.find((item) => item.id === focus)
  return zone?.issueIds.find((id) => issueById.get(id)?.topic === currentTopicId.value) ?? null
}
selectedIssueId.value = initialIssueFromFocus()

const severityWeight = { critical: 3, warning: 2, attention: 1 }
const sortedIssues = computed(() => [...currentDataset.value.issues].sort((a, b) => {
  if (issueSort.value === 'severity') return severityWeight[b.severity] - severityWeight[a.severity] || b.impact - a.impact
  if (issueSort.value === 'impact') return b.impact - a.impact
  if (issueSort.value === 'occurrence') return b.occurrence - a.occurrence
  return b.confidence - a.confidence
}))
const activeIssue = computed<Issue>(() => {
  const selected = selectedIssueId.value ? issueById.get(selectedIssueId.value) : null
  if (selected?.topic === currentTopicId.value) return selected
  const storyIssue = issueById.get(currentChapter.value.focusIssueId)
  if (experienceMode.value === 'guided' && storyIssue?.topic === currentTopicId.value) return storyIssue
  return sortedIssues.value[0]
})
const selectedActionPackage = computed<ActionPackage>(() => actionPackages.find((item) => item.id === selectedActionPackageId.value && item.issueId === activeIssue.value.id) ?? actionPackages.find((item) => item.issueId === activeIssue.value.id) ?? defaultActionPackage)
const availableActions = computed(() => actionPackages.filter((item) => item.issueId === activeIssue.value.id))
const activeRelation = computed(() => issueRelations.find((relation) => relation.sourceIssueId === activeIssue.value.id || relation.targetIssueId === activeIssue.value.id) ?? null)
const activeZone = computed(() => zoneForIssue(activeIssue.value.id))
const activeChartIds = computed(() => currentChapter.value.chartIds)
const storyProgress = computed(() => Math.min(100, elapsedSeconds.value / v3StoryDuration * 100))
const chapterProgress = computed(() => {
  const start = chapterStart(currentChapterIndex.value)
  return Math.max(0, Math.min(1, (elapsedSeconds.value - start) / currentChapter.value.duration))
})
const activeIssueHasPackage = computed(() => selectedActionPackage.value.issueId === activeIssue.value.id)
const simulationAvailable = computed(() => activeIssueHasPackage.value && Boolean(selectedActionPackage.value.improvement))
const primaryAction = computed(() => activeIssue.value.solutions[0]?.title ?? '待现场确认改善措施')
const problemRank = computed(() => sortedIssues.value.findIndex((item) => item.id === activeIssue.value.id) + 1)
const allTopicIssues = computed(() => currentDataset.value.issues)
const fallbackActionPackage = computed<ActionPackage>(() => ({
  id: `AP-${activeIssue.value.id}-PENDING`, issueId: activeIssue.value.id, title: '待建立改善基线',
  actions: activeIssue.value.solutions.map((item) => item.title), prerequisites: activeIssue.value.dataGaps,
  validationMetrics: activeIssue.value.solutions.map((item) => item.validation), responsibility: activeIssue.value.responsibility,
  improvement: null, disclaimer: '待建立现场基线后才能形成改善前后数值',
}))
const chartActionPackage = computed(() => activeIssueHasPackage.value ? selectedActionPackage.value : fallbackActionPackage.value)
const chartInputs = computed(() => ({ dataset: currentDataset.value, allIssues: allTopicIssues.value, issue: activeIssue.value, zones: factoryZones, actionPackage: chartActionPackage.value, compareMode: compareMode.value }))
const visibleActions = computed(() => activeIssueHasPackage.value ? selectedActionPackage.value.actions : activeIssue.value.solutions.map((item) => item.title))
const chartOptions = computed(() => Object.fromEntries(activeChartIds.value.map((chartId) => [chartId, buildV3ChartOption(chartId, chartInputs.value)])) as Record<V3ChartId, ReturnType<typeof buildV3ChartOption>>)

const unavailableCopy = computed(() => {
  if (dataState.value === 'empty') return { title: '当前筛选范围无问题记录', detail: '调整产线、时间或契约条件后重新分析。', action: '扩大筛选范围', owner: '数据管理员' }
  if (dataState.value === 'error') return { title: '分析结果加载失败', detail: '当前没有取得可验证的生产与质量证据。', action: '重试分析', owner: '系统运维 / 数据管理员' }
  if (dataState.value === 'forbidden') return { title: '当前账号无权查看', detail: '系统未读取受限产线与质量明细。', action: '申请数据权限', owner: '系统管理员 / 数据责任人' }
  return null
})

function chapterStart(index: number) { return v3StoryChapters.slice(0, index).reduce((sum, chapter) => sum + chapter.duration, 0) }
function chapterAt(seconds: number) {
  let total = 0
  for (let index = 0; index < v3StoryChapters.length; index += 1) {
    total += v3StoryChapters[index].duration
    if (seconds < total) return index
  }
  return v3StoryChapters.length - 1
}
function storyLoop(now: number) {
  storyFrame = window.requestAnimationFrame(storyLoop)
  if (!lastStoryTick) lastStoryTick = now
  const delta = Math.min(.25, (now - lastStoryTick) / 1000)
  lastStoryTick = now
  if (!playing.value || experienceMode.value !== 'guided') return
  elapsedSeconds.value = Math.min(v3StoryDuration, elapsedSeconds.value + delta)
  currentChapterIndex.value = chapterAt(elapsedSeconds.value)
  if (elapsedSeconds.value >= v3StoryDuration) playing.value = false
}
function formatTime(seconds: number) {
  const value = Math.max(0, Math.min(v3StoryDuration, Math.floor(seconds)))
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}
function updateRoute() {
  router.replace({ name: 'v3-analysis', query: { topic: currentTopicId.value, source: context.source, mode: experienceMode.value, scenario: 'v3-chart-story', focus: activeZone.value?.id ?? activeIssue.value.id } })
}
function pause() { playing.value = false }
function selectIssue(issueId: string) {
  if (!displayData.value) return
  const issue = issueById.get(issueId)
  if (!issue) return
  currentTopicId.value = issue.topic
  selectedIssueId.value = issue.id
  experienceMode.value = 'explore'
  selectedActionPackageId.value = actionPackages.find((item) => item.issueId === issue.id)?.id ?? defaultActionPackage.id
  compareMode.value = 'before'
  pause()
  updateRoute()
}
function handleChartSelect(payload: unknown) {
  const issueId = (payload as { issueId?: string } | null)?.issueId
  if (issueId) selectIssue(issueId)
  else pause()
}
function chooseTopic(topic: TopicId) {
  currentTopicId.value = topic
  selectedIssueId.value = topics[topic].issues[0].id
  experienceMode.value = 'explore'
  currentChapterIndex.value = topic === 'quality' ? 3 : topic === 'improvement' ? 4 : 1
  elapsedSeconds.value = chapterStart(currentChapterIndex.value)
  pause()
  updateRoute()
}
function seekChapter(index: number, autoplay = false) {
  currentChapterIndex.value = Math.max(0, Math.min(v3StoryChapters.length - 1, index))
  elapsedSeconds.value = chapterStart(currentChapterIndex.value)
  experienceMode.value = 'guided'
  selectedIssueId.value = null
  playing.value = autoplay
  compareMode.value = currentChapter.value.id === 'solution' ? 'after' : 'before'
  updateRoute()
}
function togglePlayback() {
  if (experienceMode.value === 'explore') return seekChapter(currentChapterIndex.value, true)
  if (elapsedSeconds.value >= v3StoryDuration) return seekChapter(0, true)
  playing.value = !playing.value
}
function runAnalysis() {
  window.clearTimeout(analysisTimer)
  if (!displayData.value) return
  analyzing.value = true
  analysisTimer = window.setTimeout(() => { analyzing.value = false; lastUpdated.value = new Date() }, 1100)
}
function updateDataState() {
  if (!displayData.value) {
    analyzing.value = false
    pause()
    return
  }
  runAnalysis()
}
function backToOverview() { router.push({ name: 'v3-overview' }) }

watch(activeIssue, (issue) => {
  const pkg = actionPackages.find((item) => item.issueId === issue.id)
  if (pkg) selectedActionPackageId.value = pkg.id
})
watch(() => route.query.topic, (topic) => {
  if (topicIds.includes(topic as TopicId)) currentTopicId.value = topic as TopicId
})
onMounted(() => { storyFrame = window.requestAnimationFrame(storyLoop) })
onBeforeUnmount(() => { window.cancelAnimationFrame(storyFrame); window.clearTimeout(analysisTimer) })
</script>

<template>
  <main class="v3-dashboard">
    <AiAtmosphereV3 />
    <div class="v3-desktop-required">
      <strong>请使用桌面大屏查看</strong>
      <span>V3图表驾驶舱仅提供桌面端与大屏布局。</span>
    </div>

    <header class="v3-header">
      <div class="v3-brand">
        <button type="button" @click="backToOverview">返回大屏</button>
        <span />
        <div><small>MATSUOKA · AI DECISION SYSTEM</small><h1>图表化AI问题驾驶舱</h1></div>
      </div>
      <nav aria-label="分析主题">
        <button v-for="topic in topicIds" :key="topic" type="button" :class="{ 'is-active': currentTopicId === topic }" @click="chooseTopic(topic)">{{ topics[topic].label }}</button>
      </nav>
      <div class="v3-header-actions">
        <button type="button" :aria-expanded="filtersOpen" @click="filtersOpen = !filtersOpen">筛选</button>
        <VersionDialog />
        <span class="v3-demo-badge">演示数据</span>
        <div><small>数据更新</small><strong>{{ updatedText }}</strong></div>
      </div>
    </header>

    <Transition name="v3-filter">
      <section v-if="filtersOpen" class="v3-filter-ribbon" aria-label="分析筛选条件">
        <div><span>入口上下文</span><strong>{{ sourceLabel }}</strong></div>
        <label><span>工厂</span><select v-model="context.factory" @change="runAnalysis"><option v-for="item in contextOptions.factories" :key="item">{{ item }}</option></select></label>
        <label><span>产线</span><select v-model="context.line" @change="runAnalysis"><option v-for="item in contextOptions.lines" :key="item">{{ item }}</option></select></label>
        <label><span>时间</span><select v-model="context.period" @change="runAnalysis"><option v-for="item in contextOptions.periods" :key="item">{{ item }}</option></select></label>
        <label><span>契约 / 品番</span><select v-model="context.contract" @change="runAnalysis"><option v-for="item in contextOptions.contracts" :key="item">{{ item }}</option></select></label>
        <label><span>演示状态</span><select v-model="dataState" @change="updateDataState"><option v-for="(label, key) in stateLabels" :key="key" :value="key">{{ label }}</option></select></label>
        <button type="button" :disabled="analyzing" @click="runAnalysis">{{ analyzing ? '正在更新' : '更新结果' }}</button>
      </section>
    </Transition>

    <section class="v3-executive-strip">
      <div class="v3-executive-lead"><small>{{ currentChapter.kicker }}</small><strong>{{ displayData ? currentChapter.conclusion : unavailableCopy?.title }}</strong><span>{{ displayData ? currentChapter.narrative : unavailableCopy?.detail }}</span></div>
      <dl>
        <div><dt>最大问题</dt><dd><strong>{{ displayData ? activeIssue.shortLabel : '--' }}</strong><small>{{ displayData ? `优先级 #${problemRank}` : '暂不判断' }}</small></dd></div>
        <div><dt>影响范围</dt><dd><strong>{{ displayData ? `${activeIssue.impact} ${activeIssue.impactUnit}` : '--' }}</strong><small>{{ displayData ? activeIssue.metric : unavailableCopy?.detail }}</small></dd></div>
        <div><dt>判断依据</dt><dd><strong>{{ displayData ? activeIssue.reasons[0]?.title : '暂无依据' }}</strong><small>{{ displayData ? activeIssue.reasons[0]?.evidence : unavailableCopy?.detail }}</small></dd></div>
        <div><dt>优先措施</dt><dd><strong>{{ displayData ? primaryAction : unavailableCopy?.action }}</strong><small>{{ displayData ? activeIssue.solutions[0]?.validation : '等待数据恢复' }}</small></dd></div>
        <div><dt>建议关注</dt><dd><strong>{{ displayData ? activeIssue.responsibility.department : unavailableCopy?.owner }}</strong><small>{{ displayData ? activeIssue.responsibility.role : '暂不关联岗位' }}</small></dd></div>
      </dl>
    </section>

    <section class="v3-workspace">
      <aside class="v3-issue-rail">
        <header><div><small>ISSUE RADAR</small><strong>问题优先级</strong></div><span>{{ displayData ? `${currentDataset.issues.length} 项` : '--' }}</span></header>
        <div class="v3-sorter" aria-label="问题排序">
          <button v-for="item in [{ id: 'severity', label: '严重度' }, { id: 'impact', label: '影响量' }, { id: 'occurrence', label: '频次' }, { id: 'confidence', label: '置信度' }]" :key="item.id" type="button" :class="{ 'is-active': issueSort === item.id }" @click="issueSort = item.id as typeof issueSort">{{ item.label }}</button>
        </div>
        <ol v-if="displayData">
          <li v-for="(issue, index) in sortedIssues" :key="issue.id" :class="[`is-${issue.severity}`, { 'is-active': activeIssue.id === issue.id }]">
            <button type="button" @click="selectIssue(issue.id)"><span>{{ String(index + 1).padStart(2, '0') }}</span><div><strong>{{ issue.shortLabel }}</strong><small>{{ issue.stage }}</small></div><em>{{ issue.impact }} {{ issue.impactUnit }}</em><i>AI {{ Math.round(issue.confidence * 100) }}%</i></button>
          </li>
        </ol>
        <div v-else class="v3-rail-unavailable" role="status">
          <strong>{{ unavailableCopy?.title }}</strong>
          <p>{{ unavailableCopy?.detail }}</p>
          <span>问题排序与下钻已暂停</span>
        </div>
      </aside>

      <section class="v3-chart-stage" :class="`charts-${activeChartIds.length}`">
        <article v-for="(chartId, index) in activeChartIds" :key="`${currentChapter.id}-${chartId}`" class="v3-chart-panel" :class="{ 'is-primary': index === 0 }">
          <header><div><small>{{ v3ChartMeta[chartId].kicker }}</small><strong>{{ v3ChartMeta[chartId].title }}</strong></div><span>{{ index === 0 ? '主图' : '联动' }}</span></header>
          <div class="v3-chart-body"><EChart :option="chartOptions[chartId]" :state="chartState" @select="handleChartSelect" /></div>
          <footer><span>{{ v3ChartMeta[chartId].source }}</span><small>{{ v3ChartMeta[chartId].definition }} · {{ context.period }} · {{ context.line }}</small></footer>
        </article>
      </section>

      <aside class="v3-decision-terminal">
        <header><div><small>AI DECISION TERMINAL</small><strong>问题分析结论</strong></div><span>{{ displayData ? `AI ${Math.round(activeIssue.confidence * 100)}%` : '不可判断' }}</span></header>
        <template v-if="displayData">
          <section class="v3-decision-focus"><small>{{ activeZone?.label ?? activeIssue.stage }}</small><h2>{{ activeIssue.title }}</h2><p>{{ activeIssue.summary }}</p></section>
          <section class="v3-decision-section"><header><strong>原因与证据</strong><span>待现场确认</span></header><div v-for="reason in activeIssue.reasons.slice(0, 2)" :key="reason.title"><strong>{{ reason.title }}</strong><p>{{ reason.description }}</p><small>{{ reason.evidence }}</small></div></section>
          <section class="v3-decision-section"><header><strong>建议方案</strong><span>{{ simulationAvailable ? '可模拟' : '待建立基线' }}</span></header><ol><li v-for="action in visibleActions" :key="action">{{ action }}</li></ol></section>
          <section v-if="currentChapter.id === 'solution'" class="v3-action-package">
            <template v-if="availableActions.length">
              <label><span>措施组合</span><select v-model="selectedActionPackageId"><option v-for="item in availableActions" :key="item.id" :value="item.id">{{ item.title }}</option></select></label>
              <div v-if="simulationAvailable" class="v3-compare-toggle"><button type="button" :class="{ 'is-active': compareMode === 'before' }" @click="compareMode = 'before'">改善前</button><button type="button" :class="{ 'is-active': compareMode === 'after' }" @click="compareMode = 'after'">改善后</button></div>
            </template>
            <strong v-else class="v3-baseline-pending">待建立改善基线</strong>
            <small>{{ chartActionPackage.disclaimer }}</small>
          </section>
          <section class="v3-decision-footer"><div><span>建议责任</span><strong>{{ activeIssue.responsibility.department }}</strong><small>{{ activeIssue.responsibility.role }} · {{ activeIssue.responsibility.confirmation }}</small></div><div><span>结论边界</span><strong>{{ activeRelation?.label ?? '建议关系·待确认' }}</strong><small>{{ activeIssue.dataGaps[0] }}</small></div></section>
        </template>
        <section v-else class="v3-terminal-unavailable" role="status">
          <small>DECISION SUSPENDED</small>
          <h2>{{ unavailableCopy?.title }}</h2>
          <p>{{ unavailableCopy?.detail }}</p>
          <dl>
            <div><dt>当前动作</dt><dd>{{ unavailableCopy?.action }}</dd></div>
            <div><dt>建议关注</dt><dd>{{ unavailableCopy?.owner }}</dd></div>
          </dl>
          <strong>数据恢复并重新分析前，不展示原因、方案及责任关联。</strong>
        </section>
      </aside>
    </section>

    <footer class="v3-story-dock">
      <div class="v3-story-status"><small>{{ experienceMode === 'guided' ? '引导演示' : '自由探索' }}</small><strong>{{ formatTime(elapsedSeconds) }} / 01:18</strong><span>{{ Math.round(chapterProgress * 100) }}%</span></div>
      <div class="v3-story-controls"><button type="button" @click="seekChapter(currentChapterIndex - 1)">上一段</button><button type="button" class="is-primary" @click="togglePlayback">{{ playing ? '暂停' : '播放' }}</button><button type="button" @click="seekChapter(currentChapterIndex + 1)">下一段</button><button type="button" @click="seekChapter(0, true)">重新开始</button></div>
      <ol><li v-for="(chapter, index) in v3StoryChapters" :key="chapter.id" :class="{ 'is-active': currentChapterIndex === index, 'is-past': currentChapterIndex > index }"><button type="button" @click="seekChapter(index)"><span>0{{ chapter.order }}</span><strong>{{ chapter.title }}</strong><small>{{ chapter.chartIds.length }}图联动</small></button></li><i :style="{ width: `${storyProgress}%` }" /></ol>
      <div class="v3-story-boundary"><strong>演示模拟</strong><span>不代表实际预测结果</span></div>
    </footer>
  </main>
</template>
