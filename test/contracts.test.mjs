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

test('v2.0.0版本入口由项目版本驱动并保留v1历史', () => {
  const packageJson = JSON.parse(readProjectFile('package.json'))
  const versionSource = readProjectFile('src/version.ts')
  const overviewSource = readProjectFile('src/views/OverviewView.vue')
  const analysisSource = readProjectFile('src/views/AnalysisView.vue')

  assert.equal(packageJson.version, '2.0.0')
  assert.match(versionSource, /v\$\{__APP_VERSION__\}/)
  assert.match(versionSource, /version: 'v1\.0\.0'/)
  assert.match(overviewSource, /import\.meta\.env\.BASE_URL/)
  assert.match(overviewSource, /<VersionDialog \/>/)
  assert.match(analysisSource, /<VersionDialog \/>/)
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
    visualKinds.add(zone.visual.kind)
    for (const issueId of zone.issueIds) assert.ok(issueIds.has(issueId), `${zone.id} references missing issue ${issueId}`)
  }
  assert.equal(visualKinds.size, 9)
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
    if (chapter.focusZoneId) assert.ok(factoryZonesRaw.some((zone) => zone.id === chapter.focusZoneId))
  }
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
