export const factoryZonesRaw = Object.freeze([
  { id: 'cutting', label: '裁断任务区', shortLabel: '裁断', stage: '裁断', position: [-7.2, 0, -2.7], health: 'warning', metric: '计划偏差', metricValue: '152 pcs', issueIds: ['EFF-003', 'QUA-005'], stationCount: 8, visual: { kind: 'cutting', scale: 1, offset: [0, 0, 0], motionRate: 0.82 } },
  { id: 'sewing', label: '缝制三组', shortLabel: '缝制', stage: '缝制', position: [-4.5, 0, 0.2], health: 'critical', metric: '在制 / 不良', metricValue: '214 / 26 pcs', issueIds: ['EFF-002', 'QUA-001', 'QUA-002', 'QUA-003'], stationCount: 18, visual: { kind: 'sewing', scale: 0.96, offset: [0, 0, 0], motionRate: 1.08 } },
  { id: 'qc1', label: 'QC1 检验', shortLabel: 'QC1', stage: 'QC1', position: [-1.8, 0, -2.7], health: 'normal', metric: '状态', metricValue: '正常', issueIds: [], stationCount: 6, visual: { kind: 'inspection-inbound', scale: 1, offset: [0, 0, 0], motionRate: 0.72 } },
  { id: 'special', label: '特殊工艺', shortLabel: '特殊', stage: '特殊工艺', position: [0.9, 0, 0.2], health: 'warning', metric: '换款等待', metricValue: '96 pcs', issueIds: ['EFF-004', 'IMP-004'], stationCount: 7, visual: { kind: 'special-cell', scale: 0.98, offset: [0, 0, 0], motionRate: 0.66 } },
  { id: 'qc21', label: 'QC2-1 待检区', shortLabel: 'QC2-1', stage: 'QC2-1', position: [3.6, 0, -2.7], health: 'critical', metric: '延误风险', metricValue: '286 pcs', issueIds: ['EFF-001'], stationCount: 10, visual: { kind: 'inspection-queue', scale: 1, offset: [0, 0, 0], motionRate: 1.16 } },
  { id: 'finishing', label: '整理作业区', shortLabel: '整理', stage: '整理', position: [6.3, 0, 0.2], health: 'normal', metric: '状态', metricValue: '正常', issueIds: [], stationCount: 8, visual: { kind: 'finishing', scale: 0.98, offset: [0, 0, 0], motionRate: 0.58 } },
  { id: 'qc22', label: 'QC2-2 终检', shortLabel: 'QC2-2', stage: 'QC2-2', position: [3.6, 0, 3.1], health: 'normal', metric: '状态', metricValue: '正常', issueIds: [], stationCount: 7, visual: { kind: 'inspection-final', scale: 1, offset: [0, 0, 0], motionRate: 0.76 } },
  { id: 'folding', label: '叠衣作业区', shortLabel: '叠衣', stage: '叠衣', position: [0.9, 0, 3.1], health: 'normal', metric: '状态', metricValue: '正常', issueIds: [], stationCount: 9, visual: { kind: 'folding', scale: 1, offset: [0, 0, 0], motionRate: 0.7 } },
  { id: 'warehouse', label: '出荷前仓库', shortLabel: '仓库', stage: '出荷前仓库', position: [-1.8, 0, 3.1], health: 'attention', metric: '待放行', metricValue: '64 pcs', issueIds: ['EFF-005'], stationCount: 12, visual: { kind: 'warehouse', scale: 0.96, offset: [0, 0, 0], motionRate: 0.62 } },
])

export const issueRelationsRaw = Object.freeze([
  {
    id: 'REL-DEMO-001', sourceIssueId: 'EFF-002', targetIssueId: 'QUA-001', type: 'correlation', confidence: 0.78,
    label: '同期关联·待现场确认',
    evidence: ['同一演示时间窗发生于缝制三组', '在制超阈与缝皱异常同期出现'],
    confirmation: 'pending',
  },
  {
    id: 'REL-DEMO-002', sourceIssueId: 'EFF-001', targetIssueId: 'EFF-002', type: 'ai-hypothesis', confidence: 0.72,
    label: 'AI假设·待验证',
    evidence: ['待检队列与在制高点在演示时间窗重叠'],
    confirmation: 'pending',
  },
])

export const demoScenarioRaw = Object.freeze({
  id: 'eff-quality',
  title: '效率与质量联动诊断',
  totalDuration: 90,
  chapters: [
    { id: 'boot', order: 1, title: '绿色AI校验', kicker: 'GREEN AI READY', duration: 8, narrative: '已清洗数据、内部知识与CPU小模型正在对齐。', focusZoneId: null, focusIssueId: null, camera: { position: [17, 14, 18], target: [0, 0, 0], duration: 1200 }, evidenceMode: 'hidden' },
    { id: 'overview', order: 2, title: '全厂健康态势', kicker: 'FACTORY PULSE', duration: 12, narrative: '计划达成率92.4%，延误风险量286 pcs，不良率2.3%。', focusZoneId: null, focusIssueId: null, camera: { position: [14, 11, 15], target: [0, 0, 0], duration: 1100 }, evidenceMode: 'metrics' },
    { id: 'qc21', order: 3, title: 'QC2-1待检超阈', kicker: 'PRIMARY CONSTRAINT', duration: 16, narrative: '待检队列持续高于演示阈值，后续整理与叠衣出现等料。', focusZoneId: 'qc21', focusIssueId: 'EFF-001', camera: { position: [8.4, 6.4, 3.8], target: [3.6, 0.4, -2.7], duration: 1050 }, evidenceMode: 'metrics' },
    { id: 'sewing', order: 4, title: '缝制三组双异常', kicker: 'CROSS-SIGNAL', duration: 16, narrative: '在制堆积与缝皱异常同期出现，当前只能标记为相关性线索。', focusZoneId: 'sewing', focusIssueId: 'QUA-001', camera: { position: [-0.8, 6.1, 7.2], target: [-4.5, 0.4, 0.2], duration: 1050 }, evidenceMode: 'relationship' },
    { id: 'explain', order: 5, title: '可解释分析链', kicker: 'EVIDENCE TRACE', duration: 16, narrative: '区分数据事实、知识匹配、AI假设与待确认项，不把相关性包装成因果。', focusZoneId: 'sewing', focusIssueId: 'QUA-001', camera: { position: [2.5, 8.8, 12.8], target: [-1.1, 0.2, 0.4], duration: 1200 }, evidenceMode: 'relationship' },
    { id: 'actions', order: 6, title: '改善动作组合', kicker: 'ACTION PACKAGE', duration: 14, narrative: '先拆分送检波次与小时级线平衡，同步恢复首件参数并缩短高风险巡检周期。', focusZoneId: 'sewing', focusIssueId: 'EFF-002', camera: { position: [9.2, 8.4, 13.5], target: [-0.6, 0.1, 0.3], duration: 1200 }, evidenceMode: 'actions' },
    { id: 'summary', order: 7, title: '管理决策摘要', kicker: 'EXECUTIVE BRIEF', duration: 8, narrative: '优先复核QC2-1待检队列和缝制三组节拍，再验证质量与在制的关联是否成立。', focusZoneId: null, focusIssueId: 'EFF-001', camera: { position: [14.8, 11.5, 15.8], target: [0, 0, 0], duration: 1250 }, evidenceMode: 'summary' },
  ],
})
