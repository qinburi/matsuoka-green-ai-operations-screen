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
  assert.match(versionSource, /version: 'v2\.1\.0'/)
  assert.match(versionSource, /version: 'v2\.0\.0'/)
  assert.match(versionSource, /version: 'v1\.0\.0'/)
  assert.match(versionSource, /prototypeRoutes: \{ overview: 'overview', analysis: 'analysis' \}/)
  assert.match(versionSource, /prototypeRoutes: \{ overview: 'v2-overview', analysis: 'v2-analysis' \}/)
  assert.match(versionSource, /prototypeRoutes: \{ overview: 'v1-overview', analysis: 'v1-analysis' \}/)
  assert.match(versionSource, /id: 'v1-launch'/)
  assert.match(versionSource, /id: 'v2-command-center'/)
  assert.match(versionSource, /id: 'v21-semantic-motion'/)
})

test('六条版本路由具有明确页面类型和版本元数据', () => {
  const routerSource = readProjectFile('src/router.ts')

  assert.match(routerSource, /path: '\/', name: 'overview'.*uiVersion: CURRENT_PRODUCT_VERSION, viewKind: 'overview'/)
  assert.match(routerSource, /path: '\/analysis', name: 'analysis'.*uiVersion: CURRENT_PRODUCT_VERSION, viewKind: 'analysis'/)
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

test('V2.1使用独立语义三维场景且V2.0继续加载原场景', () => {
  const analysisSource = readProjectFile('src/views/AnalysisView.vue')
  const v21SceneSource = readProjectFile('src/components/FactoryTwinSceneV21.vue')

  assert.match(analysisSource, /v-if="isV21"/)
  assert.match(analysisSource, /<FactoryTwinSceneV21/)
  assert.match(analysisSource, /<FactoryTwinScene\s+v-else/)
  assert.match(analysisSource, /route\.meta\.uiVersion === 'v2\.0\.0' \? 'v2-analysis' : 'analysis'/)
  assert.match(analysisSource, /route\.meta\.uiVersion === 'v2\.0\.0' \? 'v2-overview' : 'overview'/)
  assert.match(analysisSource, /currentChapterIndex\.value = 1/)
  assert.match(v21SceneSource, /UnrealBloomPass/)
  assert.match(v21SceneSource, /CatmullRomCurve3/)
  assert.match(v21SceneSource, /InstancedMesh/)
  assert.match(v21SceneSource, /document\.visibilityState/)
  assert.match(v21SceneSource, /window\.addEventListener\('resize', handleViewportChange\)/)
  assert.match(v21SceneSource, /bloomPass\?\.dispose\(\)/)
  assert.doesNotMatch(v21SceneSource, /TextureLoader|CanvasTexture|\.webp|\.png|\.jpe?g/)
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
