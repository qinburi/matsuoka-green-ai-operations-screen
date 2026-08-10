<script setup lang="ts">
import { computed } from 'vue'
import type { Issue } from '../types'

const props = defineProps<{
  issue: Issue | null
}>()

const emit = defineEmits<{
  close: []
}>()

const severityLabel = computed(() => ({
  critical: '严重异常',
  warning: '预警',
  attention: '需关注',
}[props.issue?.severity ?? 'attention']))
</script>

<template>
  <Transition name="drawer">
    <div v-if="issue" class="drawer-layer" role="dialog" aria-modal="true" :aria-label="`${issue.title}分析详情`">
      <button class="drawer-backdrop" type="button" aria-label="关闭问题详情" @click="emit('close')" />
      <aside class="issue-drawer">
        <header class="drawer-header">
          <div>
            <span class="eyebrow">EXPLAINABLE DIAGNOSIS · {{ issue.id }}</span>
            <h2>{{ issue.title }}</h2>
          </div>
          <button type="button" class="text-command" @click="emit('close')">关闭</button>
        </header>

        <div class="drawer-summary">
          <div>
            <span>异常级别</span>
            <strong :class="`severity-text--${issue.severity}`">{{ severityLabel }}</strong>
          </div>
          <div>
            <span>影响指标</span>
            <strong>{{ issue.impact }} {{ issue.impactUnit }}</strong>
          </div>
          <div>
            <span>AI置信度</span>
            <strong>{{ Math.round(issue.confidence * 100) }}%</strong>
          </div>
          <div>
            <span>异常工序</span>
            <strong>{{ issue.stage }}</strong>
          </div>
        </div>

        <p class="drawer-lead">{{ issue.summary }}</p>

        <section class="causal-section">
          <div class="section-heading">
            <span>01</span>
            <div>
              <h3>可解释分析链</h3>
              <p>问题、原因、改善动作与建议责任的演示关联</p>
            </div>
          </div>
          <div class="causal-chain">
            <article class="causal-node causal-node--issue">
              <span>问题</span>
              <strong>{{ issue.shortLabel }}</strong>
              <small>{{ issue.metric }}</small>
            </article>
            <div class="causal-stack">
              <article v-for="reason in issue.reasons" :key="reason.title" class="causal-node causal-node--reason">
                <span>原因假设</span>
                <strong>{{ reason.title }}</strong>
                <small>{{ reason.evidence }}</small>
              </article>
            </div>
            <div class="causal-stack">
              <article v-for="solution in issue.solutions" :key="solution.title" class="causal-node causal-node--solution">
                <span>改善动作</span>
                <strong>{{ solution.title }}</strong>
                <small>{{ solution.validation }}</small>
              </article>
            </div>
            <article class="causal-node causal-node--owner">
              <span>建议责任</span>
              <strong>{{ issue.responsibility.department }}</strong>
              <small>{{ issue.responsibility.role }}</small>
              <em>{{ issue.responsibility.confirmation }}</em>
            </article>
          </div>
        </section>

        <div class="drawer-columns">
          <section>
            <div class="section-heading section-heading--compact">
              <span>02</span>
              <div><h3>分析证据</h3></div>
            </div>
            <dl class="evidence-list">
              <div v-for="item in issue.evidence" :key="item.label">
                <dt>{{ item.label }}</dt>
                <dd><strong>{{ item.value }}</strong><small>{{ item.source }}</small></dd>
              </div>
            </dl>
          </section>
          <section>
            <div class="section-heading section-heading--compact">
              <span>03</span>
              <div><h3>知识依据</h3></div>
            </div>
            <ul class="knowledge-list">
              <li v-for="item in issue.knowledgeRefs" :key="item.id">
                <strong>{{ item.id }}</strong>
                <span>{{ item.title }}</span>
                <small>{{ item.version }}</small>
              </li>
            </ul>
          </section>
        </div>

        <section class="data-gap">
          <strong>结论边界</strong>
          <p v-for="gap in issue.dataGaps" :key="gap">{{ gap }}</p>
        </section>
      </aside>
    </div>
  </Transition>
</template>
