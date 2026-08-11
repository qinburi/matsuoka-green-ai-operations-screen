import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

export type IndustrialMaterialFamily = 'graphite' | 'metal' | 'pearl' | 'rubber' | 'fabric' | 'glass' | 'accent' | 'warning' | 'critical'

export interface IndustrialKit {
  material: (family: IndustrialMaterialFamily, accent?: number) => THREE.MeshStandardMaterial
  animatedMaterial: (family: IndustrialMaterialFamily, accent?: number) => THREE.MeshStandardMaterial
  roundedBox: (parent: THREE.Object3D, size: [number, number, number], position: [number, number, number], material: THREE.Material, radius?: number) => THREE.Mesh
  box: (parent: THREE.Object3D, size: [number, number, number], position: [number, number, number], material: THREE.Material) => THREE.Mesh
  cylinder: (parent: THREE.Object3D, radius: number, height: number, position: [number, number, number], material: THREE.Material, rotation?: [number, number, number], radialSegments?: number) => THREE.Mesh
  torus: (parent: THREE.Object3D, radius: number, tube: number, position: [number, number, number], material: THREE.Material, rotation?: [number, number, number]) => THREE.Mesh
  conveyor: (parent: THREE.Object3D, length: number, width: number, position: [number, number, number], accent?: number) => THREE.Group
  frame: (parent: THREE.Object3D, width: number, height: number, depth: number, position: [number, number, number], material: THREE.Material) => THREE.Group
  gate: (parent: THREE.Object3D, width: number, height: number, position: [number, number, number], accent: number) => THREE.Group
  crate: (parent: THREE.Object3D, size: [number, number, number], position: [number, number, number], material?: THREE.Material) => THREE.Group
  controlUnit: (parent: THREE.Object3D, position: [number, number, number], accent: number) => THREE.Group
  contactShadow: (parent: THREE.Object3D, radiusX: number, radiusZ: number, opacity?: number) => THREE.Group
  dispose: () => void
}

const palette: Record<IndustrialMaterialFamily, { color: number; roughness: number; metalness: number; opacity?: number }> = {
  graphite: { color: 0x121b1f, roughness: 0.72, metalness: 0.34 },
  metal: { color: 0x668087, roughness: 0.34, metalness: 0.72 },
  pearl: { color: 0xc7d4d6, roughness: 0.3, metalness: 0.42 },
  rubber: { color: 0x11181b, roughness: 0.94, metalness: 0.06 },
  fabric: { color: 0xcbd8d8, roughness: 0.88, metalness: 0.02 },
  glass: { color: 0x72d8e8, roughness: 0.18, metalness: 0.08, opacity: 0.2 },
  accent: { color: 0x39d98a, roughness: 0.26, metalness: 0.2 },
  warning: { color: 0xe6ad4e, roughness: 0.34, metalness: 0.22 },
  critical: { color: 0xe66b64, roughness: 0.34, metalness: 0.18 },
}

export function createIndustrialKit(isMobile: boolean): IndustrialKit {
  const geometries = new Map<string, THREE.BufferGeometry>()
  const materials = new Map<string, THREE.MeshStandardMaterial>()
  const shadowsEnabled = !isMobile

  function getGeometry(key: string, factory: () => THREE.BufferGeometry) {
    const cached = geometries.get(key)
    if (cached) return cached
    const geometry = factory()
    geometries.set(key, geometry)
    return geometry
  }

  function material(family: IndustrialMaterialFamily, accent?: number) {
    const source = palette[family]
    const color = family === 'accent' && accent ? accent : source.color
    const key = `${family}-${color}`
    const cached = materials.get(key)
    if (cached) return cached
    const transparent = source.opacity !== undefined
    const created = new THREE.MeshStandardMaterial({
      color,
      emissive: family === 'accent' || family === 'warning' || family === 'critical' ? color : 0x000000,
      emissiveIntensity: family === 'accent' ? 0.72 : family === 'warning' || family === 'critical' ? 0.48 : 0,
      roughness: source.roughness,
      metalness: source.metalness,
      transparent,
      opacity: source.opacity ?? 1,
      depthWrite: !transparent,
    })
    materials.set(key, created)
    return created
  }

  function animatedMaterial(family: IndustrialMaterialFamily, accent?: number) {
    return material(family, accent).clone()
  }

  function configure(mesh: THREE.Mesh) {
    mesh.castShadow = shadowsEnabled
    mesh.receiveShadow = shadowsEnabled
    return mesh
  }

  function roundedBox(
    parent: THREE.Object3D,
    size: [number, number, number],
    position: [number, number, number],
    targetMaterial: THREE.Material,
    radius = 0.045,
  ) {
    const [width, height, depth] = size
    const segments = isMobile ? 1 : 2
    const key = `rounded-${width}-${height}-${depth}-${radius}-${segments}`
    const geometry = getGeometry(key, () => new RoundedBoxGeometry(width, height, depth, segments, Math.min(radius, width / 4, height / 4, depth / 4)))
    const mesh = configure(new THREE.Mesh(geometry, targetMaterial))
    mesh.position.set(...position)
    parent.add(mesh)
    return mesh
  }

  function box(parent: THREE.Object3D, size: [number, number, number], position: [number, number, number], targetMaterial: THREE.Material) {
    const key = `box-${size.join('-')}`
    const mesh = configure(new THREE.Mesh(getGeometry(key, () => new THREE.BoxGeometry(...size)), targetMaterial))
    mesh.position.set(...position)
    parent.add(mesh)
    return mesh
  }

  function cylinder(
    parent: THREE.Object3D,
    radius: number,
    height: number,
    position: [number, number, number],
    targetMaterial: THREE.Material,
    rotation: [number, number, number] = [0, 0, 0],
    radialSegments = isMobile ? 10 : 18,
  ) {
    const key = `cylinder-${radius}-${height}-${radialSegments}`
    const mesh = configure(new THREE.Mesh(getGeometry(key, () => new THREE.CylinderGeometry(radius, radius, height, radialSegments)), targetMaterial))
    mesh.position.set(...position)
    mesh.rotation.set(...rotation)
    parent.add(mesh)
    return mesh
  }

  function torus(
    parent: THREE.Object3D,
    radius: number,
    tube: number,
    position: [number, number, number],
    targetMaterial: THREE.Material,
    rotation: [number, number, number] = [Math.PI / 2, 0, 0],
  ) {
    const radialSegments = isMobile ? 6 : 10
    const tubularSegments = isMobile ? 20 : 40
    const key = `torus-${radius}-${tube}-${radialSegments}-${tubularSegments}`
    const mesh = configure(new THREE.Mesh(getGeometry(key, () => new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments)), targetMaterial))
    mesh.position.set(...position)
    mesh.rotation.set(...rotation)
    parent.add(mesh)
    return mesh
  }

  function conveyor(parent: THREE.Object3D, length: number, width: number, position: [number, number, number], accent = 0x59cbe8) {
    const group = new THREE.Group()
    group.position.set(...position)
    roundedBox(group, [length, 0.12, width], [0, 0, 0], material('rubber'), 0.04)
    box(group, [length, 0.06, 0.045], [0, 0.09, -width / 2], material('metal'))
    box(group, [length, 0.06, 0.045], [0, 0.09, width / 2], material('metal'))
    const markerMaterial = animatedMaterial('accent', accent)
    markerMaterial.emissiveIntensity = 0.32
    const markerCount = Math.max(3, Math.round(length / 0.34))
    const markerGeometry = getGeometry('conveyor-marker', () => new THREE.BoxGeometry(0.12, 0.012, 0.018))
    const markers = new THREE.InstancedMesh(markerGeometry, markerMaterial, markerCount)
    const matrix = new THREE.Matrix4()
    for (let index = 0; index < markerCount; index += 1) {
      matrix.makeTranslation(-length / 2 + (index + 0.5) * length / markerCount, 0.075, 0)
      markers.setMatrixAt(index, matrix)
    }
    markers.instanceMatrix.needsUpdate = true
    group.add(markers)
    parent.add(group)
    return group
  }

  function frame(parent: THREE.Object3D, width: number, height: number, depth: number, position: [number, number, number], targetMaterial: THREE.Material) {
    const group = new THREE.Group()
    group.position.set(...position)
    const beam = 0.055
    ;[-width / 2, width / 2].forEach((x) => {
      ;[-depth / 2, depth / 2].forEach((z) => box(group, [beam, height, beam], [x, height / 2, z], targetMaterial))
    })
    box(group, [width + beam, beam, depth + beam], [0, height, 0], targetMaterial)
    parent.add(group)
    return group
  }

  function gate(parent: THREE.Object3D, width: number, height: number, position: [number, number, number], accent: number) {
    const gateGroup = new THREE.Group()
    gateGroup.position.set(...position)
    const targetMaterial = material('metal')
    box(gateGroup, [0.07, height, 0.07], [0, height / 2, -width / 2], targetMaterial)
    box(gateGroup, [0.07, height, 0.07], [0, height / 2, width / 2], targetMaterial)
    box(gateGroup, [0.07, 0.07, width + 0.08], [0, height, 0], targetMaterial)
    const lamp = roundedBox(gateGroup, [0.12, 0.08, width * 0.52], [0, height - 0.04, 0], material('accent', accent), 0.025)
    lamp.layers.enable(1)
    parent.add(gateGroup)
    return gateGroup
  }

  function crate(parent: THREE.Object3D, size: [number, number, number], position: [number, number, number], targetMaterial: THREE.Material = material('fabric')) {
    const group = new THREE.Group()
    group.position.set(...position)
    roundedBox(group, size, [0, 0, 0], targetMaterial, 0.035)
    parent.add(group)
    return group
  }

  function controlUnit(parent: THREE.Object3D, position: [number, number, number], accent: number) {
    const group = new THREE.Group()
    group.position.set(...position)
    roundedBox(group, [0.28, 0.5, 0.22], [0, 0.25, 0], material('graphite'), 0.05)
    const screen = roundedBox(group, [0.012, 0.2, 0.15], [-0.145, 0.34, 0], material('accent', accent), 0.018)
    screen.layers.enable(1)
    parent.add(group)
    return group
  }

  function contactShadow(parent: THREE.Object3D, radiusX: number, radiusZ: number, opacity = 0.2) {
    const group = new THREE.Group()
    if (!shadowsEnabled) return group
    const shadow = new THREE.Mesh(
      getGeometry('shadow-contact', () => new THREE.CircleGeometry(1, 36)),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: opacity * 0.62, depthWrite: false }),
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = -0.002
    shadow.scale.set(radiusX, radiusZ, 1)
    group.add(shadow)
    parent.add(group)
    return group
  }

  function dispose() {
    geometries.forEach((geometry) => geometry.dispose())
    materials.forEach((targetMaterial) => targetMaterial.dispose())
    geometries.clear()
    materials.clear()
  }

  return { material, animatedMaterial, roundedBox, box, cylinder, torus, conveyor, frame, gate, crate, controlUnit, contactShadow, dispose }
}
