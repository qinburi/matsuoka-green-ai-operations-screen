<script setup lang="ts">
import * as echarts from 'echarts/core'
import type { EChartsCoreOption } from 'echarts/core'
import { BarChart, CustomChart, FunnelChart, GraphChart, HeatmapChart, LineChart, PieChart, RadarChart, SankeyChart, ScatterChart } from 'echarts/charts'
import { DataZoomComponent, DatasetComponent, GraphicComponent, GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent, PolarComponent, RadarComponent, TitleComponent, TooltipComponent, VisualMapComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { DataState } from '../types'

echarts.use([
  BarChart,
  CustomChart,
  FunnelChart,
  GraphChart,
  HeatmapChart,
  LineChart,
  PieChart,
  RadarChart,
  SankeyChart,
  ScatterChart,
  DataZoomComponent,
  DatasetComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  PolarComponent,
  RadarComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
  CanvasRenderer,
])

const props = withDefaults(defineProps<{
  option: EChartsCoreOption
  state?: DataState
  emptyText?: string
}>(), {
  state: 'normal',
  emptyText: '当前筛选条件下暂无数据',
})

const emit = defineEmits<{
  select: [payload: unknown]
}>()

const chartEl = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null
let resizeObserver: ResizeObserver | null = null

function renderChart() {
  if (!chart || props.state !== 'normal' && props.state !== 'stale') return
  chart.setOption(props.option, { notMerge: true, lazyUpdate: false })
}

onMounted(async () => {
  await nextTick()
  if (!chartEl.value) return
  chart = echarts.init(chartEl.value, undefined, { renderer: 'canvas' })
  chart.on('click', (params) => emit('select', params.data))
  resizeObserver = new ResizeObserver(() => window.requestAnimationFrame(() => chart?.resize()))
  resizeObserver.observe(chartEl.value)
  renderChart()
})

watch(() => props.option, renderChart, { deep: true })
watch(() => props.state, async () => {
  await nextTick()
  if (props.state === 'normal' || props.state === 'stale') renderChart()
  else chart?.clear()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  chart?.dispose()
})
</script>

<template>
  <div class="chart-shell">
    <div ref="chartEl" class="chart-canvas" aria-hidden="true" />
    <div v-if="state === 'loading'" class="chart-state chart-state--loading" role="status">
      <span class="state-loader" />
      <strong>正在更新分析结果</strong>
      <small>请稍候，当前图表将自动刷新</small>
    </div>
    <div v-else-if="state === 'empty'" class="chart-state" role="status">
      <strong>暂无可分析数据</strong>
      <small>{{ emptyText }}</small>
    </div>
    <div v-else-if="state === 'error'" class="chart-state chart-state--error" role="alert">
      <strong>分析数据加载失败</strong>
      <small>请检查数据源连接或稍后重试</small>
    </div>
    <div v-else-if="state === 'forbidden'" class="chart-state" role="alert">
      <strong>当前账号无权查看</strong>
      <small>需由管理员授予生产诊断数据权限</small>
    </div>
    <div v-else-if="state === 'metric-conflict'" class="chart-state chart-state--error" role="alert">
      <strong>指标口径存在冲突</strong>
      <small>已暂停原因、责任与改善结论，请先确认统计口径</small>
    </div>
    <div v-if="state === 'stale'" class="chart-stale">数据已超过演示时效，结论需复核</div>
  </div>
</template>
