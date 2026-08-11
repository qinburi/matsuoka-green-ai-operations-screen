<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { findVersionRelease, versionHistory, versionRelease } from '../version'
import type { VersionRelease } from '../version'

const route = useRoute()
const router = useRouter()
const open = ref(false)

const currentVersion = computed(() => (
  typeof route.meta.uiVersion === 'string' ? route.meta.uiVersion : versionRelease.version
))
const currentRelease = computed(() => findVersionRelease(currentVersion.value))

function displayVersion(version: string) {
  return version.toUpperCase()
}

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

async function openVersion(release: VersionRelease) {
  if (release.version === currentRelease.value.version) {
    closeDialog()
    return
  }
  const viewKind = route.meta.viewKind === 'analysis' ? 'analysis' : 'overview'
  const targetName = release.prototypeRoutes[viewKind]
  if (!targetName) return
  await router.push({ name: targetName, query: { ...route.query } })
  closeDialog()
}

onBeforeUnmount(() => document.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <button
    class="version-trigger"
    type="button"
    aria-haspopup="dialog"
    :aria-expanded="open"
    :title="`查看与切换版本，当前 ${displayVersion(currentRelease.version)}`"
    @click="showDialog"
  >
    <span>VERSION</span>
    <strong>{{ displayVersion(currentRelease.version) }}</strong>
  </button>

  <Teleport to="body">
    <Transition name="version-dialog">
      <div v-if="open" class="version-layer">
        <button
          class="version-backdrop"
          type="button"
          aria-label="关闭版本中心"
          @click="closeDialog"
        />
        <section
          class="version-modal version-modal--switcher"
          role="dialog"
          aria-modal="true"
          aria-labelledby="version-dialog-title"
        >
          <header class="version-modal__header">
            <div>
              <span>VERSION CENTER · RELEASE ARCHIVE</span>
              <h2 id="version-dialog-title">版本记录</h2>
              <p>查看版本内容、修改历史并切换完整页面</p>
            </div>
            <button type="button" aria-label="关闭版本中心" title="关闭" @click="closeDialog">×</button>
          </header>

          <div class="version-catalog" aria-label="可查看版本">
            <div class="version-catalog__intro">
              <span>AVAILABLE PROTOTYPES</span>
              <strong>选择产品原型版本</strong>
              <p>点击版本卡片直接进入对应的完整原型，当前查看位置和分析上下文将被保留。</p>
            </div>

            <div class="version-catalog__list">
              <article
                v-for="release in versionHistory"
                :key="release.version"
                class="version-card"
                :class="{ 'is-current-view': currentRelease.version === release.version }"
                :aria-label="`${currentRelease.version === release.version ? '当前正在查看' : '进入'} ${displayVersion(release.version)} ${release.title}`"
                role="button"
                tabindex="0"
                @click="openVersion(release)"
                @keydown.enter.prevent="openVersion(release)"
                @keydown.space.prevent="openVersion(release)"
              >
                <header>
                  <div>
                    <span>{{ release.status === 'current' ? 'CURRENT RELEASE' : 'ARCHIVED RELEASE' }}</span>
                    <strong>{{ displayVersion(release.version) }}</strong>
                  </div>
                  <em>{{ currentRelease.version === release.version ? '当前查看' : release.status === 'current' ? '当前版本' : '历史版本' }}</em>
                </header>
                <h3>{{ release.title }}</h3>
                <small>{{ release.releasedAt }}</small>
                <ul>
                  <li v-for="item in release.highlights" :key="item">{{ item }}</li>
                </ul>
                <div class="version-card__boundaries">
                  <span>交付边界</span>
                  <ul>
                    <li v-for="item in release.boundaries" :key="item">{{ item }}</li>
                  </ul>
                </div>
                <div class="version-card__changes">
                  <span>修改历史</span>
                  <ol>
                    <li v-for="change in release.changes" :key="change.id">
                      <time>{{ change.changedAt }}</time>
                      <strong>{{ change.category }}</strong>
                      <p>{{ change.description }}</p>
                    </li>
                  </ol>
                </div>
                <footer>
                  <span>{{ release.version === currentRelease.version ? '点击关闭版本窗口' : `点击进入 ${displayVersion(release.version)} 原型` }}</span>
                  <strong aria-hidden="true">→</strong>
                </footer>
              </article>
            </div>
          </div>

          <footer class="version-modal__actions">
            <div>
              <span>当前正在查看</span>
              <strong>{{ displayVersion(currentRelease.version) }} · {{ route.meta.viewKind === 'analysis' ? '分析页' : '首页' }}</strong>
            </div>
            <span>版本号、原型路由与修改记录由项目配置手动维护</span>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
