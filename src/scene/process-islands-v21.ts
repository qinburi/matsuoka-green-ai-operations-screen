import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { AiAnalysisStage, FactoryZone, ProcessAnimationState } from '../types'
import type { IndustrialKit } from './industrial-kit'

export interface ProcessMotionContext {
  elapsedSeconds: number
  state: ProcessAnimationState
  improvementProgress: number
  aiStage: AiAnalysisStage
  reducedMotion: boolean
}

export interface ProcessIslandV21 {
  group: THREE.Group
  update: (context: ProcessMotionContext) => void
}

type Motion = (context: ProcessMotionContext) => void

const cyan = 0x59cbe8
const green = 0x39d98a
const amber = 0xe6ad4e
const red = 0xe66b64

function markDynamic<T extends THREE.Object3D>(object: T) {
  object.userData.dynamic = true
  return object
}

function belongsToDynamicBranch(object: THREE.Object3D, root: THREE.Object3D) {
  let current: THREE.Object3D | null = object
  while (current && current !== root) {
    if (current.userData.dynamic) return true
    current = current.parent
  }
  return false
}

function batchStaticMeshes(root: THREE.Group) {
  root.updateMatrixWorld(true)
  const rootInverse = root.matrixWorld.clone().invert()
  const buckets = new Map<THREE.Material, { geometries: THREE.BufferGeometry[]; meshes: THREE.Mesh[] }>()
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh || belongsToDynamicBranch(object, root)) return
    const materialList = Array.isArray(object.material) ? object.material : [object.material]
    if (materialList.length !== 1 || !materialList[0]) return
    const relativeMatrix = rootInverse.clone().multiply(object.matrixWorld)
    const cloned = object.geometry.clone().applyMatrix4(relativeMatrix)
    const geometry = cloned.index ? cloned.toNonIndexed() : cloned
    if (geometry !== cloned) cloned.dispose()
    const bucket = buckets.get(materialList[0]) ?? { geometries: [], meshes: [] }
    bucket.geometries.push(geometry)
    bucket.meshes.push(object)
    buckets.set(materialList[0], bucket)
  })
  buckets.forEach(({ geometries, meshes }, material) => {
    if (geometries.length < 2) {
      geometries.forEach((geometry) => geometry.dispose())
      return
    }
    const merged = mergeGeometries(geometries, false)
    geometries.forEach((geometry) => geometry.dispose())
    if (!merged) return
    meshes.forEach((mesh) => mesh.parent?.remove(mesh))
    const batched = new THREE.Mesh(merged, material)
    batched.castShadow = true
    batched.receiveShadow = true
    root.add(batched)
  })
}

function motionFactor(state: ProcessAnimationState) {
  return {
    ambient: 0.36,
    warning: 0.52,
    selected: 0.72,
    diagnosing: 0.88,
    improving: 1,
    recovered: 0.68,
  }[state]
}

function queueFactor(zone: FactoryZone, context: ProcessMotionContext) {
  const base = Math.min(1, zone.runtime.queue / Math.max(1, zone.runtime.capacityPerHour * 0.4))
  if (context.state === 'improving') return THREE.MathUtils.lerp(base, base * 0.42, context.improvementProgress)
  if (context.state === 'recovered') return base * 0.42
  return base
}

function addOutline(parent: THREE.Object3D, points: THREE.Vector3[], color: number, opacity = 0.58, closed = false) {
  const geometry = new THREE.BufferGeometry().setFromPoints(closed ? [...points, points[0]] : points)
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity })
  const line = new THREE.Line(geometry, material)
  parent.add(line)
  return { line, material }
}

function createCutting(parent: THREE.Group, zone: FactoryZone, accent: number, kit: IndustrialKit): Motion {
  const metal = kit.material('metal')
  const fabric = kit.material('fabric')
  const warning = kit.animatedMaterial('warning')
  kit.conveyor(parent, 2.2, 0.92, [0.28, 0.62, 0.12], cyan)
  const rack = kit.frame(parent, 0.58, 1.08, 1.2, [-1.12, 0.5, -0.03], metal)
  const rolls = [-0.36, 0, 0.36].map((z) => markDynamic(kit.cylinder(rack, 0.18, 0.48, [0, 0.36 + Math.abs(z) * 0.42, z], fabric, [0, 0, Math.PI / 2])))

  const gantry = markDynamic(new THREE.Group())
  kit.box(gantry, [0.07, 0.72, 0.07], [0, 0.44, -0.51], metal)
  kit.box(gantry, [0.07, 0.72, 0.07], [0, 0.44, 0.51], metal)
  kit.box(gantry, [0.12, 0.08, 1.12], [0, 0.82, 0], metal)
  const cutter = kit.roundedBox(gantry, [0.2, 0.26, 0.18], [0, 0.67, 0], kit.material('accent', accent), 0.04)
  cutter.layers.enable(1)
  parent.add(gantry)

  const path = addOutline(parent, [
    new THREE.Vector3(-0.42, 0.71, -0.26),
    new THREE.Vector3(0.14, 0.71, -0.34),
    new THREE.Vector3(0.88, 0.71, -0.03),
    new THREE.Vector3(0.36, 0.71, 0.34),
    new THREE.Vector3(-0.18, 0.71, 0.16),
  ], accent, 0.64, true)
  const offcuts = [-0.42, 0, 0.42].map((z) => markDynamic(kit.crate(parent, [0.32, 0.17, 0.25], [1.24, 0.7, z], warning)))
  kit.controlUnit(parent, [-0.62, 0.58, 0.82], accent)

  return (context) => {
    const factor = motionFactor(context.state)
    const time = context.elapsedSeconds * zone.visual.motionRate
    if (!context.reducedMotion) {
      gantry.position.x = Math.sin(time * 1.1) * 0.72 + 0.25
      cutter.position.z = Math.sin(time * 1.8) * 0.3
      rolls.forEach((roll, index) => { roll.rotation.x = time * (0.18 + index * 0.04) * factor })
    }
    path.material.opacity = context.state === 'diagnosing' || context.state === 'selected' ? 0.9 : 0.42
    offcuts.forEach((crate, index) => {
      const alert = context.state === 'warning' || context.state === 'diagnosing'
      crate.scale.y = 1 + (alert ? Math.max(0, Math.sin(time * 2 - index * 0.7)) * 0.12 : 0)
    })
  }
}

function createSewing(parent: THREE.Group, zone: FactoryZone, accent: number, kit: IndustrialKit, isMobile: boolean): Motion {
  const machineMaterial = kit.material('pearl')
  const tableMaterial = kit.material('graphite')
  const spoolMaterial = kit.material('accent', accent)
  const count = isMobile ? 9 : 15
  const columns = isMobile ? 3 : 5
  const rows = Math.ceil(count / columns)
  const tables = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.08, 0.31), tableMaterial, count)
  const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.17, 0.2, 0.15), machineMaterial, count)
  const matrix = new THREE.Matrix4()
  for (let index = 0; index < count; index += 1) {
    const column = index % columns
    const row = Math.floor(index / columns)
    const x = -1.16 + column * (2.32 / Math.max(1, columns - 1))
    const z = -0.68 + row * (1.36 / Math.max(1, rows - 1))
    matrix.makeTranslation(x, 0.68, z)
    tables.setMatrixAt(index, matrix)
    matrix.makeTranslation(x - 0.04, 0.83, z)
    heads.setMatrixAt(index, matrix)
  }
  tables.instanceMatrix.needsUpdate = true
  heads.instanceMatrix.needsUpdate = true
  parent.add(tables, heads)
  kit.conveyor(parent, 2.9, 0.22, [0, 0.57, 0], green)

  const needles = [-0.86, -0.42, 0, 0.42, 0.86].map((x) => markDynamic(kit.cylinder(parent, 0.018, 0.26, [x, 1, -0.5], kit.material('metal'))))
  const spools = [-0.86, -0.42, 0, 0.42, 0.86].map((x) => markDynamic(kit.torus(parent, 0.065, 0.014, [x, 1.16, -0.5], spoolMaterial)))
  const wipMaterial = kit.animatedMaterial('critical')
  const wip = [-0.72, -0.24, 0.24, 0.72].map((x) => markDynamic(kit.crate(parent, [0.33, 0.18, 0.28], [x, 0.72, 0.92], wipMaterial)))
  const bufferFrame = kit.frame(parent, 1.9, 0.72, 0.42, [0, 0.55, 0.9], kit.material('metal'))
  bufferFrame.rotation.y = Math.PI / 2
  kit.controlUnit(parent, [1.45, 0.58, -0.82], accent)

  return (context) => {
    const factor = motionFactor(context.state)
    const time = context.elapsedSeconds * zone.visual.motionRate
    const backlog = queueFactor(zone, context)
    if (!context.reducedMotion) {
      needles.forEach((needle, index) => { needle.position.y = 1 + Math.sin(time * 8 + index * 0.7) * 0.055 * factor })
      spools.forEach((spool, index) => { spool.rotation.z = time * (1.2 + index * 0.08) * factor })
    }
    wip.forEach((crate, index) => {
      const visible = backlog > index * 0.17
      crate.visible = visible
      crate.scale.y = visible ? 0.82 + backlog * 0.38 : 0.01
    })
    wipMaterial.emissiveIntensity = ['warning', 'diagnosing', 'selected'].includes(context.state) ? 0.76 : 0.32
  }
}

function createQc1(parent: THREE.Group, zone: FactoryZone, accent: number, kit: IndustrialKit): Motion {
  kit.conveyor(parent, 2.4, 0.62, [0, 0.62, 0], cyan)
  kit.gate(parent, 0.82, 1.12, [-0.18, 0.66, 0], accent)
  const scanMaterial = kit.animatedMaterial('glass')
  scanMaterial.color.setHex(accent)
  scanMaterial.emissive.setHex(accent)
  scanMaterial.emissiveIntensity = 0.62
  const scan = markDynamic(kit.box(parent, [0.025, 0.84, 0.78], [-0.7, 1.05, 0], scanMaterial))
  const diverter = markDynamic(new THREE.Group())
  diverter.position.set(0.86, 0.81, 0)
  kit.box(diverter, [0.72, 0.05, 0.07], [0, 0, 0], kit.material('pearl'))
  parent.add(diverter)
  kit.conveyor(parent, 0.9, 0.24, [0.92, 0.58, 0.55], amber).rotation.y = -0.42
  kit.controlUnit(parent, [-0.78, 0.58, -0.64], accent)
  return (context) => {
    const time = context.elapsedSeconds * zone.visual.motionRate
    if (!context.reducedMotion) scan.position.x = -0.64 + Math.sin(time * 1.6) * 0.42
    diverter.rotation.y = context.state === 'warning' ? 0.35 : Math.sin(time * 0.5) * 0.04
    scanMaterial.opacity = context.state === 'diagnosing' || context.state === 'selected' ? 0.42 : 0.2
  }
}

function createSpecial(parent: THREE.Group, zone: FactoryZone, accent: number, kit: IndustrialKit): Motion {
  kit.cylinder(parent, 0.9, 0.16, [0, 0.62, 0], kit.material('graphite'))
  kit.torus(parent, 1.08, 0.035, [0, 0.7, 0], kit.material('warning'))
  const chamber = markDynamic(kit.cylinder(parent, 0.48, 0.68, [0, 1, 0], kit.material('glass')))
  chamber.material = kit.animatedMaterial('glass')
  const turret = markDynamic(new THREE.Group())
  const tools: THREE.Mesh[] = []
  for (let index = 0; index < 4; index += 1) {
    const angle = index * Math.PI / 2
    const arm = kit.box(turret, [0.5, 0.07, 0.07], [Math.cos(angle) * 0.28, 1.3, Math.sin(angle) * 0.28], kit.material('metal'))
    arm.rotation.y = -angle
    tools.push(kit.roundedBox(turret, [0.22, 0.3, 0.2], [Math.cos(angle) * 0.7, 1.18, Math.sin(angle) * 0.7], kit.material('pearl'), 0.04))
  }
  parent.add(turret)
  ;[-0.95, 0.95].forEach((x) => kit.box(parent, [0.06, 0.48, 1.55], [x, 0.88, 0], kit.material('metal')))
  kit.controlUnit(parent, [-1.18, 0.58, 0.82], accent)
  return (context) => {
    const time = context.elapsedSeconds * zone.visual.motionRate
    const factor = motionFactor(context.state)
    if (!context.reducedMotion) turret.rotation.y = time * 0.32 * factor
    tools.forEach((tool, index) => { tool.position.y = 1.18 + Math.sin(time * 1.4 + index) * 0.05 * factor })
    ;(chamber.material as THREE.MeshStandardMaterial).opacity = context.state === 'selected' ? 0.32 : 0.18
  }
}

function createQc21(parent: THREE.Group, zone: FactoryZone, accent: number, kit: IndustrialKit, isMobile: boolean): Motion {
  const lanes = [-0.64, 0, 0.64]
  lanes.forEach((z) => kit.conveyor(parent, 2.55, 0.34, [-0.18, 0.61, z], red))
  const queueMaterial = kit.animatedMaterial('critical')
  const queueCells: THREE.Group[] = []
  const slots = isMobile ? 3 : 4
  lanes.forEach((z) => {
    for (let slot = 0; slot < slots; slot += 1) {
      queueCells.push(markDynamic(kit.crate(parent, [0.32, 0.17, 0.25], [-1.14 + slot * 0.43, 0.76, z], queueMaterial)))
    }
  })
  const inspectionCabin = kit.frame(parent, 0.82, 1.35, 1.75, [0.86, 0.6, 0], kit.material('metal'))
  const glass = markDynamic(kit.roundedBox(inspectionCabin, [0.56, 0.78, 1.48], [0, 0.64, 0], kit.animatedMaterial('glass'), 0.06))
  const scanMaterial = kit.animatedMaterial('critical')
  scanMaterial.transparent = true
  scanMaterial.opacity = 0.28
  scanMaterial.depthWrite = false
  const scan = markDynamic(kit.box(parent, [0.025, 0.96, 1.6], [0.52, 1.12, 0], scanMaterial))
  scan.layers.enable(1)
  kit.controlUnit(parent, [1.48, 0.58, -0.9], accent)
  return (context) => {
    const time = context.elapsedSeconds * zone.visual.motionRate
    const backlog = queueFactor(zone, context)
    if (!context.reducedMotion) scan.position.x = 0.62 + Math.sin(time * 1.8) * 0.23
    queueCells.forEach((cell, index) => {
      const threshold = index / queueCells.length
      cell.visible = backlog + 0.12 > threshold
      const pulse = context.state === 'diagnosing' && !context.reducedMotion ? Math.max(0, Math.sin(time * 2.4 - index * 0.22)) * 0.12 : 0
      cell.scale.y = cell.visible ? 0.72 + backlog * 0.4 + pulse : 0.01
    })
    queueMaterial.emissiveIntensity = context.state === 'improving' ? THREE.MathUtils.lerp(0.72, 0.18, context.improvementProgress) : context.state === 'diagnosing' ? 0.92 : 0.5
    scanMaterial.opacity = context.state === 'diagnosing' || context.state === 'selected' ? 0.52 : 0.24
    ;(glass.material as THREE.MeshStandardMaterial).opacity = context.state === 'selected' ? 0.3 : 0.17
  }
}

function createFinishing(parent: THREE.Group, zone: FactoryZone, accent: number, kit: IndustrialKit): Motion {
  const frame = kit.frame(parent, 2.6, 1.45, 0.7, [0, 0.58, 0], kit.material('metal'))
  kit.box(frame, [2.7, 0.06, 0.06], [0, 1.18, 0], kit.material('accent', accent))
  const garments = [-0.88, -0.44, 0, 0.44, 0.88].map((x) => {
    const hanger = markDynamic(kit.torus(parent, 0.09, 0.012, [x, 1.48, 0], kit.material('metal'), [0, 0, 0]))
    kit.roundedBox(hanger, [0.28, 0.38, 0.055], [0, -0.28, 0], kit.material('fabric'), 0.025)
    return hanger
  })
  kit.conveyor(parent, 2.25, 0.56, [0, 0.58, 0.52], cyan)
  const steam = [-0.58, 0, 0.58].map((x) => {
    const material = kit.animatedMaterial('glass')
    const ring = markDynamic(kit.torus(parent, 0.16, 0.018, [x, 0.78, 0.52], material))
    return { ring, material }
  })
  return (context) => {
    const time = context.elapsedSeconds * zone.visual.motionRate
    const starvation = context.state === 'improving' ? THREE.MathUtils.lerp(zone.runtime.starvationRate, 0.12, context.improvementProgress) : context.state === 'recovered' ? 0.12 : zone.runtime.starvationRate
    garments.forEach((garment, index) => {
      garment.visible = index / garments.length > starvation * 0.72
      if (!context.reducedMotion) garment.rotation.y = Math.sin(time * 0.9 + index * 0.5) * 0.06
    })
    steam.forEach(({ ring, material }, index) => {
      const cycle = (time * 0.34 + index * 0.28) % 1
      ring.position.y = 0.78 + cycle * 0.48
      ring.scale.setScalar(0.82 + cycle * 0.5)
      material.opacity = context.reducedMotion ? 0.08 : (1 - cycle) * (context.state === 'selected' ? 0.26 : 0.13)
    })
  }
}

function createQc22(parent: THREE.Group, zone: FactoryZone, accent: number, kit: IndustrialKit): Motion {
  kit.conveyor(parent, 2.45, 0.68, [-0.18, 0.61, 0], cyan)
  kit.gate(parent, 0.84, 1.08, [-0.55, 0.66, 0], accent)
  kit.gate(parent, 0.84, 1.08, [0.28, 0.66, 0], accent)
  const scans = [-0.55, 0.28].map((x) => {
    const material = kit.animatedMaterial('glass')
    material.color.setHex(accent)
    material.emissive.setHex(accent)
    const scan = markDynamic(kit.box(parent, [0.022, 0.82, 0.8], [x, 1.08, 0], material))
    return { scan, material }
  })
  const split = markDynamic(new THREE.Group())
  split.position.set(0.9, 0.76, 0)
  kit.box(split, [0.78, 0.05, 0.07], [0, 0, 0], kit.material('pearl'))
  parent.add(split)
  kit.conveyor(parent, 0.92, 0.24, [0.98, 0.57, 0.58], amber).rotation.y = -0.48
  return (context) => {
    const time = context.elapsedSeconds * zone.visual.motionRate
    scans.forEach(({ scan, material }, index) => {
      if (!context.reducedMotion) scan.position.x = (index ? 0.28 : -0.55) + Math.sin(time * 1.5 + index * Math.PI) * 0.1
      material.opacity = context.state === 'selected' ? 0.36 : 0.18
    })
    split.rotation.y = context.state === 'warning' ? 0.38 : Math.sin(time * 0.72) * 0.06
  }
}

function createFolding(parent: THREE.Group, zone: FactoryZone, accent: number, kit: IndustrialKit): Motion {
  kit.roundedBox(parent, [1.62, 0.14, 1.02], [0, 0.66, 0], kit.material('graphite'), 0.08)
  kit.roundedBox(parent, [0.88, 0.055, 0.66], [0, 0.78, 0], kit.material('fabric'), 0.035)
  const left = markDynamic(new THREE.Group())
  left.position.set(-0.82, 0.83, 0)
  kit.roundedBox(left, [0.78, 0.06, 0.12], [0.39, 0, 0], kit.material('metal'), 0.025)
  parent.add(left)
  const right = markDynamic(new THREE.Group())
  right.position.set(0.82, 0.83, 0)
  kit.roundedBox(right, [0.78, 0.06, 0.12], [-0.39, 0, 0], kit.material('metal'), 0.025)
  parent.add(right)
  const press = markDynamic(kit.roundedBox(parent, [0.72, 0.12, 0.5], [0, 1.2, 0], kit.material('pearl'), 0.04))
  kit.frame(parent, 1, 0.88, 0.72, [0, 0.67, 0], kit.material('metal'))
  const stacks = [0, 1, 2].map((index) => markDynamic(kit.roundedBox(parent, [0.46, 0.07, 0.34], [0.94, 0.67 + index * 0.075, 0.54], kit.material('fabric'), 0.025)))
  return (context) => {
    const time = context.elapsedSeconds * zone.visual.motionRate
    const factor = motionFactor(context.state)
    const fold = context.reducedMotion ? 0.12 : Math.max(0, Math.sin(time * 1.2)) * 0.74 * factor
    left.rotation.z = -fold
    right.rotation.z = fold
    press.position.y = 1.2 - Math.max(0, Math.sin(time * 1.2 - 0.8)) * 0.28 * factor
    stacks.forEach((stack, index) => { stack.position.y = 0.67 + index * 0.075 + Math.sin(time + index) * 0.006 })
  }
}

function createWarehouse(parent: THREE.Group, zone: FactoryZone, accent: number, kit: IndustrialKit, isMobile: boolean): Motion {
  const rackMaterial = kit.material('metal')
  const rackXs = isMobile ? [-0.72, 0.72] : [-0.9, 0, 0.9]
  rackXs.forEach((x) => {
    const rack = kit.frame(parent, 0.66, 1.48, 1.38, [x, 0.58, 0], rackMaterial)
    ;[0.45, 0.82, 1.18].forEach((y) => kit.box(rack, [0.68, 0.045, 1.4], [0, y, 0], rackMaterial))
    ;[-0.42, 0, 0.42].forEach((z, index) => {
      if (isMobile && index === 1) return
      kit.crate(rack, [0.34, 0.2, 0.3], [0, 0.62 + (index % 2) * 0.36, z], index === 2 ? kit.material('accent', accent) : kit.material('fabric'))
    })
  })
  const agv = markDynamic(new THREE.Group())
  kit.roundedBox(agv, [0.72, 0.18, 0.52], [0, 0.1, 0], kit.material('graphite'), 0.08)
  kit.roundedBox(agv, [0.42, 0.13, 0.32], [0, 0.26, 0], kit.material('fabric'), 0.04)
  ;[-0.25, 0.25].forEach((x) => {
    ;[-0.18, 0.18].forEach((z) => kit.cylinder(agv, 0.055, 0.06, [x, 0.02, z], kit.material('rubber'), [Math.PI / 2, 0, 0]))
  })
  agv.position.set(0, 0.6, -1.03)
  parent.add(agv)
  const dock = kit.frame(parent, 0.96, 0.64, 0.72, [1.05, 0.58, -0.82], kit.material('accent', accent))
  dock.layers.enable(1)
  const route = addOutline(parent, [new THREE.Vector3(-1.15, 0.61, -1.03), new THREE.Vector3(1.1, 0.61, -1.03)], accent, 0.56)
  return (context) => {
    const time = context.elapsedSeconds * zone.visual.motionRate
    if (!context.reducedMotion) agv.position.x = Math.sin(time * 0.74) * 1.05
    agv.position.y = context.state === 'selected' ? 0.66 : 0.6
    route.material.opacity = context.state === 'improving' || context.state === 'recovered' ? 0.82 : 0.46
  }
}

export function createProcessIslandV21(zone: FactoryZone, accent: number, kit: IndustrialKit, isMobile: boolean): ProcessIslandV21 {
  const group = new THREE.Group()
  group.name = `${zone.id}-v21-process-island`
  group.position.set(...zone.visual.offset)
  group.position.y += zone.model.elevation
  group.scale.setScalar(zone.visual.scale)

  const builders: Record<FactoryZone['visual']['kind'], () => Motion> = {
    cutting: () => createCutting(group, zone, accent, kit),
    sewing: () => createSewing(group, zone, accent, kit, isMobile),
    'inspection-inbound': () => createQc1(group, zone, accent, kit),
    'special-cell': () => createSpecial(group, zone, accent, kit),
    'inspection-queue': () => createQc21(group, zone, accent, kit, isMobile),
    finishing: () => createFinishing(group, zone, accent, kit),
    'inspection-final': () => createQc22(group, zone, accent, kit),
    folding: () => createFolding(group, zone, accent, kit),
    warehouse: () => createWarehouse(group, zone, accent, kit, isMobile),
  }
  const motion = builders[zone.visual.kind]()
  batchStaticMeshes(group)
  return { group, update: motion }
}
