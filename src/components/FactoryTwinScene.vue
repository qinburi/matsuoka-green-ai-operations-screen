<script setup lang="ts">
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import EChart from './EChart.vue'
import { buildFactoryFallbackOption } from '../chart-options'
import { createProcessIsland } from '../scene/process-islands'
import type { CameraPreset, DataState, FactoryZone } from '../types'

const props = defineProps<{
  zones: FactoryZone[]
  activeZoneId: string | null
  camera: CameraPreset
  dataState: DataState | 'loading'
  forceFallback?: boolean
}>()

const emit = defineEmits<{
  selectZone: [zoneId: string]
  manualInteraction: []
  renderState: [state: 'webgl' | 'fallback']
}>()

const hostEl = ref<HTMLDivElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
const fallback = ref(false)
const reducedMotion = ref(false)
const fallbackOption = computed(() => buildFactoryFallbackOption(props.zones, props.activeZoneId))
const labelsVisible = computed(() => props.dataState === 'normal' || props.dataState === 'stale')

const labelElements = new Map<string, HTMLElement>()
const zoneGroups = new Map<string, THREE.Group>()
const signalMeshes = new Map<string, THREE.Mesh>()
const zoneMaterials = new Map<string, THREE.MeshStandardMaterial[]>()
const processAnimations = new Map<string, (elapsedSeconds: number, active: boolean) => void>()
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()

let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let controls: OrbitControls | null = null
let resizeObserver: ResizeObserver | null = null
let animationFrame = 0
let lastFrameAt = 0
let pulseStartedAt = 0
let flowPoints: THREE.Points | null = null
let flowSamples: THREE.Vector3[] = []
let mediaQuery: MediaQueryList | null = null
let pointerStart: { x: number; y: number } | null = null
let cameraTween: {
  startedAt: number
  duration: number
  fromPosition: THREE.Vector3
  toPosition: THREE.Vector3
  fromTarget: THREE.Vector3
  toTarget: THREE.Vector3
} | null = null

const healthColors: Record<FactoryZone['health'], number> = {
  normal: 0x39d98a,
  attention: 0x59cbe8,
  warning: 0xe6ad4e,
  critical: 0xe66b64,
}

const stateCopy: Record<Exclude<DataState, 'normal'> | 'loading', { title: string; detail: string }> = {
  loading: { title: '正在重新计算', detail: '清洗数据与知识索引正在对齐' },
  empty: { title: '暂无可分析数据', detail: '请调整当前筛选范围' },
  error: { title: '分析数据加载失败', detail: '请检查数据源连接或重新分析' },
  forbidden: { title: '当前账号无权查看', detail: '需由管理员授予生产诊断数据权限' },
  stale: { title: '数据已过期', detail: '三维态势可查看，结论需复核' },
}

const blockingState = computed(() => {
  if (props.dataState === 'normal' || props.dataState === 'stale') return null
  return stateCopy[props.dataState]
})

function setLabelRef(zoneId: string, element: unknown) {
  if (element instanceof HTMLElement) labelElements.set(zoneId, element)
  else labelElements.delete(zoneId)
}

function chooseZone(zoneId: string) {
  if (!labelsVisible.value) return
  emit('selectZone', zoneId)
}

function createFloor(targetScene: THREE.Scene) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 15),
    new THREE.MeshStandardMaterial({ color: 0x0c1215, roughness: 0.92, metalness: 0.1 }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -0.16
  floor.receiveShadow = true
  targetScene.add(floor)

  const grid = new THREE.GridHelper(24, 24, 0x234b48, 0x18282b)
  grid.scale.z = 0.62
  grid.position.y = -0.145
  const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material]
  gridMaterials.forEach((material) => {
    material.transparent = true
    material.opacity = 0.42
  })
  targetScene.add(grid)

  const perimeter = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(22.8, 0.22, 13.2)),
    new THREE.LineBasicMaterial({ color: 0x2e6f69, transparent: true, opacity: 0.42 }),
  )
  perimeter.position.y = -0.03
  targetScene.add(perimeter)
}

function createZone(zone: FactoryZone) {
  const group = new THREE.Group()
  group.name = zone.id
  group.position.set(...zone.position)
  group.userData.zoneId = zone.id

  const accent = healthColors[zone.health]
  const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x131c20, roughness: 0.68, metalness: 0.42 })
  const roofMaterial = new THREE.MeshStandardMaterial({
    color: zone.health === 'critical' ? 0x2b191a : zone.health === 'warning' ? 0x292316 : 0x10231d,
    emissive: accent,
    emissiveIntensity: zone.health === 'critical' ? 0.18 : 0.08,
    roughness: 0.48,
    metalness: 0.5,
  })
  zoneMaterials.set(zone.id, [baseMaterial, roofMaterial])

  const base = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.2, 1.95), baseMaterial)
  base.position.y = 0
  base.castShadow = true
  base.receiveShadow = true
  group.add(base)

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.72, 0.3, 1.62), roofMaterial)
  body.position.y = 0.25
  body.castShadow = true
  group.add(body)

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(2.76, 0.34, 1.66)),
    new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.52 }),
  )
  edges.position.y = 0.25
  group.add(edges)

  const processIsland = createProcessIsland(zone, accent)
  group.add(processIsland.group)
  processAnimations.set(zone.id, processIsland.update)

  const signalMaterial = new THREE.MeshStandardMaterial({
    color: accent,
    emissive: accent,
    emissiveIntensity: zone.health === 'critical' ? 2.2 : 1.25,
    roughness: 0.25,
    metalness: 0.15,
  })
  const signal = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.035, 10, 40), signalMaterial)
  signal.rotation.x = Math.PI / 2
  signal.position.set(0, 1.86, 0)
  signalMeshes.set(zone.id, signal)
  group.add(signal)

  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), signalMaterial.clone())
  beacon.position.set(0, 1.86, 0)
  group.add(beacon)

  return group
}

function createFlow(targetScene: THREE.Scene) {
  const routePoints = props.zones.map((zone) => new THREE.Vector3(zone.position[0], 0.28, zone.position[2]))
  const routeGeometry = new THREE.BufferGeometry().setFromPoints(routePoints)
  const route = new THREE.Line(
    routeGeometry,
    new THREE.LineBasicMaterial({ color: 0x59cbe8, transparent: true, opacity: 0.34 }),
  )
  targetScene.add(route)

  flowSamples = []
  for (let index = 0; index < routePoints.length - 1; index += 1) {
    for (let step = 0; step < 24; step += 1) {
      flowSamples.push(routePoints[index].clone().lerp(routePoints[index + 1], step / 24))
    }
  }
  flowSamples.push(routePoints[routePoints.length - 1].clone())

  const particleCount = window.innerWidth <= 760 ? 18 : 36
  const particlePositions = new Float32Array(particleCount * 3)
  const particleGeometry = new THREE.BufferGeometry()
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3))
  flowPoints = new THREE.Points(
    particleGeometry,
    new THREE.PointsMaterial({ color: 0x55e9ba, size: 0.075, transparent: true, opacity: 0.8, sizeAttenuation: true }),
  )
  targetScene.add(flowPoints)
}

function updateFlow(elapsedSeconds: number) {
  if (!flowPoints || !flowSamples.length || reducedMotion.value || blockingState.value) return
  const attribute = flowPoints.geometry.getAttribute('position') as THREE.BufferAttribute
  for (let index = 0; index < attribute.count; index += 1) {
    const sampleIndex = Math.floor((index * 7 + elapsedSeconds * 6) % flowSamples.length)
    const point = flowSamples[sampleIndex]
    attribute.setXYZ(index, point.x, point.y, point.z)
  }
  attribute.needsUpdate = true
}

function handlePointerDown(event: PointerEvent) {
  pointerStart = { x: event.clientX, y: event.clientY }
}

function handlePointerUp(event: PointerEvent) {
  const start = pointerStart
  pointerStart = null
  if (!start || !camera || !canvasEl.value || !labelsVisible.value) return
  const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y)
  if (distance > 6) return
  const rect = canvasEl.value.getBoundingClientRect()
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(pointer, camera)
  const hit = raycaster.intersectObjects([...zoneGroups.values()], true)[0]
  let target: THREE.Object3D | null = hit?.object ?? null
  while (target && !target.userData.zoneId) target = target.parent
  if (typeof target?.userData.zoneId === 'string') chooseZone(target.userData.zoneId)
}

function projectLabels() {
  if (!camera || !hostEl.value) return
  const width = hostEl.value.clientWidth
  const height = hostEl.value.clientHeight
  props.zones.forEach((zone) => {
    const element = labelElements.get(zone.id)
    if (!element) return
    const point = new THREE.Vector3(zone.position[0], 2.25, zone.position[2]).project(camera!)
    const x = (point.x * 0.5 + 0.5) * width
    const y = (-point.y * 0.5 + 0.5) * height
    const visible = point.z > -1 && point.z < 1 && x > -80 && x < width + 80 && y > -50 && y < height + 50
    element.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%)`
    element.style.visibility = visible ? 'visible' : 'hidden'
  })
}

function animateCamera(now: number) {
  if (!camera || !controls || !cameraTween) return
  const progress = Math.min(1, (now - cameraTween.startedAt) / cameraTween.duration)
  const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2
  camera.position.lerpVectors(cameraTween.fromPosition, cameraTween.toPosition, eased)
  controls.target.lerpVectors(cameraTween.fromTarget, cameraTween.toTarget, eased)
  if (progress >= 1) cameraTween = null
}

function applyCameraPreset(preset: CameraPreset) {
  if (!camera || !controls) return
  const destination = new THREE.Vector3(...preset.position)
  const target = new THREE.Vector3(...preset.target)
  if (reducedMotion.value) {
    camera.position.copy(destination)
    controls.target.copy(target)
    controls.update()
    cameraTween = null
    return
  }
  cameraTween = {
    startedAt: performance.now(),
    duration: Math.max(180, preset.duration),
    fromPosition: camera.position.clone(),
    toPosition: destination,
    fromTarget: controls.target.clone(),
    toTarget: target,
  }
}

function updateActiveZone(now: number) {
  const animationsPaused = reducedMotion.value || Boolean(blockingState.value)
  props.zones.forEach((zone) => {
    const active = zone.id === props.activeZoneId
    const group = zoneGroups.get(zone.id)
    const materials = zoneMaterials.get(zone.id)
    if (group) {
      const targetScale = active ? 1.055 : 1
      group.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.08)
      group.position.y += ((active ? zone.position[1] + 0.11 : zone.position[1]) - group.position.y) * 0.08
    }
    materials?.forEach((material, index) => {
      material.emissiveIntensity = active ? (index === 0 ? 0.12 : 0.42) : (index === 0 ? 0 : zone.health === 'critical' ? 0.18 : 0.08)
    })
    const signal = signalMeshes.get(zone.id)
    if (!signal) return
    signal.rotation.z += animationsPaused ? 0 : 0.004
    if (active && !animationsPaused && now - pulseStartedAt < 2100) {
      const cycle = ((now - pulseStartedAt) % 700) / 700
      const scale = 1 + Math.sin(cycle * Math.PI) * 0.28
      signal.scale.setScalar(scale)
    } else {
      signal.scale.lerp(new THREE.Vector3(1, 1, 1), 0.12)
    }
  })
}

function updateProcessMotions(elapsedSeconds: number) {
  if (reducedMotion.value || blockingState.value) return
  processAnimations.forEach((update, zoneId) => update(elapsedSeconds, zoneId === props.activeZoneId))
}

function renderLoop(now: number) {
  if (!scene || !camera || !renderer || !controls) return
  animationFrame = window.requestAnimationFrame(renderLoop)
  const elapsedSeconds = now / 1000
  const shouldRender = !reducedMotion.value || now - lastFrameAt > 120
  if (!shouldRender) return
  lastFrameAt = now
  animateCamera(now)
  updateFlow(elapsedSeconds)
  updateProcessMotions(elapsedSeconds)
  updateActiveZone(now)
  controls.update()
  projectLabels()
  renderer.render(scene, camera)
}

function handleResize() {
  if (!renderer || !camera || !hostEl.value) return
  const { clientWidth, clientHeight } = hostEl.value
  renderer.setSize(Math.max(1, clientWidth), Math.max(1, clientHeight), false)
  camera.aspect = clientWidth / Math.max(1, clientHeight)
  camera.updateProjectionMatrix()
  projectLabels()
}

function disposeScene() {
  if (animationFrame) window.cancelAnimationFrame(animationFrame)
  resizeObserver?.disconnect()
  controls?.dispose()
  canvasEl.value?.removeEventListener('pointerdown', handlePointerDown)
  canvasEl.value?.removeEventListener('pointerup', handlePointerUp)
  scene?.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points || object instanceof THREE.LineSegments) {
      object.geometry?.dispose()
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach((material) => material?.dispose())
    }
  })
  renderer?.dispose()
  mediaQuery?.removeEventListener('change', handleMotionPreference)
  labelElements.clear()
  zoneGroups.clear()
  signalMeshes.clear()
  zoneMaterials.clear()
  processAnimations.clear()
  pointerStart = null
  scene = null
  camera = null
  renderer = null
  controls = null
}

function handleMotionPreference(event: MediaQueryListEvent | MediaQueryList) {
  reducedMotion.value = event.matches
  if (event.matches) applyCameraPreset(props.camera)
}

async function initializeScene() {
  await nextTick()
  if (!hostEl.value || !canvasEl.value) return
  mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  handleMotionPreference(mediaQuery)
  mediaQuery.addEventListener('change', handleMotionPreference)
  if (props.forceFallback) {
    fallback.value = true
    emit('renderState', 'fallback')
    return
  }
  try {
    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x080d10)
    scene.fog = new THREE.FogExp2(0x080d10, 0.035)
    camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100)
    camera.position.set(...props.camera.position)

    renderer = new THREE.WebGLRenderer({
      canvas: canvasEl.value,
      antialias: window.innerWidth > 760,
      alpha: false,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth <= 760 ? 1 : 1.5))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.92
    renderer.shadowMap.enabled = window.innerWidth > 760
    renderer.shadowMap.type = THREE.PCFShadowMap

    controls = new OrbitControls(camera, canvasEl.value)
    controls.target.set(...props.camera.target)
    controls.enableDamping = true
    controls.dampingFactor = 0.07
    controls.enablePan = false
    controls.minDistance = 7
    controls.maxDistance = 32
    controls.minPolarAngle = 0.48
    controls.maxPolarAngle = 1.42
    controls.addEventListener('start', () => {
      cameraTween = null
      emit('manualInteraction')
    })
    canvasEl.value.addEventListener('pointerdown', handlePointerDown)
    canvasEl.value.addEventListener('pointerup', handlePointerUp)

    scene.add(new THREE.HemisphereLight(0xbcd7db, 0x071012, 1.35))
    const keyLight = new THREE.DirectionalLight(0xf0fbff, 2.6)
    keyLight.position.set(5, 13, 8)
    keyLight.castShadow = window.innerWidth > 760
    keyLight.shadow.mapSize.set(1024, 1024)
    scene.add(keyLight)
    const accentLight = new THREE.PointLight(0x39d98a, 22, 22, 1.8)
    accentLight.position.set(-2, 5, 1)
    scene.add(accentLight)

    createFloor(scene)
    props.zones.forEach((zone) => {
      const group = createZone(zone)
      zoneGroups.set(zone.id, group)
      scene!.add(group)
    })
    createFlow(scene)
    resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(hostEl.value)
    handleResize()
    controls.update()
    pulseStartedAt = performance.now()
    emit('renderState', 'webgl')
    animationFrame = window.requestAnimationFrame(renderLoop)
  } catch (error) {
    console.warn('三维场景初始化失败，已切换二维拓扑。', error)
    disposeScene()
    fallback.value = true
    emit('renderState', 'fallback')
  }
}

function onFallbackSelect(payload: unknown) {
  const zoneId = (payload as { zoneId?: string } | null)?.zoneId
  if (zoneId) chooseZone(zoneId)
}

watch(() => props.camera, (preset) => applyCameraPreset(preset), { deep: true })
watch(() => props.activeZoneId, () => { pulseStartedAt = performance.now() })
watch(() => props.forceFallback, async (forced) => {
  if (forced && !fallback.value) {
    disposeScene()
    fallback.value = true
    emit('renderState', 'fallback')
    return
  }
  if (!forced && fallback.value) {
    fallback.value = false
    await initializeScene()
  }
})

onMounted(initializeScene)
onBeforeUnmount(disposeScene)
</script>

<template>
  <div ref="hostEl" class="twin-scene" :class="{ 'is-fallback': fallback }">
    <canvas
      v-show="!fallback"
      ref="canvasEl"
      class="twin-canvas"
      :data-renderer-state="fallback ? 'fallback' : 'webgl'"
      aria-label="抽象工厂数字孪生场景"
    />

    <EChart
      v-if="fallback"
      class="twin-fallback"
      :option="fallbackOption"
      :state="dataState"
      @select="onFallbackSelect"
    />

    <div v-if="!fallback && labelsVisible" class="twin-label-layer">
      <button
        v-for="zone in zones"
        :key="zone.id"
        :ref="(element) => setLabelRef(zone.id, element)"
        type="button"
        class="twin-zone-label"
        :class="[`is-${zone.health}`, { 'is-active': activeZoneId === zone.id }]"
        :aria-pressed="activeZoneId === zone.id"
        @click.stop="chooseZone(zone.id)"
      >
        <span>{{ zone.shortLabel }}</span>
        <strong>{{ zone.metricValue }}</strong>
      </button>
    </div>

    <div class="twin-scene-meta">
      <span>ABSTRACT DIGITAL TWIN</span>
      <strong>演示生产拓扑·非真实厂区复刻</strong>
    </div>

    <div class="twin-legend" aria-label="工序状态图例">
      <span><i class="legend-dot is-normal" />正常</span>
      <span><i class="legend-dot is-warning" />预警</span>
      <span><i class="legend-dot is-critical" />异常</span>
      <span><i class="legend-line" />AI路径</span>
    </div>

    <div v-if="blockingState" class="twin-state" :class="`is-${dataState}`" role="status">
      <span v-if="dataState === 'loading'" class="state-loader" />
      <strong>{{ blockingState.title }}</strong>
      <small>{{ blockingState.detail }}</small>
    </div>

    <div v-if="dataState === 'stale'" class="twin-stale">数据超过演示时效·结论需复核</div>
  </div>
</template>
