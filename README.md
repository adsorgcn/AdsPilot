# AdsPilot

*English version: [README.en.md](README.en.md).*

一个会投放的 AI,不是一个让你登录的系统。

AdsPilot 不是一个让你登录的后台。你在本地装好、连上你自己的 Google Ads 账号,然后对一个
AI 说话,它替你操作 Google Ads:选 offer 和关键词、建广告和调广告、过滤流量、管理多个账号。

> **凭证归你自己。** 授权在你本机的浏览器里完成(OAuth loopback 流程,和 Claude Code CLI
> 登录用的是同一套)。你的 Google refresh token 存在你自己机器上,不发往任何服务器。

## AdsPilot 是什么

大多数广告工具是个 Web 控制台:你登录、点来点去、手工配置一切。AdsPilot 把它反过来。界面
就是 AI。你用大白话说你要什么,AI 替你驱动 Google Ads API。

- AI 就是操作者,没有要学的管理后台。
- 它跑在你这边、你自己的机器上,不是一个替你拿着账号的托管服务。
- 它设计成以 OpenClaw skill 的形式运行,让非技术用户能在引导下装好;他们遇到的 bug 会变成
  对项目的改进。

## 为什么没有登录系统

传统广告 SaaS 需要登录系统、订阅计费、多租户权限、托管你的 token,因为它的架构是"平台替你
干活"。AdsPilot 的架构是"AI 替你干活"。你在本地装好、在自己浏览器里完成 Google 授权,token
归你自己。AI 直接操作 API,中间不需要一个 Web 后台。登录系统、计费、多租户、token 托管在这
个范式下不需要存在,所以它们就不存在。

## 四块核心能力

**1. 联盟 API 对接。** 可插拔的 `AffiliateProvider` 接口。AI 从联盟的第一方结构化数据里选
offer、写广告文案。接新联盟只需实现接口,不动主干。

**2. Google Ads 关键词数据。** `KeywordProvider` 接口抽象关键词来源。Google Ads API 是首发
实现;API 还没批下来时,CSV 导入自动兜底,系统不停摆。

**3. 真实流量源 + 反作弊过滤。** 买来的真实流量经埋点入库,四层过滤假流量:

| 层 | 机制 | 延迟 |
|---|---|---|
| 第一层 | 入口指纹(IP 情报、UA 异常、头一致性) | 毫秒级,同步 |
| 第二层 | 频率窗口(同 IP/指纹在时间窗内的点击频次) | 毫秒级,Redis 计数 |
| 第三层 | 行为信号(停留时间、交互、JS 执行) | 秒级,异步回填 |
| 第四层 | 转化回溯(联盟回传拒付,反标到对应点击) | 天级,离线批处理 |

IP 情报可插拔(`IPIntelProvider`,首发 IPQS)。实时规则引擎和离线 ML 模型双引擎并行:冷启动
靠规则扛,样本够了模型接管。这里的"反作弊"是把假流量过滤掉,不是制造假流量。

**4. 多账户管理。** Google Ads MCC 管理多账户数据,`BrowserProvider` 接口对接指纹浏览器(首
发 AdsPower),实现多账户会话隔离。

## 怎么用

1. **安装**:通过 OpenClaw(或克隆下来本地跑,用于开发)。
2. **授权**:本机的浏览器流程连上你的 Google Ads 账号。token 只写到你的机器上。配置和完整流程见 [本地授权指南](docs/local-auth.md)。
3. **操作**:告诉 AI 你要什么("给这个产品找关键词"、"给这个 offer 开个广告系列"、"这个广
   告组为什么跑不动"),它用 Google Ads API 去做。

## 可插拔架构

每个第三方集成都走 provider 接口,新增同类只需实现接口,不改主干。

| Provider | 接口 | 首发实现 |
|---|---|---|
| 联盟 | `AffiliateProvider` | CJ / Impact |
| 关键词 | `KeywordProvider` | Google Ads API |
| 流量源 | `TrafficProvider` | Native |
| IP 情报 | `IPIntelProvider` | IPQS |
| AI | `AIProvider` | Claude / DeepSeek |
| 指纹浏览器 | `BrowserProvider` | AdsPower |

## 模块

能力层是一组独立的 Go 服务模块,通过 Go workspace(`go.work`)串起来。

| 模块 | 职责 | 状态 |
|---|---|---|
| `adscenter` | Google Ads API:账户、关键词、广告系列、MCC | 已建 |
| `aicore` | AI 抽象层(选 offer、设计广告、反作弊推理) | 已建 |
| `siterank` | 站点和关键词排名信号 | 已建 |
| `recommendations` | 优化建议 | 已建 |
| `proxy-pool` | 中性 IP 路由基础设施 | 已建 |
| `gateway-middleware` | 边缘鉴权和路由 | 已建 |
| `bff` | 聚合层 | 已建 |
| `projector` | 事件投影和读模型 | 已建 |
| `useractivity` | 活动追踪 | 已建 |
| `console` | 控制台后端 | 已建 |
| `affiliate` | 联盟 API 对接 | 计划中 |
| `traffic` | 真实流量接入和埋点 | 计划中 |
| `antifraud` | 反作弊过滤 | 计划中 |
| `browserpool` | 指纹浏览器 API | 计划中 |

共享 Go 库放在 `pkg/`。

## 状态

本地授权(浏览器 loopback 流程、token 存用户本机)正在开发中。把能力打包成 OpenClaw skill、
以及通过 ClawHub 分发,是接下来的事。

## 铁律

- 不做假流量、不模拟点击。"反作弊"是把假流量或垃圾流量过滤掉,绝不制造。
- 不做 cloaking,给 Google 爬虫看的和真实用户看的没有任何不同。
- 凭证不进代码。全走环境变量,加密入库。
- 你的 OAuth token 存在你机器上,平台零留存。

## 配置

配置全走环境变量。从 `.env.example` 开始,填你自己的值。

| 变量 | 说明 |
|---|---|
| `DATABASE_URL` | PostgreSQL 连接串 |
| `REDIS_URL` | Redis 连接串 |
| `CREDENTIAL_ENC_KEY` | 32 字节,加密存储凭证用 |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | 你自己的 Google Ads Developer Token |
| `GOOGLE_ADS_OAUTH_CLIENT_ID` | 你自己的 OAuth Client ID(桌面类型客户端) |
| `GOOGLE_ADS_OAUTH_CLIENT_SECRET` | 你自己的 OAuth Client Secret |

## 开发

后端(Go 1.25.1+):

```bash
go work sync
go build ./...
```

格式检查和分模块测试在 CI 里跑,见 `.github/workflows/ci.yml`。

## License

MIT。
