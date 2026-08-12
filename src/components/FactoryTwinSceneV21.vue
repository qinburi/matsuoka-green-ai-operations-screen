<script setup lang="ts">
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import EChart from './EChart.vue'
import { buildFactoryFallbackOption } from '../chart-options'
import { createIndustrialKit } from '../scene/industrial-kit'
import { createProcessIslandV21 } from '../scene/process-islands-v21'
import type { AiAnalysisStage, CameraShot, DataState, FactoryZone, ProcessAnimationState, ProductionFlowSnapshot } from '../types'

const props = defineProps<{
  zones: FactoryZone[]
  activeZoneId: string | null
  camera: CameraShot
  dataState: DataState | 'loading'
  zoneStates: Record<string, ProcessAnimationState>
  aiStage: AiAnalysisStage
  chapterProgress: number
  flowSnapshot: ProductionFlowSnapshot
  improvementProgress: number
  forceFallback?: boolean
}>()

const emit = defineEmits<{
  selectZone: [zoneId: string]
  manualInteraction: []
  renderState: [state: 'webgl' | 'fallback']
}>()

const BLOOM_LAYER = 1
let isMobile = window.innerWidth <= 760
const hostEl = ref<HTMLDivElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
const fallback = ref(false)
const reducedMotion = ref(false)
const qualityLabel = ref(isMobile ? '移动端轻量渲染' : '大屏选择性AI光层')
const fallbackOption = computed(() => buildFactoryFallbackOption(props.zones, props.activeZoneId))
const labelsVisible = computed(() => props.dataState === 'normal' || props.dataState === 'stale')

const labelElements = new Map<string, HTMLElement>()
const zoneGroups = new Map<string, THREE.Group>()
const signalMeshes = new Map<string, THREE.Mesh>()
const zoneMaterials = new Map<string, THREE.MeshStandardMaterial[]>()
const processAnimations = new Map<string, ReturnType<typeof createProcessIslandV21>['update']>()
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
let industrialKit = createIndustrialKit(isMobile)
let kitDisposed = false

let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let controls: OrbitControls | null = null
let bloomComposer: EffectComposer | null = null
let finalComposer: EffectComposer | null = null
let bloomPass: UnrealBloomPass | null = null
let compositePass: ShaderPass | null = null
let resizeObserver: ResizeObserver | null = null
let animationFrame = 0
let lastFrameAt = 0
let pulseStartedAt = 0
let mediaQuery: MediaQueryList | null = null
let pointerStart: { x: number; y: number } | null = null
let pageVisible = true
let flowMesh: THREE.InstancedMesh | null = null
let flowCurves: THREE.CatmullRomCurve3[] = []
let aiScanRing: THREE.Mesh | null = null
let aiRelationMaterial: THREE.MeshStandardMaterial | null = null
let aiRelationCurves: THREE.CatmullRomCurve3[] = []
let aiPackets: THREE.InstancedMesh | null = null
let responsibilityBeacons: THREE.Mesh[] = []
let perfStartedAt = 0
let perfFrames = 0
let renderFrameIndex = 0
let lastDrawCalls = 0
let lastTriangles = 0
let qualityPixelRatio = Math.min(window.devicePixelRatio || 1, isMobile ? 1 : 1.5)
let lastQualityAdjustedAt = 0
let viewportReinitTimer = 0
let cameraTween: {
  startedAt: number
  duration: number
  positionCurve: THREE.CatmullRomCurve3
  targetCurve: THREE.CatmullRomCurve3
} | null = null

const healthColors: Record<FactoryZone['health'], number> = {
  normal: 0x39d98a,
  attention: 0x59cbe8,
  warning: 0xe6ad4e,
  critical: 0xe66b64,
}

const animationCopy: Record<ProcessAnimationState, string> = {
  ambient: '稳定运行',
  warning: '状态预警',
  selected: '当前聚焦',
  diagnosing: 'AI诊断中',
  improving: '改善模拟',
  recovered: '模拟恢复',
}

const stateCopy: Record<Exclude<DataState, 'normal'> | 'loading', { title: string; detail: string }> = {
  loading: { title: '正在重新计算', detail: '清洗数据与知识索引正在对齐' },
  empty: { title: '暂无可分析数据', detail: '请调整当前筛选范围' },
  error: { title: '分析数据加载失败', detail: '请检查数据源连接或重新分析' },
  forbidden: { title: '当前账号无权查看', detail: '需由管理员授予生产诊断数据权限' },
  stale: { title: '数据已过期', detail: '三维态势可查看，结论需复核' },
  'metric-conflict': { title: '指标口径存在冲突', detail: '请先确认统计口径再恢复分析' },
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

function displayMetric(zone: FactoryZone) {
  if (zone.id === 'qc21' && props.improvementProgress > 0) {
    return `${Math.round(THREE.MathUtils.lerp(zone.runtime.queue, 128, props.improvementProgress))} pcs`
  }
  if (zone.id === 'finishing' && props.improvementProgress > 0.66) return '节拍恢复'
  return zone.metricValue
}

function createFloor(targetScene: THREE.Scene) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(25, 15.6),
    new THREE.MeshStandardMaterial({ color: 0x182529, roughness: 0.94, metalness: 0.08 }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -0.18
  floor.receiveShadow = !isMobile
  targetScene.add(floor)

  const grid = new THREE.GridHelper(25, 50, 0x3a716a, 0x294147)
  grid.scale.z = 0.62
  grid.position.y = -0.165
  const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material]
  gridMaterials.forEach((material) => {
    material.transparent = true
    material.opacity = 0.4
  })
  targetScene.add(grid)

}

function createZone(zone: FactoryZone) {
  const group = new THREE.Group()
  group.name = zone.id
  group.position.set(...zone.position)
  group.userData.zoneId = zone.id
  const accent = healthColors[zone.health]
  const [width, depth] = zone.model.footprint
  const baseMaterial = industrialKit.animatedMaterial('graphite')
  const deckMaterial = industrialKit.animatedMaterial(zone.model.materialFamily === 'inspection' ? 'metal' : 'graphite')
  deckMaterial.color.setHex(zone.health === 'critical' ? 0x462426 : zone.health === 'warning' ? 0x40351e : 0x18322c)
  deckMaterial.emissive.setHex(accent)
  deckMaterial.emissiveIntensity = zone.health === 'critical' ? 0.16 : 0.06
  zoneMaterials.set(zone.id, [baseMaterial, deckMaterial])
  industrialKit.roundedBox(group, [width, 0.16, depth], [0, -0.02, 0], baseMaterial, 0.11)
  industrialKit.roundedBox(group, [width - 0.18, 0.12, depth - 0.18], [0, 0.1, 0], deckMaterial, 0.08)

  const portMaterial = industrialKit.material('accent', accent)
  const ports = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.035, 0.16), portMaterial, 2)
  const portMatrix = new THREE.Matrix4()
  portMatrix.makeTranslation(...zone.inputPort.position)
  ports.setMatrixAt(0, portMatrix)
  portMatrix.makeTranslation(...zone.outputPort.position)
  ports.setMatrixAt(1, portMatrix)
  ports.instanceMatrix.needsUpdate = true
  ports.layers.enable(BLOOM_LAYER)
  group.add(ports)

  const processIsland = createProcessIslandV21(zone, accent, industrialKit, isMobile)
  group.add(processIsland.group)
  processAnimations.set(zone.id, processIsland.update)

  const signalMaterial = industrialKit.animatedMaterial('accent', accent)
  signalMaterial.emissiveIntensity = zone.health === 'critical' ? 1.8 : 1.05
  const signal = industrialKit.torus(group, 0.34, 0.032, [0, 2.08, 0], signalMaterial)
  signal.layers.enable(BLOOM_LAYER)
  signalMeshes.set(zone.id, signal)
  return group
}

function portWorld(zone: FactoryZone, kind: 'input' | 'output') {
  const port = kind === 'input' ? zone.inputPort : zone.outputPort
  return new THREE.Vector3(zone.position[0] + port.position[0], 0.24, zone.position[2] + port.position[2])
}

function createContactShadows(targetScene: THREE.Scene) {
  if (isMobile) return
  const shadows = new THREE.InstancedMesh(
    new THREE.CircleGeometry(1, 36),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16, depthWrite: false }),
    props.zones.length,
  )
  const matrix = new THREE.Matrix4()
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))
  props.zones.forEach((zone, index) => {
    matrix.compose(
      new THREE.Vector3(zone.position[0], -0.155, zone.position[2]),
      quaternion,
      new THREE.Vector3(zone.model.footprint[0] * 0.6, zone.model.footprint[1] * 0.68, 1),
    )
    shadows.setMatrixAt(index, matrix)
  })
  shadows.instanceMatrix.needsUpdate = true
  targetScene.add(shadows)
}

function createSemanticFlow(targetScene: THREE.Scene) {
  flowCurves = []
  const railMaterial = industrialKit.material('metal')
  const routeGroup = new THREE.Group()
  routeGroup.name = 'semantic-material-flow'
  const railGeometries: THREE.BufferGeometry[] = []
  const centerGeometries: THREE.BufferGeometry[] = []
  for (let index = 0; index < props.zones.length - 1; index += 1) {
    const start = portWorld(props.zones[index], 'output')
    const end = portWorld(props.zones[index + 1], 'input')
    const delta = end.clone().sub(start)
    const curve = new THREE.CatmullRomCurve3([
      start,
      start.clone().add(delta.clone().multiplyScalar(0.32)).setY(0.28),
      start.clone().add(delta.clone().multiplyScalar(0.68)).setY(0.28),
      end,
    ], false, 'centripetal')
    flowCurves.push(curve)
    railGeometries.push(new THREE.TubeGeometry(curve, 18, 0.035, 6, false))
    centerGeometries.push(new THREE.TubeGeometry(curve, 18, 0.012, 5, false))
  }
  const mergedRails = mergeGeometries(railGeometries, false)
  const mergedCenters = mergeGeometries(centerGeometries, false)
  railGeometries.forEach((geometry) => geometry.dispose())
  centerGeometries.forEach((geometry) => geometry.dispose())
  if (mergedRails) routeGroup.add(new THREE.Mesh(mergedRails, railMaterial))
  if (mergedCenters) {
    const centerMaterial = industrialKit.animatedMaterial('accent', 0x59cbe8)
    centerMaterial.emissiveIntensity = 0.32
    routeGroup.add(new THREE.Mesh(mergedCenters, centerMaterial))
  }
  targetScene.add(routeGroup)

  const count = isMobile ? 32 : 64
  const material = new THREE.MeshStandardMaterial({ color: 0x55e9ba, emissive: 0x39d98a, emissiveIntensity: 0.7, roughness: 0.28, metalness: 0.16, vertexColors: true })
  flowMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.19, 0.055, 0.08), material, count)
  flowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  flowMesh.layers.enable(BLOOM_LAYER)
  targetScene.add(flowMesh)
}

function updateSemanticFlow(elapsedSeconds: number) {
  if (!flowMesh || !flowCurves.length || blockingState.value) return
  const matrix = new THREE.Matrix4()
  const quaternion = new THREE.Quaternion()
  const scale = new THREE.Vector3()
  const up = new THREE.Vector3(1, 0, 0)
  const color = new THREE.Color()
  const segmentCount = flowCurves.length
  for (let index = 0; index < flowMesh.count; index += 1) {
    const segment = index % segmentCount
    const source = props.zones[segment]
    const target = props.zones[segment + 1]
    const curve = flowCurves[segment]
    const densityBase = Math.max(0.18, 1 - target.runtime.starvationRate * props.flowSnapshot.starvationScale)
    const density = segment === 4
      ? THREE.MathUtils.lerp(densityBase * 0.35, 0.92, props.improvementProgress)
      : densityBase
    const slot = Math.floor(index / segmentCount)
    const visible = slot / Math.ceil(flowMesh.count / segmentCount) <= density
    let speed = ((source.runtime.throughputRate + target.runtime.throughputRate) / 2) * props.flowSnapshot.throughputScale
    if (target.id === props.flowSnapshot.bottleneckZoneId) speed *= 0.36
    if (source.id === 'qc21') speed *= THREE.MathUtils.lerp(0.28, 1, props.improvementProgress)
    const seed = (index * 0.173) % 1
    const progress = reducedMotion.value ? seed : (seed + elapsedSeconds * 0.075 * speed) % 1
    const point = curve.getPointAt(progress)
    const tangent = curve.getTangentAt(progress).normalize()
    quaternion.setFromUnitVectors(up, tangent)
    const scaleValue = visible ? 1 : 0.001
    scale.set(scaleValue, scaleValue, scaleValue)
    matrix.compose(point, quaternion, scale)
    flowMesh.setMatrixAt(index, matrix)
    const isBottleneck = target.id === props.flowSnapshot.bottleneckZoneId
    color.setHex(isBottleneck ? 0xe66b64 : source.runtime.starvationRate > 0.45 ? 0xe6ad4e : 0x55e9ba)
    flowMesh.setColorAt(index, color)
  }
  flowMesh.instanceMatrix.needsUpdate = true
  if (flowMesh.instanceColor) flowMesh.instanceColor.needsUpdate = true
}

function relationCurve(fromId: string, toId: string) {
  const from = props.zones.find((zone) => zone.id === fromId)
  const to = props.zones.find((zone) => zone.id === toId)
  if (!from || !to) return null
  const start = new THREE.Vector3(from.position[0], 1.25, from.position[2])
  const end = new THREE.Vector3(to.position[0], 1.25, to.position[2])
  const middle = start.clone().lerp(end, 0.5)
  middle.y = 3.2
  return new THREE.CatmullRomCurve3([start, middle, end], false, 'centripetal')
}

function createAiLayer(targetScene: THREE.Scene) {
  const scanMaterial = industrialKit.animatedMaterial('accent', 0x39d98a)
  scanMaterial.transparent = true
  scanMaterial.opacity = 0
  scanMaterial.depthWrite = false
  aiScanRing = new THREE.Mesh(new THREE.TorusGeometry(3.8, 0.028, 8, 72), scanMaterial)
  aiScanRing.rotation.x = Math.PI / 2
  aiScanRing.position.y = 0.22
  aiScanRing.layers.enable(BLOOM_LAYER)
  targetScene.add(aiScanRing)

  aiRelationMaterial = industrialKit.animatedMaterial('accent', 0x39d98a)
  aiRelationMaterial.transparent = true
  aiRelationMaterial.opacity = 0
  aiRelationMaterial.depthWrite = false
  aiRelationMaterial.emissiveIntensity = 1.15
  aiRelationCurves = [relationCurve('qc21', 'sewing'), relationCurve('sewing', 'special')].filter((curve): curve is THREE.CatmullRomCurve3 => Boolean(curve))
  aiRelationCurves.forEach((curve) => {
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 42, 0.028, 6, false), aiRelationMaterial!)
    mesh.layers.enable(BLOOM_LAYER)
    targetScene.add(mesh)
  })

  aiPackets = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.075, isMobile ? 8 : 12, isMobile ? 6 : 8),
    industrialKit.material('accent', 0x39d98a),
    isMobile ? 8 : 14,
  )
  aiPackets.layers.enable(BLOOM_LAYER)
  targetScene.add(aiPackets)
  responsibilityBeacons = ['qc21', 'sewing'].map((zoneId) => {
    const zone = props.zones.find((item) => item.id === zoneId)!
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 2.8, 8),
      industrialKit.animatedMaterial('accent', 0x39d98a),
    )
    beacon.position.set(zone.position[0], 1.42, zone.position[2])
    beacon.visible = false
    beacon.layers.enable(BLOOM_LAYER)
    targetScene.add(beacon)
    return beacon
  })
}

function updateAiLayer(elapsedSeconds: number) {
  if (!aiScanRing || !aiRelationMaterial || !aiPackets) return
  const stageOrder: AiAnalysisStage[] = ['idle', 'scan', 'lock', 'evidence', 'hypothesis', 'solution', 'responsibility']
  const stage = stageOrder.indexOf(props.aiStage)
  const scanMaterial = aiScanRing.material as THREE.MeshStandardMaterial
  aiScanRing.visible = props.aiStage === 'scan' && !blockingState.value
  aiScanRing.scale.setScalar(0.25 + props.chapterProgress * 1.75)
  scanMaterial.opacity = aiScanRing.visible ? Math.max(0.08, (1 - props.chapterProgress) * 0.48) : 0
  aiRelationMaterial.opacity = stage >= 3 && !blockingState.value ? (props.aiStage === 'hypothesis' ? 0.56 : 0.82) : 0
  aiRelationMaterial.color.setHex(props.aiStage === 'hypothesis' ? 0xe6ad4e : 0x39d98a)
  aiRelationMaterial.emissive.setHex(props.aiStage === 'hypothesis' ? 0xe6ad4e : 0x39d98a)

  const matrix = new THREE.Matrix4()
  const scale = new THREE.Vector3()
  for (let index = 0; index < aiPackets.count; index += 1) {
    const curve = aiRelationCurves[index % Math.max(1, aiRelationCurves.length)]
    const visible = stage >= 3 && Boolean(curve) && !blockingState.value
    const progress = reducedMotion.value ? index / aiPackets.count : (elapsedSeconds * 0.16 + index / aiPackets.count) % 1
    const point = curve?.getPointAt(progress) ?? new THREE.Vector3()
    scale.setScalar(visible ? 1 : 0.001)
    matrix.compose(point, new THREE.Quaternion(), scale)
    aiPackets.setMatrixAt(index, matrix)
  }
  aiPackets.instanceMatrix.needsUpdate = true
  responsibilityBeacons.forEach((beacon) => {
    beacon.visible = props.aiStage === 'responsibility' && !blockingState.value
    beacon.scale.y = beacon.visible ? Math.max(0.08, props.chapterProgress) : 0.001
  })
}

function handlePointerDown(event: PointerEvent) {
  pointerStart = { x: event.clientX, y: event.clientY }
}

function handlePointerUp(event: PointerEvent) {
  const start = pointerStart
  pointerStart = null
  if (!start || !camera || !canvasEl.value || !labelsVisible.value) return
  if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return
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
    const point = new THREE.Vector3(zone.position[0], 2.5, zone.position[2]).project(camera!)
    const x = (point.x * 0.5 + 0.5) * width
    const y = (-point.y * 0.5 + 0.5) * height
    const visible = point.z > -1 && point.z < 1 && x > -100 && x < width + 100 && y > -70 && y < height + 70
    element.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%)`
    element.style.visibility = visible ? 'visible' : 'hidden'
  })
}

function animateCamera(now: number) {
  if (!camera || !controls || !cameraTween) return
  const progress = Math.max(0, Math.min(1, (now - cameraTween.startedAt) / cameraTween.duration))
  const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2
  camera.position.copy(cameraTween.positionCurve.getPoint(eased))
  controls.target.copy(cameraTween.targetCurve.getPoint(eased))
  if (progress >= 1) cameraTween = null
}

function framedDestination(shot: CameraShot) {
  const destination = new THREE.Vector3(...shot.position)
  const target = new THREE.Vector3(...shot.target)
  if (shot.framing === 'overview' || !camera || !props.activeZoneId) return destination
  const group = zoneGroups.get(props.activeZoneId)
  if (!group) return destination
  const box = new THREE.Box3().setFromObject(group)
  const sphere = box.getBoundingSphere(new THREE.Sphere())
  const minimumDistance = sphere.radius / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * 1.18
  const direction = destination.clone().sub(target).normalize()
  if (destination.distanceTo(target) < minimumDistance) return target.clone().add(direction.multiplyScalar(minimumDistance))
  return destination
}

function applyCameraShot(shot: CameraShot) {
  if (!camera || !controls) return
  const destination = framedDestination(shot)
  const target = new THREE.Vector3(...shot.target)
  if (reducedMotion.value) {
    camera.position.copy(destination)
    controls.target.copy(target)
    controls.update()
    cameraTween = null
    return
  }
  const fromPosition = camera.position.clone()
  const midpoint = fromPosition.clone().lerp(destination, 0.5)
  midpoint.y += shot.pathLift
  const fromTarget = controls.target.clone()
  const targetMidpoint = fromTarget.clone().lerp(target, 0.5)
  targetMidpoint.y += shot.framing === 'relationship' ? 0.8 : 0.24
  const positionQuarter = fromPosition.clone().lerp(midpoint, 0.55)
  const targetQuarter = fromTarget.clone().lerp(targetMidpoint, 0.55)
  cameraTween = {
    startedAt: performance.now(),
    duration: Math.max(800, Math.min(1400, shot.duration)),
    positionCurve: new THREE.CatmullRomCurve3([fromPosition, positionQuarter, midpoint, destination], false, 'centripetal'),
    targetCurve: new THREE.CatmullRomCurve3([fromTarget, targetQuarter, targetMidpoint, target], false, 'centripetal'),
  }
}

function updateZones(now: number, elapsedSeconds: number) {
  const animationsPaused = Boolean(blockingState.value)
  props.zones.forEach((zone) => {
    const state = props.zoneStates[zone.id] ?? 'ambient'
    const group = zoneGroups.get(zone.id)
    const materials = zoneMaterials.get(zone.id)
    const active = ['selected', 'diagnosing', 'improving'].includes(state)
    if (group) {
      const targetScale = active ? 1.065 : state === 'recovered' ? 1.025 : 1
      group.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.075)
      const lift = active ? 0.13 : state === 'recovered' ? 0.04 : 0
      group.position.y += (zone.position[1] + lift - group.position.y) * 0.075
    }
    materials?.forEach((material, index) => {
      const base = index === 0 ? 0 : zone.health === 'critical' ? 0.16 : 0.06
      material.emissiveIntensity = active ? (index === 0 ? 0.08 : 0.38) : state === 'recovered' ? 0.18 : base
    })
    const signal = signalMeshes.get(zone.id)
    if (signal) {
      signal.visible = !props.activeZoneId || active
      if (!reducedMotion.value && !animationsPaused) signal.rotation.z += state === 'diagnosing' ? 0.012 : 0.003
      if (active && !reducedMotion.value && now - pulseStartedAt < 2100) {
        const cycle = ((now - pulseStartedAt) % 700) / 700
        signal.scale.setScalar(1 + Math.sin(cycle * Math.PI) * 0.24)
      } else signal.scale.lerp(new THREE.Vector3(1, 1, 1), 0.12)
    }
    processAnimations.get(zone.id)?.({
      elapsedSeconds,
      state,
      improvementProgress: props.improvementProgress,
      aiStage: props.aiStage,
      reducedMotion: reducedMotion.value || animationsPaused,
    })
  })
}

function renderFrame() {
  if (!renderer || !scene || !camera) return
  renderer.info.reset()
  const bloomActive = Boolean(
    bloomComposer
    && finalComposer
    && !reducedMotion.value
    && (props.aiStage !== 'idle' || props.activeZoneId || props.improvementProgress > 0),
  )
  if (bloomActive && bloomComposer && finalComposer) {
    const background = scene.background
    if (renderFrameIndex % 4 === 0) {
      scene.background = new THREE.Color(0x000000)
      camera.layers.set(BLOOM_LAYER)
      bloomComposer.render()
    }
    camera.layers.set(0)
    scene.background = background
    finalComposer.render()
    camera.layers.enable(BLOOM_LAYER)
  } else renderer.render(scene, camera)
  renderFrameIndex += 1
  lastDrawCalls = renderer.info.render.calls
  lastTriangles = renderer.info.render.triangles
}

function updatePerformance(now: number) {
  if (!renderer) return
  if (!perfStartedAt) perfStartedAt = now
  perfFrames += 1
  if (now - perfStartedAt < 1000) return
  const fps = Math.round(perfFrames * 1000 / (now - perfStartedAt))
  if (canvasEl.value) {
    canvasEl.value.dataset.fps = String(fps)
    canvasEl.value.dataset.drawCalls = String(lastDrawCalls)
    canvasEl.value.dataset.triangles = String(lastTriangles)
    canvasEl.value.dataset.pixelRatio = qualityPixelRatio.toFixed(2)
  }
  if (!isMobile && fps < 44 && qualityPixelRatio > 1.1 && now - lastQualityAdjustedAt > 3500) {
    qualityPixelRatio = Math.max(1.1, qualityPixelRatio - 0.2)
    renderer.setPixelRatio(qualityPixelRatio)
    qualityLabel.value = '大屏自适应高画质'
    lastQualityAdjustedAt = now
    handleResize()
  }
  perfStartedAt = now
  perfFrames = 0
}

function renderLoop(now: number) {
  if (!scene || !camera || !renderer || !controls) return
  animationFrame = window.requestAnimationFrame(renderLoop)
  if (!pageVisible) return
  const shouldRender = !reducedMotion.value || now - lastFrameAt > 120
  if (!shouldRender) return
  lastFrameAt = now
  const elapsedSeconds = now / 1000
  animateCamera(now)
  updateSemanticFlow(elapsedSeconds)
  updateAiLayer(elapsedSeconds)
  updateZones(now, elapsedSeconds)
  controls.update()
  projectLabels()
  renderFrame()
  updatePerformance(now)
}

function handleResize() {
  if (!renderer || !camera || !hostEl.value) return
  const width = Math.max(1, hostEl.value.clientWidth)
  const height = Math.max(1, hostEl.value.clientHeight)
  renderer.setSize(width, height, false)
  bloomComposer?.setSize(Math.max(1, width * 0.5), Math.max(1, height * 0.5))
  finalComposer?.setSize(width, height)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  projectLabels()
}

function setupPostProcessing() {
  if (!renderer || !scene || !camera || isMobile || reducedMotion.value) return
  bloomComposer = new EffectComposer(renderer)
  bloomComposer.renderToScreen = false
  bloomComposer.addPass(new RenderPass(scene, camera))
  bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.62, 0.38, 0.6)
  bloomComposer.addPass(bloomPass)
  finalComposer = new EffectComposer(renderer)
  finalComposer.addPass(new RenderPass(scene, camera))
  compositePass = new ShaderPass(new THREE.ShaderMaterial({
    uniforms: {
      baseTexture: { value: null },
      bloomTexture: { value: bloomComposer.renderTarget2.texture },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D baseTexture; uniform sampler2D bloomTexture; varying vec2 vUv; void main(){ gl_FragColor = texture2D(baseTexture, vUv) + texture2D(bloomTexture, vUv); }',
    depthWrite: false,
  }), 'baseTexture')
  finalComposer.addPass(compositePass)
}

function disposeScene() {
  if (animationFrame) window.cancelAnimationFrame(animationFrame)
  resizeObserver?.disconnect()
  window.clearTimeout(viewportReinitTimer)
  controls?.dispose()
  canvasEl.value?.removeEventListener('pointerdown', handlePointerDown)
  canvasEl.value?.removeEventListener('pointerup', handlePointerUp)
  document.removeEventListener('visibilitychange', handleVisibility)
  window.removeEventListener('resize', handleViewportChange)
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  scene?.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points || object instanceof THREE.LineSegments) {
      if (object.geometry) geometries.add(object.geometry)
      const objectMaterials = Array.isArray(object.material) ? object.material : [object.material]
      objectMaterials.forEach((material) => material && materials.add(material))
    }
  })
  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => material.dispose())
  industrialKit.dispose()
  kitDisposed = true
  bloomComposer?.dispose()
  finalComposer?.dispose()
  bloomPass?.dispose()
  compositePass?.dispose()
  renderer?.dispose()
  mediaQuery?.removeEventListener('change', handleMotionPreference)
  labelElements.clear()
  zoneGroups.clear()
  signalMeshes.clear()
  zoneMaterials.clear()
  processAnimations.clear()
  flowCurves = []
  aiRelationCurves = []
  responsibilityBeacons = []
  flowMesh = null
  aiPackets = null
  aiScanRing = null
  aiRelationMaterial = null
  pointerStart = null
  bloomComposer = null
  finalComposer = null
  bloomPass = null
  compositePass = null
  scene = null
  camera = null
  renderer = null
  controls = null
}

function handleMotionPreference(event: MediaQueryListEvent | MediaQueryList) {
  reducedMotion.value = event.matches
  if (event.matches) applyCameraShot(props.camera)
}

function handleVisibility() {
  pageVisible = document.visibilityState === 'visible'
}

function handleViewportChange() {
  const nextMobile = window.innerWidth <= 760
  if (nextMobile === isMobile || fallback.value) return
  window.clearTimeout(viewportReinitTimer)
  viewportReinitTimer = window.setTimeout(async () => {
    isMobile = nextMobile
    qualityPixelRatio = Math.min(window.devicePixelRatio || 1, isMobile ? 1 : 1.5)
    qualityLabel.value = isMobile ? '移动端轻量渲染' : '大屏选择性AI光层'
    disposeScene()
    fallback.value = false
    await initializeScene()
  }, 160)
}

async function initializeScene() {
  await nextTick()
  if (!hostEl.value || !canvasEl.value) return
  if (props.forceFallback) {
    fallback.value = true
    emit('renderState', 'fallback')
    return
  }
  mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  handleMotionPreference(mediaQuery)
  mediaQuery.addEventListener('change', handleMotionPreference)
  document.addEventListener('visibilitychange', handleVisibility)
  window.addEventListener('resize', handleViewportChange)
  try {
    if (kitDisposed) {
      industrialKit = createIndustrialKit(isMobile)
      kitDisposed = false
    }
    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x10191e)
    scene.fog = new THREE.FogExp2(0x10191e, 0.026)
    camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
    camera.position.set(...props.camera.position)
    camera.layers.enable(BLOOM_LAYER)

    renderer = new THREE.WebGLRenderer({
      canvas: canvasEl.value,
      antialias: !isMobile,
      alpha: false,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(qualityPixelRatio)
    renderer.info.autoReset = false
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    // Procedural contact shadows preserve depth without a full extra shadow-map render.
    renderer.shadowMap.enabled = false

    controls = new OrbitControls(camera, canvasEl.value)
    controls.target.set(...props.camera.target)
    controls.enableDamping = true
    controls.dampingFactor = 0.07
    controls.enablePan = false
    controls.minDistance = 6.5
    controls.maxDistance = 34
    controls.minPolarAngle = 0.46
    controls.maxPolarAngle = 1.42
    controls.addEventListener('start', () => {
      cameraTween = null
      emit('manualInteraction')
    })
    canvasEl.value.addEventListener('pointerdown', handlePointerDown)
    canvasEl.value.addEventListener('pointerup', handlePointerUp)

    scene.add(new THREE.HemisphereLight(0xd9e9ea, 0x102326, 1.65))
    const keyLight = new THREE.DirectionalLight(0xf4fbfc, 3.2)
    keyLight.position.set(5, 14, 8)
    keyLight.castShadow = false
    scene.add(keyLight)
    const rimLight = new THREE.DirectionalLight(0x68d5ee, 1.45)
    rimLight.position.set(-9, 6, -8)
    scene.add(rimLight)
    const fillLight = new THREE.DirectionalLight(0xcfe4e6, 1.25)
    fillLight.position.set(-1, 7, 12)
    scene.add(fillLight)
    const accentLight = new THREE.PointLight(0x39d98a, 18, 20, 1.8)
    accentLight.position.set(-1.5, 4.6, 0.5)
    scene.add(accentLight)

    createFloor(scene)
    createContactShadows(scene)
    props.zones.forEach((zone) => {
      const group = createZone(zone)
      zoneGroups.set(zone.id, group)
      scene!.add(group)
    })
    createSemanticFlow(scene)
    createAiLayer(scene)
    setupPostProcessing()
    resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(hostEl.value)
    handleResize()
    controls.update()
    pulseStartedAt = performance.now()
    emit('renderState', 'webgl')
    animationFrame = window.requestAnimationFrame(renderLoop)
  } catch (error) {
    console.warn('V2.1三维场景初始化失败，已切换二维拓扑。', error)
    disposeScene()
    fallback.value = true
    emit('renderState', 'fallback')
  }
}

function onFallbackSelect(payload: unknown) {
  const zoneId = (payload as { zoneId?: string } | null)?.zoneId
  if (zoneId) chooseZone(zoneId)
}

watch(() => props.camera, (shot) => applyCameraShot(shot), { deep: true })
watch(() => props.activeZoneId, () => { pulseStartedAt = performance.now() })
watch(() => props.aiStage, () => { pulseStartedAt = performance.now() })
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
  <div
    ref="hostEl"
    class="twin-scene twin-scene--v21"
    :class="{ 'is-fallback': fallback, 'is-blocked': blockingState }"
    data-scene-version="v2.1.0"
  >
    <canvas
      v-show="!fallback"
      ref="canvasEl"
      class="twin-canvas"
      :data-renderer-state="fallback ? 'fallback' : 'webgl'"
      aria-label="AI工业微缩工厂三维场景"
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
        :class="[`is-${zone.health}`, `is-state-${zoneStates[zone.id] ?? 'ambient'}`, { 'is-active': activeZoneId === zone.id }]"
        :aria-pressed="activeZoneId === zone.id"
        @click.stop="chooseZone(zone.id)"
      >
        <span>{{ zone.shortLabel }}</span>
        <strong>{{ displayMetric(zone) }}</strong>
        <small>{{ animationCopy[zoneStates[zone.id] ?? 'ambient'] }}</small>
      </button>
    </div>

    <div class="twin-scene-meta">
      <span>V2.1 · SEMANTIC DIGITAL TWIN</span>
      <strong>纯Three.js工业模型·演示拓扑·{{ qualityLabel }}</strong>
    </div>

    <div class="twin-legend" aria-label="工序状态图例">
      <span><i class="legend-dot is-normal" />正常</span>
      <span><i class="legend-dot is-warning" />预警</span>
      <span><i class="legend-dot is-critical" />异常</span>
      <span><i class="legend-line is-flow" />生产物流</span>
      <span><i class="legend-line" />AI分析链</span>
    </div>

    <div v-if="improvementProgress > 0" class="twin-improvement-status">
      <span>改善模拟</span>
      <strong>QC2-1队列 {{ Math.round(286 - 158 * improvementProgress) }} pcs</strong>
      <small>演示模拟·需现场验证</small>
    </div>

    <div v-if="blockingState" class="twin-state" :class="`is-${dataState}`" role="status">
      <span v-if="dataState === 'loading'" class="state-loader" />
      <strong>{{ blockingState.title }}</strong>
      <small>{{ blockingState.detail }}</small>
    </div>

    <div v-if="dataState === 'stale'" class="twin-stale">数据超过演示时效·结论需复核</div>
  </div>
</template>
