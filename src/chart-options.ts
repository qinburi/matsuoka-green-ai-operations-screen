import type { EChartsOption } from 'echarts'
import type { Issue, TopicDataset, TopicId } from './types'

const colors = {
  ai: '#39d98a',
  cyan: '#59cbe8',
  amber: '#e6ad4e',
  danger: '#e66b64',
  text: '#f3f6f7',
  muted: '#91a0a8',
  line: 'rgba(180, 203, 213, 0.13)',
  surface: '#11191e',
}

const severityColor = {
  critical: colors.danger,
  warning: colors.amber,
  attention: colors.cyan,
}

const axis = {
  axisLine: { lineStyle: { color: 'rgba(180, 203, 213, 0.2)' } },
  axisTick: { show: false },
  axisLabel: { color: colors.muted, fontSize: 11 },
  splitLine: { lineStyle: { color: colors.line } },
}

export function buildProblemMapOption(
  topic: TopicId,
  issues: Issue[],
  selectedId: string | null,
): EChartsOption {
  if (topic === 'improvement') return buildImprovementGraph(issues, selectedId)

  const xName = topic === 'quality' ? '出现频次' : '异常触发频次'
  const yName = topic === 'quality' ? '影响数量' : '延误风险量'

  return {
    animationDuration: 700,
    animationDurationUpdate: 520,
    animationEasingUpdate: 'cubicOut',
    grid: { left: 56, right: 26, top: 34, bottom: 46 },
    tooltip: {
      trigger: 'item',
      backgroundColor: '#10171c',
      borderColor: 'rgba(89, 203, 232, 0.35)',
      textStyle: { color: colors.text },
      formatter: (params: any) => {
        const data = params.data
        return `<strong>${data.name}</strong><br/>${xName}：${data.value[0]}<br/>${yName}：${data.value[1]} ${data.unit}<br/>AI置信度：${Math.round(data.confidence * 100)}%`
      },
    },
    xAxis: {
      type: 'value',
      name: xName,
      nameLocation: 'middle',
      nameGap: 29,
      nameTextStyle: { color: colors.muted },
      min: 0,
      max: Math.max(20, Math.ceil(Math.max(...issues.map((item) => item.occurrence)) / 5) * 5 + 2),
      ...axis,
    },
    yAxis: {
      type: 'value',
      name: yName,
      nameTextStyle: { color: colors.muted, padding: [0, 0, 8, 0] },
      min: 0,
      max: Math.ceil(Math.max(...issues.map((item) => item.impact)) * 1.25),
      ...axis,
    },
    series: [{
      type: 'scatter',
      data: issues.map((item) => ({
        name: item.shortLabel,
        issueId: item.id,
        confidence: item.confidence,
        unit: item.impactUnit,
        value: [item.occurrence, item.impact, item.confidence],
        symbolSize: Math.max(48, Math.min(88, 34 + item.impact * (topic === 'quality' ? 1.5 : 0.16))),
        itemStyle: {
          color: severityColor[item.severity],
          opacity: selectedId && selectedId !== item.id ? 0.42 : 0.9,
          borderColor: selectedId === item.id ? '#ffffff' : 'rgba(255,255,255,0.34)',
          borderWidth: selectedId === item.id ? 2 : 1,
          shadowBlur: selectedId === item.id ? 24 : 12,
          shadowColor: severityColor[item.severity],
        },
      })),
      label: {
        show: true,
        position: 'inside',
        color: '#ffffff',
        fontWeight: 600,
        fontSize: 11,
        formatter: (params: any) => params.data.name,
      },
      emphasis: { scale: 1.08, focus: 'self' },
    }],
  }
}

function buildImprovementGraph(issues: Issue[], selectedId: string | null): EChartsOption {
  const nodes: any[] = []
  const links: any[] = []
  const count = issues.length

  issues.forEach((item, index) => {
    const y = 70 + index * (330 / Math.max(1, count - 1))
    const issueNode = `issue-${item.id}`
    const solutionNode = `solution-${item.id}`
    const ownerNode = `owner-${item.id}`
    nodes.push(
      {
        id: issueNode,
        name: item.shortLabel,
        issueId: item.id,
        x: 86,
        y,
        symbolSize: selectedId === item.id ? 74 : 60,
        category: 0,
        itemStyle: { color: severityColor[item.severity], opacity: selectedId && selectedId !== item.id ? 0.48 : 0.92 },
      },
      {
        id: solutionNode,
        name: item.solutions[0].title,
        issueId: item.id,
        x: 380,
        y,
        symbol: 'roundRect',
        symbolSize: [144, 42],
        category: 1,
        itemStyle: { color: '#17362d', borderColor: colors.ai, borderWidth: 1 },
      },
      {
        id: ownerNode,
        name: item.responsibility.role,
        issueId: item.id,
        x: 680,
        y,
        symbol: 'roundRect',
        symbolSize: [150, 42],
        category: 2,
        itemStyle: { color: '#132b33', borderColor: colors.cyan, borderWidth: 1 },
      },
    )
    links.push(
      { source: issueNode, target: solutionNode },
      { source: solutionNode, target: ownerNode },
    )
  })

  return {
    animationDuration: 760,
    tooltip: {
      trigger: 'item',
      backgroundColor: '#10171c',
      borderColor: 'rgba(57, 217, 138, 0.35)',
      textStyle: { color: colors.text },
    },
    legend: [{
      top: 4,
      right: 8,
      data: ['问题', '改善动作', '建议责任岗位'],
      textStyle: { color: colors.muted },
      itemWidth: 10,
      itemHeight: 10,
    }],
    series: [{
      type: 'graph',
      layout: 'none',
      roam: true,
      data: nodes,
      links,
      categories: [{ name: '问题' }, { name: '改善动作' }, { name: '建议责任岗位' }],
      lineStyle: { color: colors.ai, width: 1.5, opacity: 0.62, curveness: 0.08 },
      edgeSymbol: ['none', 'arrow'],
      edgeSymbolSize: 7,
      label: { show: true, color: colors.text, fontSize: 10, width: 122, overflow: 'truncate' },
      emphasis: { focus: 'adjacency', lineStyle: { width: 3, opacity: 1 } },
    }],
  }
}

export function buildRankingOption(topic: TopicId, issues: Issue[]): EChartsOption {
  const sorted = [...issues].sort((a, b) => b.impact - a.impact)
  return {
    animationDuration: 620,
    grid: { left: 86, right: 26, top: 18, bottom: 28 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#10171c',
      borderColor: 'rgba(89, 203, 232, 0.35)',
      textStyle: { color: colors.text },
    },
    xAxis: { type: 'value', ...axis },
    yAxis: {
      type: 'category',
      inverse: true,
      data: sorted.map((item) => item.shortLabel),
      axisLabel: { color: colors.text, fontSize: 11 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [{
      type: 'bar',
      barWidth: 10,
      data: sorted.map((item) => ({
        value: item.impact,
        issueId: item.id,
        itemStyle: { color: severityColor[item.severity], borderRadius: [0, 2, 2, 0] },
      })),
      label: {
        show: true,
        position: 'right',
        color: colors.text,
        fontSize: 10,
        formatter: (params: any) => `${params.value} ${sorted[params.dataIndex].impactUnit}`,
      },
    }],
  }
}

export function buildTrendOption(dataset: TopicDataset): EChartsOption {
  const isQuality = dataset.id === 'quality'
  return {
    animationDuration: 760,
    grid: { left: 48, right: 24, top: 24, bottom: 34 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#10171c',
      borderColor: 'rgba(57, 217, 138, 0.35)',
      textStyle: { color: colors.text },
      valueFormatter: (value: unknown) => `${value}${isQuality ? '%' : dataset.id === 'efficiency' ? '%' : '项'}`,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dataset.trendLabels,
      ...axis,
    },
    yAxis: {
      type: 'value',
      scale: true,
      ...axis,
      axisLabel: { color: colors.muted, fontSize: 10, formatter: `{value}${dataset.id === 'improvement' ? '' : '%'}` },
    },
    series: [{
      name: dataset.id === 'quality' ? '不良率' : dataset.id === 'efficiency' ? '计划达成率' : '可执行方案',
      type: 'line',
      smooth: 0.35,
      symbol: 'circle',
      symbolSize: 6,
      data: dataset.trend,
      lineStyle: { width: 2, color: colors.ai },
      itemStyle: { color: colors.ai, borderColor: '#0c1216', borderWidth: 2 },
      areaStyle: { color: 'rgba(57, 217, 138, 0.08)' },
    }],
  }
}
