import type { ActionPackage, ChartStoryChapter, V3ChartId } from '../types'

export const v3StoryChapters: readonly ChartStoryChapter[] = [
  {
    id: 'management', order: 1, title: '管理态势', kicker: 'EXECUTIVE PULSE', duration: 10,
    narrative: '先看影响经营目标的首要问题，再决定本次讲解的下钻路径。',
    conclusion: 'QC2-1待检队列是当前首要约束，延误风险量为286 pcs。',
    chartIds: ['health-radar', 'issue-scatter'], focusIssueId: 'EFF-001',
  },
  {
    id: 'locate', order: 2, title: '问题定位', kicker: 'CONSTRAINT LOCATOR', duration: 12,
    narrative: '沿九道工序对比等待、在制、不良和节拍，定位异常集中区。',
    conclusion: 'QC2-1队列超阈，同时缝制三组在制偏高，需优先复核两处节拍。',
    chartIds: ['process-heatmap'], focusIssueId: 'EFF-001',
  },
  {
    id: 'evidence', order: 3, title: '数据证据', kicker: 'EVIDENCE WINDOW', duration: 14,
    narrative: '对齐计划、质量、在制与事件时间线，确认问题出现的时间窗口。',
    conclusion: '待检峰值与上游在制高点处于同一演示时间窗，但尚不能视为确定因果。',
    chartIds: ['completion-trend', 'defect-trend', 'queue-area', 'evidence-timeline'], focusIssueId: 'EFF-001',
  },
  {
    id: 'reason', order: 4, title: '原因分析', kicker: 'EXPLAINABLE CAUSE', duration: 14,
    narrative: '将事实证据、原因线索、AI假设和待确认项分层呈现。',
    conclusion: '送检批次集中与检验能力未随批量调整，是当前最值得现场验证的两项原因。',
    chartIds: ['defect-pareto', 'reason-waterfall', 'causal-graph'], focusIssueId: 'EFF-001',
  },
  {
    id: 'solution', order: 5, title: '方案模拟', kicker: 'ACTION SIMULATION', duration: 16,
    narrative: '选择预设措施组合，比较改善前后指标及实施验证要求。',
    conclusion: '建议先拆分送检波次并执行小时级线平衡，再以待检峰值和等待时长验证。',
    chartIds: ['action-matrix', 'improvement-compare'], focusIssueId: 'EFF-001',
  },
  {
    id: 'responsibility', order: 6, title: '责任与验证', kicker: 'OWNER & VALIDATION', duration: 12,
    narrative: '把问题、措施、建议责任岗位和验证状态关联到同一闭环。',
    conclusion: '建议由品质部与生产部共同复核，责任关联与结论均需客户确认。',
    chartIds: ['responsibility-sankey', 'validation-progress'], focusIssueId: 'EFF-001',
  },
] as const

export const v3StoryDuration = v3StoryChapters.reduce((sum, chapter) => sum + chapter.duration, 0)

export const v3ChartMeta: Record<V3ChartId, { title: string; kicker: string; source: string; definition: string }> = {
  'health-radar': { title: '生产健康雷达', kicker: 'HEALTH INDEX', source: '演示：MES/QMS管理切片', definition: '六维得分越高表示运行状态越健康' },
  'issue-scatter': { title: '问题影响分布', kicker: 'ISSUE IMPACT', source: '演示：异常问题池', definition: '影响量×发生频次，气泡表示置信度' },
  'process-heatmap': { title: '工序流程热力', kicker: 'PROCESS HEAT', source: '演示：工序实时切片', definition: '等待、在制、不良与节拍标准化风险值' },
  'completion-trend': { title: '计划达成率趋势', kicker: 'PLAN TREND', source: '演示：生产报工', definition: '当日分时累计完成量/计划量' },
  'defect-trend': { title: '不良率同期趋势', kicker: 'QUALITY TREND', source: '演示：质量检验', definition: '不良数量/检验数量；仅作同期线索' },
  'defect-pareto': { title: '不良原因Pareto', kicker: 'DEFECT PARETO', source: '演示：QMS不良明细', definition: '不良数量及累计占比' },
  'queue-area': { title: '在制与待检堆积', kicker: 'QUEUE LOAD', source: '演示：工序在制快照', definition: '缝制、QC2-1、整理分时队列量' },
  'evidence-timeline': { title: '事件证据时间线', kicker: 'EVENT TRACE', source: '演示：MES/QMS事件', definition: '批次完成、送检、异常与放行事件' },
  'causal-graph': { title: '问题因果关系', kicker: 'CAUSAL GRAPH', source: '演示：数据证据与知识依据', definition: '事实、相关性、AI假设和建议关系' },
  'reason-waterfall': { title: '原因贡献拆分', kicker: 'CAUSE IMPACT', source: '演示：原因贡献估算', definition: '原因线索对问题影响的演示拆分' },
  'action-matrix': { title: '方案优先级矩阵', kicker: 'ACTION PRIORITY', source: '演示：改善建议池', definition: '实施难度×预期影响；大小表示数据完整度' },
  'improvement-compare': { title: '改善前后对比', kicker: 'BEFORE / AFTER', source: '演示：预设改善快照', definition: '改善模拟，不代表实际预测结果' },
  'responsibility-sankey': { title: '责任关联路径', kicker: 'OWNER LINK', source: '演示：责任映射', definition: '建议关联，待客户确认' },
  'validation-progress': { title: '验证闭环进度', kicker: 'VALIDATION LOOP', source: '演示：待确认清单', definition: '待确认、待采集、可验证和已具备证据' },
}

export const actionPackages: readonly ActionPackage[] = [
  {
    id: 'AP-EFF-001-A', issueId: 'EFF-001', title: '队列快速恢复组合',
    actions: ['拆分送检波次', '小时级线平衡', '设置待检峰值预警'],
    prerequisites: ['确认QC2-1可用工位与班次能力', '复核送检批次时间戳完整性'],
    validationMetrics: ['待检峰值', '平均等待时长', '计划达成率'],
    responsibility: { department: '品质部 / 生产部', role: 'QC2组长 / 生产调度', confirmation: '建议关联，待客户确认' },
    improvement: { status: 'simulation', queueBefore: 286, queueAfter: 128, completionBefore: 92.4, completionAfter: 96.1, disclaimer: '演示模拟，不代表实际预测结果' },
    disclaimer: '演示模拟，不代表实际预测结果',
  },
  {
    id: 'AP-EFF-001-B', issueId: 'EFF-001', title: '检验能力复核组合',
    actions: ['复核检验标准工时', '按款号拆分检验优先级', '建立小时级队列复盘'],
    prerequisites: ['取得各款号检验标准工时', '确认临时调整岗位权限'],
    validationMetrics: ['小时通过量', '队列消退时间', '后工序缺料时长'],
    responsibility: { department: '品质部 / IE工程', role: '品质主管 / IE工程师', confirmation: '建议关联，待客户确认' },
    improvement: null,
    disclaimer: '待建立现场基线后才能形成改善前后数值',
  },
] as const

export const defaultActionPackage = actionPackages[0]
