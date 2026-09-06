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

包内只有 Markdown 指令、引用和 JSON 业务契约，没有安装脚本或后台进程。
宿主没有连接器时，Agent 应找可用接入方式、整理缺项和配置方案，
给出具体的宿主能力请求，同时继续研究/起草；不能假装投放成功，
也不能要求用户部署 AdsPilot 服务来补齐。
账户所有者仍可能需要在宿主的连接流程中同意 Google/CJ 授权。

## 用户提供什么，AI 负责什么

AI 先检查已经知道和已经连好的部分，只问缺少的内容：

- 用户提供商品/网站、想达成的目标、目标地区和语言；需要投放时再确认预算。
- 用户选择广告账户，在 Google 正式授权页同意连接；不把密码、验证码或令牌贴进聊天。
- AI 自动整理账户和权限、准备必要的申请/配置材料、检查接口条件、生成方案。
- 遇到错误，AI 按官方错误原因修复并复查；只有本人登录/同意、资料真实性确认、
  Google 审批等不能代办的环节，才给用户一张简短操作卡。

已有连接器的用户无需重复申请开发者令牌或自建项目。
只有实际选择自备 API 路线时，才由 AI 按条件整理配置清单。
见 [自动接入与用户资料清单](skills/adspilot/references/onboarding.md) 和
[自动排错流程](skills/adspilot/references/troubleshooting.md)。

开发依据是 Google 官方文档、多种账户条件与故障场景测试，**不以作者的
个人账户为前提，也不以任何一个账户跑通作为“没有 bug”的证明**。

## 当前能交付什么

| 能力 | 当前状态 |
| --- | --- |
| Agent 安装包与能力发现 | v0.3.0：15 项逻辑操作、条件接入、排错、两类宿主适配与 CI 打包 |
| I-Lang 协议 | 固定官方版本；严格语法、判断函数及模式样例通过验证 |
| 账户/关键词/广告计划 | 完整契约与样例测试：层级/分页/金额/来源、暂停 Search 依赖计划；实号结果另验 |
| 广告变更 | 精确校验/授权/持久占用/逐资源回读，含失败与断点场景；超时不盲重试 |
| 联盟 offer/佣金/转化 | CJ 增量对账、重复/更正/退款/分页恢复、Data Manager/旧路线选择及逐条回执；真实接入另验 |
| 旧 Go AdsCenter | 可选开发适配层；未实现的执行明确失败，不再伪报成功 |

不要把指令包、单元测试或 HTTP 501 当成真实广告投放能力。

统一验收见 [P0/P1 验收清单](docs/P0_P1_ACCEPTANCE_v4_2026-09-07.md)。
包内也有 [用户 AI 验收说明](skills/adspilot/references/acceptance.md)：
先演练异常情况，再检查实际连接；默认不花钱、不创建广告、不上传转化。

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
node scripts/verify-release.mjs
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

当前产品与验收以 [统一验收 v4](docs/P0_P1_ACCEPTANCE_v4_2026-09-07.md)
为准；v1/v2/v3 保留此前审计、紧急修复和设计变更记录。
未完成事项和恢复信息见 [项目记忆](docs/PROJECT_MEMORY_v1_2026-09-06.md)。

[MIT License](LICENSE)
