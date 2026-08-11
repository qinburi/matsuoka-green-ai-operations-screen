<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EChart from '../../components/EChart.vue'
import InferencePipeline from '../../components/InferencePipeline.vue'
import IssueDrawer from '../../components/IssueDrawer.vue'
import VersionDialog from '../../components/VersionDialog.vue'
import { buildProblemMapOption, buildRankingOption, buildTrendOption } from '../../chart-options'
import { contextOptions, defaultContext, sourceLabels, stateLabels, topics } from '../../data/demo'
import type { DataState, Issue, TopicId } from '../../types'
import './v1.css'

const route = useRoute()
const router = useRouter()
const topicIds: TopicId[] = ['efficiency', 'quality', 'improvement']
const initialTopic = topicIds.includes(route.query.topic as TopicId) ? route.query.topic as TopicId : 'efficiency'

const currentTopicId = ref<TopicId>(initialTopic)
const context = reactive({
  ...defaultContext,
  source: typeof route.query.source === 'string' ? route.query.source : defaultContext.source,
})
const dataState = ref<DataState>('normal')
const analyzing = ref(false)
const activeStep = ref(4)
const selectedIssue = ref<Issue | null>(null)
const lastUpdated = ref(new Date())
const timers: number[] = []

const currentDataset = computed(() => topics[currentTopicId.value])
const chartState = computed<DataState | 'loading'>(() => analyzing.value ? 'loading' : dataState.value)
const sourceLabel = computed(() => sourceLabels[context.source] ?? '综合入口')
const updatedText = computed(() => new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
}).format(lastUpdated.value))

const problemMapOption = computed(() => buildProblemMapOption(
  currentTopicId.value,
  currentDataset.value.issues,
  selectedIssue.value?.id ?? null,
))
const rankingOption = computed(() => buildRankingOption(currentTopicId.value, currentDataset.value.issues))
const trendOption = computed(() => buildTrendOption(currentDataset.value))
const primaryChartTitle = computed(() => currentTopicId.value === 'improvement' ? '问题改善关联图' : 'AI问题星图')
const rankingTitle = computed(() => ({ efficiency: '延误风险排名', quality: '不良影响排名', improvement: '改善影响排名' })[currentTopicId.value])
const trendTitle = computed(() => ({ efficiency: '计划达成率趋势', quality: '不良率趋势', improvement: '可执行方案累计' })[currentTopicId.value])

function clearTimers() {
  while (timers.length) window.clearTimeout(timers.pop())
}

function runAnalysis() {
  clearTimers()
  if (dataState.value !== 'normal' && dataState.value !== 'stale') {
    analyzing.value = false
    activeStep.value = 4
    return
  }
  analyzing.value = true
  activeStep.value = 0
  selectedIssue.value = null
  ;[420, 840, 1260].forEach((delay, index) => {
    timers.push(window.setTimeout(() => { activeStep.value = index + 1 }, delay))
  })
  timers.push(window.setTimeout(() => {
    analyzing.value = false
    activeStep.value = 4
    lastUpdated.value = new Date()
  }, 1760))
}

function chooseTopic(topic: TopicId) {
  if (topic === currentTopicId.value) return
  currentTopicId.value = topic
  context.source = 'green-ai-entry'
  router.replace({ name: 'v1-analysis', query: { ...route.query, topic, source: context.source } })
  runAnalysis()
}

function updateDataState() {
  context.dataState = dataState.value
  runAnalysis()
}

function selectIssue(payload: unknown) {
  const issueId = (payload as { issueId?: string } | null)?.issueId
  if (!issueId) return
  const issue = currentDataset.value.issues.find((item) => item.id === issueId)
  if (issue) selectedIssue.value = issue
}

function openIssue(issue: Issue) {
  if (dataState.value === 'normal' || dataState.value === 'stale') selectedIssue.value = issue
}

function backToOverview() {
  router.push({ name: 'v1-overview', query: { ...route.query } })
}

watch(() => route.query, (query) => {
  const topic = query.topic as TopicId
  if (topicIds.includes(topic) && topic !== currentTopicId.value) currentTopicId.value = topic
  if (typeof query.source === 'string') context.source = query.source
}, { deep: true })

runAnalysis()
onBeforeUnmount(clearTimers)
</script>

<template>
  <div class="legacy-v1-root" data-ui-version="v1.0.0">
    <main class="analysis-page">
      <div class="ambient-grid" aria-hidden="true" />
      <div class="ambient-scan" aria-hidden="true" />

      <header class="analysis-header">
        <div class="analysis-brand">
          <button type="button" class="back-command" @click="backToOverview">返回大屏</button>
          <div class="brand-divider" />
          <div><span class="eyebrow">MATSUOKA · GREEN AI</span><h1>生产运营诊断中心</h1></div>
        </div>

        <nav class="analysis-tabs" aria-label="分析主题">
          <button v-for="topic in topicIds" :key="topic" type="button" :class="{ 'is-active': currentTopicId === topic }" @click="chooseTopic(topic)">
            {{ topics[topic].label }}
          </button>
        </nav>

        <div class="header-meta">
          <span class="legacy-version-badge">历史归档版本 · V1.0.0</span>
          <VersionDialog />
          <span class="demo-badge">演示数据</span>
          <div><small>数据更新</small><strong>{{ updatedText }}</strong></div>
        </div>
      </header>

      <section class="filter-bar" aria-label="分析筛选条件">
        <div class="entry-context"><span>入口上下文</span><strong>{{ sourceLabel }}</strong></div>
        <label><span>工厂</span><select v-model="context.factory" @change="runAnalysis"><option v-for="item in contextOptions.factories" :key="item">{{ item }}</option></select></label>
        <label><span>车间 / 产线</span><select v-model="context.line" @change="runAnalysis"><option v-for="item in contextOptions.lines" :key="item">{{ item }}</option></select></label>
        <label><span>时间范围</span><select v-model="context.period" @change="runAnalysis"><option v-for="item in contextOptions.periods" :key="item">{{ item }}</option></select></label>
        <label><span>契约 / 品番</span><select v-model="context.contract" @change="runAnalysis"><option v-for="item in contextOptions.contracts" :key="item">{{ item }}</option></select></label>
        <label><span>演示状态</span><select v-model="dataState" @change="updateDataState"><option v-for="(label, key) in stateLabels" :key="key" :value="key">{{ label }}</option></select></label>
        <button class="reanalyze-command" type="button" :disabled="analyzing" @click="runAnalysis">{{ analyzing ? '分析中' : '重新分析' }}</button>
      </section>

      <InferencePipeline :active-step="activeStep" :analyzing="analyzing" />

      <section class="decision-band">
        <div class="metric-strip">
          <article v-for="metric in currentDataset.metrics" :key="metric.id" class="metric-item">
            <span>{{ metric.label }}</span>
            <div><strong v-if="dataState === 'normal' || dataState === 'stale'">{{ metric.value.toLocaleString('zh-CN') }}</strong><strong v-else>--</strong><em>{{ metric.unit }}</em></div>
            <small :class="`metric-trend--${metric.status}`">{{ metric.trend > 0 ? '+' : '' }}{{ metric.trend }} {{ metric.trendLabel }}</small>
            <i :title="`${metric.definition}；数据来源：${metric.source}`">口径</i>
          </article>
        </div>
        <aside class="boss-conclusion"><div class="boss-label">老板关注结论</div><strong>{{ currentDataset.bossConclusion }}</strong><p><span>建议动作</span>{{ currentDataset.bossAction }}</p></aside>
      </section>

      <section class="analysis-workspace">
        <article class="analysis-panel problem-panel">
          <header class="panel-heading"><div><span>01 · AI INSIGHT MAP</span><h2>{{ primaryChartTitle }}</h2></div><small>{{ currentDataset.description }}</small></header>
          <EChart :option="problemMapOption" :state="chartState" @select="selectIssue" />
          <footer class="panel-source">来源：演示 MES + QMS + 内部知识库 · 单位：pcs/款/项 · 范围：{{ context.period }} · 筛选：{{ context.line }}</footer>
        </article>

        <article class="analysis-panel issue-panel">
          <header class="panel-heading"><div><span>02 · PRIORITY QUEUE</span><h2>问题优先序</h2></div><small>按影响度与置信度排序</small></header>
          <div v-if="dataState === 'normal' || dataState === 'stale'" class="issue-list">
            <button v-for="(item, index) in currentDataset.issues" :key="item.id" type="button" :class="[`severity-border--${item.severity}`, { 'is-selected': selectedIssue?.id === item.id }]" @click="openIssue(item)">
              <span class="issue-rank">0{{ index + 1 }}</span><span class="issue-copy"><strong>{{ item.shortLabel }}</strong><small>{{ item.stage }}</small></span><span class="issue-impact"><strong>{{ item.impact }}</strong><small>{{ item.impactUnit }}</small></span><span class="issue-confidence">AI {{ Math.round(item.confidence * 100) }}%</span>
            </button>
          </div>
          <div v-else class="issue-state"><strong>{{ stateLabels[dataState] }}</strong><span>当前状态下不展示问题结论</span></div>
          <footer class="panel-source">点击问题查看原因、证据、方案与建议责任</footer>
        </article>

        <article class="analysis-panel ranking-panel">
          <header class="panel-heading panel-heading--compact"><div><span>03 · IMPACT</span><h2>{{ rankingTitle }}</h2></div></header>
          <EChart :option="rankingOption" :state="chartState" @select="selectIssue" />
          <footer class="panel-source">指标口径：依当前主题按影响量排序 · 点击条目可下钻</footer>
        </article>

        <article class="analysis-panel trend-panel">
          <header class="panel-heading panel-heading--compact"><div><span>04 · TREND</span><h2>{{ trendTitle }}</h2></div></header>
          <EChart :option="trendOption" :state="chartState" />
          <footer class="panel-source">时间范围：演示近7个周期 · 统计口径详见顶部指标定义</footer>
        </article>
      </section>

      <IssueDrawer :issue="selectedIssue" @close="selectedIssue = null" />
    </main>
  </div>
</template>
