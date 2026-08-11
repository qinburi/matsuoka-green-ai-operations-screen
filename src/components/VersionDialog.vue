<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { versionHistory, versionRelease } from '../version'

const open = ref(false)

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeDialog()
}

function showDialog() {
  open.value = true
  document.addEventListener('keydown', handleKeydown)
}

function closeDialog() {
  open.value = false
  document.removeEventListener('keydown', handleKeydown)
}

onBeforeUnmount(() => document.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <button
    class="version-trigger"
    type="button"
    aria-haspopup="dialog"
    :aria-expanded="open"
    title="查看当前版本内容"
    @click="showDialog"
  >
    <span>VERSION</span>
    <strong>{{ versionRelease.version }}</strong>
  </button>

  <Teleport to="body">
    <Transition name="version-dialog">
      <div v-if="open" class="version-layer">
        <button
          class="version-backdrop"
          type="button"
          aria-label="关闭版本说明"
          @click="closeDialog"
        />
        <section
          class="version-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="version-dialog-title"
        >
          <header class="version-modal__header">
            <div>
              <span>RELEASE NOTE · CURRENT</span>
              <h2 id="version-dialog-title">{{ versionRelease.version }}</h2>
              <p>{{ versionRelease.title }}</p>
            </div>
            <button type="button" aria-label="关闭版本说明" title="关闭" @click="closeDialog">×</button>
          </header>

          <div class="version-modal__meta">
            <span>发布日期</span>
            <strong>{{ versionRelease.releasedAt }}</strong>
            <span>版本状态</span>
            <strong>当前正式版本</strong>
          </div>

          <section class="version-section">
            <div class="version-section__heading">
              <span>01</span>
              <div>
                <h3>版本内容</h3>
                <p>本版本已交付的核心能力</p>
              </div>
            </div>
            <ol class="version-list">
              <li v-for="item in versionRelease.highlights" :key="item">{{ item }}</li>
            </ol>
          </section>

          <section class="version-section version-section--boundary">
            <div class="version-section__heading">
              <span>02</span>
              <div>
                <h3>交付边界</h3>
                <p>评审时需要明确的演示范围</p>
              </div>
            </div>
            <ul class="version-boundaries">
              <li v-for="item in versionRelease.boundaries" :key="item">{{ item }}</li>
            </ul>
          </section>

          <section class="version-section version-section--history">
            <div class="version-section__heading">
              <span>03</span>
              <div>
                <h3>历史版本</h3>
                <p>保留已发布版本的内容记录</p>
              </div>
            </div>
            <ol class="version-history">
              <li v-for="release in versionHistory.slice(1)" :key="release.version">
                <strong>{{ release.version }}</strong>
                <span>{{ release.title }}</span>
                <small>{{ release.releasedAt }}</small>
              </li>
            </ol>
          </section>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
