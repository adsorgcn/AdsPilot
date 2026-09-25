# AdsPilot 2.x 架构总图（第一层，待老板签字）

> 一页纸。这一页签了才有第二层（契约）、第三层（骨架）、第四层（首发插件）、第五层（使用方法与脚本）。
> 从大到小做，不从细节出发。

## 1. 定位

一个开源、免费、颠覆传统广告投放 SaaS 的东西。传统 SaaS 让你登录、托管账号、按月收费；AdsPilot 把整套投放能力做成 **基座加插件**，任何人的 Agent（Claude Code、Codex、OpenClaw、Hermes 或同类）拿去，就能在 **自己的账号、自己的机器** 上无人值守地跑。不登录、不托管、不收费。

能跑起来是基座保证的；能不能赚钱取决于 SOUL。仓库自带一个通用的默认 SOUL，能跑，不保证赚。赚钱的 SOUL 是 iLang Inc. 的：按客户定制，或做成 API 按调用次数收费。这是商业模式。

这也是 iLang 协议第一个较大的商用应用：v3 通信层保证一份使用方法跨 Agent 同样执行，v4 执行层就是无人值守循环里的 OBJECTIVE、EVIDENCE、STATUS，v5 判断层就是 SOUL API 的请求与响应。仓库是正典的参考实现，协议改动只走 ilang-spec。

## 2. 一条判据

**凡是要对外部 API 说话的，就是插件口子；剩下的全是主干。**

主干不依赖任何一家外部服务；任何一个插件消失，主干照样跑，只是笨一点。

## 3. 主干（core）

| 部件 | 干/插 | 管什么 |
|---|---|---|
| Agent 适配 | 干 | 入口文件（CLAUDE.md、AGENTS.md、.cursor/rules）、iLang runtime 加载、能力自检（能执行命令、读写文件、访问网络、跑长任务、部署、常驻运营；不满足即判不适用） |
| 落地页（LP） | 干 | 模板、Google 目的地要求合规检查、第一方标签写 sub-id token、自有域名中转 |
| 判断 | 干 | 判断接口按 iLang v5 冻结 schema 定义；规则与阈值兜底；证据四步核验（CHEK→AUDT→VALD→STATUS）。外部引擎只是往这个接口里插 |
| 归因与对账 | 干 | sub-id token（32 位内纯字母数字）、映射表（token→gclid、campaign、adgroup、keyword、page、时间、network、offer）、佣金明细 join、离线转化文件生成、拒付反标、证据账本 |
| 无人值守循环 | 干 | 调度模式（systemd timer / cron / Worker cron）、非交互、幂等、dry-run、日志、退出码、哨兵与升级预案 |
| 默认 SOUL | 干 | 本地、开源、通用的判断与策略默认值 |
| schema 与自检 | 干 | report 回流 schema（带版本）、插件 manifest 格式、一致性自检 |

## 4. 插件（plugins）：两块，各一个固定契约

**流量平台**（`plugins/traffic/<平台>/`）：Google Ads 首发；后续 Bing、Meta、TikTok。契约四个动作：生成投放规格、部署（Agent 操作后台，有 API 且用户自有凭据时走 API）、拉报表、回传转化。

**联盟与广告主**（`plugins/affiliate/<网络>/`）：CJ 首发；后续 Impact、Awin、Rakuten、ShareASale，以及带 postback 的直客广告主。契约四个动作：offer 发现与尽调数据、带 sub-id 的链接生成、佣金明细拉取、拒付解析。

**同样按判据归为插件的**：关键词数据源（Keyword Planner、Semrush 类）、IP 情报（IPQS 类）、判断引擎的外部提供者（Jev；以及我们自己的 SOUL API，对用户环境而言同为外部 API，走同一口子，只是收费）、部署目标（Cloudflare Worker API）、回流通道（飞书群机器人接口）。

每个插件一个目录：一份使用方法、一个 manifest（能力、需要用户自己持有的凭据、限额、版本）、脚本、自测。加一家只加一个目录，主干不改。

## 5. SOUL 接口

基座在每个需要判断的节点通过同一个接口问 SOUL：状态进，决策出，带置信度，形状即 iLang v5 判断向量与冻结输出 schema，也与 Jev 的类型化输出一一映射。默认 SOUL 本地、开源；付费 SOUL 远程、按次计费；用户改一个配置项切换，基座与插件一行不改。服务端代码不进本仓库，本仓库只放接口说明（请求与响应 schema、计费单位、认证方式）。

## 6. 数据回流

方向只有一个：从用户回到社区。用户的 Agent 每完成一段，用固定 schema 的 JSON 回报（线、段、时间、动作、关键数字、判断与置信度、证据引用），社区机器人校验、审计、记进度、落账本。个人数据只有本人与管理者可见；聚合数据回填尽调库、判断阈值、平台资格表，并作为校验 Jev 与 SOUL 的真实标签。我们的 Google Ads API 与判断引擎不向用户免费开放。

## 7. 自动化验收（硬标准）

每个插件必须交付无人值守的日常循环：定时触发、非交互、幂等、有日志与退出码、自带哨兵。人只在三处出现：证件与 KYC、付款与绑卡、平台要求本人申诉。**在一台干净的用户环境里连续七天无人干预跑完日常循环，账本连续、告警可达、无人工介入记录，才可发布。**

## 8. 合规姿态（README 第一屏，与「开源免费」并排）

本人真实身份、单账号、平台要 KYC 照实做；不造流量、不模拟点击、不做 cloaking、不绕平台资格与封禁、不冒充身份、不做多账号；凭据零留存，一切在用户自己的机器与账号里。

## 9. 版本规则

三位号 主.次.末。日常改动只动末位（2.0.1、2.0.2 …）；「迭代小版本」才动中间位；大版本第一位只由老板决定。`VERSION`、`CHANGELOG.md`、git tag 三处一致。旧 Go 代码打 tag `v1-go-archive` 归档后从主分支移除；主干完成后发 2.0.0。

## 10. 目录结构（第三层落地时按此建）

```
core/            适配、LP、判断、归因对账、循环、默认 SOUL、自检
plugins/traffic/     google-ads/ …
plugins/affiliate/   cj/ …
plugins/judgment/    jev/  soul-api/
plugins/keywords/  plugins/ipintel/  plugins/deploy/  plugins/report/
schemas/         report、manifest、判断输入输出
soul/            SOUL 接口定义、默认 SOUL、SOUL API 接口说明
reference/       affiliate-design、旧交接文档
CLAUDE.md  AGENTS.md  .cursor/rules  README.md  VERSION  CHANGELOG.md
```

## 11. 分层推进顺序

第一层 本页 → 第二层 契约（适配、判断、两块插件的四个动作、report schema）→ 第三层 骨架（目录、入口文件、能力自检、默认 SOUL 空壳、插件模板）→ 第四层 首发插件（Google Ads、CJ）→ 第五层 使用方法与脚本（sub-id 归因第一个）。上一层未签，不写下一层。
