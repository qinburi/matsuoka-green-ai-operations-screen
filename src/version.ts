export type VersionStatus = 'current' | 'archived'

export interface VersionChange {
  id: string
  changedAt: string
  category: string
  title: string
  description: string
}

export interface VersionRelease {
  version: string
  releasedAt: string
  title: string
  status: VersionStatus
  prototypeRoutes: Record<'overview' | 'analysis', string>
  highlights: readonly string[]
  boundaries: readonly string[]
  changes: readonly VersionChange[]
}

export const CURRENT_PRODUCT_VERSION = 'v2.0.0'

// Future versions are added here manually together with their routes and append-only changes.
export const versionHistory: readonly VersionRelease[] = [
  {
    version: 'v2.0.0',
    releasedAt: '2026-08-11',
    title: '三维生产指挥舱',
    status: 'current',
    prototypeRoutes: { overview: 'overview', analysis: 'analysis' },
    highlights: [
      '新增九类纯 Three.js 程序化未来微缩工厂节点，支持工序聚焦、旋转、缩放和机构动画。',
      '新增90秒效率与质量联动演示，支持暂停、跳转、重播和自由探索。',
      '重构AI决策舱，将影响、依据、措施和建议责任岗位作为常驻结论。',
      '明确区分事实、同期关联、AI假设和待现场确认项。',
      '提供WebGL失败后的ECharts二维生产拓扑降级方案。',
    ],
    boundaries: [
      '三维场景为抽象演示拓扑，不代表松冈真实厂区布局。',
      '当前使用演示数据，未连接松冈真实生产接口或CPU小模型服务。',
      '质量与效率仅展示同期关联线索，不作为已确认因果。',
      '责任部门与岗位为建议关联，不包含任务分派和闭环处理。',
    ],
    changes: [
      {
        id: 'v2-command-center',
        changedAt: '2026-08-11',
        category: '指挥舱改版',
        title: '从图表看板升级为三维生产指挥舱',
        description: '分析页升级为 Three.js 三维生产指挥舱和90秒引导演示。',
      },
      {
        id: 'v2-process-islands',
        changedAt: '2026-08-11',
        category: '工序视觉',
        title: '新增九类程序化工序岛',
        description: '增加九类纯 Three.js 程序化微缩工厂节点，不使用AI位图。',
      },
      {
        id: 'v2-stability',
        changedAt: '2026-08-11',
        category: '稳定性',
        title: '完善场景交互与降级保障',
        description: '完善三维点击、异常状态静止、类型检查和二维拓扑降级。',
      },
    ],
  },
  {
    version: 'v1.0.0',
    releasedAt: '2026-08-10',
    title: '绿色AI生产运营诊断大屏首版',
    status: 'archived',
    prototypeRoutes: { overview: 'v1-overview', analysis: 'v1-analysis' },
    highlights: [
      '保留工厂数字化运营中心底图，增加综合入口与三个业务热点。',
      '提供生产效率、质量分析、工艺改善路径三类诊断主题。',
      '支持问题星图、趋势与优先级联动，并下钻原因、证据、方案和建议责任岗位。',
    ],
    boundaries: [
      '使用演示数据和前端交互演示，未连接真实生产接口或模型服务。',
    ],
    changes: [
      {
        id: 'v1-launch',
        changedAt: '2026-08-10',
        category: '首版发布',
        title: '建立绿色AI生产运营诊断原型',
        description: '增加绿色AI综合入口和三个业务热点，形成效率、质量、工艺改善三类图表式诊断。',
      },
      {
        id: 'v1-version-entry',
        changedAt: '2026-08-10',
        category: '版本管理',
        title: '新增顶部版本说明入口',
        description: '增加顶部版本号、版本内容和交付边界查看入口。',
      },
    ],
  },
] as const

export const versionRelease = versionHistory.find((release) => release.version === CURRENT_PRODUCT_VERSION)
  ?? versionHistory[0]

export function findVersionRelease(version: string) {
  return versionHistory.find((release) => release.version === version) ?? versionRelease
}
