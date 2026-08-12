import type { EChartsOption } from 'echarts'
import type { HealthProblem, InterventionRecord, LifecycleNode } from './types'

const color = {
  ai: '#0b9b70', cyan: '#197f9b', amber: '#c68418', danger: '#cb454c', notice: '#4d9bae',
  graphite: '#17282d', text: '#24373c', muted: '#6b7d81', line: 'rgba(39,73,80,.14)', white: '#ffffff',
}
const healthColor = { normal: color.ai, notice: color.notice, warning: color.amber, critical: color.danger }
const tooltip = { backgroundColor: 'rgba(23,40,45,.96)', borderColor: 'rgba(25,127,155,.35)', textStyle: { color: '#f4fbfa', fontSize: 11 } }
const axis = { axisLine: { lineStyle: { color: color.line } }, axisTick: { show: false }, axisLabel: { color: color.muted, fontSize: 9 }, splitLine: { lineStyle: { color: color.line } } }

export function buildHealthRoseOption(nodes: LifecycleNode[], selectedNodeId: string): EChartsOption {
  return {
    animationDuration: 850,
    tooltip: { ...tooltip, formatter: (params: any) => `<b>${params.data.fullLabel}</b><br/>影响指数：${params.value}<br/>问题次数：${params.data.issueCount}次<br/>核心指标：${params.data.metric}` },
    polar: { radius: ['18%', '68%'], center: ['50%', '49%'] },
    radiusAxis: { min: 0, max: 100, splitNumber: 4, alignTicks: false, axisLabel: { show: false }, axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: 'rgba(25,127,155,.12)' } }, splitArea: { areaStyle: { color: ['rgba(255,255,255,.28)', 'rgba(235,246,246,.18)'] } } },
    angleAxis: { type: 'category', startAngle: 108, clockwise: true, data: nodes.map((node) => `${String(node.order).padStart(2, '0')} ${node.shortLabel}`), axisLine: { lineStyle: { color: 'rgba(25,127,155,.24)' } }, axisTick: { show: false }, axisLabel: { color: color.text, fontSize: 10, fontWeight: 600, margin: 10 } },
    series: [{
      type: 'bar', coordinateSystem: 'polar', roundCap: true, barWidth: 22, showBackground: true,
      backgroundStyle: { color: 'rgba(25,127,155,.06)', borderRadius: 9 },
      data: nodes.map((node) => ({
        value: node.impactIndex, nodeId: node.id, fullLabel: node.label, issueCount: node.issueCount, metric: `${node.coreMetric.value}${node.coreMetric.unit}`,
        itemStyle: { color: healthColor[node.health], opacity: node.id === selectedNodeId ? 1 : .62, borderColor: node.id === selectedNodeId ? color.white : 'transparent', borderWidth: node.id === selectedNodeId ? 2 : 0, shadowBlur: node.id === selectedNodeId ? 18 : 4, shadowColor: healthColor[node.health] },
      })),
      label: { show: true, position: 'end', color: color.text, fontSize: 9, formatter: (params: any) => `${params.value}` },
    }],
    graphic: [{ type: 'text', left: 'center', top: '43%', style: { text: '健康体检\n影响指数', align: 'center', fill: color.graphite, font: '700 11px PingFang SC', lineHeight: 17 } }],
  }
}

export function buildPeriodCompareOption(node: LifecycleNode, metric: 'count' | 'impact' | 'duration'): EChartsOption {
  const multiplier = node.impactIndex / 72
  const bases = metric === 'count' ? [5, 7, 18, 36] : metric === 'impact' ? [68, 92, 286, 612] : [31, 44, 62, 78]
  const current = bases.map((value) => Math.max(1, Math.round(value * multiplier)))
  const previous = current.map((value, index) => Math.round(value * [0.86, .91, .82, .88][index]))
  const unit = metric === 'count' ? '次' : metric === 'impact' ? 'pcs' : '分钟'
  return {
    animationDuration: 700, grid: { left: 42, right: 18, top: 32, bottom: 30 }, tooltip: { ...tooltip, trigger: 'axis', valueFormatter: (value: unknown) => `${value}${unit}` },
    legend: { top: 2, right: 6, data: ['对比期', '当前期'], textStyle: { color: color.muted, fontSize: 9 }, itemWidth: 9, itemHeight: 7 },
    xAxis: { type: 'category', data: ['昨日同期', '今日', '本周', '本月'], ...axis }, yAxis: { type: 'value', name: unit, ...axis },
    series: [{ name: '对比期', type: 'bar', data: previous, barMaxWidth: 20, itemStyle: { color: 'rgba(25,127,155,.28)', borderRadius: [3, 3, 0, 0] } }, { name: '当前期', type: 'bar', data: current, barMaxWidth: 20, itemStyle: { color: color.cyan, borderRadius: [3, 3, 0, 0] } }],
  }
}

export function buildProblemParetoOption(problems: HealthProblem[], activeProblemId: string): EChartsOption {
  const sorted = [...problems].sort((a, b) => b.impactValue - a.impactValue).slice(0, 6)
  const total = sorted.reduce((sum, item) => sum + item.impactValue, 0)
  let running = 0
  const cumulative = sorted.map((item) => Math.round((running += item.impactValue) / total * 100))
  return {
    animationDuration: 760, grid: { left: 38, right: 38, top: 28, bottom: 50 }, tooltip: { ...tooltip, trigger: 'axis' },
    xAxis: { type: 'category', data: sorted.map((item) => item.problemType.split('/').slice(-1)[0]), axisLabel: { color: color.text, fontSize: 9, rotate: 20, overflow: 'truncate', width: 60 }, axisLine: { lineStyle: { color: color.line } }, axisTick: { show: false } },
    yAxis: [{ type: 'value', name: '影响量', ...axis }, { type: 'value', min: 0, max: 100, axisLabel: { color: color.muted, fontSize: 9, formatter: '{value}%' }, splitLine: { show: false }, axisLine: { show: false }, axisTick: { show: false } }],
    series: [{ name: '影响量', type: 'bar', barMaxWidth: 22, data: sorted.map((item) => ({ value: item.impactValue, problemId: item.id, itemStyle: { color: item.id === activeProblemId ? healthColor[item.severity] : 'rgba(25,127,155,.54)', borderRadius: [3, 3, 0, 0] } })) }, { name: '累计占比', type: 'line', yAxisIndex: 1, data: cumulative, lineStyle: { color: color.amber, width: 2 }, itemStyle: { color: color.amber }, symbolSize: 5 }],
  }
}

export function buildInterventionTrendOption(problem: HealthProblem, records: InterventionRecord[]): EChartsOption {
  const labels = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00']
  const base = Math.max(12, problem.impactValue)
  const hasRecord = records.some((record) => record.problemId === problem.id)
  const values = hasRecord ? [base * .45, base * .58, base * .76, base, base * .82, base * .61, base * .42, base * .35] : [base * .38, base * .46, base * .57, base * .64, base * .78, base * .89, base, base * .94]
  const alertMarks = problem.alertEvents.map((event) => ({ name: event.levelLabel, xAxis: event.occurredAt.slice(0, 5), itemStyle: { color: event.level === 'third' || event.level === 'recurring' ? color.danger : color.amber } }))
  return {
    animationDuration: 760, grid: { left: 42, right: 20, top: 28, bottom: 32 }, tooltip: { ...tooltip, trigger: 'axis' },
    xAxis: { type: 'category', boundaryGap: false, data: labels, ...axis }, yAxis: { type: 'value', name: problem.impactUnit, ...axis },
    series: [{ name: '问题影响', type: 'line', smooth: .32, data: values.map(Math.round), symbolSize: 5, lineStyle: { color: color.danger, width: 2.3 }, itemStyle: { color: color.danger, borderColor: color.white, borderWidth: 2 }, areaStyle: { color: 'rgba(203,69,76,.10)' }, markPoint: { symbolSize: 42, label: { color: color.white, fontSize: 8, formatter: '{b}' }, data: alertMarks }, markLine: hasRecord ? { symbol: ['none', 'none'], label: { formatter: '干预记录', color: color.ai, fontSize: 9 }, lineStyle: { color: color.ai, type: 'dashed' }, data: [{ xAxis: '12:00' }] } : undefined }],
  }
}

export function buildClosureFunnelOption(problems: HealthProblem[]): EChartsOption {
  const counts = {
    detected: problems.length,
    alerted: problems.filter((item) => item.alertLevel !== 'normal').length,
    responded: problems.filter((item) => item.responseStatus !== '待响应').length,
    recorded: problems.filter((item) => item.responseStatus !== '缺记录' && item.responseStatus !== '待响应').length,
    verifying: problems.filter((item) => item.responseStatus === '待验证' || item.alertLevel === 'verifying').length,
    closed: problems.filter((item) => item.alertLevel === 'resolved').length,
  }
  return {
    animationDuration: 720, tooltip: { ...tooltip, trigger: 'item', formatter: '{b}：{c}项' },
    series: [{ type: 'funnel', left: '10%', top: 12, bottom: 10, width: '80%', min: 0, max: Math.max(1, counts.detected), minSize: '12%', maxSize: '100%', sort: 'descending', gap: 3, label: { show: true, position: 'inside', color: color.white, fontSize: 9, formatter: '{b} {c}' }, labelLine: { show: false }, itemStyle: { borderColor: color.white, borderWidth: 1, opacity: .88 }, data: [{ name: '发现问题', value: counts.detected, itemStyle: { color: color.cyan } }, { name: '触发预警', value: counts.alerted, itemStyle: { color: color.notice } }, { name: '已响应', value: counts.responded, itemStyle: { color: color.amber } }, { name: '有处理记录', value: counts.recorded, itemStyle: { color: '#a77729' } }, { name: '进入验证', value: counts.verifying, itemStyle: { color: color.ai } }, { name: '未复发', value: counts.closed, itemStyle: { color: '#4b8b75' } }] }],
  }
}
