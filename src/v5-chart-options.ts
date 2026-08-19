import type { EChartsOption } from 'echarts'
import type { ProblemClosureTimeline, ProblemTrendProfile, ProblemTrendSeries } from './types'

const colors = {
  ink: '#17242e',
  muted: '#6f7f8a',
  line: '#dfe7eb',
  danger: '#df3546',
  cyan: '#27a5c4',
  emerald: '#159775',
  amber: '#db922c',
}

function timeLabel(value: string | null) {
  if (!value) return null
  const match = /T(\d{2}):(\d{2})/.exec(value)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour < 8 || hour > 17) return null
  return `${String(minute >= 30 && hour < 17 ? hour + 1 : hour).padStart(2, '0')}:00`
}

export function buildPulseTrendOption(
  profile: ProblemTrendProfile,
  snapshot: ProblemTrendSeries,
  timeline: ProblemClosureTimeline,
  motionEnabled = true,
): EChartsOption {
  const stages = [
    { name: '问题发生', at: timeline.occurredAt, color: colors.danger },
    { name: '首次响应', at: timeline.responseAt, color: colors.cyan },
    { name: '实际处理', at: timeline.handledAt, color: colors.amber },
    { name: '验证完成', at: timeline.verifiedAt, color: colors.emerald },
  ]
  const eventPoints = snapshot.granularity === 'hour'
    ? stages.flatMap((stage) => {
        const label = timeLabel(stage.at)
        const index = label ? snapshot.labels.indexOf(label) : -1
        if (index < 0) return []
        return [{
          name: stage.name,
          coord: [label as string, snapshot.currentValues[index] ?? 0] as [string, number],
          value: stage.name,
          symbol: 'circle',
          symbolSize: 14,
          itemStyle: { color: stage.color, borderColor: '#ffffff', borderWidth: 3, shadowBlur: 10, shadowColor: `${stage.color}66` },
          label: { show: true, position: 'top' as const, distance: 22, formatter: stage.name, color: stage.color, fontSize: 10, fontWeight: 700 },
        }]
      })
    : []

  return {
    animation: motionEnabled,
    animationDuration: 720,
    animationEasing: 'cubicOut',
    color: [colors.danger, colors.cyan],
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(23,36,46,.96)',
      borderWidth: 0,
      padding: [10, 12],
      textStyle: { color: '#ffffff', fontSize: 12 },
      axisPointer: { type: 'line', lineStyle: { color: 'rgba(39,165,196,.45)' } },
      valueFormatter: (value) => `${value ?? '--'} ${profile.unit}`,
    },
    legend: {
      top: 6,
      right: 8,
      itemWidth: 20,
      itemHeight: 3,
      textStyle: { color: colors.muted, fontSize: 11 },
      data: [snapshot.currentLabel, snapshot.comparisonLabel],
    },
    grid: { left: 58, right: 24, top: 50, bottom: snapshot.labels.length > 16 ? 52 : 38, containLabel: false },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: snapshot.labels,
      axisLine: { lineStyle: { color: colors.line } },
      axisTick: { show: false },
      axisLabel: { color: colors.muted, fontSize: 11, interval: snapshot.labels.length > 16 ? 'auto' : 0, hideOverlap: true },
    },
    yAxis: {
      type: 'value',
      name: profile.unit,
      nameTextStyle: { color: colors.muted, padding: [0, 28, 4, 0] },
      min: 0,
      axisLabel: { color: colors.muted, fontSize: 11 },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#e8eef1' } },
    },
    dataZoom: snapshot.labels.length > 18 ? [{ type: 'inside', start: 0, end: 100 }] : [],
    series: [
      {
        id: 'current-period',
        name: snapshot.currentLabel,
        type: 'line',
        smooth: 0.3,
        symbol: 'circle',
        symbolSize: 6,
        showSymbol: snapshot.labels.length <= 14,
        data: snapshot.currentValues,
        lineStyle: { color: colors.danger, width: 3.5 },
        itemStyle: { color: colors.danger, borderColor: '#ffffff', borderWidth: 2 },
        label: {
          show: snapshot.labels.length <= 14,
          position: 'top',
          distance: 7,
          formatter: `{c}${profile.unit}`,
          color: colors.danger,
          fontSize: 10,
          fontWeight: 700,
          backgroundColor: 'rgba(255,255,255,.86)',
          borderRadius: 2,
          padding: [2, 3],
        },
        areaStyle: { color: 'rgba(223,53,70,.065)' },
        markArea: {
          silent: true,
          label: { show: false },
          itemStyle: { color: 'rgba(21,151,117,.07)' },
          data: [[{ yAxis: 0 }, { yAxis: profile.normalMax }]],
        },
        markLine: {
          symbol: 'none',
          label: { color: colors.amber, fontSize: 10, formatter: `管理阈值 ${profile.normalMax}${profile.unit}` },
          lineStyle: { color: colors.amber, width: 1.5, type: 'dashed' },
          data: [{ yAxis: profile.normalMax }],
        },
        markPoint: { silent: true, data: eventPoints },
        emphasis: { focus: 'series' },
      },
      {
        id: 'comparison-period',
        name: snapshot.comparisonLabel,
        type: 'line',
        smooth: 0.3,
        symbol: 'none',
        data: snapshot.comparisonValues,
        lineStyle: { color: colors.cyan, width: 2, opacity: 0.78 },
        emphasis: { focus: 'series' },
      },
    ],
  }
}

export function buildPulseEfficiencyGaugeOption(
  elapsedMinutes: number,
  targetMinutes: number | null,
  overdue: boolean,
  motionEnabled = true,
): EChartsOption {
  const ratio = targetMinutes && targetMinutes > 0 ? Math.min(120, elapsedMinutes / targetMinutes * 100) : 0
  return {
    animation: motionEnabled,
    animationDuration: 620,
    series: [{
      type: 'gauge',
      min: 0,
      max: 120,
      startAngle: 205,
      endAngle: -25,
      radius: '96%',
      center: ['50%', '60%'],
      splitNumber: 6,
      progress: { show: true, roundCap: true, width: 10, itemStyle: { color: overdue ? colors.danger : ratio >= 80 ? colors.amber : colors.emerald } },
      axisLine: { roundCap: true, lineStyle: { width: 10, color: [[0.67, '#dff1eb'], [0.84, '#f6ead8'], [1, '#f5dce0']] } },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      pointer: { length: '52%', width: 4, itemStyle: { color: colors.ink } },
      anchor: { show: true, size: 9, itemStyle: { color: colors.ink, borderColor: '#ffffff', borderWidth: 3 } },
      title: { show: true, offsetCenter: [0, '55%'], color: colors.muted, fontSize: 10 },
      detail: { valueAnimation: motionEnabled, offsetCenter: [0, '12%'], color: colors.ink, fontSize: 21, fontWeight: 800, formatter: `${elapsedMinutes} min` },
      data: [{ value: ratio, name: targetMinutes ? `目标 ${targetMinutes} min` : '目标待配置' }],
    }],
  }
}
