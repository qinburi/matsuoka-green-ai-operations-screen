import type {
  DutyFact,
  HealthProblem,
  InterventionRecord,
  LifecycleNode,
  LifecycleNodeId,
  ManagementAction,
  SolutionEffectiveness,
} from '../types'

export const lifecycleNodes: LifecycleNode[] = [
  { id: 'order-plan', order: 1, label: '订单与计划', shortLabel: '计划', department: '计划部', dataSource: '演示：订单计划与MES工单', health: 'notice', impactIndex: 38, issueCount: 2, coreMetric: { label: '计划达成率', value: 92.4, unit: '%', definition: '已完成合格数量 / 当期计划数量' }, updatedAt: '2026-08-12 14:20', issueIds: ['P-PLAN-01'] },
  { id: 'procurement', order: 2, label: '采购备料', shortLabel: '备料', department: '采购部', dataSource: '演示：采购订单、预计到料与实收入库', health: 'warning', impactIndex: 56, issueCount: 3, coreMetric: { label: '齐套满足率', value: 88.6, unit: '%', definition: '按期齐套订单数 / 应齐套订单数' }, updatedAt: '2026-08-12 14:18', issueIds: ['P-BUY-01'] },
  { id: 'material-warehouse', order: 3, label: '面辅料检验与仓库', shortLabel: '面辅料', department: '资材部 / IQC', dataSource: '演示：WMS批次库存与来料检验', health: 'warning', impactIndex: 62, issueCount: 5, coreMetric: { label: '待验批次', value: 7, unit: '批', definition: '已收货但未完成检验放行的物料批次' }, updatedAt: '2026-08-12 14:19', issueIds: ['P-MAT-01'] },
  { id: 'cutting', order: 4, label: '裁断', shortLabel: '裁断', department: '裁断课', dataSource: '演示：MES裁断报工与首件记录', health: 'notice', impactIndex: 44, issueCount: 4, coreMetric: { label: '裁片偏差', value: 1.8, unit: '%', definition: '尺寸偏差裁片数 / 当期检验裁片数' }, updatedAt: '2026-08-12 14:20', issueIds: ['P-CUT-01'] },
  { id: 'sewing', order: 5, label: '缝制生产', shortLabel: '缝制', department: '缝制课', dataSource: '演示：MES报工、在制与工位节拍', health: 'critical', impactIndex: 86, issueCount: 9, coreMetric: { label: '超时在制', value: 214, unit: 'pcs', definition: '在当前工序停留超过管理阈值的在制数量' }, updatedAt: '2026-08-12 14:21', issueIds: ['P-SEW-01'] },
  { id: 'special-process', order: 6, label: '水洗/特殊工艺', shortLabel: '特殊工艺', department: '特殊工艺课', dataSource: '演示：委外/特殊工艺批次与检验记录', health: 'warning', impactIndex: 58, issueCount: 3, coreMetric: { label: '待复核批次', value: 3, unit: '批', definition: '工艺完成后等待质量复核的批次数' }, updatedAt: '2026-08-12 14:16', issueIds: ['P-SPECIAL-01'] },
  { id: 'finishing', order: 7, label: '后整理', shortLabel: '后整理', department: '整理课', dataSource: '演示：MES整理报工与在制记录', health: 'normal', impactIndex: 26, issueCount: 1, coreMetric: { label: '节拍达成率', value: 97.1, unit: '%', definition: '实际小时产出 / 目标小时产出' }, updatedAt: '2026-08-12 14:20', issueIds: ['P-FIN-01'] },
  { id: 'quality', order: 8, label: '品质检验', shortLabel: '品质', department: '品质部', dataSource: '演示：质量检验、不良与放行记录', health: 'critical', impactIndex: 94, issueCount: 12, coreMetric: { label: '重复不良', value: 46, unit: 'pcs', definition: '当前窗口内重复出现同类不良的数量' }, updatedAt: '2026-08-12 14:22', issueIds: ['P-QA-01', 'P-QA-02'] },
  { id: 'packing', order: 9, label: '包装', shortLabel: '包装', department: '包装课', dataSource: '演示：包装报工与抽检记录', health: 'warning', impactIndex: 67, issueCount: 6, coreMetric: { label: '待复核包装', value: 38, unit: 'pcs', definition: '标签或装箱信息需要复核的包装数量' }, updatedAt: '2026-08-12 14:19', issueIds: ['P-PACK-01'] },
  { id: 'finished-warehouse', order: 10, label: '成品仓库与出货', shortLabel: '成品仓', department: '成品仓库', dataSource: '演示：WMS成品库存与出库放行', health: 'notice', impactIndex: 41, issueCount: 2, coreMetric: { label: '待放行数量', value: 86, unit: 'pcs', definition: '已入成品仓但尚未取得出货放行状态的数量' }, updatedAt: '2026-08-12 14:18', issueIds: ['P-FG-01'] },
]

const identity = (process: string, styleNo: string, batch: string, station: string, continuousCount: number, recurrenceState: HealthProblem['identity']['recurrenceState']): HealthProblem['identity'] => ({
  problemType: '', factory: '松冈工厂（演示）', process, styleNo, batch, station, timeWindow: '今日 08:00-14:00', continuousCount,
  firstOccurredAt: '2026-08-12 09:18', lastOccurredAt: '2026-08-12 13:52', recurrenceState,
})

const checklist = (prefix: string, items: Array<[HealthProblem['inspectionItems'][number]['category'], string, string, string]>): HealthProblem['inspectionItems'] => items.map(([category, label, method, evidence], index) => ({ id: `${prefix}-${index + 1}`, category, label, method, requiredEvidence: evidence, selected: index < 2 }))

export const healthProblems: HealthProblem[] = [
  {
    id: 'P-PLAN-01', nodeId: 'order-plan', title: '计划达成率趋势偏离', problemType: '计划执行/趋势偏离', alertLevel: 'first', severity: 'notice', impactValue: 2, impactUnit: '工单', changeFromYesterday: 1, responseStatus: '待响应', summary: '两张工单的小时达成趋势低于管理参考线，建议先核对报工完整性、物料齐套与工序在制，不直接形成延误结论。', identity: { ...identity('订单与计划', 'ST-240812-A', 'WO-0812-01', '计划组', 1, 'pending'), problemType: '计划执行/趋势偏离' }, facts: [{ label: '风险工单', value: '2 单', source: '演示：订单计划与MES报工' }], alertEvents: [{ id: 'A-PLAN-01', occurredAt: '13:20', level: 'first', levelLabel: '首次提示', triggerRule: '小时达成趋势连续低于管理参考线', period: '2小时', thresholdType: 'trend', threshold: '连续偏离', evidence: '两张工单连续两个小时低于参考线' }], inspectionItems: checklist('PLAN', [['管理', '核对计划与报工口径', '确认计划数量、合格数量和时间窗口一致', '指标口径确认'], ['物料', '核对齐套与缺料事实', '比较工单需求与可用库存', '齐套记录'], ['工艺', '检查关键工序在制状态', '定位在制停留超时节点', '在制记录'], ['人员', '核对当班报工完整性', '仅检查是否缺报或晚报', '报工时间'], ['设备', '核对停机对计划的已记录影响', '使用已存在停机记录比对', '停机记录']]), plan: ['先确认报工与计划统计口径', '核对齐套与关键工序在制', '口径一致后再决定是否升级预警'], suggestedDepartment: '计划部 / 生产管理', suggestedRole: '计划员 / 生产主管', verificationRequirement: '下一统计窗口计划达成趋势恢复且报工完整。', dataGaps: ['部分工位报工可能存在时间延迟'], traceNodeIds: ['order-plan', 'procurement', 'material-warehouse', 'sewing'], traceConfirmation: 'pending',
  },
  {
    id: 'P-QA-01', nodeId: 'quality', title: '缝皱不良第三次警报', problemType: '外观不良/缝皱', alertLevel: 'third', severity: 'critical', impactValue: 46, impactUnit: 'pcs', changeFromYesterday: 18, responseStatus: '待响应',
    summary: '同款同批次在三个检验窗口连续出现缝皱不良，系统建议先检查设备张力与工艺参数，再核对物料批次；当前未认定根因。',
    identity: { ...identity('品质检验', 'ST-240812-A', 'B240812-03', 'QC2-1 / 缝制三组', 3, 'continuous'), problemType: '外观不良/缝皱' },
    facts: [{ label: '重复不良数量', value: '46 pcs', source: '演示：QC2-1检验记录' }, { label: '连续发生窗口', value: '3 次', source: '演示：质量预警事件' }, { label: '关联批次', value: 'B240812-03', source: '演示：批次追溯关系' }],
    alertEvents: [
      { id: 'A-QA-01-1', occurredAt: '09:18', level: 'first', levelLabel: '首次提示', triggerRule: '单窗口不良率超过标准阈值', period: '30分钟', thresholdType: 'standard', threshold: '> 2.0%', evidence: '缝皱不良率 2.4%' },
      { id: 'A-QA-01-2', occurredAt: '11:06', level: 'second', levelLabel: '二次加强', triggerRule: '同类问题在当班再次发生', period: '当班', thresholdType: 'management', threshold: '≥ 2次', evidence: '同款同批次第二次触发' },
      { id: 'A-QA-01-3', occurredAt: '13:52', level: 'third', levelLabel: '三次警报', triggerRule: '同一问题身份证连续第三次触发', period: '当班', thresholdType: 'management', threshold: '≥ 3次', evidence: '累计影响 46 pcs' },
    ],
    inspectionItems: checklist('QA', [['设备', '检查压脚压力与送布同步', '按首件参数表逐项核对并留存实测值', '设备参数截图或点检值'], ['工艺', '复核针距、线张力和操作顺序', '对照工艺标准完成一件首件复核', '首件复核记录'], ['物料', '核对面料批次与缩水特性', '比较当前批次与已放行批次差异', '批次检验数据'], ['人员', '确认换款后参数确认步骤', '核对岗位是否完成换款首件确认', '换款确认记录'], ['管理', '检查巡检间隔是否覆盖异常窗口', '对齐巡检时间与三次事件时间', '巡检时间记录']]),
    plan: ['先隔离当前批次待检品并标记影响范围', '按设备→工艺→物料顺序完成标准检查', '完成3件首件复核后再决定是否恢复批量流转'],
    suggestedDepartment: '品质部 / 缝制课', suggestedRole: 'QC组长 / 缝制三组组长', verificationRequirement: '处理后连续2个检验窗口、每窗口不少于30件，未再触发同类不良。', dataGaps: ['需补充压脚压力与线张力实测值', '需现场确认面料批次影响'], traceNodeIds: ['material-warehouse', 'cutting', 'sewing', 'quality'], traceConfirmation: 'pending',
  },
  {
    id: 'P-SEW-01', nodeId: 'sewing', title: '缝制三组在制持续超时', problemType: '在制堆积/节拍失衡', alertLevel: 'intervention', severity: 'critical', impactValue: 214, impactUnit: 'pcs', changeFromYesterday: 36, responseStatus: '超时',
    summary: '三组在制超过管理阈值并持续94分钟，已形成待干预事实；建议先核对工位节拍、缺勤与前后工序供料，不直接归因于人员。',
    identity: { ...identity('缝制生产', 'ST-240812-A', 'B240812-03', '缝制三组', 4, 'continuous'), problemType: '在制堆积/节拍失衡' },
    facts: [{ label: '超时在制', value: '214 pcs', source: '演示：MES在制记录' }, { label: '持续时间', value: '94 min', source: '演示：工序进出站时间' }],
    alertEvents: [{ id: 'A-SEW-01', occurredAt: '12:46', level: 'intervention', levelLabel: '待干预', triggerRule: '在制连续超过管理阈值60分钟', period: '小时', thresholdType: 'management', threshold: '> 180 pcs', evidence: '峰值214 pcs，持续94分钟' }],
    inspectionItems: checklist('SEW', [['工艺', '核对瓶颈工位实绩节拍', '按小时比较目标与实绩', '工位小时产出'], ['人员', '核对当班出勤与岗位变更事实', '仅核对排班和临时调岗记录', '排班/调岗记录'], ['设备', '检查关键机台停机记录', '核对停机开始与恢复时间', '设备停机记录'], ['物料', '核对前工序供料连续性', '比较到料间隔与工位停等时间', '工序交接记录'], ['管理', '检查小时线平衡复核记录', '确认是否在预警后完成复核', '线平衡记录']]),
    plan: ['先确认实际瓶颈工位与停等原因', '临时拆分在制并保持批次标识', '下一小时复核在制、节拍和缺料状态'], suggestedDepartment: '缝制课 / 生产计划', suggestedRole: '缝制三组组长 / 线平衡员', verificationRequirement: '下一小时超时在制降至管理阈值以下，并保留工位节拍记录。', dataGaps: ['缺少部分工位的自动节拍采集'], traceNodeIds: ['cutting', 'sewing', 'quality'], traceConfirmation: 'pending',
  },
  {
    id: 'P-PACK-01', nodeId: 'packing', title: '包装标签复核记录缺失', problemType: '包装信息/记录缺失', alertLevel: 'third', severity: 'warning', impactValue: 38, impactUnit: 'pcs', changeFromYesterday: 12, responseStatus: '缺记录',
    summary: '抽检发现款号与包装标签需复核，但当前批次缺少二次确认记录；先补证据并冻结相关包装流转，不推定为操作失误。',
    identity: { ...identity('包装', 'ST-240812-B', 'B240812-08', '包装二组', 3, 'recurring'), problemType: '包装信息/记录缺失' },
    facts: [{ label: '待复核', value: '38 pcs', source: '演示：包装抽检记录' }, { label: '缺失记录', value: '1 项', source: '演示：包装复核记录' }],
    alertEvents: [{ id: 'A-PACK-01', occurredAt: '13:28', level: 'third', levelLabel: '三次警报', triggerRule: '同类记录缺失在本周第三次出现', period: '本周', thresholdType: 'management', threshold: '≥ 3次', evidence: '本周三批次缺少二次复核记录' }],
    inspectionItems: checklist('PACK', [['物料', '核对标签版本与领用批次', '扫描标签批号并与款号主数据比对', '标签领用记录'], ['管理', '补查包装二次复核记录', '核对交接、抽检和放行时间', '复核记录'], ['工艺', '检查包装指示书版本', '确认现场版本与生效版本一致', '指示书版本'], ['人员', '核对当班岗位与交接事实', '只核对交接是否留痕', '交接记录'], ['设备', '检查打印模板与扫码规则', '使用测试标签验证模板字段', '模板测试记录']]),
    plan: ['冻结当前38件包装放行状态', '完成标签、款号和包装指示书三方比对', '补齐复核记录后由品质确认放行'], suggestedDepartment: '包装课 / 品质部', suggestedRole: '包装组长 / 出货检验员', verificationRequirement: '本批次100%复核，后续两个批次复核记录完整。', dataGaps: ['需取得标签打印模板版本'], traceNodeIds: ['quality', 'packing', 'finished-warehouse'], traceConfirmation: 'confirmed',
  },
  {
    id: 'P-MAT-01', nodeId: 'material-warehouse', title: '面料色差批次二次加强', problemType: '来料质量/色差', alertLevel: 'second', severity: 'warning', impactValue: 3, impactUnit: '批', changeFromYesterday: 1, responseStatus: '已响应',
    summary: '同供应批次的色差检验再次接近管理限，当前仅形成批次风险提示，建议扩大抽样并关联裁断排料批次。',
    identity: { ...identity('面辅料检验与仓库', 'ST-240812-A', 'FAB-0812-06', 'IQC检验台2', 2, 'similar'), problemType: '来料质量/色差' },
    facts: [{ label: '待复核批次', value: '3 批', source: '演示：IQC检验记录' }],
    alertEvents: [{ id: 'A-MAT-01', occurredAt: '10:38', level: 'second', levelLabel: '二次加强', triggerRule: '同供应批次再次接近管理限', period: '批次', thresholdType: 'trend', threshold: '连续上升', evidence: '两次抽样色差值连续上升' }],
    inspectionItems: checklist('MAT', [['物料', '扩大色差抽样范围', '按卷号分层抽样', '分卷检测值'], ['管理', '核对批次隔离状态', '确认未放行批次未进入裁断', '库存状态记录'], ['工艺', '确认裁断排料批次计划', '建立面料批次与裁片批次关系', '排料批次'], ['设备', '校验检测设备状态', '按点检标准复核仪器', '点检记录'], ['人员', '核对抽样操作记录', '复核抽样位置是否满足标准', '抽样记录']]),
    plan: ['保持三批物料待复核状态', '按卷号扩大抽样并记录检测值', '确认放行后再建立裁断批次关联'], suggestedDepartment: '资材部 / 品质部', suggestedRole: 'IQC组长 / 面料仓管理员', verificationRequirement: '复核结果满足来料标准并完成批次放行记录。', dataGaps: ['需补部分卷号分层检测值'], traceNodeIds: ['material-warehouse', 'cutting'], traceConfirmation: 'confirmed',
  },
  {
    id: 'P-CUT-01', nodeId: 'cutting', title: '裁片尺寸偏差处理后复发', problemType: '裁断质量/尺寸偏差', alertLevel: 'recurring', severity: 'warning', impactValue: 28, impactUnit: 'pcs', changeFromYesterday: 8, responseStatus: '待验证',
    summary: '同款不同批次在处理后再次出现尺寸偏差，属于复发问题；需核对实际措施、刀具状态和面料批次后再判断。', identity: { ...identity('裁断', 'ST-240812-A', 'CUT-0812-12', '自动裁床1', 1, 'recurring'), problemType: '裁断质量/尺寸偏差' }, facts: [{ label: '本次影响', value: '28 pcs', source: '演示：裁片抽检记录' }, { label: '复发间隔', value: '19 h', source: '演示：干预复发时间线' }], alertEvents: [{ id: 'A-CUT-01', occurredAt: '11:42', level: 'recurring', levelLabel: '再次复发', triggerRule: '处理后同款再次触发同类问题', period: '48小时', thresholdType: 'management', threshold: '再次出现', evidence: '距上次处理19小时再次触发' }], inspectionItems: checklist('CUT', [['设备', '复核刀具磨损与吸附状态', '按设备点检表检查', '点检结果'], ['物料', '比对面料批次与松弛时间', '核对面料上机前静置记录', '松弛记录'], ['工艺', '核对裁剪文件与缩水补偿', '比较版本和参数', '裁剪文件版本'], ['人员', '复核首件确认记录', '确认首件抽检值', '首件记录'], ['管理', '复盘上次实际措施', '对比措施与复发间隔', '历史干预记录']]), plan: ['隔离本批次裁片', '复核上次措施是否实际完成', '重新首件确认后安排连续抽检'], suggestedDepartment: '裁断课 / 品质部', suggestedRole: '裁断组长 / 巡检员', verificationRequirement: '连续三个抽检点尺寸符合标准且48小时未再次触发。', dataGaps: ['缺少上次刀具更换实测记录'], traceNodeIds: ['material-warehouse', 'cutting', 'sewing'], traceConfirmation: 'pending',
  },
  {
    id: 'P-BUY-01', nodeId: 'procurement', title: '关键辅料预计到料偏晚', problemType: '备料风险/预计到料', alertLevel: 'first', severity: 'warning', impactValue: 2, impactUnit: '订单', changeFromYesterday: 1, responseStatus: '待响应', summary: '两张采购订单预计到料晚于齐套时间，仅基于演示采购订单、预计到料和实收入库数据形成提示。', identity: { ...identity('采购备料', 'ST-240814-C', 'PO-0810-18', '采购组', 1, 'pending'), problemType: '备料风险/预计到料' }, facts: [{ label: '风险订单', value: '2 单', source: '演示：采购订单与预计到料' }], alertEvents: [{ id: 'A-BUY-01', occurredAt: '13:04', level: 'first', levelLabel: '首次提示', triggerRule: '预计到料晚于计划齐套时间', period: '订单', thresholdType: 'standard', threshold: '晚于齐套时间', evidence: '预计晚6小时与10小时' }], inspectionItems: checklist('BUY', [['物料', '核对供应商最新预计到料', '比较采购订单与供应回复', '预计到料回执'], ['管理', '确认替代料或拆单条件', '仅按已批准规则检查', '替代料审批规则'], ['工艺', '确认该辅料实际投产节点', '核对BOM与工序需求时间', 'BOM/排产'], ['人员', '核对采购跟催记录', '确认时间与回复内容', '跟催记录'], ['设备', '不适用：保持不选', '本问题不优先检查设备', '不适用']]), plan: ['刷新预计到料回执', '核对实际投产需求时间', '若仍冲突则提交人工调整排产评估'], suggestedDepartment: '采购部 / 计划部', suggestedRole: '采购担当 / 物料计划员', verificationRequirement: '取得可追溯到料承诺或完成已批准的排产调整。', dataGaps: ['供应商预计到料需人工确认'], traceNodeIds: ['procurement', 'material-warehouse', 'order-plan'], traceConfirmation: 'confirmed',
  },
  {
    id: 'P-SPECIAL-01', nodeId: 'special-process', title: '特殊工艺批次待复核', problemType: '特殊工艺/批次复核', alertLevel: 'second', severity: 'warning', impactValue: 3, impactUnit: '批', changeFromYesterday: 1, responseStatus: '已响应', summary: '三个特殊工艺批次完成后等待质量复核，系统仅提示批次停留时间与交接记录，具体工艺类型和原因待现场确认。', identity: { ...identity('水洗/特殊工艺', 'ST-240812-C', 'SP-0812-04', '模块工艺区', 2, 'continuous'), problemType: '特殊工艺/批次复核' }, facts: [{ label: '待复核', value: '3 批', source: '演示：特殊工艺批次记录' }], alertEvents: [{ id: 'A-SP-01', occurredAt: '13:12', level: 'second', levelLabel: '二次加强', triggerRule: '完成批次等待复核超过管理时间', period: '批次', thresholdType: 'management', threshold: '> 60分钟', evidence: '最长等待88分钟' }], inspectionItems: checklist('SP', [['工艺', '核对批次工艺记录完整性', '检查参数、完成时间和检验要求', '工艺批次记录'], ['管理', '核对品质复核交接状态', '对齐完成与接收时间', '交接记录'], ['物料', '确认批次标识未混用', '检查批次隔离与标签', '批次标签'], ['设备', '检查设备完工状态记录', '核对结束状态与异常代码', '设备记录'], ['人员', '核对交接责任岗位记录', '只确认交接是否留痕', '交接签收']]), plan: ['保持三批次待复核状态', '补齐工艺与交接记录', '由品质完成复核后恢复流转'], suggestedDepartment: '特殊工艺课 / 品质部', suggestedRole: '特殊工艺组长 / 品质复核员', verificationRequirement: '三批次完成复核且后续批次交接时间在管理阈值内。', dataGaps: ['具体工艺类型与参数需现场确认'], traceNodeIds: ['sewing', 'special-process', 'finishing', 'quality'], traceConfirmation: 'pending',
  },
  {
    id: 'P-FIN-01', nodeId: 'finishing', title: '后整理节拍轻微波动', problemType: '后整理/节拍波动', alertLevel: 'first', severity: 'normal', impactValue: 18, impactUnit: 'pcs', changeFromYesterday: -6, responseStatus: '已响应', summary: '当前节拍达成率仍在管理区间内，仅记录短时波动，建议在日会观察，不升级为干预任务。', identity: { ...identity('后整理', 'ST-240812-B', 'FIN-0812-07', '整理一组', 1, 'not-recurred'), problemType: '后整理/节拍波动' }, facts: [{ label: '节拍达成率', value: '97.1%', source: '演示：MES整理报工' }], alertEvents: [{ id: 'A-FIN-01', occurredAt: '12:48', level: 'first', levelLabel: '首次提示', triggerRule: '单窗口节拍波动但未超过管理阈值', period: '30分钟', thresholdType: 'trend', threshold: '观察项', evidence: '已恢复至97.1%' }], inspectionItems: checklist('FIN', [['工艺', '观察下一窗口节拍', '对比目标与实绩', '小时产出'], ['设备', '核对短停记录', '检查是否存在已记录短停', '短停记录'], ['物料', '核对上游供料连续性', '比较到料间隔', '交接记录'], ['人员', '核对报工是否完整', '仅检查记录完整性', '报工记录'], ['管理', '保持日会观察', '未达阈值不升级干预', '日会记录']]), plan: ['保持观察，不调整当前生产安排', '下一窗口复核节拍和供料连续性'], suggestedDepartment: '整理课', suggestedRole: '整理组长', verificationRequirement: '下一小时节拍维持管理区间且未再次触发。', dataGaps: [], traceNodeIds: ['special-process', 'finishing', 'quality'], traceConfirmation: 'confirmed',
  },
  {
    id: 'P-QA-02', nodeId: 'quality', title: '终检污渍异常待现场确认', problemType: '外观不良/污渍', alertLevel: 'verifying', severity: 'notice', impactValue: 12, impactUnit: 'pcs', changeFromYesterday: -4, responseStatus: '待验证', summary: '已完成清洁与隔离处理，当前处于验证窗口；上游关联仅为追溯路径，不代表已确认原因。', identity: { ...identity('品质检验', 'ST-240812-B', 'B240812-09', '终检台2', 1, 'not-recurred'), problemType: '外观不良/污渍' }, facts: [{ label: '当前影响', value: '12 pcs', source: '演示：终检记录' }], alertEvents: [{ id: 'A-QA-02', occurredAt: '12:22', level: 'verifying', levelLabel: '验证中', triggerRule: '已记录处理，进入后续验证窗口', period: '2个检验窗口', thresholdType: 'management', threshold: '不得再触发', evidence: '首个窗口未复发' }], inspectionItems: checklist('QA2', [['设备', '检查工作台与传送面清洁', '目视并留存点检结果', '清洁点检'], ['物料', '核对包装材料清洁状态', '抽检相关包装材料', '抽检记录'], ['工艺', '复核后整理交接防护', '检查转运和暂存方式', '交接记录'], ['人员', '确认操作防护记录', '核对是否按标准执行', '岗位记录'], ['管理', '延长一个验证窗口', '持续观察同类异常', '验证记录']]), plan: ['保持当前措施并完成第二个验证窗口', '若再出现则升级为复发并重新检查'], suggestedDepartment: '品质部 / 后整理课', suggestedRole: '终检组长 / 整理组长', verificationRequirement: '连续两个检验窗口未再次出现同类污渍。', dataGaps: ['第二个验证窗口尚未结束'], traceNodeIds: ['finishing', 'quality', 'packing'], traceConfirmation: 'pending',
  },
  {
    id: 'P-FG-01', nodeId: 'finished-warehouse', title: '成品待放行记录超时', problemType: '出货准备/放行超时', alertLevel: 'second', severity: 'notice', impactValue: 86, impactUnit: 'pcs', changeFromYesterday: -12, responseStatus: '已响应', summary: '86件成品已入库但放行记录超过管理时限，仓库已响应，等待品质复核结果。', identity: { ...identity('成品仓库与出货', 'ST-240812-B', 'FG-0812-05', '成品待放行区', 2, 'continuous'), problemType: '出货准备/放行超时' }, facts: [{ label: '待放行', value: '86 pcs', source: '演示：WMS库存状态' }], alertEvents: [{ id: 'A-FG-01', occurredAt: '13:36', level: 'second', levelLabel: '二次加强', triggerRule: '待放行状态超过管理时限', period: '小时', thresholdType: 'management', threshold: '> 120分钟', evidence: '已等待147分钟' }], inspectionItems: checklist('FG', [['管理', '核对放行申请与复核状态', '对齐WMS与质量记录', '状态流记录'], ['物料', '核对成品批次隔离状态', '确认库存状态正确', '库存状态'], ['工艺', '检查包装与终检是否完结', '核对前置单据状态', '完结记录'], ['人员', '核对仓库与品质交接时间', '仅核对交接事实', '交接记录'], ['设备', '不适用：保持不选', '本问题不优先检查设备', '不适用']]), plan: ['保持待放行库存状态', '由品质复核前置记录', '放行后核对WMS状态同步'], suggestedDepartment: '成品仓库 / 品质部', suggestedRole: '成品仓管理员 / 出货检验员', verificationRequirement: '质量放行与WMS库存状态一致且保留时间记录。', dataGaps: [], traceNodeIds: ['quality', 'packing', 'finished-warehouse'], traceConfirmation: 'confirmed',
  },
]

export const managementActions: ManagementAction[] = [
  { id: 'MA-01', problemId: 'P-QA-01', priority: 'P1', action: '隔离当前批次并完成缝皱标准检查', triggerBasis: '同一问题身份证第三次警报，影响46 pcs', suggestedRole: 'QC组长 / 缝制三组组长', expectedVerificationAt: '今日 16:00', status: '待响应' },
  { id: 'MA-02', problemId: 'P-SEW-01', priority: 'P1', action: '复核瓶颈工位并拆分超时在制', triggerBasis: '超时在制214 pcs，持续94分钟', suggestedRole: '缝制三组组长 / 线平衡员', expectedVerificationAt: '下一小时', status: '已响应' },
  { id: 'MA-03', problemId: 'P-PACK-01', priority: 'P2', action: '冻结38件包装并补齐复核记录', triggerBasis: '本周第三次出现同类记录缺失', suggestedRole: '包装组长 / 出货检验员', expectedVerificationAt: '今日 15:30', status: '待响应' },
  { id: 'MA-04', problemId: 'P-CUT-01', priority: 'P2', action: '复盘上次措施并重新完成首件确认', triggerBasis: '处理后19小时再次复发', suggestedRole: '裁断组长 / 巡检员', expectedVerificationAt: '今日 17:00', status: '验证中' },
  { id: 'MA-05', problemId: 'P-MAT-01', priority: 'P3', action: '按卷号扩大色差抽样', triggerBasis: '同供应批次第二次接近管理限', suggestedRole: 'IQC组长', expectedVerificationAt: '今日下班前', status: '已响应' },
]

export const interventionRecords: InterventionRecord[] = [
  { id: 'IR-01', problemId: 'P-CUT-01', handler: '裁断组长（演示）', checkedItemIds: ['CUT-1', 'CUT-3'], actualMeasure: '更换刀具并重新确认裁剪文件版本', handledAt: '2026-08-11 16:32', verifyAt: '2026-08-12 11:42', recurrenceResult: '再次复发', isDemo: true },
  { id: 'IR-02', problemId: 'P-QA-02', handler: '终检组长（演示）', checkedItemIds: ['QA2-1', 'QA2-3'], actualMeasure: '清洁检验台并调整转运防护', handledAt: '2026-08-12 12:36', verifyAt: '2026-08-12 15:00', recurrenceResult: '待验证', isDemo: true },
]

export const solutionEffectiveness: SolutionEffectiveness[] = [
  { id: 'SE-01', problemType: '外观不良/缝皱', measure: '恢复首件参数并缩短巡检间隔', usageCount: null, nonRecurrenceCount: null, averageRecurrenceInterval: null, applicableConditions: ['同款同批次连续发生', '设备与工艺参数可取得'], baselineStatus: 'pending' },
  { id: 'SE-02', problemType: '在制堆积/节拍失衡', measure: '拆分在制并执行小时线平衡', usageCount: 4, nonRecurrenceCount: 3, averageRecurrenceInterval: '22小时', applicableConditions: ['工位节拍已采集', '批次可拆分'], baselineStatus: 'available' },
  { id: 'SE-03', problemType: '裁断质量/尺寸偏差', measure: '刀具点检与首件复核', usageCount: 3, nonRecurrenceCount: 1, averageRecurrenceInterval: '19小时', applicableConditions: ['自动裁床', '同款连续批次'], baselineStatus: 'available' },
]

export const dutyFacts: DutyFact[] = [
  { label: '应响应', count: 9, definition: '达到待干预状态且落在统计窗口内的问题' },
  { label: '已响应', count: 6, definition: '已留下处理人和响应时间的问题' },
  { label: '超时', count: 2, definition: '超过管理响应时限仍未完成响应的问题' },
  { label: '缺记录', count: 1, definition: '状态已变化但缺少必要处理记录的问题' },
  { label: '待验证', count: 4, definition: '已处理但尚未满足验证窗口的问题' },
  { label: '重复发生', count: 3, definition: '处理后再次触发同一问题身份证的问题' },
]

export const lifecycleById = new Map<LifecycleNodeId, LifecycleNode>(lifecycleNodes.map((node) => [node.id, node]))
export const problemById = new Map(healthProblems.map((problem) => [problem.id, problem]))

export const dataStateLabelsV4 = {
  normal: '正常演示', loading: '加载中', empty: '空数据', error: '加载失败', forbidden: '无权限', stale: '数据过期', 'metric-conflict': '口径冲突',
} as const

export const periodOptions = ['昨日同期', '今日', '本周', '本月'] as const
