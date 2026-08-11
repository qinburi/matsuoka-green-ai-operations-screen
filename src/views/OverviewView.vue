<script setup lang="ts">
import { useRouter } from 'vue-router'
import VersionDialog from '../components/VersionDialog.vue'
import { entryContexts } from '../data/demo'

const router = useRouter()
const factoryBackdropUrl = `${import.meta.env.BASE_URL}assets/factory-operations-center.png`

function enter(entry: keyof typeof entryContexts) {
  const context = entryContexts[entry]
  router.push({
    name: 'analysis',
    query: {
      topic: context.topic,
      source: context.source,
      mode: context.mode,
      scenario: context.scenario,
      focus: context.focus || undefined,
    },
  })
}
</script>

<template>
  <main class="overview-page">
    <section class="screen-stage" aria-label="松冈工厂数字化运营中心">
      <img
        class="screen-backdrop"
        :src="factoryBackdropUrl"
        alt="松冈工厂数字化运营中心现有大屏"
      />

      <button
        class="ai-entry"
        type="button"
        title="进入绿色AI综合分析"
        @click="enter('overview')"
      >
        <span class="ai-entry__signal" />
        <span>绿色AI分析</span>
      </button>

      <VersionDialog />

      <button
        class="screen-hotspot screen-hotspot--production"
        type="button"
        title="查看生产效率分析"
        aria-label="从生产实绩进入绿色AI生产效率分析"
        @click="enter('production')"
      >
        <span>生产效率诊断</span>
      </button>
      <button
        class="screen-hotspot screen-hotspot--defects"
        type="button"
        title="查看质量问题分析"
        aria-label="从不良原因Top5进入绿色AI质量分析"
        @click="enter('defects')"
      >
        <span>质量问题诊断</span>
      </button>
      <button
        class="screen-hotspot screen-hotspot--progress"
        type="button"
        title="查看工程进度诊断"
        aria-label="从工程进度进入绿色AI效率分析"
        @click="enter('progress')"
      >
        <span>工程进度诊断</span>
      </button>
    </section>

    <button class="mobile-ai-entry" type="button" @click="enter('overview')">
      <span class="ai-entry__signal" />
      进入绿色AI分析
    </button>
  </main>
</template>
