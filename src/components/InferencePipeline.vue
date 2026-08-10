<script setup lang="ts">
defineProps<{
  activeStep: number
  analyzing: boolean
}>()

const stages = [
  { label: '数据校验', detail: '完整率 98.6%' },
  { label: '知识召回', detail: '命中 14 条' },
  { label: 'CPU小模型', detail: '规则 + 轻量推理' },
  { label: '建议生成', detail: '可解释输出' },
]
</script>

<template>
  <section class="inference-pipeline" :class="{ 'is-analyzing': analyzing }" aria-label="绿色AI分析过程">
    <div class="pipeline-intro">
      <span class="pipeline-chip">GREEN AI</span>
      <strong>{{ analyzing ? '正在重新分析' : '轻量诊断已完成' }}</strong>
      <small>CPU 运行·无需 GPU</small>
    </div>
    <ol class="pipeline-steps">
      <li
        v-for="(stage, index) in stages"
        :key="stage.label"
        :class="{ 'is-active': activeStep === index, 'is-done': activeStep > index || !analyzing }"
      >
        <span class="pipeline-index">0{{ index + 1 }}</span>
        <span class="pipeline-copy">
          <strong>{{ stage.label }}</strong>
          <small>{{ stage.detail }}</small>
        </span>
      </li>
    </ol>
  </section>
</template>
