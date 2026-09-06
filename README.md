# AdsPilot

[English](README.en.md)

一个由 AI Agent 安装和使用的广告运营 Skill，遵循 [I-Lang](https://ilang.ai/spec/)。

**用户不需要为 AdsPilot 准备电脑、服务器、Docker、Go、Node 或数据库。**
Agent 加载指令包，使用所在平台已有的工具、连接器、授权、密钥保管和执行能力。
这不等于“不需要计算环境”：计算由 Agent 宿主承担，不另建 AdsPilot 服务。

## 安装和使用

让你的 Agent 从本仓库加载 [skills/adspilot](skills/adspilot/SKILL.md)，
或导入版本化的 `adspilot-agent-v*.zip`。不同宿主的导入方式不同；
这是可加载的 Skill 文件夹，不代表已经上架某个市场或通过平台认证。

例如对 Agent 说：

> 加载 AdsPilot Skill，检查你已有的 Google Ads 和联盟连接器。
> 先确认可访问的账户和数据来源，给这个产品做关键词和暂停状态的广告计划。

包内只有 Markdown 指令、引用和 JSON 能力清单，没有安装脚本或后台进程。
宿主没有连接器时，Agent 应报告缺少的能力并继续研究/起草，
不能假装投放成功，也不能要求用户部署 AdsPilot 服务来补齐。
账户所有者仍可能需要在宿主的连接流程中同意 Google/CJ 授权。

## 当前能交付什么

| 能力 | 当前状态 |
| --- | --- |
| Agent 安装包与能力发现 | 已有 v0.1.0 指令包、结构测试和 CI 打包 |
| I-Lang 协议 | 固定官方版本；严格语法、判断函数及模式样例通过验证 |
| 账户/关键词/广告计划 | 工作流已定义；真实执行依赖宿主已连接工具，尚未做实号验收 |
| 广告变更 | 要求真实校验、范围授权、持久执行记录和回读；超时不盲重试 |
| 联盟 offer/佣金/转化 | 已定义证据与对账流程；CJ 实际连接器及全链路验收仍待完成 |
| 旧 Go AdsCenter | 可选开发适配层；未实现的执行明确失败，不再伪报成功 |

不要把指令包、单元测试或 HTTP 501 当成真实广告投放能力。

## I-Lang 协议基线

- 官方规范：[ilang-ai/ilang-spec](https://github.com/ilang-ai/ilang-spec)，
  固定提交 `f81e2bf1a952563ede3d45b814bb4a8482ba38cd`。
- 执行安全基线：v4.0-FINAL；判断层：v5.0 merged document 2.0.1。
- v5 使用 Part II 冻结序列化的 M1–M8 与 `ine` 维度，不混用旧展示名称。
- 当前只声明 **L1 advisory**。权限隔离、预算限制和状态转换必须由宿主强制；
  纯指令文本不能自称 L2/L3。v5 仍为 public preview，语法通过不是行为认证。

详见 [协议适配](skills/adspilot/references/ilang.md)、
[宿主能力契约](skills/adspilot/references/host.md) 和
[计划、授权与执行证据](skills/adspilot/references/records.md)。

## 开发与验证

以下是贡献者命令，不是产品安装步骤；无需先运行 `npm install`：

```sh
node scripts/verify-agent-package.mjs
node --test tests/agent-package/*.test.mjs scripts/verify-go.test.mjs
node scripts/verify-go.mjs --inventory-only
python scripts/verify-ilang.py
python scripts/package-agent.py
```

维护旧 Go 适配器时，再准备 Go 并运行 `node scripts/verify-go.mjs`。
它按模块使用 `GOWORK=off` 和 `-mod=readonly`，不运行 tidy、不改依赖清单。
范围覆盖 AdsCenter 默认/`ads_live` 与 Affiliate 库，不代表全仓 36 个模块都已验收。
详情见 [开发验证说明](scripts/README.md)。

## 目录与后续

- `skills/adspilot/`：唯一主产品安装包。
- `tests/agent-package/`：指令包约束和协议样例。
- `services/adscenter/`、`services/affiliate/`：可选历史适配层。
- 其他服务、前端、旧本地授权/部署脚本：保留的历史资产，不是安装依赖。

当前工作以 [Agent-native 路线图 v2](docs/AGENT_NATIVE_ROADMAP_v2_2026-09-06.md)
为准；历史“本机单用户运行”描述已被 2026-09-06 的产品决定替代。
未完成事项和恢复信息见 [项目记忆](docs/PROJECT_MEMORY_v1_2026-09-06.md)。

[MIT License](LICENSE)
