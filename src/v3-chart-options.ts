import type { EChartsOption } from 'echarts'
import type { ActionPackage, FactoryZone, Issue, TopicDataset, V3ChartId } from './types'

const v3 = {
  ai: '#0ea978', cyan: '#148ba7', amber: '#cc8517', danger: '#d04b4b', graphite: '#1b272b',
  text: '#263337', muted: '#69797d', line: 'rgba(42, 72, 78, 0.14)', pale: '#eef5f4', white: '#ffffff',
}

const severity = { critical: v3.danger, warning: v3.amber, attention: v3.cyan }
const axis = {
  alignTicks: false,
  axisLine: { lineStyle: { color: 'rgba(42, 72, 78, 0.22)' } }, axisTick: { show: false },
  axisLabel: { color: v3.muted, fontSize: 10 }, splitLine: { lineStyle: { color: v3.line } },
}
const tooltip = { backgroundColor: 'rgba(27,39,43,0.96)', borderColor: 'rgba(14,169,120,0.38)', textStyle: { color: '#f5fbfa', fontSize: 11 } }
const labels = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00']

export interface V3ChartInputs {
  dataset: TopicDataset
  allIssues: Issue[]
  issue: Issue
  zones: FactoryZone[]
  actionPackage: ActionPackage
  compareMode: 'before' | 'after'
}

export function buildV3ChartOption(chartId: V3ChartId, input: V3ChartInputs): EChartsOption {
  const builders: Record<V3ChartId, () => EChartsOption> = {
    'health-radar': () => healthRadar(), 'issue-scatter': () => issueScatter(input.allIssues, input.issue.id),
    'process-heatmap': () => processHeatmap(input.zones), 'completion-trend': () => completionTrend(input.compareMode),
    'defect-trend': () => defectTrend(), 'defect-pareto': () => defectPareto(),
    'queue-area': () => queueArea(input.compareMode), 'evidence-timeline': () => evidenceTimeline(),
    'causal-graph': () => causalGraph(input.issue), 'reason-waterfall': () => reasonWaterfall(input.issue),
    'action-matrix': () => actionMatrix(input.issue), 'improvement-compare': () => improvementCompare(input.actionPackage, input.compareMode),
    'responsibility-sankey': () => responsibilitySankey(input.issue, input.actionPackage), 'validation-progress': () => validationProgress(),
  }
  const option = builders[chartId]() as EChartsOption & {
    xAxis?: Record<string, unknown> | Array<Record<string, unknown>>
    yAxis?: Record<string, unknown> | Array<Record<string, unknown>>
  }
  for (const axisOption of [...toAxisArray(option.xAxis), ...toAxisArray(option.yAxis)]) {
    axisOption.alignTicks = false
  }
  return option
}

function toAxisArray(axisOption: Record<string, unknown> | Array<Record<string, unknown>> | undefined) {
  if (!axisOption) return []
  return Array.isArray(axisOption) ? axisOption : [axisOption]
}

function healthRadar(): EChartsOption {
  return { animationDuration: 900, tooltip, radar: { radius: '64%', splitNumber: 4, indicator: ['进度', '质量', '在制', '交期', '检验', '节拍'].map((name) => ({ name, max: 100 })), axisName: { color: v3.text, fontSize: 10 }, splitArea: { areaStyle: { color: ['rgba(14,169,120,.03)', 'rgba(20,139,167,.025)'] } }, splitLine: { lineStyle: { color: 'rgba(20,139,167,.2)' } }, axisLine: { lineStyle: { color: 'rgba(20,139,167,.2)' } } }, series: [{ type: 'radar', symbolSize: 5, data: [{ value: [76, 82, 58, 68, 54, 64], name: '当前健康度', areaStyle: { color: 'rgba(14,169,120,.16)' }, lineStyle: { color: v3.ai, width: 2 }, itemStyle: { color: v3.ai } }] }] }
}

function issueScatter(issues: Issue[], activeId: string): EChartsOption {
  const maxImpact = Math.max(...issues.map((issue) => issue.impact))
  return { animationDuration: 850, animationEasing: 'cubicOut', grid: { left: 46, right: 22, top: 18, bottom: 34 }, tooltip: { ...tooltip, formatter: (p: any) => `<b>${p.data.name}</b><br/>影响量：${p.data.value[0]}<br/>发生频次：${p.data.value[1]}<br/>置信度：${Math.round(p.data.confidence * 100)}%` }, xAxis: { type: 'value', name: '影响量', nameLocation: 'middle', nameGap: 24, max: Math.ceil(maxImpact * 1.18), ...axis }, yAxis: { type: 'value', name: '频次', ...axis }, series: [{ type: 'scatter', data: issues.map((issue) => ({ name: issue.shortLabel, issueId: issue.id, confidence: issue.confidence, value: [issue.impact, issue.occurrence], symbolSize: 22 + issue.confidence * 26, itemStyle: { color: severity[issue.severity], opacity: issue.id === activeId ? 1 : .64, borderColor: issue.id === activeId ? v3.white : 'transparent', borderWidth: 2, shadowBlur: issue.id === activeId ? 22 : 6, shadowColor: severity[issue.severity] }, label: { show: issue.id === activeId, formatter: issue.shortLabel, position: 'top', color: v3.graphite, fontWeight: 700 } })) }] }
}

function processHeatmap(zones: FactoryZone[]): EChartsOption {
  const dimensions = ['等待', '在制', '不良', '节拍']
  const values = zones.flatMap((zone, x) => [zone.runtime.queue / 3, zone.runtime.wip / 3, zone.runtime.severity * 100, (1 - zone.runtime.throughputRate) * 100].map((value, y) => [x, y, Math.min(100, Math.round(value)), zone.id]))
  return { animationDuration: 850, grid: { left: 50, right: 18, top: 28, bottom: 62 }, tooltip: { ...tooltip, formatter: (p: any) => `${zones[p.data[0]].label}<br/>${dimensions[p.data[1]]}风险：${p.data[2]}` }, xAxis: { type: 'category', data: zones.map((z) => z.shortLabel), axisLabel: { color: v3.text, fontSize: 9, rotate: 22 }, axisLine: { lineStyle: { color: v3.line } }, axisTick: { show: false } }, yAxis: { type: 'category', data: dimensions, axisLabel: { color: v3.text }, axisLine: { show: false }, axisTick: { show: false } }, visualMap: { min: 0, max: 100, orient: 'horizontal', left: 'center', bottom: 4, itemWidth: 90, itemHeight: 6, text: ['高风险', '稳定'], textStyle: { color: v3.muted, fontSize: 9 }, inRange: { color: ['#d8f0e8', '#7fcdb6', '#e7bb60', '#d04b4b'] } }, series: [{ type: 'heatmap', data: values, label: { show: true, color: v3.graphite, fontSize: 9, formatter: (p: any) => p.data[2] }, emphasis: { itemStyle: { borderColor: v3.white, borderWidth: 2, shadowBlur: 12, shadowColor: v3.cyan } } }] }
}

function completionTrend(mode: 'before' | 'after'): EChartsOption {
  const before = [96.4, 95.8, 94.9, 93.2, 91.8, 92.1, 92.4]
  const after = [96.4, 96.0, 95.6, 95.4, 95.7, 96.0, 96.1]
  return lineOption('计划达成率', mode === 'after' ? after : before, v3.ai, '%', [10, 11])
}

function defectTrend(): EChartsOption { return lineOption('不良率', [1.8, 1.9, 2.0, 2.2, 2.3, 2.2, 2.3], v3.amber, '%', [10, 11]) }

function lineOption(name: string, data: number[], color: string, unit: string, markRange?: [number, number]): EChartsOption {
  return { animationDuration: 950, grid: { left: 42, right: 18, top: 24, bottom: 30 }, tooltip: { ...tooltip, trigger: 'axis', valueFormatter: (v: unknown) => `${v}${unit}` }, xAxis: { type: 'category', boundaryGap: false, data: labels, ...axis }, yAxis: { type: 'value', scale: true, axisLabel: { color: v3.muted, fontSize: 9, formatter: `{value}${unit}` }, splitLine: { lineStyle: { color: v3.line } } }, series: [{ name, type: 'line', smooth: .35, symbolSize: 5, data, lineStyle: { color, width: 2.4 }, itemStyle: { color, borderColor: v3.white, borderWidth: 2 }, areaStyle: { color: color === v3.ai ? 'rgba(14,169,120,.12)' : 'rgba(204,133,23,.1)' }, markArea: markRange ? { silent: true, itemStyle: { color: 'rgba(208,75,75,.07)' }, data: [[{ xAxis: labels[markRange[0] - 8] }, { xAxis: labels[markRange[1] - 8] }]] } : undefined }] }
}

function defectPareto(): EChartsOption {
  const names = ['缝皱', '跳针', '污渍', '生地瑕疵', '裁断粗糙']; const counts = [26, 18, 15, 12, 10]; const cumulative = [32, 54, 73, 88, 100]
  return { animationDuration: 900, grid: { left: 38, right: 40, top: 26, bottom: 42 }, tooltip: { ...tooltip, trigger: 'axis' }, legend: { top: 0, right: 8, data: ['不良数量', '累计占比'], textStyle: { color: v3.muted, fontSize: 9 } }, xAxis: { type: 'category', data: names, axisLabel: { color: v3.text, fontSize: 9, rotate: 18 }, axisLine: { lineStyle: { color: v3.line } }, axisTick: { show: false } }, yAxis: [{ type: 'value', ...axis }, { type: 'value', min: 0, max: 100, axisLabel: { color: v3.muted, formatter: '{value}%' }, splitLine: { show: false } }], series: [{ name: '不良数量', type: 'bar', data: counts, barWidth: 18, itemStyle: { color: (p: any) => p.dataIndex === 0 ? v3.danger : v3.cyan, borderRadius: [3, 3, 0, 0] } }, { name: '累计占比', type: 'line', yAxisIndex: 1, data: cumulative, symbolSize: 5, lineStyle: { color: v3.amber, width: 2 }, itemStyle: { color: v3.amber } }] }
}

function queueArea(mode: 'before' | 'after'): EChartsOption {
  const factor = mode === 'after' ? .56 : 1
  const seriesData: Array<{ name: string; data: number[]; color: string }> = [
    { name: '缝制在制', data: [132, 158, 188, 214, 206, 192, 180], color: v3.cyan },
    { name: 'QC2-1待检', data: [84, 126, 174, 228, 286, 260, 242], color: v3.danger },
    { name: '整理等待', data: [12, 18, 26, 42, 58, 66, 64], color: v3.amber },
  ]
  return { animationDuration: 900, grid: { left: 38, right: 18, top: 28, bottom: 28 }, tooltip: { ...tooltip, trigger: 'axis' }, legend: { top: 0, right: 5, data: ['缝制在制', 'QC2-1待检', '整理等待'], textStyle: { color: v3.muted, fontSize: 9 } }, xAxis: { type: 'category', boundaryGap: false, data: labels, ...axis }, yAxis: { type: 'value', ...axis }, series: seriesData.map(({ name, data, color }) => ({ name, type: 'line' as const, stack: 'queue', smooth: .3, symbol: 'none', data: data.map(v => Math.round(v * factor)), lineStyle: { color, width: 1.5 }, areaStyle: { opacity: .18, color } })) }
}

function evidenceTimeline(): EChartsOption {
  const events = [{ value: [0, 0], name: '批次完成', detail: '缝制三组批次集中完成' }, { value: [1, 1], name: '集中送检', detail: '38分钟内出现4个批次' }, { value: [2, 2], name: '队列超阈', detail: 'QC2-1达到286 pcs' }, { value: [3, 3], name: '等料出现', detail: '整理工序等待增加' }, { value: [4, 4], name: '异常复核', detail: '相关性待现场确认' }]
  return { animationDuration: 800, grid: { left: 30, right: 30, top: 44, bottom: 46 }, tooltip: { ...tooltip, formatter: (p: any) => `<b>${p.data.name}</b><br/>${p.data.detail}` }, xAxis: { type: 'category', data: ['09:42', '10:08', '10:34', '10:52', '11:16'], axisLabel: { color: v3.muted }, axisLine: { lineStyle: { color: v3.cyan, width: 2 } }, axisTick: { show: false } }, yAxis: { show: false, min: -1, max: 5 }, series: [{ type: 'scatter', symbolSize: 22, data: events.map((e, i) => ({ ...e, itemStyle: { color: i === 2 ? v3.danger : i === 4 ? v3.amber : v3.cyan, borderColor: v3.white, borderWidth: 3, shadowBlur: 12, shadowColor: i === 2 ? v3.danger : v3.cyan }, label: { show: true, position: i % 2 ? 'bottom' : 'top', formatter: e.name, color: v3.text, fontSize: 9 } })) }] }
}

function causalGraph(issue: Issue): EChartsOption {
  const nodes: any[] = [{ id: 'issue', name: issue.shortLabel, type: 'issue', x: 0, y: 0, symbolSize: 74, itemStyle: { color: v3.danger } }]
  issue.evidence.slice(0, 2).forEach((e, i) => nodes.push({ id: `e${i}`, name: e.label, type: 'evidence', x: -210, y: -70 + i * 140, symbol: 'roundRect', symbolSize: [116, 42], itemStyle: { color: '#e5f4f6', borderColor: v3.cyan, borderWidth: 2 } }))
  issue.reasons.slice(0, 2).forEach((r, i) => nodes.push({ id: `r${i}`, name: r.title, type: 'reason', x: 190, y: -75 + i * 150, symbol: 'roundRect', symbolSize: [124, 44], itemStyle: { color: '#fff4dc', borderColor: v3.amber, borderWidth: 2 } }))
  nodes.push({ id: 'solution', name: issue.solutions[0].title, type: 'solution', x: 410, y: -40, symbol: 'roundRect', symbolSize: [138, 46], itemStyle: { color: '#def4ea', borderColor: v3.ai, borderWidth: 2 } }, { id: 'owner', name: issue.responsibility.role, type: 'responsibility', x: 410, y: 100, symbol: 'roundRect', symbolSize: [138, 46], itemStyle: { color: '#e7f1f3', borderColor: v3.graphite, borderWidth: 1 } })
  const links = [{ source: 'e0', target: 'issue', relationType: 'fact' }, { source: 'e1', target: 'issue', relationType: 'fact' }, { source: 'issue', target: 'r0', relationType: 'correlation' }, { source: 'issue', target: 'r1', relationType: 'ai-hypothesis' }, { source: 'r0', target: 'solution', relationType: 'pending' }, { source: 'solution', target: 'owner', relationType: 'pending' }]
  return { animationDuration: 1050, tooltip: { ...tooltip, formatter: (p: any) => p.data.name ?? p.data.relationType }, series: [{ type: 'graph', layout: 'none', roam: true, data: nodes, links: links.map((l) => ({ ...l, lineStyle: { color: l.relationType === 'fact' ? v3.cyan : l.relationType === 'correlation' || l.relationType === 'ai-hypothesis' ? v3.amber : v3.ai, type: l.relationType === 'fact' ? 'solid' : 'dashed', width: 2, opacity: .8, curveness: .08 } })), edgeSymbol: ['none', 'arrow'], edgeSymbolSize: 7, label: { show: true, color: v3.graphite, fontSize: 9, width: 104, overflow: 'truncate' }, emphasis: { focus: 'adjacency' } }] }
}

function reasonWaterfall(issue: Issue): EChartsOption {
  const names = [...issue.reasons.slice(0, 2).map(r => r.title), '其他线索', '待验证影响']; const values = [44, 31, 15, 10]; let total = 0; const helper = values.map(v => { const current = total; total += v; return current })
  return { animationDuration: 900, grid: { left: 40, right: 18, top: 22, bottom: 62 }, tooltip: { ...tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } }, xAxis: { type: 'category', data: names, axisLabel: { color: v3.text, fontSize: 9, rotate: 20 }, axisLine: { lineStyle: { color: v3.line } }, axisTick: { show: false } }, yAxis: { type: 'value', max: 100, axisLabel: { color: v3.muted, formatter: '{value}%' }, splitLine: { lineStyle: { color: v3.line } } }, series: [{ type: 'bar', stack: 'total', silent: true, data: helper, itemStyle: { color: 'transparent' } }, { name: '演示贡献', type: 'bar', stack: 'total', data: values, barWidth: 24, itemStyle: { color: (p: any) => p.dataIndex < 2 ? v3.amber : '#a8b7ba', borderRadius: [3, 3, 0, 0] }, label: { show: true, position: 'top', color: v3.text, formatter: '{c}%' } }] }
}

function actionMatrix(issue: Issue): EChartsOption {
  const solutions = [issue.solutions[0]?.title ?? '拆分送检波次', issue.solutions[1]?.title ?? '小时级线平衡', '设置队列预警', '复核检验标准工时']
  const points = [[2.1, 8.8, 92], [4.1, 8.1, 78], [1.8, 6.7, 86], [6.2, 7.4, 61]]
  return { animationDuration: 900, grid: { left: 46, right: 20, top: 24, bottom: 38 }, tooltip: { ...tooltip, formatter: (p: any) => `<b>${p.data.name}</b><br/>实施难度：${p.data.value[0]}<br/>预期影响：${p.data.value[1]}<br/>数据完整度：${p.data.value[2]}%` }, xAxis: { type: 'value', min: 0, max: 10, name: '实施难度', nameLocation: 'middle', nameGap: 24, ...axis }, yAxis: { type: 'value', min: 0, max: 10, name: '预期影响', ...axis }, series: [{ type: 'scatter', data: solutions.map((name, i) => ({ name, value: points[i], symbolSize: 20 + points[i][2] * .24, itemStyle: { color: i === 0 ? v3.ai : i === 1 ? v3.cyan : v3.amber, opacity: .84 }, label: { show: true, position: 'top', formatter: name, color: v3.text, fontSize: 9 } })) }] }
}

function improvementCompare(pkg: ActionPackage, mode: 'before' | 'after'): EChartsOption {
  const snap = pkg.improvement
  if (!snap) return { graphic: [{ type: 'text', left: 'center', top: 'middle', style: { text: '待建立现场基线\n当前仅展示验证指标', fill: v3.muted, font: '14px PingFang SC', align: 'center', lineHeight: 26 } }] }
  const before = [snap.queueBefore, 64, 38]; const after = [snap.queueAfter, 22, 16]
  return { animationDuration: 1000, grid: { left: 50, right: 22, top: 42, bottom: 32 }, tooltip: { ...tooltip, trigger: 'axis' }, legend: { top: 2, right: 5, data: ['改善前', '改善后'], textStyle: { color: v3.muted } }, xAxis: { type: 'category', data: ['待检队列', '整理等料', '平均等待'], axisLabel: { color: v3.text }, axisLine: { lineStyle: { color: v3.line } }, axisTick: { show: false } }, yAxis: { type: 'value', name: '演示量', ...axis }, series: [{ name: '改善前', type: 'bar', data: before, barMaxWidth: 28, itemStyle: { color: mode === 'before' ? v3.danger : 'rgba(208,75,75,.32)', borderRadius: [3, 3, 0, 0] } }, { name: '改善后', type: 'bar', data: after, barMaxWidth: 28, itemStyle: { color: mode === 'after' ? v3.ai : 'rgba(14,169,120,.32)', borderRadius: [3, 3, 0, 0] } }] }
}

function responsibilitySankey(issue: Issue, pkg: ActionPackage): EChartsOption {
  const actions = pkg.actions.slice(0, 3); const departments = issue.responsibility.department.split(' / '); const roles = issue.responsibility.role.split(' / ')
  const nodes = [{ name: issue.shortLabel }, ...actions.map(name => ({ name })), ...departments.map(name => ({ name })), ...roles.map(name => ({ name }))]
  const links = actions.map(name => ({ source: issue.shortLabel, target: name, value: 2 })).concat(actions.flatMap((action, i) => [{ source: action, target: departments[i % departments.length], value: 1 }, { source: action, target: roles[i % roles.length], value: 1 }]))
  return { animationDuration: 1000, tooltip, series: [{ type: 'sankey', left: 12, right: 18, top: 16, bottom: 16, data: nodes, links, nodeWidth: 10, nodeGap: 12, layoutIterations: 24, label: { color: v3.text, fontSize: 9 }, lineStyle: { color: 'gradient', opacity: .42, curveness: .54 }, levels: [{ depth: 0, itemStyle: { color: v3.danger } }, { depth: 1, itemStyle: { color: v3.ai } }, { depth: 2, itemStyle: { color: v3.cyan } }] }] }
}

function validationProgress(): EChartsOption {
  const data = [{ name: '待确认', value: 5, itemStyle: { color: v3.amber } }, { name: '待采集', value: 3, itemStyle: { color: '#a1b0b3' } }, { name: '可验证', value: 7, itemStyle: { color: v3.cyan } }, { name: '已有证据', value: 9, itemStyle: { color: v3.ai } }]
  return { animationDuration: 900, tooltip, legend: { bottom: 2, left: 'center', textStyle: { color: v3.muted, fontSize: 9 }, itemWidth: 8, itemHeight: 8 }, series: [{ type: 'pie', radius: ['44%', '70%'], center: ['50%', '45%'], padAngle: 2, itemStyle: { borderRadius: 3, borderColor: v3.white, borderWidth: 2 }, label: { color: v3.text, fontSize: 9, formatter: '{b}\n{c}项' }, data }] }
}
