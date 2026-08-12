<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EChart from '../components/EChart.vue'
import VersionDialog from '../components/VersionDialog.vue'
import { contextOptions, defaultContext, sourceLabels } from '../data/demo'
import { dataStateLabelsV4, dutyFacts, healthProblems, interventionRecords, lifecycleById, lifecycleNodes, managementActions, periodOptions, problemById, solutionEffectiveness } from '../data/v4-health-center'
import { buildClosureFunnelOption, buildHealthRoseOption, buildInterventionTrendOption, buildPeriodCompareOption, buildProblemParetoOption } from '../v4-chart-options'
import type { DataState, HealthProblem, InterventionRecord, LifecycleNodeId } from '../types'

const route = useRoute()
const router = useRouter()
const context = reactive({ ...defaultContext, source: typeof route.query.source === 'string' ? route.query.source : defaultContext.source })
const legacyFocusMap: Record<string, LifecycleNodeId> = { qc21: 'quality', sewing: 'sewing', cutting: 'cutting' }
const requestedFocus = typeof route.query.focus === 'string' ? route.query.focus : ''
const initialNodeId = lifecycleById.has(requestedFocus as LifecycleNodeId) ? requestedFocus as LifecycleNodeId : legacyFocusMap[requestedFocus] ?? 'quality'
const selectedNodeId = ref<LifecycleNodeId>(initialNodeId)
const requestedProblem = typeof route.query.problem === 'string' ? route.query.problem : ''
const selectedProblemId = ref<string>(problemById.has(requestedProblem) ? requestedProblem : healthProblems.find((item) => item.nodeId === initialNodeId)?.id ?? 'P-QA-01')
const period = ref<(typeof periodOptions)[number]>('今日')
const meetingMode = ref<'daily' | 'shift'>('daily')
const dataState = ref<DataState>('normal')
const filtersOpen = ref(false)
const metric = ref<'count' | 'impact' | 'duration'>('count')
const evidenceView = ref<'compare' | 'pareto' | 'trend' | 'funnel'>('compare')
const interventionTab = ref<'diagnosis' | 'record' | 'recurrence' | 'effectiveness' | 'duty'>('diagnosis')
const records = ref<InterventionRecord[]>(interventionRecords.map((item) => ({ ...item })))
const selectedChecks = ref<string[]>([])
const interventionForm = reactive({ handler: '', measure: '', verifyAt: '2026-08-12 16:00' })
const recordNotice = ref('')

const visible = computed(() => dataState.value === 'normal' || dataState.value === 'stale')
const conclusionsAllowed = computed(() => dataState.value === 'normal')
const sourceLabel = computed(() => sourceLabels[context.source] ?? '综合入口')
const activeNode = computed(() => lifecycleById.get(selectedNodeId.value) ?? lifecycleNodes[7])
const nodeProblems = computed(() => healthProblems.filter((item) => item.nodeId === selectedNodeId.value))
const displayedProblems = computed(() => nodeProblems.value.length ? nodeProblems.value : healthProblems)
const activeProblem = computed<HealthProblem>(() => problemById.get(selectedProblemId.value) ?? displayedProblems.value[0] ?? healthProblems[0])
const activeActions = computed(() => managementActions.filter((item) => item.problemId === activeProblem.value.id))
const activeRecords = computed(() => records.value.filter((item) => item.problemId === activeProblem.value.id))
const activeEffectiveness = computed(() => solutionEffectiveness.filter((item) => item.problemType === activeProblem.value.problemType))
const chartState = computed(() => dataState.value)
const roseOption = computed(() => buildHealthRoseOption(lifecycleNodes, selectedNodeId.value))
const secondaryOption = computed(() => {
  if (evidenceView.value === 'pareto') return buildProblemParetoOption(healthProblems, activeProblem.value.id)
  if (evidenceView.value === 'trend') return buildInterventionTrendOption(activeProblem.value, records.value)
  if (evidenceView.value === 'funnel') return buildClosureFunnelOption(healthProblems)
  return buildPeriodCompareOption(activeNode.value, metric.value)
})
const secondaryTitle = computed(() => ({ compare: '周期分组对比', pareto: '问题影响 Pareto', trend: '问题与干预趋势', funnel: '问题闭环漏斗' })[evidenceView.value])
const unavailableCopy = computed(() => {
  if (dataState.value === 'loading') return ['正在取得健康数据', '原因、岗位和方案暂不形成']
  if (dataState.value === 'empty') return ['当前筛选范围无问题记录', '可调整时间、工厂或产线范围']
  if (dataState.value === 'error') return ['数据加载失败', '恢复数据源前不生成管理结论']
  if (dataState.value === 'forbidden') return ['当前账号无权查看', '需申请生命周期与质量数据权限']
  if (dataState.value === 'metric-conflict') return ['指标口径存在冲突', '请先确认次数周期、阈值与重置条件']
  if (dataState.value === 'stale') return ['数据已过期，结论暂停', '可查看历史事实，但检查建议需刷新后恢复']
  return null
})
const latestAlert = (problem: HealthProblem) => problem.alertEvents[problem.alertEvents.length - 1]

function selectNode(nodeId: LifecycleNodeId) {
  selectedNodeId.value = nodeId
  const first = healthProblems.find((item) => item.nodeId === nodeId)
  if (first) selectedProblemId.value = first.id
  updateRoute()
}
function selectProblem(problem: HealthProblem) {
  selectedNodeId.value = problem.nodeId
  selectedProblemId.value = problem.id
  recordNotice.value = ''
  updateRoute()
}
function handleRoseSelect(payload: unknown) {
  const nodeId = (payload as { nodeId?: LifecycleNodeId } | null)?.nodeId
  if (nodeId) selectNode(nodeId)
}
function handleSecondarySelect(payload: unknown) {
  const problemId = (payload as { problemId?: string } | null)?.problemId
  const problem = problemId ? problemById.get(problemId) : null
  if (problem) selectProblem(problem)
}
function updateRoute() {
  router.replace({ name: 'analysis', query: { ...route.query, topic: 'health', source: context.source, mode: meetingMode.value, period: period.value, focus: selectedNodeId.value, problem: selectedProblemId.value } })
}
function updateDataState() {
  if (dataState.value === 'loading') window.setTimeout(() => { if (dataState.value === 'loading') dataState.value = 'normal' }, 900)
}
function toggleCheck(id: string) {
  selectedChecks.value = selectedChecks.value.includes(id) ? selectedChecks.value.filter((item) => item !== id) : [...selectedChecks.value, id]
}
function saveIntervention() {
  recordNotice.value = ''
  if (!conclusionsAllowed.value) return
  if (!interventionForm.handler.trim() || !interventionForm.measure.trim() || !selectedChecks.value.length) {
    recordNotice.value = '请填写处理人、实际措施，并至少选择一项已检查内容。'
    return
  }
  records.value.unshift({ id: `IR-DEMO-${Date.now()}`, problemId: activeProblem.value.id, handler: `${interventionForm.handler.trim()}（演示）`, checkedItemIds: [...selectedChecks.value], actualMeasure: interventionForm.measure.trim(), handledAt: '2026-08-12 14:30', verifyAt: interventionForm.verifyAt, recurrenceResult: '待验证', isDemo: true })
  recordNotice.value = '演示干预记录已保存，问题进入待验证状态；未下发正式任务。'
  interventionForm.handler = ''
  interventionForm.measure = ''
  selectedChecks.value = []
}
function backToOverview() { router.push({ name: 'overview' }) }

watch(() => route.query.problem, (value) => { if (typeof value === 'string' && problemById.has(value)) selectProblem(problemById.get(value)!) }, { immediate: true })
</script>

<template>
  <main class="v4-health-center">
    <div class="v4-desktop-required"><strong>请使用桌面大屏查看</strong><span>V4健康体检与干预中心仅提供桌面端和大屏布局。</span></div>
    <header class="v4-header">
      <div class="v4-brand"><button type="button" @click="backToOverview">返回大屏</button><span /><div><small>GREEN AI · FACTORY HEALTH CONTROL</small><h1>工厂健康体检与干预中心</h1></div></div>
      <nav aria-label="会议模式"><button type="button" :class="{ 'is-active': meetingMode === 'shift' }" @click="meetingMode = 'shift'; updateRoute()">班前会</button><button type="button" :class="{ 'is-active': meetingMode === 'daily' }" @click="meetingMode = 'daily'; updateRoute()">日会模式</button></nav>
      <div class="v4-header-actions"><button type="button" @click="filtersOpen = !filtersOpen">筛选</button><VersionDialog /><span>演示数据</span><div><small>最近更新</small><strong>{{ activeNode.updatedAt }}</strong></div></div>
    </header>

    <Transition name="v4-filter"><section v-if="filtersOpen" class="v4-filter-ribbon"><div><span>入口</span><strong>{{ sourceLabel }}</strong></div><label><span>工厂</span><select v-model="context.factory"><option v-for="item in contextOptions.factories" :key="item">{{ item }}</option></select></label><label><span>产线</span><select v-model="context.line"><option v-for="item in contextOptions.lines" :key="item">{{ item }}</option></select></label><label><span>契约 / 品番</span><select v-model="context.contract"><option v-for="item in contextOptions.contracts" :key="item">{{ item }}</option></select></label><label><span>数据状态</span><select v-model="dataState" @change="updateDataState"><option v-for="(label, key) in dataStateLabelsV4" :key="key" :value="key">{{ label }}</option></select></label></section></Transition>

    <section class="v4-executive-strip">
      <div><small>MANAGEMENT CONCLUSION</small><strong>{{ visible ? activeProblem.title : unavailableCopy?.[0] }}</strong><span>{{ visible ? activeProblem.summary : unavailableCopy?.[1] }}</span></div>
      <dl><div><dt>首要问题</dt><dd><strong>{{ visible ? activeProblem.problemType : '--' }}</strong><small>{{ visible ? activeNode.label : '暂不定位' }}</small></dd></div><div><dt>影响范围</dt><dd><strong>{{ visible ? `${activeProblem.impactValue} ${activeProblem.impactUnit}` : '--' }}</strong><small>{{ activeProblem.identity.styleNo }} / {{ activeProblem.identity.batch }}</small></dd></div><div><dt>较昨日变化</dt><dd><strong :class="activeProblem.changeFromYesterday > 0 ? 'is-danger' : 'is-good'">{{ visible ? `${activeProblem.changeFromYesterday > 0 ? '+' : ''}${activeProblem.changeFromYesterday}` : '--' }}</strong><small>相同统计口径</small></dd></div><div><dt>预警等级</dt><dd><strong>{{ visible ? latestAlert(activeProblem)?.levelLabel : '--' }}</strong><small>{{ visible ? activeProblem.responseStatus : '暂停判断' }}</small></dd></div><div><dt>优先方法</dt><dd><strong>{{ conclusionsAllowed ? activeProblem.inspectionItems[0]?.label : '等待数据恢复' }}</strong><small>{{ conclusionsAllowed ? '按标准检查顺序' : '不生成检查建议' }}</small></dd></div><div><dt>建议责任岗位</dt><dd><strong>{{ conclusionsAllowed ? activeProblem.suggestedRole : '暂不关联岗位' }}</strong><small>建议关联，待现场确认</small></dd></div></dl>
    </section>

    <section class="v4-workspace">
      <aside class="v4-problem-rail">
        <header><div><small>INTERVENTION QUEUE</small><strong>待干预问题</strong></div><em>{{ visible ? `${healthProblems.length}项` : '--' }}</em></header>
        <div class="v4-priority-filters"><span>三次警报</span><span>重复发生</span><span>超时/缺记录</span></div>
        <ol v-if="visible"><li v-for="problem in displayedProblems" :key="problem.id" :class="[`is-${problem.severity}`, { 'is-active': activeProblem.id === problem.id }]" @click="selectProblem(problem)"><button type="button"><div><span>{{ lifecycleById.get(problem.nodeId)?.shortLabel }}</span><em>{{ latestAlert(problem)?.levelLabel }}</em></div><strong>{{ problem.title }}</strong><small>{{ problem.impactValue }} {{ problem.impactUnit }} · {{ problem.responseStatus }} · 连续{{ problem.identity.continuousCount }}次</small></button></li></ol>
        <div v-else class="v4-unavailable"><strong>{{ unavailableCopy?.[0] }}</strong><span>{{ unavailableCopy?.[1] }}</span></div>
        <section class="v4-actions"><header><strong>今日管理动作</strong><span>P1 / P2 / P3</span></header><button v-for="action in managementActions.slice(0, 4)" :key="action.id" type="button" @click="selectProblem(problemById.get(action.problemId)!)"><em :class="`is-${action.priority.toLowerCase()}`">{{ action.priority }}</em><span><strong>{{ action.action }}</strong><small>{{ action.suggestedRole }} · {{ action.expectedVerificationAt }}</small></span></button></section>
      </aside>

      <section class="v4-visual-stage">
        <article class="v4-panel v4-rose-panel"><header><div><small>FACTORY HEALTH ROSE</small><strong>十节点健康风向玫瑰</strong></div><span>半径=影响指数 · 外圈=问题次数</span></header><div class="v4-chart-body"><EChart :option="roseOption" :state="chartState" @select="handleRoseSelect" /></div><footer><span>{{ activeNode.dataSource }}</span><small>{{ activeNode.coreMetric.definition }} · {{ period }} · {{ context.factory }}</small></footer></article>
        <nav class="v4-lifecycle-strip" aria-label="生命周期节点"><button v-for="node in lifecycleNodes" :key="node.id" type="button" :class="[`is-${node.health}`, { 'is-active': node.id === selectedNodeId }]" @click="selectNode(node.id)"><i /><span>{{ String(node.order).padStart(2, '0') }}</span><strong>{{ node.shortLabel }}</strong><small>{{ node.issueCount }}次</small></button></nav>
        <article class="v4-panel v4-evidence-panel"><header><div><small>MANAGEMENT EVIDENCE</small><strong>{{ secondaryTitle }}</strong></div><nav><button v-for="item in [{ id:'compare',label:'周期对比'},{id:'pareto',label:'Pareto'},{id:'trend',label:'干预趋势'},{id:'funnel',label:'闭环漏斗'}]" :key="item.id" type="button" :class="{ 'is-active': evidenceView === item.id }" @click="evidenceView = item.id as typeof evidenceView">{{ item.label }}</button></nav></header><div v-if="evidenceView === 'compare'" class="v4-metric-switch"><button v-for="item in [{id:'count',label:'问题次数'},{id:'impact',label:'影响数量'},{id:'duration',label:'平均处理时长'}]" :key="item.id" type="button" :class="{ 'is-active': metric === item.id }" @click="metric = item.id as typeof metric">{{ item.label }}</button></div><div class="v4-chart-body"><EChart :option="secondaryOption" :state="chartState" @select="handleSecondarySelect" /></div><footer><span>演示：MES / WMS / 质量 / 干预记录</span><small>统计口径随图表切换常驻显示 · {{ period }} · {{ context.line }}</small></footer></article>
      </section>

      <aside class="v4-intervention-terminal">
        <header><div><small>INTERVENTION TERMINAL</small><strong>问题干预</strong></div><span>{{ conclusionsAllowed ? '推荐检查顺序' : '结论暂停' }}</span></header>
        <nav><button v-for="item in [{id:'diagnosis',label:'诊断'},{id:'record',label:'记录干预'},{id:'recurrence',label:'复发'},{id:'effectiveness',label:'措施库'},{id:'duty',label:'履职事实'}]" :key="item.id" type="button" :class="{ 'is-active': interventionTab === item.id }" @click="interventionTab = item.id as typeof interventionTab">{{ item.label }}</button></nav>
        <div v-if="!conclusionsAllowed" class="v4-terminal-paused"><strong>{{ unavailableCopy?.[0] }}</strong><p>{{ unavailableCopy?.[1] }}</p><span>当前仅保留必要状态说明，不展示原因、方案或责任关联。</span></div>
        <div v-else-if="interventionTab === 'diagnosis'" class="v4-terminal-scroll"><section><header><strong>事实与证据</strong><span>已记录事实</span></header><div class="v4-facts"><p v-for="fact in activeProblem.facts" :key="fact.label"><span>{{ fact.label }}</span><strong>{{ fact.value }}</strong><small>{{ fact.source }}</small></p></div></section><section><header><strong>问题身份证</strong><span>{{ activeProblem.identity.recurrenceState }}</span></header><dl class="v4-identity"><div><dt>问题类型</dt><dd>{{ activeProblem.identity.problemType }}</dd></div><div><dt>款号 / 批次</dt><dd>{{ activeProblem.identity.styleNo }} / {{ activeProblem.identity.batch }}</dd></div><div><dt>设备 / 工位</dt><dd>{{ activeProblem.identity.station }}</dd></div><div><dt>时间窗口</dt><dd>{{ activeProblem.identity.timeWindow }}</dd></div></dl></section><section><header><strong>标准检查清单</strong><span>AI仅推荐顺序</span></header><ol class="v4-check-list"><li v-for="(item, index) in activeProblem.inspectionItems" :key="item.id"><em>{{ index + 1 }}</em><div><strong>{{ item.category }} · {{ item.label }}</strong><p>{{ item.method }}</p><small>需留证：{{ item.requiredEvidence }}</small></div></li></ol></section><section><header><strong>方案预案</strong><span>未正式下发</span></header><ol class="v4-plan"><li v-for="item in activeProblem.plan" :key="item">{{ item }}</li></ol></section><section class="v4-owner"><div><span>建议责任</span><strong>{{ activeProblem.suggestedDepartment }}</strong><small>{{ activeProblem.suggestedRole }} · 待现场确认</small></div><div><span>验证要求</span><strong>{{ activeProblem.verificationRequirement }}</strong></div></section><section><header><strong>反向追溯</strong><span>{{ activeProblem.traceConfirmation === 'confirmed' ? '关系已记录' : '待现场确认' }}</span></header><div class="v4-trace"><span v-for="nodeId in activeProblem.traceNodeIds" :key="nodeId">{{ lifecycleById.get(nodeId)?.shortLabel }}</span></div></section></div>
        <div v-else-if="interventionTab === 'record'" class="v4-terminal-scroll v4-record-form"><p>仅保存前端演示记录，不下发正式任务。</p><label><span>处理人 / 岗位</span><input v-model="interventionForm.handler" placeholder="请输入演示处理人" /></label><fieldset><legend>已完成检查项</legend><button v-for="item in activeProblem.inspectionItems" :key="item.id" type="button" :class="{ 'is-active': selectedChecks.includes(item.id) }" @click="toggleCheck(item.id)"><i />{{ item.category }} · {{ item.label }}</button></fieldset><label><span>实际措施</span><textarea v-model="interventionForm.measure" placeholder="记录实际采取的措施，不填写推定根因" /></label><label><span>计划验证时间</span><input v-model="interventionForm.verifyAt" /></label><button class="v4-save-record" type="button" @click="saveIntervention">保存演示干预记录</button><strong v-if="recordNotice" class="v4-record-notice">{{ recordNotice }}</strong></div>
        <div v-else-if="interventionTab === 'recurrence'" class="v4-terminal-scroll"><section><header><strong>预警与复发时间轴</strong><span>{{ activeProblem.identity.firstOccurredAt }}</span></header><ol class="v4-timeline"><li v-for="event in activeProblem.alertEvents" :key="event.id"><time>{{ event.occurredAt }}</time><i /><div><strong>{{ event.levelLabel }}</strong><p>{{ event.triggerRule }}</p><small>{{ event.threshold }} · {{ event.evidence }}</small></div></li><li v-for="record in activeRecords" :key="record.id" class="is-intervention"><time>{{ record.handledAt.slice(-5) }}</time><i /><div><strong>已记录干预 · {{ record.handler }}</strong><p>{{ record.actualMeasure }}</p><small>验证：{{ record.verifyAt }} · {{ record.recurrenceResult }}</small></div></li></ol></section></div>
        <div v-else-if="interventionTab === 'effectiveness'" class="v4-terminal-scroll"><section><header><strong>措施有效性库</strong><span>只计算有真实处理记录项</span></header><article v-if="activeEffectiveness.length" v-for="item in activeEffectiveness" :key="item.id" class="v4-effect"><strong>{{ item.measure }}</strong><template v-if="item.baselineStatus === 'available'"><dl><div><dt>使用次数</dt><dd>{{ item.usageCount }}</dd></div><div><dt>未复发次数</dt><dd>{{ item.nonRecurrenceCount }}</dd></div><div><dt>平均复发间隔</dt><dd>{{ item.averageRecurrenceInterval }}</dd></div></dl></template><p v-else>待建立验证基线，不计算有效率。</p><small>适用：{{ item.applicableConditions.join('；') }}</small></article><div v-else class="v4-empty-detail">当前问题类型尚无可计算的历史措施记录。</div></section></div>
        <div v-else class="v4-terminal-scroll"><section><header><strong>履职事实</strong><span>不评价能力或态度</span></header><div class="v4-duty-grid"><article v-for="item in dutyFacts" :key="item.label"><span>{{ item.label }}</span><strong>{{ item.count }}</strong><small>{{ item.definition }}</small></article></div></section></div>
      </aside>
    </section>

    <footer class="v4-bottom-dock"><nav><button v-for="item in periodOptions" :key="item" type="button" :class="{ 'is-active': period === item }" @click="period = item; updateRoute()">{{ item }}</button></nav><div><strong>{{ activeActions[0]?.action ?? '当前问题暂无单独管理动作' }}</strong><span>{{ activeActions[0]?.triggerBasis ?? '查看标准检查清单与验证要求' }}</span></div><dl><div><dt>状态流</dt><dd>提示 → 加强 → 警报 → 干预 → 验证</dd></div><div><dt>产品边界</dt><dd>建议预案 · 非正式任务</dd></div></dl></footer>
  </main>
</template>

<style src="../v4-health-center.css"></style>
