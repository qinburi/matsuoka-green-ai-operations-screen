import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { hotspotContexts, rawTopics } from '../src/data/demo-raw.mjs'

const readProjectFile = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf-8')

test('四个入口都映射到可用分析主题', () => {
  assert.deepEqual(Object.keys(hotspotContexts).sort(), ['defects', 'overview', 'production', 'progress'])
  for (const entry of Object.values(hotspotContexts)) {
    assert.ok(rawTopics[entry.topic])
    assert.ok(entry.source)
  }
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

test('v1.0.0版本入口由项目版本驱动并覆盖两个页面', () => {
  const packageJson = JSON.parse(readProjectFile('package.json'))
  const versionSource = readProjectFile('src/version.ts')
  const overviewSource = readProjectFile('src/views/OverviewView.vue')
  const analysisSource = readProjectFile('src/views/AnalysisView.vue')

  assert.equal(packageJson.version, '1.0.0')
  assert.match(versionSource, /v\$\{__APP_VERSION__\}/)
  assert.match(overviewSource, /<VersionDialog \/>/)
  assert.match(analysisSource, /<VersionDialog \/>/)
})
