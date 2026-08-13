# 松冈绿色AI生产运营诊断中心

独立交互原型：保留现有大屏底图，通过统一入口和三个业务热点进入绿色AI分析。V4以工厂健康体检、分级预警、检查推荐、干预记录和复发验证为主线；V3、V2.1、V2.0和V1作为完整历史版本保留。

## 版本与访问

- 当前部署版本：`V4.0.0`
- 已部署在线演示：<https://qinburi.github.io/matsuoka-green-ai-operations-screen/>
- 当前本地分析页：`/#/analysis`
- V3 历史原型：`/#/v3/`
- V3 历史分析页：`/#/v3/analysis`
- V2.1 历史原型：`/#/v21/`
- V2.0 历史原型：`/#/v2/`
- V1 历史原型：<https://qinburi.github.io/matsuoka-green-ai-operations-screen/#/v1/>
- V1 历史分析页：<https://qinburi.github.io/matsuoka-green-ai-operations-screen/#/v1/analysis>
- 源码仓库：<https://github.com/qinburi/matsuoka-green-ai-operations-screen>

## 运行

```bash
pnpm install
pnpm dev
```

生产构建与数据契约测试：

```bash
pnpm test
pnpm build
```

## 数据边界

- 所有数据、原因、方案、知识条目和责任映射均为演示内容。
- 责任部门和岗位仅作建议关联，干预记录仅保存在前端演示会话，不包含正式分派、接收、验证和关闭流程。
- 绿色AI仅推荐检查顺序和方案预案，不直接认定根因，也未连接真实模型或业务接口。
- iconfont 项目资源尚未提供，当前只保留图标语义映射。
