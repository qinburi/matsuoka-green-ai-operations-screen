import type { DemoScenario, FactoryZone, IssueRelation, SceneNode } from '../types'
import { demoScenarioRaw, factoryZonesRaw, issueRelationsRaw } from './factory-scene-raw.mjs'

export const factoryZones = factoryZonesRaw as FactoryZone[]
export const issueRelations = issueRelationsRaw as IssueRelation[]
export const demoScenario = demoScenarioRaw as DemoScenario

export const sceneNodes: SceneNode[] = factoryZones.map((zone) => ({
  id: `zone-${zone.id}`,
  zoneId: zone.id,
  kind: 'zone',
  position: zone.position,
  issueIds: zone.issueIds,
}))

export const zoneById = new Map(factoryZones.map((zone) => [zone.id, zone]))
