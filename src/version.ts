export interface VersionRelease {
  version: string
  releasedAt: string
  title: string
  highlights: readonly string[]
  boundaries: readonly string[]
}

export const versionHistory: readonly VersionRelease[] = [
  {
    version: `v${__APP_VERSION__}`,
    releasedAt: '2026-08-11',
    title: '三维生产指挥舱',
    highlights: [
      '新增基于 Three.js 的抽象工厂数字孪生场景，支持工序聚焦、旋转和缩放。',
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
  },
  {
    version: 'v1.0.0',
    releasedAt: '2026-08-10',
    title: '绿色AI生产运营诊断大屏首版',
    highlights: [
      '保留工厂数字化运营中心底图，增加综合入口与三个业务热点。',
      '提供生产效率、质量分析、工艺改善路径三类诊断主题。',
      '支持问题星图、趋势与优先级联动，并下钻原因、证据、方案和建议责任岗位。',
    ],
    boundaries: [
      '使用演示数据和前端交互演示，未连接真实生产接口或模型服务。',
    ],
  },
] as const

export const versionRelease = versionHistory[0]
