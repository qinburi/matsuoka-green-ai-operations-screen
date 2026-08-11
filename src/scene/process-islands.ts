import * as THREE from 'three'
import type { FactoryZone } from '../types'

export interface ProcessIsland {
  group: THREE.Group
  update: (elapsedSeconds: number, active: boolean) => void
}

type Motion = (time: number, active: boolean) => void

const graphite = 0x10191d
const pearl = 0xc4d4d7
const coolMetal = 0x6d858a
const cyan = 0x59cbe8

function standardMaterial(
  color: number,
  emissive = 0x000000,
  emissiveIntensity = 0,
  options: { transparent?: boolean; opacity?: number; roughness?: number; metalness?: number } = {},
) {
  const parameters: THREE.MeshStandardMaterialParameters = {
    color,
    emissive,
    emissiveIntensity,
    roughness: options.roughness ?? 0.42,
    metalness: options.metalness ?? 0.5,
  }
  if (options.transparent !== undefined) parameters.transparent = options.transparent
  if (options.opacity !== undefined) parameters.opacity = options.opacity
  return new THREE.MeshStandardMaterial(parameters)
}

function addBox(
  parent: THREE.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material)
  mesh.position.set(...position)
  mesh.castShadow = window.innerWidth > 760
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

function addCylinder(
  parent: THREE.Object3D,
  radius: number,
  height: number,
  position: [number, number, number],
  material: THREE.Material,
  rotation: [number, number, number] = [0, 0, 0],
) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 16), material)
  mesh.position.set(...position)
  mesh.rotation.set(...rotation)
  mesh.castShadow = window.innerWidth > 760
  parent.add(mesh)
  return mesh
}

function addLine(
  parent: THREE.Object3D,
  points: THREE.Vector3[],
  color: number,
  opacity = 0.65,
  closed = false,
) {
  const geometry = new THREE.BufferGeometry().setFromPoints(closed ? [...points, points[0]] : points)
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity })
  const line = new THREE.Line(geometry, material)
  parent.add(line)
  return line
}

function addGate(parent: THREE.Object3D, x: number, accentMaterial: THREE.Material, width = 0.78) {
  const gate = new THREE.Group()
  gate.position.x = x
  addBox(gate, [0.08, 0.76, 0.08], [0, 1.02, -width / 2], accentMaterial)
  addBox(gate, [0.08, 0.76, 0.08], [0, 1.02, width / 2], accentMaterial)
  addBox(gate, [0.08, 0.08, width + 0.08], [0, 1.42, 0], accentMaterial)
  parent.add(gate)
  return gate
}

function createCutting(parent: THREE.Group, accent: number): Motion {
  const metal = standardMaterial(coolMetal, cyan, 0.08)
  const bedMaterial = standardMaterial(0x172429, cyan, 0.12)
  const fabricMaterial = standardMaterial(0xd6e2e1, 0x263a3c, 0.2, { roughness: 0.68, metalness: 0.12 })
  addBox(parent, [1.74, 0.1, 0.78], [0.2, 0.66, 0.08], bedMaterial)
  ;[-0.82, -0.4, 0.02].forEach((x) => addCylinder(parent, 0.16, 0.34, [x, 0.73, -0.56], fabricMaterial, [0, 0, Math.PI / 2]))

  const gantry = new THREE.Group()
  addBox(gantry, [0.08, 0.62, 0.08], [0, 0.92, -0.42], metal)
  addBox(gantry, [0.08, 0.62, 0.08], [0, 0.92, 0.42], metal)
  addBox(gantry, [0.08, 0.08, 0.92], [0, 1.22, 0], metal)
  addBox(gantry, [0.16, 0.2, 0.13], [0, 1.08, 0], standardMaterial(pearl, accent, 0.28))
  parent.add(gantry)

  const path = addLine(parent, [
    new THREE.Vector3(-0.42, 0.73, -0.2),
    new THREE.Vector3(0.12, 0.73, -0.3),
    new THREE.Vector3(0.64, 0.73, 0.02),
    new THREE.Vector3(0.18, 0.73, 0.28),
  ], accent, 0.58, true)
  const scanMaterial = path.material as THREE.LineBasicMaterial

  return (time, active) => {
    gantry.position.x = Math.sin(time * 1.15) * 0.58 + 0.18
    scanMaterial.opacity = (active ? 0.72 : 0.42) + Math.sin(time * 2.1) * 0.12
  }
}

function createSewing(parent: THREE.Group, zone: FactoryZone, accent: number): Motion {
  const tableMaterial = standardMaterial(0x253338, cyan, 0.08)
  const machineMaterial = standardMaterial(pearl, 0x32484a, 0.26, { roughness: 0.32 })
  const threadMaterial = standardMaterial(accent, accent, 0.92)
  const backlogMaterial = standardMaterial(0x512526, accent, 0.45)
  const count = window.innerWidth <= 760 ? 9 : Math.min(15, zone.stationCount)
  const columns = window.innerWidth <= 760 ? 3 : 5
  const rows = Math.ceil(count / columns)
  const tables = new THREE.InstancedMesh(new THREE.BoxGeometry(0.36, 0.08, 0.28), tableMaterial, count)
  const machines = new THREE.InstancedMesh(new THREE.BoxGeometry(0.15, 0.22, 0.14), machineMaterial, count)
  const matrix = new THREE.Matrix4()
  for (let index = 0; index < count; index += 1) {
    const column = index % columns
    const row = Math.floor(index / columns)
    const x = -0.94 + column * (1.88 / Math.max(1, columns - 1))
    const z = -0.38 + row * (0.76 / Math.max(1, rows - 1))
    matrix.makeTranslation(x, 0.69, z)
    tables.setMatrixAt(index, matrix)
    matrix.makeTranslation(x - 0.03, 0.83, z)
    machines.setMatrixAt(index, matrix)
  }
  tables.instanceMatrix.needsUpdate = true
  machines.instanceMatrix.needsUpdate = true
  parent.add(tables, machines)

  const spools = [-0.62, 0, 0.62].map((x) => {
    const spool = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.017, 8, 20), threadMaterial.clone())
    spool.position.set(x, 1.08, -0.04)
    spool.rotation.x = Math.PI / 2
    parent.add(spool)
    return spool
  })
  const backlog = [-0.54, -0.18, 0.18, 0.54].map((x) => addBox(parent, [0.27, 0.11, 0.2], [x, 0.7, 0.63], backlogMaterial.clone()))

  return (time, active) => {
    spools.forEach((spool, index) => { spool.rotation.z = time * (1.2 + index * 0.14) })
    backlog.forEach((box, index) => {
      const pulse = 1 + Math.max(0, Math.sin(time * 2.3 - index * 0.55)) * (active ? 0.14 : 0.06)
      box.scale.setScalar(pulse)
    })
  }
}

function createInboundInspection(parent: THREE.Group, accent: number): Motion {
  const conveyor = standardMaterial(graphite, cyan, 0.14)
  const frame = standardMaterial(coolMetal, accent, 0.32)
  const scanMaterial = standardMaterial(accent, accent, 0.7, { transparent: true, opacity: 0.28, metalness: 0.05 })
  addBox(parent, [2.05, 0.14, 0.72], [0, 0.65, 0], conveyor)
  addGate(parent, 0, frame)
  const scan = addBox(parent, [0.035, 0.62, 0.68], [-0.72, 1.02, 0], scanMaterial)
  const passCells = [-0.62, 0, 0.62].map((x) => addBox(parent, [0.28, 0.13, 0.28], [x, 0.8, 0], standardMaterial(pearl, accent, 0.18)))
  return (time, active) => {
    scan.position.x = Math.sin(time * 1.3) * 0.72
    scanMaterial.opacity = active ? 0.46 : 0.24
    passCells.forEach((cell, index) => { cell.position.y = 0.8 + Math.sin(time * 2 - index * 0.7) * 0.025 })
  }
}

function createSpecialCell(parent: THREE.Group, accent: number): Motion {
  const shell = standardMaterial(0x20282b, accent, 0.18)
  const toolMaterial = standardMaterial(pearl, cyan, 0.22)
  addCylinder(parent, 0.68, 0.15, [0, 0.66, 0], shell)
  addCylinder(parent, 0.34, 0.55, [0, 0.98, 0], standardMaterial(0x142126, cyan, 0.2))
  const turret = new THREE.Group()
  const toolHeads: THREE.Mesh[] = []
  for (let index = 0; index < 4; index += 1) {
    const angle = index * Math.PI / 2
    const head = addBox(turret, [0.2, 0.3, 0.2], [Math.cos(angle) * 0.52, 1.22, Math.sin(angle) * 0.52], toolMaterial.clone())
    head.rotation.y = -angle
    toolHeads.push(head)
  }
  parent.add(turret)
  const changeover = new THREE.Mesh(new THREE.TorusGeometry(0.79, 0.035, 10, 40), standardMaterial(accent, accent, 1.1))
  changeover.position.y = 0.72
  changeover.rotation.x = Math.PI / 2
  parent.add(changeover)
  return (time, active) => {
    turret.rotation.y = time * (active ? 0.72 : 0.28)
    changeover.rotation.z = -time * 0.42
    toolHeads.forEach((head, index) => { head.position.y = 1.22 + Math.sin(time * 1.7 + index) * 0.035 })
  }
}

function createQueueInspection(parent: THREE.Group, accent: number): Motion {
  const queueMaterial = standardMaterial(0x55292b, accent, 0.52)
  const frame = standardMaterial(coolMetal, accent, 0.4)
  const laneMaterial = standardMaterial(0x111a1e, cyan, 0.12)
  ;[-0.42, 0, 0.42].forEach((z) => addBox(parent, [1.78, 0.07, 0.22], [-0.05, 0.63, z], laneMaterial))
  const queueCells: THREE.Mesh[] = []
  for (let lane = 0; lane < 3; lane += 1) {
    for (let slot = 0; slot < 3; slot += 1) {
      queueCells.push(addBox(parent, [0.28, 0.14, 0.17], [-0.76 + slot * 0.38, 0.75, -0.42 + lane * 0.42], queueMaterial.clone()))
    }
  }
  addGate(parent, 0.76, frame, 1.02)
  const scanMaterial = standardMaterial(accent, accent, 1.1, { transparent: true, opacity: 0.38, metalness: 0.05 })
  const scan = addBox(parent, [0.035, 0.72, 0.94], [0.48, 1.04, 0], scanMaterial)
  return (time, active) => {
    scan.position.x = 0.55 + Math.sin(time * 1.9) * 0.2
    scanMaterial.opacity = active ? 0.6 : 0.32
    queueCells.forEach((cell, index) => {
      const lanePulse = Math.max(0, Math.sin(time * 2.4 - index * 0.28))
      cell.position.y = 0.75 + lanePulse * (active ? 0.08 : 0.025)
    })
  }
}

function createFinishing(parent: THREE.Group, accent: number): Motion {
  const railMaterial = standardMaterial(coolMetal, cyan, 0.18)
  const garmentMaterial = standardMaterial(pearl, 0x31484a, 0.18, { roughness: 0.72, metalness: 0.08 })
  addBox(parent, [2, 0.07, 0.07], [0, 1.32, 0], railMaterial)
  addBox(parent, [0.07, 0.75, 0.07], [-0.94, 0.96, 0], railMaterial)
  addBox(parent, [0.07, 0.75, 0.07], [0.94, 0.96, 0], railMaterial)
  const garments = [-0.68, -0.34, 0, 0.34, 0.68].map((x) => addBox(parent, [0.22, 0.34, 0.06], [x, 1.08, 0], garmentMaterial.clone()))
  addBox(parent, [1.45, 0.11, 0.54], [0, 0.66, 0.38], standardMaterial(0x172329, cyan, 0.1))
  const steam = [-0.48, 0, 0.48].map((x, index) => {
    const material = standardMaterial(0xd8f4f4, accent, 0.45, { transparent: true, opacity: 0.16, metalness: 0 })
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.015, 8, 24), material)
    ring.position.set(x, 0.82 + index * 0.08, 0.4)
    ring.rotation.x = Math.PI / 2
    parent.add(ring)
    return { ring, material, phase: index * 1.35 }
  })
  return (time, active) => {
    garments.forEach((garment, index) => { garment.rotation.y = Math.sin(time * 0.8 + index * 0.4) * 0.05 })
    steam.forEach(({ ring, material, phase }) => {
      const cycle = (time * 0.38 + phase) % 1
      ring.position.y = 0.82 + cycle * 0.42
      ring.scale.setScalar(0.85 + cycle * 0.5)
      material.opacity = (1 - cycle) * (active ? 0.28 : 0.14)
    })
  }
}

function createFinalInspection(parent: THREE.Group, accent: number): Motion {
  const frame = standardMaterial(coolMetal, accent, 0.36)
  const bed = standardMaterial(0x162126, cyan, 0.12)
  addBox(parent, [2.02, 0.13, 0.72], [0, 0.65, 0], bed)
  addGate(parent, -0.42, frame)
  addGate(parent, 0.42, frame)
  const scans = [-0.42, 0.42].map((x) => {
    const material = standardMaterial(accent, accent, 0.9, { transparent: true, opacity: 0.25, metalness: 0 })
    const scan = addBox(parent, [0.028, 0.62, 0.68], [x, 1.02, 0], material)
    return { scan, material }
  })
  const diverter = new THREE.Group()
  addBox(diverter, [0.68, 0.06, 0.08], [0, 0.86, 0], standardMaterial(pearl, accent, 0.28))
  diverter.position.set(0.78, 0, 0)
  parent.add(diverter)
  return (time, active) => {
    scans.forEach(({ scan, material }, index) => {
      scan.position.x = (index ? 0.42 : -0.42) + Math.sin(time * 1.5 + index * Math.PI) * 0.12
      material.opacity = active ? 0.45 : 0.22
    })
    diverter.rotation.y = Math.sin(time * 0.85) * 0.24
  }
}

function createFolding(parent: THREE.Group, accent: number): Motion {
  const table = standardMaterial(0x1b292d, cyan, 0.14)
  const armMaterial = standardMaterial(coolMetal, accent, 0.3)
  const fabric = standardMaterial(0xd3dfdf, 0x304648, 0.2, { roughness: 0.75, metalness: 0.06 })
  addBox(parent, [1.46, 0.12, 0.8], [0, 0.68, 0], table)
  addBox(parent, [0.78, 0.06, 0.52], [0, 0.78, 0], fabric)
  const leftArm = new THREE.Group()
  leftArm.position.set(-0.74, 0.82, 0)
  addBox(leftArm, [0.72, 0.06, 0.08], [0.34, 0, 0], armMaterial)
  parent.add(leftArm)
  const rightArm = new THREE.Group()
  rightArm.position.set(0.74, 0.82, 0)
  addBox(rightArm, [0.72, 0.06, 0.08], [-0.34, 0, 0], armMaterial)
  parent.add(rightArm)
  const stacks = [0, 1, 2].map((index) => addBox(parent, [0.42, 0.07, 0.32], [0.78, 0.68 + index * 0.075, 0.45], fabric.clone()))
  return (time, active) => {
    const fold = Math.max(0, Math.sin(time * 1.25)) * (active ? 0.72 : 0.4)
    leftArm.rotation.z = -fold
    rightArm.rotation.z = fold
    stacks.forEach((stack, index) => { stack.position.y = 0.68 + index * 0.075 + Math.sin(time + index) * 0.008 })
  }
}

function createWarehouse(parent: THREE.Group, accent: number): Motion {
  const rackMaterial = standardMaterial(coolMetal, cyan, 0.16)
  const toteMaterial = standardMaterial(0xb8cacd, 0x2a4144, 0.2)
  const activeToteMaterial = standardMaterial(accent, accent, 0.7)
  ;[-0.68, 0.68].forEach((x) => {
    ;[-0.48, 0.48].forEach((z) => addBox(parent, [0.07, 0.92, 0.07], [x, 1.02, z], rackMaterial))
    ;[0.68, 0.98, 1.28].forEach((y) => addBox(parent, [0.86, 0.05, 1.02], [x, y, 0], rackMaterial))
  })
  const totes: THREE.Mesh[] = []
  ;[-0.68, 0.68].forEach((x, rackIndex) => {
    ;[0.78, 1.08].forEach((y, levelIndex) => {
      ;[-0.25, 0.25].forEach((z, cellIndex) => {
        totes.push(addBox(parent, [0.3, 0.17, 0.3], [x, y, z], rackIndex === 1 && levelIndex === 1 && cellIndex === 0 ? activeToteMaterial : toteMaterial.clone()))
      })
    })
  })
  const agv = new THREE.Group()
  addBox(agv, [0.58, 0.16, 0.42], [0, 0.69, 0], standardMaterial(0x18262b, accent, 0.32))
  addBox(agv, [0.34, 0.11, 0.28], [0, 0.82, 0], toteMaterial)
  parent.add(agv)
  addLine(parent, [new THREE.Vector3(0, 0.61, -0.62), new THREE.Vector3(0, 0.61, 0.62)], accent, 0.46)
  return (time, active) => {
    agv.position.z = Math.sin(time * 0.72) * 0.58
    agv.position.y = active ? 0.05 : 0
    totes.forEach((tote, index) => { tote.scale.setScalar(1 + Math.max(0, Math.sin(time * 1.1 - index * 0.4)) * 0.025) })
  }
}

export function createProcessIsland(zone: FactoryZone, accent: number): ProcessIsland {
  const group = new THREE.Group()
  group.name = `${zone.id}-process-island`
  group.position.set(...zone.visual.offset)
  group.scale.setScalar(zone.visual.scale)

  const builders: Record<FactoryZone['visual']['kind'], () => Motion> = {
    cutting: () => createCutting(group, accent),
    sewing: () => createSewing(group, zone, accent),
    'inspection-inbound': () => createInboundInspection(group, accent),
    'special-cell': () => createSpecialCell(group, accent),
    'inspection-queue': () => createQueueInspection(group, accent),
    finishing: () => createFinishing(group, accent),
    'inspection-final': () => createFinalInspection(group, accent),
    folding: () => createFolding(group, accent),
    warehouse: () => createWarehouse(group, accent),
  }
  const motion = builders[zone.visual.kind]()
  return {
    group,
    update: (elapsedSeconds, active) => motion(elapsedSeconds * zone.visual.motionRate, active),
  }
}
