<script setup lang="ts">
import * as echarts from 'echarts/core'
import type { EChartsCoreOption } from 'echarts/core'
import { BarChart, GraphChart, LineChart, ScatterChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { DataState } from '../types'

echarts.use([
  BarChart,
  GraphChart,
  LineChart,
  ScatterChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer,
])

const props = withDefaults(defineProps<{
  option: EChartsCoreOption
  state?: DataState | 'loading'
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
  resizeObserver = new ResizeObserver(() => chart?.resize())
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
      <strong>正在重算分析切片</strong>
      <small>清洗数据与知识索引正在对齐</small>
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
    <div v-if="state === 'stale'" class="chart-stale">数据已超过演示时效，结论需复核</div>
  </div>
</template>
