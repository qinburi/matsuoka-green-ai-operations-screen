# 松冈绿色AI生产运营诊断中心

独立交互原型：保留现有大屏底图，通过统一入口和三个业务热点进入生产效率、质量分析与工艺改善诊断。V2 分析页采用纯 Three.js 程序化未来微缩工厂，V1 图表式诊断原型作为历史版本保留。

## 版本与访问

- 当前版本：`V2.0.0`
- V2 在线演示：<https://qinburi.github.io/matsuoka-green-ai-operations-screen/>
- V2 分析页：<https://qinburi.github.io/matsuoka-green-ai-operations-screen/#/analysis>
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
- 责任部门和岗位仅作建议关联，不包含分派、接收、验证和关闭流程。
- 绿色AI推理过程为前端交互演示，未连接真实CPU小模型或业务接口。
- iconfont 项目资源尚未提供，当前只保留图标语义映射。
