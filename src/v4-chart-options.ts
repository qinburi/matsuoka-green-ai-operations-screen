import type { EChartsOption } from 'echarts'
import type {
  HealthProblem,
  LifecycleNode,
  LifecycleNodeId,
  ManagementInterventionEvidence,
  PeriodComparison,
  PeriodKey,
  PeriodMetric,
} from './types'

const palette = {
  ai: '#08a978',
  cyan: '#16a8d5',
  cyanSoft: '#74d8ee',
  blue: '#0753a6',
  ink: '#112b4a',
  muted: '#6a829c',
  amber: '#e49b20',
  danger: '#e5424d',
  white: '#ffffff',
}

const healthColors = {
  normal: palette.ai,
  notice: palette.cyan,
  warning: palette.amber,
  critical: palette.danger,
}

function metricText(node: LifecycleNode) {
  return `${node.coreMetric.label}  ${node.coreMetric.value}${node.coreMetric.unit}`
}

function lifecycleEdges(nodes: LifecycleNode[]) {
  return nodes.slice(0, -1).map((node, index) => ({
    source: node.id,
    target: nodes[index + 1].id,
    lineStyle: {
      color: index >= 2 && index <= 7 ? palette.cyan : palette.cyanSoft,
      width: index >= 2 && index <= 7 ? 3 : 2,
      opacity: index >= 2 && index <= 7 ? 0.72 : 0.5,
    },
  }))
}

function baseGraphic(title: string, subtitle: string): EChartsOption['graphic'] {
  return [
    {
      type: 'text',
      left: 24,
      top: 16,
      silent: true,
      style: { text: title, fill: palette.ink, font: '700 22px PingFang SC' },
    },
    {
      type: 'text',
      left: 24,
      top: 50,
      silent: true,
      style: { text: subtitle, fill: palette.muted, font: '12px PingFang SC' },
    },
  ]
}

export function buildLifecycleCanvasOption(
  nodes: LifecycleNode[],
  selectedNodeId: LifecycleNodeId,
  problem: HealthProblem,
): EChartsOption {
  const graphNodes = nodes.map((node, index) => ({
    id: node.id,
    nodeId: node.id,
    nodeType: 'lifecycle',
    name: node.shortLabel,
    x: index * 118,
    y: 200,
    symbol: 'roundRect',
    symbolSize: [112, 92],
    itemStyle: {
      color: node.id === selectedNodeId ? '#e9f9fd' : '#f8fcff',
      borderColor: healthColors[node.health],
      borderWidth: node.id === selectedNodeId ? 3 : 1.5,
      shadowBlur: node.id === selectedNodeId ? 24 : 10,
      shadowColor: `${healthColors[node.health]}38`,
      shadowOffsetY: 7,
    },
    label: {
      show: true,
      color: palette.ink,
      lineHeight: 20,
      formatter: `{order|${String(node.order).padStart(2, '0')}}  {name|${node.shortLabel}}\n{metric|${metricText(node)}}\n{issues|${node.issueCount} 次问题}  {state|${node.health === 'critical' ? '严重' : node.health === 'warning' ? '预警' : node.health === 'notice' ? '关注' : '正常'}}`,
      rich: {
        order: { color: palette.cyan, fontSize: 10, fontWeight: 700 },
        name: { color: palette.ink, fontSize: 15, fontWeight: 700 },
        metric: { color: '#365b7d', fontSize: 10 },
        issues: { color: palette.muted, fontSize: 10 },
        state: { color: healthColors[node.health], fontSize: 10, fontWeight: 700 },
      },
    },
  }))

  const issueNode = {
    id: problem.id,
    problemId: problem.id,
    nodeId: problem.nodeId,
    nodeType: 'issue',
    name: problem.title,
    x: 7 * 118,
    y: 42,
    symbol: 'circle',
    symbolSize: 38,
    itemStyle: {
      color: palette.danger,
      borderColor: palette.white,
      borderWidth: 4,
      shadowBlur: 24,
      shadowColor: 'rgba(229,66,77,.56)',
    },
    label: { show: true, formatter: '!', color: palette.white, fontSize: 20, fontWeight: 800 },
  }
  const paddingNodes = [
    { id: 'padding-left', name: '', x: -82, y: 300, symbolSize: 1, itemStyle: { opacity: 0 }, label: { show: false }, tooltip: { show: false } },
    { id: 'padding-right', name: '', x: 1144, y: 300, symbolSize: 1, itemStyle: { opacity: 0 }, label: { show: false }, tooltip: { show: false } },
  ]

  return {
    animationDuration: 950,
    animationEasing: 'cubicOut',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(14,45,76,.96)',
      borderColor: 'rgba(116,216,238,.58)',
      textStyle: { color: '#fff', fontSize: 12 },
      formatter: (params: any) => {
        if (params.data?.nodeType === 'issue') return `<b>${problem.title}</b><br/>${problem.impactValue} ${problem.impactUnit} · 三次警报<br/>点击查看已记录证据`
        const node = nodes.find((item) => item.id === params.data?.nodeId)
        return node ? `<b>${node.label}</b><br/>${node.coreMetric.definition}<br/>来源：${node.dataSource}` : ''
      },
    },
    graphic: baseGraphic('工厂生命周期态势', '十个可管理节点 · 点击节点查看状态 · 点击红色警报进入问题聚焦'),
    series: [
      {
        id: 'lifecycle-baseline',
        type: 'custom',
        coordinateSystem: 'none',
        silent: true,
        data: [0],
        renderItem: (_params: unknown, api: any) => ({
          type: 'group',
          children: [
            {
              type: 'line',
              shape: { x1: api.getWidth() * 0.055, y1: api.getHeight() * 0.64, x2: api.getWidth() * 0.945, y2: api.getHeight() * 0.64 },
              style: { stroke: 'rgba(22,168,213,.13)', lineWidth: 12, lineCap: 'round' },
            },
            {
              type: 'line',
              shape: { x1: api.getWidth() * 0.055, y1: api.getHeight() * 0.64, x2: api.getWidth() * 0.945, y2: api.getHeight() * 0.64 },
              style: { stroke: 'rgba(22,168,213,.36)', lineWidth: 1.5, lineDash: [7, 8] },
            },
          ],
        }),
      },
      {
        id: 'lifecycle-graph',
        type: 'graph',
        layout: 'none',
        left: '3.2%',
        right: '3.2%',
        top: '17%',
        bottom: '15%',
        roam: false,
        edgeSymbol: ['none', 'arrow'],
        edgeSymbolSize: [0, 8],
        emphasis: { focus: 'adjacency', scale: 1.04 },
        data: [...graphNodes, issueNode, ...paddingNodes],
        links: [
          ...lifecycleEdges(nodes),
          {
            source: problem.id,
            target: problem.nodeId,
            lineStyle: { color: palette.danger, width: 2, type: 'dashed', opacity: 0.76, curveness: 0.08 },
          },
        ],
        lineStyle: { color: palette.cyan, width: 2, opacity: 0.6 },
      },
    ],
  }
}

export function buildProblemFocusOption(
  nodes: LifecycleNode[],
  problem: HealthProblem,
  selectedRelationNodeId: string | null = problem.id,
  motionEnabled = true,
): EChartsOption {
  const traceNodeIds = new Set(problem.traceNodeIds)
  const compactNodes = nodes.map((node, index) => ({
    id: `context-${node.id}`,
    nodeId: node.id,
    nodeType: 'context',
    relationType: traceNodeIds.has(node.id) ? 'trace-pending' : 'lifecycle-context',
    source: node.dataSource,
    name: node.shortLabel,
    x: index * 112,
    y: 142,
    symbol: 'roundRect',
    symbolSize: [82, 38],
    itemStyle: {
      color: node.id === problem.nodeId ? '#fff3f5' : traceNodeIds.has(node.id) ? '#fff9ea' : 'rgba(248,252,255,.84)',
      borderColor: node.id === problem.nodeId ? palette.danger : traceNodeIds.has(node.id) ? palette.amber : 'rgba(22,168,213,.32)',
      borderWidth: selectedRelationNodeId === `context-${node.id}` ? 3 : node.id === problem.nodeId ? 2 : 1,
      opacity: selectedRelationNodeId && selectedRelationNodeId !== `context-${node.id}` && !traceNodeIds.has(node.id) ? 0.42 : 1,
      shadowBlur: selectedRelationNodeId === `context-${node.id}` ? 18 : 0,
      shadowColor: traceNodeIds.has(node.id) ? 'rgba(228,155,32,.3)' : 'rgba(22,168,213,.2)',
    },
    label: {
      show: true,
      formatter: traceNodeIds.has(node.id) ? `{name|${node.shortLabel}}\n{trace|待确认}` : node.shortLabel,
      color: node.id === problem.nodeId ? palette.danger : '#67829b',
      fontSize: 11,
      fontWeight: node.id === problem.nodeId ? 700 : 500,
      lineHeight: 15,
      rich: {
        name: { color: node.id === problem.nodeId ? palette.danger : palette.ink, fontSize: 11, fontWeight: 700 },
        trace: { color: palette.amber, fontSize: 8, fontWeight: 700 },
      },
    },
  }))

  const factNodes = problem.facts.map((fact, index) => ({
    id: `fact-${index}`,
    nodeType: 'fact',
    relationType: 'fact',
    source: fact.source,
    detail: `${fact.label}：${fact.value}`,
    name: fact.label,
    x: 170 + index * 250,
    y: 448,
    symbol: 'roundRect',
    symbolSize: [190, 92],
    itemStyle: {
      color: '#f4fcff',
      borderColor: palette.cyan,
      borderWidth: selectedRelationNodeId === `fact-${index}` ? 3 : 1.5,
      shadowBlur: selectedRelationNodeId === `fact-${index}` ? 26 : 18,
      shadowColor: 'rgba(22,168,213,.15)',
      shadowOffsetY: 8,
    },
    label: {
      show: true,
      lineHeight: 22,
      formatter: `{label|${fact.label}}\n{value|${fact.value}}\n{source|${fact.source.replace('演示：', '')}}`,
      rich: {
        label: { color: palette.muted, fontSize: 11 },
        value: { color: palette.ink, fontSize: 20, fontWeight: 700 },
        source: { color: palette.cyan, fontSize: 10 },
      },
    },
  }))

  const issueNode = {
    id: problem.id,
    problemId: problem.id,
    nodeId: problem.nodeId,
    nodeType: 'issue-focus',
    relationType: 'alert-fact',
    source: '演示：质量预警事件',
    detail: problem.summary,
    name: problem.title,
    x: 440,
    y: 252,
    symbol: 'roundRect',
    symbolSize: [340, 118],
    itemStyle: {
      color: '#123963',
      borderColor: palette.cyanSoft,
      borderWidth: selectedRelationNodeId === problem.id ? 4 : 2,
      shadowBlur: 30,
      shadowColor: 'rgba(7,83,166,.26)',
      shadowOffsetY: 12,
    },
    label: {
      show: true,
      lineHeight: 27,
      formatter: `{eyebrow|SEVERE ALERT · 已记录事实}\n{title|${problem.title}}\n{meta|${problem.impactValue} ${problem.impactUnit}  ·  ${problem.identity.styleNo} / ${problem.identity.batch}}`,
      rich: {
        eyebrow: { color: '#77e2f3', fontSize: 10, fontWeight: 700 },
        title: { color: palette.white, fontSize: 22, fontWeight: 700 },
        meta: { color: '#bdd9ee', fontSize: 12 },
      },
    },
  }

  const focusPaddingNodes = [
    { id: 'focus-padding-left', name: '', x: -100, y: 520, symbolSize: 1, itemStyle: { opacity: 0 }, label: { show: false }, tooltip: { show: false } },
    { id: 'focus-padding-right', name: '', x: 1110, y: 520, symbolSize: 1, itemStyle: { opacity: 0 }, label: { show: false }, tooltip: { show: false } },
  ]

  const lifecycleLinks = compactNodes.slice(0, -1).map((node, index) => ({
    source: node.id,
    target: compactNodes[index + 1].id,
    relationType: 'lifecycle-context',
    lineStyle: { color: 'rgba(22,168,213,.28)', width: 1.5, opacity: 0.48 },
  }))
  const traceLinks = problem.traceNodeIds.slice(0, -1).map((nodeId, index) => ({
    source: `context-${nodeId}`,
    target: `context-${problem.traceNodeIds[index + 1]}`,
    relationType: 'trace-pending',
    lineStyle: { color: palette.amber, width: 2.2, type: 'dashed' as const, opacity: 0.78, curveness: 0.08 },
  }))
  const factLinks = factNodes.map((factNode) => ({
    source: problem.id,
    target: factNode.id,
    relationType: 'fact',
    lineStyle: { color: palette.cyan, width: 2.5, opacity: 0.72, curveness: 0.04 },
  }))
  const alertLink = {
    source: `context-${problem.nodeId}`,
    target: problem.id,
    relationType: 'alert-fact',
    lineStyle: { color: palette.danger, width: 2, type: 'dashed' as const, opacity: 0.68 },
  }
  const links = [
    ...lifecycleLinks,
    ...traceLinks,
    ...factLinks,
    alertLink,
  ].map((link) => ({
    ...link,
    lineStyle: {
      ...link.lineStyle,
      opacity: !selectedRelationNodeId || selectedRelationNodeId === problem.id || link.source === selectedRelationNodeId || link.target === selectedRelationNodeId
        ? link.lineStyle.opacity ?? 0.78
        : 0.15,
    },
  }))

  return {
    animationDuration: motionEnabled ? 900 : 0,
    animationDurationUpdate: motionEnabled ? 900 : 0,
    animationEasingUpdate: 'cubicInOut',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(14,45,76,.96)',
      borderColor: 'rgba(116,216,238,.58)',
      textStyle: { color: '#fff', fontSize: 12 },
      formatter: (params: any) => {
        if (params.data?.nodeType === 'fact') return `<b>${params.data.detail}</b><br/>${params.data.source}<br/>冷青实线 · 已记录事实`
        if (params.data?.relationType === 'trace-pending') return `<b>${params.name}</b><br/>${params.data.source}<br/>琥珀虚线 · 追溯范围待现场确认`
        if (params.data?.nodeType === 'issue-focus') return `<b>${problem.title}</b><br/>${problem.summary}`
        return params.name
      },
    },
    graphic: baseGraphic('问题关联总览 · 已记录事实', '生命周期保留为追溯上下文 · 琥珀虚线为待现场确认范围 · 点击节点查看来源'),
    series: [{
      id: 'lifecycle-graph',
      type: 'graph',
      layout: 'none',
      left: '4%',
      right: '4%',
      top: '22%',
      bottom: '5%',
      roam: false,
      edgeSymbol: ['none', 'arrow'],
      edgeSymbolSize: [0, 7],
      data: [...compactNodes, issueNode, ...factNodes, ...focusPaddingNodes],
      links,
      lineStyle: { color: palette.cyan, width: 2, opacity: 0.56 },
      emphasis: { focus: 'adjacency', scale: 1.03 },
    }],
  }
}

const lightTooltip = {
  backgroundColor: 'rgba(14,45,76,.96)',
  borderColor: 'rgba(116,216,238,.58)',
  textStyle: { color: '#fff', fontSize: 11 },
}

const cartesianAxis = {
  axisLine: { lineStyle: { color: 'rgba(37,112,154,.2)' } },
  axisTick: { show: false },
  axisLabel: { color: palette.muted, fontSize: 10 },
  splitLine: { lineStyle: { color: 'rgba(37,112,154,.09)' } },
}

export function buildPeriodComparisonOption(
  data: PeriodComparison[],
  metric: PeriodMetric,
  selectedPeriod: PeriodKey,
): EChartsOption {
  return {
    animationDuration: 720,
    grid: { left: 42, right: 16, top: 28, bottom: 34 },
    tooltip: {
      ...lightTooltip,
      trigger: 'axis',
      formatter: (params: any) => {
        const item = data[params[0]?.dataIndex]
        return item ? `<b>${item.label} · ${item.definition}</b><br/>当前：${item.currentValue}${item.unit}<br/>对比：${item.comparisonValue}${item.unit}<br/>变化：${item.changeRate > 0 ? '+' : ''}${item.changeRate}%` : ''
      },
    },
    xAxis: { type: 'category', data: data.map((item) => item.label), ...cartesianAxis },
    yAxis: { type: 'value', name: data[0]?.unit, ...cartesianAxis },
    series: [
      {
        name: '对比期',
        type: 'bar',
        barWidth: 15,
        data: data.map((item) => ({ value: item.comparisonValue, period: item.period, itemStyle: { color: 'rgba(22,168,213,.22)', borderRadius: [3, 3, 0, 0] } })),
      },
      {
        name: metric === 'duration' ? '当前响应时长' : '当前期',
        type: 'bar',
        barWidth: 19,
        data: data.map((item) => ({
          value: item.currentValue,
          period: item.period,
          itemStyle: {
            color: item.period === selectedPeriod ? palette.blue : palette.cyan,
            borderColor: item.period === selectedPeriod ? palette.white : 'transparent',
            borderWidth: item.period === selectedPeriod ? 1 : 0,
            borderRadius: [4, 4, 0, 0],
            shadowBlur: item.period === selectedPeriod ? 10 : 0,
            shadowColor: 'rgba(7,83,166,.25)',
          },
        })),
        label: { show: true, position: 'top', color: palette.ink, fontSize: 9, formatter: (params: any) => `${params.value}` },
      },
    ],
  }
}

export function buildEvidenceTrendOption(problem: HealthProblem): EChartsOption {
  const labels = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00']
  const values = [1.2, 2.4, 1.6, 2.8, 1.9, 3.1, 2.7]
  const alertPoints = problem.alertEvents.map((event, index) => ({
    name: event.levelLabel,
    value: [event.occurredAt.slice(0, 2) + ':00', values[Math.min(index * 2 + 1, values.length - 1)]],
    eventId: event.id,
    occurrence: index + 1,
    itemStyle: { color: index === 2 ? palette.danger : palette.amber, borderColor: palette.white, borderWidth: 2 },
  }))
  return {
    animationDuration: 860,
    grid: { left: 48, right: 22, top: 42, bottom: 42 },
    tooltip: { ...lightTooltip, trigger: 'axis', valueFormatter: (value: unknown) => `${value}%` },
    xAxis: { type: 'category', boundaryGap: false, data: labels, ...cartesianAxis },
    yAxis: { type: 'value', name: '缝皱不良率 %', min: 0, max: 4, ...cartesianAxis },
    series: [
      {
        type: 'line',
        name: '缝皱不良率',
        data: values,
        smooth: 0.28,
        symbolSize: 6,
        lineStyle: { color: palette.cyan, width: 3 },
        itemStyle: { color: palette.white, borderColor: palette.cyan, borderWidth: 2 },
        areaStyle: { color: 'rgba(22,168,213,.09)' },
        markArea: { silent: true, itemStyle: { color: 'rgba(229,66,77,.055)' }, data: [[{ xAxis: '09:00' }, { xAxis: '14:00' }]] },
        markLine: { silent: true, symbol: ['none', 'none'], label: { formatter: '标准阈值 2.0%', color: palette.amber, fontSize: 10 }, lineStyle: { color: palette.amber, type: 'dashed' }, data: [{ yAxis: 2 }] },
      },
      {
        type: 'scatter',
        name: '预警事件',
        data: alertPoints,
        symbolSize: 22,
        z: 5,
        label: { show: true, position: 'top', distance: 7, color: palette.ink, fontSize: 9, fontWeight: 700, formatter: (params: any) => `${params.data.occurrence} · ${params.data.name}` },
      },
    ],
  }
}

export function buildCandidateEvidenceOption(data: readonly { category: string; completeness: number; priority: number; dataCondition: number; label: string }[]): EChartsOption {
  const dimensions = ['证据完整度', '检查优先级', '数据条件']
  return {
    animationDuration: 820,
    grid: { left: 78, right: 24, top: 34, bottom: 34 },
    tooltip: { ...lightTooltip, formatter: (params: any) => `${params.data.category} · 候选原因/待现场确认<br/>${dimensions[params.data.value[0]]}：${params.data.value[2]}%<br/>${params.data.candidateLabel}` },
    xAxis: { type: 'category', data: dimensions, ...cartesianAxis },
    yAxis: { type: 'category', inverse: true, data: data.map((item) => item.category), ...cartesianAxis },
    visualMap: { min: 0, max: 100, show: false, inRange: { color: ['#e5f5fa', '#54bfdc', '#0875ad'] } },
    series: [{
      type: 'heatmap',
      data: data.flatMap((item, row) => [
        { value: [0, row, item.completeness], category: item.category, candidateLabel: item.label },
        { value: [1, row, item.priority], category: item.category, candidateLabel: item.label },
        { value: [2, row, item.dataCondition], category: item.category, candidateLabel: item.label },
      ]),
      label: { show: true, color: palette.ink, fontSize: 10, formatter: (params: any) => `${params.value[2]}%` },
      itemStyle: { borderColor: '#f7fcff', borderWidth: 5, borderRadius: 4 },
      emphasis: { itemStyle: { shadowBlur: 12, shadowColor: 'rgba(7,83,166,.2)' } },
    }],
  }
}

export function buildActionPriorityOption(data: readonly { id: string; label: string; difficulty: number; impact: number; verificationHours: number; dataReadiness: number; category: string }[]): EChartsOption {
  return {
    animationDuration: 760,
    grid: { left: 44, right: 24, top: 32, bottom: 42 },
    tooltip: { ...lightTooltip, formatter: (params: any) => `<b>${params.data.label}</b><br/>检查顺序：${params.dataIndex + 1}<br/>实施难度：${params.value[0]}<br/>预期影响：${params.value[1]}<br/>验证周期：${params.data.verificationHours}小时<br/>数据条件：${params.data.dataReadiness}%` },
    xAxis: { type: 'value', name: '实施难度', min: 0, max: 100, ...cartesianAxis },
    yAxis: { type: 'value', name: '预期影响', min: 0, max: 100, ...cartesianAxis },
    series: [{
      type: 'scatter',
      data: data.map((item, index) => ({
        ...item,
        value: [item.difficulty, item.impact, item.dataReadiness],
        symbolSize: 18 + item.dataReadiness * 0.18,
        itemStyle: { color: index < 2 ? palette.ai : palette.amber, opacity: 0.82, borderColor: '#fff', borderWidth: 2 },
        label: { show: true, position: 'top', color: palette.ink, fontSize: 9, formatter: `${index + 1} · ${item.category}` },
      })),
      labelLayout: { hideOverlap: true },
      markArea: { silent: true, itemStyle: { color: 'rgba(8,169,120,.055)' }, data: [[{ xAxis: 0, yAxis: 70 }, { xAxis: 45, yAxis: 100 }]] },
    }],
  }
}

export function buildManagementEffectivenessOption(data: ManagementInterventionEvidence[]): EChartsOption {
  const stabilityColors = { observing: palette.amber, pass: '#16a8d5', good: palette.ai, excellent: '#0753a6', recurred: palette.danger }
  return {
    animationDuration: 820,
    grid: { left: 52, right: 26, top: 34, bottom: 48 },
    tooltip: { ...lightTooltip, formatter: (params: any) => `<b>${params.data.problemLabel}</b><br/>厂长介入响应：${params.value[0]}分钟<br/>无复发/复发间隔：${params.value[1]}天<br/>影响量：${params.data.impactValue}<br/>协调动作：${params.data.coordinationActionsCompleted}/${params.data.coordinationActionsTotal}<br/>证据完整度：${params.data.evidenceCompleteness}%<br/>同期关系，不代表已验证因果关系` },
    xAxis: { type: 'value', name: '第三次警报至厂长介入（分钟）', min: 0, max: 60, ...cartesianAxis },
    yAxis: { type: 'value', name: '干预后无复发天数', min: 0, max: 120, ...cartesianAxis },
    series: [{
      type: 'scatter',
      data: data.map((item) => ({
        ...item,
        value: [item.managerResponseMinutes, item.nonRecurrenceDays],
        symbolSize: 20 + item.impactValue * 0.38,
        itemStyle: { color: stabilityColors[item.stabilityLevel], opacity: 0.78, borderColor: '#fff', borderWidth: 2 },
        label: { show: true, position: 'top', color: palette.ink, fontSize: 9, formatter: item.problemLabel },
      })),
      markLine: {
        silent: true,
        symbol: ['none', 'none'],
        label: { color: palette.muted, fontSize: 9 },
        lineStyle: { color: 'rgba(7,83,166,.2)', type: 'dashed' },
        data: [{ yAxis: 7, name: '7天' }, { yAxis: 30, name: '30天' }, { yAxis: 90, name: '90天' }],
      },
    }],
  }
}

export function buildValidationTimelineOption(): EChartsOption {
  const stages = [
    { name: '系统警报', time: '13:52', state: 'complete', note: '第三次触发' },
    { name: '待干预', time: '当前', state: 'active', note: '检查顺序已生成' },
    { name: '现场检查', time: '--', state: 'pending', note: '需补参数与首件证据' },
    { name: '验证通过', time: '--', state: 'pending', note: '连续2个检验窗口' },
    { name: '稳定观察', time: '--', state: 'pending', note: '7 / 30 / 90天' },
  ]
  return {
    animationDuration: 700,
    tooltip: { ...lightTooltip, formatter: (params: any) => `${params.data.name}<br/>${params.data.note}<br/>时间：${params.data.time}` },
    xAxis: { type: 'category', boundaryGap: true, data: stages.map((item) => item.name), axisLabel: { color: palette.ink, fontSize: 9, interval: 0 }, axisLine: { lineStyle: { color: 'rgba(22,168,213,.22)' } }, axisTick: { show: false } },
    yAxis: { show: false, min: 0, max: 2 },
    grid: { left: 18, right: 18, top: 24, bottom: 34 },
    series: [{
      type: 'line',
      data: stages.map((item, index) => ({ ...item, value: 1, itemStyle: { color: item.state === 'complete' ? palette.cyan : item.state === 'active' ? palette.danger : '#cbd9e3' }, label: { show: true, position: 'top', color: item.state === 'active' ? palette.danger : palette.muted, fontSize: 9, formatter: item.time } })),
      symbolSize: 18,
      lineStyle: { color: 'rgba(22,168,213,.3)', width: 2 },
    }],
  }
}
