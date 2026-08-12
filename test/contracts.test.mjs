import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { hotspotContexts, rawTopics } from '../src/data/demo-raw.mjs'
import { demoScenarioRaw, factoryZonesRaw, issueRelationsRaw } from '../src/data/factory-scene-raw.mjs'

const readProjectFile = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf-8')

test('四个入口都映射到可用分析主题', () => {
  assert.deepEqual(Object.keys(hotspotContexts).sort(), ['defects', 'overview', 'production', 'progress'])
  for (const entry of Object.values(hotspotContexts)) {
    assert.ok(rawTopics[entry.topic])
    assert.ok(entry.source)
    assert.match(entry.mode, /^(guided|explore)$/)
    assert.equal(entry.scenario, 'eff-quality')
  }
  assert.equal(hotspotContexts.overview.mode, 'guided')
  assert.equal(hotspotContexts.production.mode, 'explore')
  assert.equal(hotspotContexts.defects.focus, 'sewing')
})

test('每个问题都具备原因、方案、责任、证据和知识引用', () => {
  const ids = new Set()
  for (const topic of Object.values(rawTopics)) {
    assert.equal(topic.metrics.length, 4)
    assert.ok(topic.issues.length >= 4)
    for (const item of topic.issues) {
      assert.equal(item.topic, topic.id)
      assert.ok(!ids.has(item.id), `duplicate id: ${item.id}`)
      ids.add(item.id)
      assert.ok(item.reasons.length > 0)
      assert.ok(item.solutions.length > 0)
      assert.ok(item.responsibility.department)
      assert.ok(item.responsibility.role)
      assert.match(item.responsibility.confirmation, /待客户确认/)
      assert.ok(item.evidence.length > 0)
      assert.ok(item.knowledgeRefs.length > 0)
      assert.ok(item.dataGaps.length > 0)
    }
  }
})

test('所有指标与证据来源都明确标识为演示', () => {
  for (const topic of Object.values(rawTopics)) {
    for (const metric of topic.metrics) assert.match(metric.source, /^演示：/)
    for (const item of topic.issues) {
      for (const evidence of item.evidence) assert.match(evidence.source, /^演示：/)
      for (const ref of item.knowledgeRefs) assert.match(ref.version, /演示版/)
    }
  }
})

test('当前产品版本与package版本一致且保留完整版本配置', () => {
  const packageJson = JSON.parse(readProjectFile('package.json'))
  const versionSource = readProjectFile('src/version.ts')
  const configuredVersion = versionSource.match(/CURRENT_PRODUCT_VERSION = '(v[^']+)'/)?.[1]

  assert.equal(configuredVersion, `v${packageJson.version}`)
  assert.match(versionSource, /version: 'v4\.0\.0'/)
  assert.match(versionSource, /version: 'v3\.0\.0'/)
  assert.match(versionSource, /version: 'v2\.1\.0'/)
  assert.match(versionSource, /version: 'v2\.0\.0'/)
  assert.match(versionSource, /version: 'v1\.0\.0'/)
  assert.match(versionSource, /prototypeRoutes: \{ overview: 'overview', analysis: 'analysis' \}/)
  assert.match(versionSource, /prototypeRoutes: \{ overview: 'v3-overview', analysis: 'v3-analysis' \}/)
  assert.match(versionSource, /prototypeRoutes: \{ overview: 'v21-overview', analysis: 'v21-analysis' \}/)
  assert.match(versionSource, /prototypeRoutes: \{ overview: 'v2-overview', analysis: 'v2-analysis' \}/)
  assert.match(versionSource, /prototypeRoutes: \{ overview: 'v1-overview', analysis: 'v1-analysis' \}/)
  assert.match(versionSource, /id: 'v1-launch'/)
  assert.match(versionSource, /id: 'v2-command-center'/)
  assert.match(versionSource, /id: 'v21-semantic-motion'/)
})

test('十条版本路由具有明确页面类型和版本元数据', () => {
  const routerSource = readProjectFile('src/router.ts')

  assert.match(routerSource, /path: '\/', name: 'overview'.*uiVersion: CURRENT_PRODUCT_VERSION, viewKind: 'overview'/)
  assert.match(routerSource, /path: '\/analysis', name: 'analysis'.*uiVersion: CURRENT_PRODUCT_VERSION, viewKind: 'analysis'/)
  assert.match(routerSource, /path: '\/v3\/', alias: '\/v3', name: 'v3-overview'.*uiVersion: 'v3\.0\.0', viewKind: 'overview'/)
  assert.match(routerSource, /path: '\/v3\/analysis', name: 'v3-analysis'.*uiVersion: 'v3\.0\.0', viewKind: 'analysis'/)
  assert.match(routerSource, /path: '\/v21\/', alias: '\/v21', name: 'v21-overview'.*uiVersion: 'v2\.1\.0', viewKind: 'overview'/)
  assert.match(routerSource, /path: '\/v21\/analysis', name: 'v21-analysis'.*uiVersion: 'v2\.1\.0', viewKind: 'analysis'/)
  assert.match(routerSource, /path: '\/v2\/', alias: '\/v2', name: 'v2-overview'.*uiVersion: 'v2\.0\.0', viewKind: 'overview'/)
  assert.match(routerSource, /path: '\/v2\/analysis', name: 'v2-analysis'.*uiVersion: 'v2\.0\.0', viewKind: 'analysis'/)
  assert.match(routerSource, /path: '\/v1\/', alias: '\/v1', name: 'v1-overview'.*uiVersion: 'v1\.0\.0', viewKind: 'overview'/)
  assert.match(routerSource, /path: '\/v1\/analysis', name: 'v1-analysis'.*uiVersion: 'v1\.0\.0', viewKind: 'analysis'/)
})

test('版本卡片直接切换同类页面并保留查询上下文', () => {
  const dialogSource = readProjectFile('src/components/VersionDialog.vue')

  assert.match(dialogSource, /release\.prototypeRoutes\[viewKind\]/)
  assert.match(dialogSource, /router\.push\(\{ name: targetName, query: \{ \.\.\.route\.query \} \}\)/)
  assert.match(dialogSource, /@click="openVersion\(release\)"/)
  assert.doesNotMatch(dialogSource, /进入此版本/)
})

test('v1历史原型使用独立命名空间且不加载Three.js指挥舱', () => {
  const overviewSource = readProjectFile('src/legacy/v1/V1OverviewView.vue')
  const analysisSource = readProjectFile('src/legacy/v1/V1AnalysisView.vue')
  const legacyStyles = readProjectFile('src/legacy/v1/v1.css')

  assert.match(overviewSource, /import\.meta\.env\.BASE_URL/)
  assert.match(overviewSource, /data-ui-version="v1\.0\.0"/)
  assert.match(analysisSource, /data-ui-version="v1\.0\.0"/)
  assert.match(analysisSource, /<VersionDialog \/>/)
  assert.match(legacyStyles, /\.legacy-v1-root/)
  assert.doesNotMatch(`${overviewSource}\n${analysisSource}`, /FactoryTwinScene|from ['"]three['"]|Three\.js/)
})

test('抽象数字孪生覆盖九个工序并可追溯到问题', () => {
  assert.equal(factoryZonesRaw.length, 9)
  const visualKinds = new Set()
  const issueIds = new Set(Object.values(rawTopics).flatMap((topic) => topic.issues.map((issue) => issue.id)))
  for (const zone of factoryZonesRaw) {
    assert.equal(zone.position.length, 3)
    assert.ok(zone.stationCount > 0)
    assert.match(zone.health, /^(normal|attention|warning|critical)$/)
    assert.ok(zone.visual)
    assert.ok(zone.visual.scale > 0)
    assert.ok(zone.visual.motionRate > 0)
    assert.equal(zone.visual.offset.length, 3)
    assert.equal(zone.inputPort.position.length, 3)
    assert.equal(zone.outputPort.position.length, 3)
    assert.ok(zone.runtime.throughputRate > 0 && zone.runtime.throughputRate <= 1)
    assert.ok(zone.runtime.capacityPerHour > 0)
    assert.ok(zone.runtime.wip >= 0)
    assert.ok(zone.runtime.queue >= 0)
    assert.ok(zone.model.footprint.every((value) => value > 0))
    assert.ok(zone.model.desktopDetail >= zone.model.mobileDetail)
    visualKinds.add(zone.visual.kind)
    for (const issueId of zone.issueIds) assert.ok(issueIds.has(issueId), `${zone.id} references missing issue ${issueId}`)
  }
  assert.equal(visualKinds.size, 9)
})

test('V3使用独立图表驾驶舱且V2.1与V2.0继续加载历史场景', () => {
  const analysisSource = readProjectFile('src/views/AnalysisView.vue')
  const v3AnalysisSource = readProjectFile('src/views/V3AnalysisView.vue')
  const routerSource = readProjectFile('src/router.ts')
  const v21SceneSource = readProjectFile('src/components/FactoryTwinSceneV21.vue')

  assert.match(analysisSource, /v-if="isV21"/)
  assert.match(analysisSource, /<FactoryTwinSceneV21/)
  assert.match(analysisSource, /<FactoryTwinScene\s+v-else/)
  assert.match(analysisSource, /'v21-analysis'/)
  assert.match(analysisSource, /'v2-analysis'/)
  assert.match(analysisSource, /'v21-overview'/)
  assert.match(analysisSource, /'v2-overview'/)
  assert.match(routerSource, /name: 'v3-analysis', component: V3AnalysisView/)
  assert.match(v3AnalysisSource, /图表化AI问题驾驶舱/)
  assert.doesNotMatch(v3AnalysisSource, /数据接入|质量校验|知识召回|CPU小模型分析|结论生成/)
  assert.match(analysisSource, /currentChapterIndex\.value = 1/)
  assert.match(v21SceneSource, /UnrealBloomPass/)
  assert.match(v21SceneSource, /CatmullRomCurve3/)
  assert.match(v21SceneSource, /InstancedMesh/)
  assert.match(v21SceneSource, /document\.visibilityState/)
  assert.match(v21SceneSource, /window\.addEventListener\('resize', handleViewportChange\)/)
  assert.match(v21SceneSource, /bloomPass\?\.dispose\(\)/)
  assert.doesNotMatch(v21SceneSource, /TextureLoader|CanvasTexture|\.webp|\.png|\.jpe?g/)
})

test('V4生命周期固定为十节点且不包含不可取得的数据环节', () => {
  const dataSource = readProjectFile('src/data/v4-health-center.ts')
  const typeSource = readProjectFile('src/types.ts')
  const expectedNodes = ['order-plan', 'procurement', 'material-warehouse', 'cutting', 'sewing', 'special-process', 'finishing', 'quality', 'packing', 'finished-warehouse']
  const nodeBlock = dataSource.match(/lifecycleNodes:[\s\S]*?\n\]/)?.[0] ?? ''

  for (const node of expectedNodes) assert.match(nodeBlock, new RegExp(`id: '${node}'`))
  assert.equal((nodeBlock.match(/ id: '/g) ?? []).length, 10)
  assert.doesNotMatch(nodeBlock, /海运|码头|清关/)
  for (const typeName of ['LifecycleNode', 'ProblemIdentity', 'AlertEvent', 'InterventionRecord', 'SolutionEffectiveness', 'ManagementAction']) {
    assert.match(typeSource, new RegExp(`interface ${typeName}`))
  }
})

test('V4问题具备身份证、预警、五类检查、责任与验证要求', () => {
  const dataSource = readProjectFile('src/data/v4-health-center.ts')
  const viewSource = readProjectFile('src/views/V4HealthInterventionView.vue')

  for (const category of ['设备', '物料', '工艺', '人员', '管理']) assert.match(dataSource, new RegExp(`'${category}'`))
  for (const alert of ['首次提示', '二次加强', '三次警报', '待干预', '验证中', '再次复发']) assert.match(dataSource, new RegExp(alert))
  assert.match(viewSource, /问题身份证/)
  assert.match(viewSource, /标准检查清单/)
  assert.match(viewSource, /建议责任/)
  assert.match(viewSource, /验证要求/)
  assert.match(viewSource, /反向追溯/)
  assert.match(viewSource, /AI仅推荐顺序/)
})

test('V4核心图表与生命周期状态带支持联动下钻', () => {
  const viewSource = readProjectFile('src/views/V4HealthInterventionView.vue')
  const chartSource = readProjectFile('src/v4-chart-options.ts')
  const echartSource = readProjectFile('src/components/EChart.vue')

  for (const builder of ['buildHealthRoseOption', 'buildPeriodCompareOption', 'buildProblemParetoOption', 'buildInterventionTrendOption', 'buildClosureFunnelOption']) assert.match(chartSource, new RegExp(`function ${builder}`))
  assert.match(viewSource, /v4-lifecycle-strip/)
  assert.match(viewSource, /@select="handleRoseSelect"/)
  assert.match(viewSource, /@select="handleSecondarySelect"/)
  assert.match(viewSource, /qc21: 'quality'/)
  assert.match(viewSource, /sewing: 'sewing'/)
  assert.match(viewSource, /cutting: 'cutting'/)
  assert.match(echartSource, /FunnelChart/)
})

test('V4异常数据状态暂停原因、岗位和改善结论', () => {
  const viewSource = readProjectFile('src/views/V4HealthInterventionView.vue')
  const typeSource = readProjectFile('src/types.ts')
  const chartSource = readProjectFile('src/components/EChart.vue')

  assert.match(typeSource, /'metric-conflict'/)
  assert.match(viewSource, /conclusionsAllowed/)
  assert.match(viewSource, /不展示原因、方案或责任关联/)
  assert.match(chartSource, /指标口径存在冲突/)
})

test('V4提供干预记录、复发、措施库与履职事实但不表现为正式任务', () => {
  const viewSource = readProjectFile('src/views/V4HealthInterventionView.vue')
  const dataSource = readProjectFile('src/data/v4-health-center.ts')
  const versionSource = readProjectFile('src/version.ts')

  assert.match(viewSource, /保存演示干预记录/)
  assert.match(viewSource, /未下发正式任务/)
  assert.match(viewSource, /预警与复发时间轴/)
  assert.match(viewSource, /措施有效性库/)
  assert.match(viewSource, /不评价能力或态度/)
  assert.match(dataSource, /baselineStatus: 'pending'/)
  assert.match(versionSource, /V4仅提供桌面端与大屏布局，不制作手机端/)
})

test('V3包含六章节78秒故事线和十四类图表', () => {
  const dataSource = readProjectFile('src/data/v3-dashboard.ts')
  const typeSource = readProjectFile('src/types.ts')
  const chapterBlock = dataSource.match(/v3StoryChapters[\s\S]*?] as const/)?.[0] ?? ''
  const durations = [...chapterBlock.matchAll(/duration: (\d+)/g)].map((match) => Number(match[1]))
  const chartIds = [
    'health-radar', 'issue-scatter', 'process-heatmap', 'completion-trend', 'defect-trend',
    'defect-pareto', 'queue-area', 'evidence-timeline', 'causal-graph', 'reason-waterfall',
    'action-matrix', 'improvement-compare', 'responsibility-sankey', 'validation-progress',
  ]

  assert.equal(durations.length, 6)
  assert.equal(durations.reduce((sum, duration) => sum + duration, 0), 78)
  for (const id of chartIds) {
    assert.match(typeSource, new RegExp(`'${id}'`))
    assert.match(dataSource, new RegExp(`'${id}'`))
  }
  assert.equal(new Set(chartIds).size, 14)
  assert.equal((chapterBlock.match(/conclusion:/g) ?? []).length, 6)
})

test('V3仅提供桌面大屏布局并保持演示边界', () => {
  const viewSource = readProjectFile('src/views/V3AnalysisView.vue')
  const styleSource = readProjectFile('src/styles.css')
  const versionSource = readProjectFile('src/version.ts')

  assert.match(viewSource, /请使用桌面大屏查看/)
  assert.match(styleSource, /@media \(max-width: 1180px\)/)
  assert.match(versionSource, /V3仅提供桌面端与大屏布局，不制作手机端/)
  assert.match(viewSource, /不代表实际预测结果/)
})

test('V2.1工序动画由六态状态机和AI阶段驱动', () => {
  const typeSource = readProjectFile('src/types.ts')
  const islandSource = readProjectFile('src/scene/process-islands-v21.ts')
  const sceneSource = readProjectFile('src/components/FactoryTwinSceneV21.vue')

  for (const state of ['ambient', 'warning', 'selected', 'diagnosing', 'improving', 'recovered']) {
    assert.match(typeSource, new RegExp(`'${state}'`))
  }
  for (const stage of ['scan', 'lock', 'evidence', 'hypothesis', 'solution', 'responsibility']) {
    assert.match(typeSource, new RegExp(`'${stage}'`))
  }
  assert.match(islandSource, /improvementProgress/)
  assert.match(islandSource, /queueFactor/)
  assert.match(sceneSource, /flowSnapshot/)
  assert.match(sceneSource, /updateAiLayer/)
})

test('工序岛由Three.js程序化几何构成且不依赖位图资产', () => {
  const processIslandSource = readProjectFile('src/scene/process-islands.ts')

  assert.match(processIslandSource, /THREE\.InstancedMesh/)
  assert.match(processIslandSource, /THREE\.(?:BoxGeometry|CylinderGeometry|TorusGeometry)/)
  assert.doesNotMatch(processIslandSource, /TextureLoader|CanvasTexture|THREE\.Sprite|\.webp|\.png|\.jpe?g/)
})

test('90秒演示章节、镜头与业务聚焦完整', () => {
  const duration = demoScenarioRaw.chapters.reduce((sum, chapter) => sum + chapter.duration, 0)
  assert.equal(demoScenarioRaw.totalDuration, 90)
  assert.equal(duration, 90)
  assert.equal(demoScenarioRaw.chapters.length, 7)
  for (const [index, chapter] of demoScenarioRaw.chapters.entries()) {
    assert.equal(chapter.order, index + 1)
    assert.equal(chapter.camera.position.length, 3)
    assert.equal(chapter.camera.target.length, 3)
    assert.match(chapter.camera.framing, /^(overview|zone|relationship)$/)
    assert.ok(chapter.camera.pathLift > 0)
    assert.match(chapter.aiStage, /^(idle|scan|lock|evidence|hypothesis|solution|responsibility)$/)
    assert.ok(chapter.flow.throughputScale > 0)
    assert.match(chapter.improvement.status, /^(inactive|simulation|recovered)$/)
    assert.match(chapter.improvement.disclaimer, /演示/)
    if (chapter.focusZoneId) assert.ok(factoryZonesRaw.some((zone) => zone.id === chapter.focusZoneId))
  }
  assert.equal(demoScenarioRaw.chapters.find((chapter) => chapter.id === 'actions').improvement.status, 'simulation')
  assert.equal(demoScenarioRaw.chapters.find((chapter) => chapter.id === 'summary').improvement.status, 'recovered')
})

test('效率与质量联动只标记相关或AI假设', () => {
  assert.ok(issueRelationsRaw.length >= 2)
  for (const relation of issueRelationsRaw) {
    assert.match(relation.type, /^(fact|correlation|ai-hypothesis|confirmed-cause)$/)
    assert.ok(relation.confidence > 0 && relation.confidence <= 1)
    assert.ok(relation.evidence.length > 0)
    assert.equal(relation.confirmation, 'pending')
  }
  const crossTopic = issueRelationsRaw.find((relation) => relation.id === 'REL-DEMO-001')
  assert.equal(crossTopic.type, 'correlation')
  assert.match(crossTopic.label, /待现场确认/)
})
