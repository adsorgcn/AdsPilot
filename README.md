# AdsPilot

**开源、免费。** 把整套广告联盟投放能力做成基座加插件，交给你自己的 Agent（Claude Code、Codex、OpenClaw、Hermes 或同类），在你自己的账号、你自己的机器上无人值守地跑。不登录、不托管、不收费。

**合规姿态，与开源免费并排写在第一屏。** 本人真实身份、单账号，平台要 KYC 照实做；不造流量、不模拟点击、不做 cloaking、不绕平台资格与封禁、不冒充身份、不做多账号；凭据零留存，一切在你自己的机器与账号里。做不到这几条的，这个仓库帮不上。

*English: [README.en.md](README.en.md)*

## 这是什么，为什么这么做

传统的投放 SaaS 是「平台替你干活」：你登录它的后台，把账号托管给它，按月付费，它替你建广告、看报表、调预算。这个架构下登录、计费、多租户、托管 token 一样都少不了，而且它永远在替你做判断，你看不见它怎么判的。

AdsPilot 反过来，是「你的 Agent 替你干活」。仓库里没有一个要编译的程序、没有后台、没有账号系统。它是一套写给 Agent 看的使用方法，加一组只用 Python 标准库的小脚本。使用方法用 iLang 写，所以 Claude Code、Codex 或别的 Agent 读到的是同一份，执行出来也是同一个样子。你的 Agent 读完入口文件，先自检这台机器够不够格，然后按使用方法在你自己的 Google Ads 和 CJ 账号上建广告、拉报表、对账、把转化灌回去，每天自己跑一轮。

它分两块，一条判据切开：**凡是要对外部 API 说话的，就是插件；剩下的全是主干。** 主干不依赖任何一家外部服务，任何一个插件消失，主干照样跑，只是笨一点。加一家平台或一家联盟，只加一个目录，主干一行不改。

能跑起来是主干保证的；跑得好不好取决于 SOUL。SOUL 是所有判断规则和阈值的集合，仓库自带一个通用默认 SOUL，本地、开源、零成本。每到要做决定的地方（选哪个 offer、要不要上线、今天加预算还是暂停、这个词要不要停、转化要不要灌、账号异常要不要停），主干把状态打成 iLang v5 的 11 维向量，按冻结的 f_v5 算出 M1 到 M8。判断给的是建议，不是闸门：你明确说了要投什么、要怎么调，就照你的做，判断照算，作为建议写进输出和账本；你没说，Agent 才按判断自己拿主意，M1 和 M2 执行，其余只提议。唯一不因一句话放行的是第一屏那几条合规姿态。公益期 iLang Inc. 托管一个判断服务（便宜模型加 Jev），免费给大家用，用真实数据把判断磨准。这也是 iLang 协议第一个较大的商用应用：v3 通信层、v4 执行层、v5 判断层各管一段。

人只在三处出现：证件与 KYC、付款与绑卡、平台要求本人申诉。其余全是 Agent 与脚本。

## 一个学员的一天

早上六点半，调度器把 `core/loop/daily.py` 拉起来。它先自检，再从自有域名的中转拉回昨天的点击映射，读 Google Ads 的报表，拉 CJ 的佣金明细，把佣金按 token 对回 gclid 和关键词，生成能直接灌回 Google Ads 的转化文件。然后逐个系列、逐个词过一遍判断：这条系列均价超了就降价，那条连花一百块没转化就暂停，这条连续三天有佣金就加两成预算。判断出来的动作，凭据齐的话通过 API 直接做掉，转化通过 Data Manager 传上去；凭据不齐就写成一张清单，Agent 在后台照着做。最后在 `runs/<id>/` 留一份 `report.json` 和 `run.log`，退出码 0 是正常，2 是要本人出手，教练要看就把这两个文件贴过去。没有任何东西自动往外发。

## 骨架一眼看

```
core/       主干：agent 适配与自检 · launch 开局 · lp 落地页 · judge 判断（f_v5 冻结） · ledger 归因对账 · loop 无人值守循环 · selfcheck
plugins/    插件：traffic/google-ads · affiliate/cj · judgment/{llm,jev,soul-api} · deploy/cloudflare · keywords · ipintel
soul/       默认 SOUL、SOUL 接口、SOUL API 接口说明
schemas/    manifest · judgment · report · traffic-spec · traffic-report · commissions
reference/  iLang runtime（钉版本）· affiliate-design · v1 交接
```

架构总图在 `ARCHITECTURE.md`，一页纸，改它要老板点头。

## 走到哪了

截至 2026-09-26，版本 2.0.11。下面每一块都有代码、有使用方法、有自测，区别只在有没有碰过真实世界。

| 部件 | 状态 | 真实世界 |
|---|---|---|
| Agent 适配与能力自检 | 完成 | 三份入口文件同内容，十一项自检，iLang runtime 钉版本校验 |
| 开局（三把钥匙进，一条系列出） | **真实账号实测通过** | 在 reviews.aixray.dev 从零建落地位、发页、建系列、真点一次进账本，全程无人，然后拆净 |
| 落地页 | 完成 | 模板与合规检查通过自测，开局时在真域名上发过一页 |
| 判断（f_v5 冻结） | 完成 | 判断块用 iLang 正典校验器核过；提供者只做感知层 |
| 归因与对账 | 完成 | 只跑过样例数据 |
| 无人值守循环 | 完成 | 只跑过样例数据；七天验收未做 |
| 默认 SOUL | 完成 | 阈值从 SOP 抄的，没被真数据校过 |
| 插件 Google Ads | **真实账号实测通过** | 建系列、改预算改出价暂停词加否定词、删系列、拉报表、Data Manager 转化上传（validate-only），全通 |
| 插件 CJ | **真实账号实测通过** | offers 187 家分页取齐、link 装 sid、commissions 切段查询、chargebacks，全通（只读） |
| 插件 判断 llm / jev / soul-api | 代码齐 | 没连过真端点；jev 等接入文档；soul-api 服务端未建 |
| 插件 Cloudflare 落地位 | **真实账号实测通过** | 一把钥匙建 KV、Worker、域名证书；页面 200、/go 302 带 sid、/export 进账本，全通 |
| 选品第一条（词的出价 < 每次点击赚的钱） | **真实账号实测通过** | CJ 前 10 家查词算账，3 家过、7 家出局，过线的词直接带给建系列 |
| 插件 关键词（Google Ads Keyword Planner） | **真实账号实测通过** | 用商家首页当种子出品类词，带月搜索与首页出价 |
| 插件 IP 情报 | 只有契约 | 待首发 |

一句话：接入只剩一个动作，交三把钥匙（Cloudflare、Google Ads、CJ），然后跑开局，出一条真系列。从落地位到系列到账本整条链已在真实世界闭合过一次。真实世界还没碰过的只剩 SOUL 阈值对着真数据校，那只能靠跑起来慢慢校。下一步是找第一个学员环境装上跑七天，验收后把插件从 alpha 改 stable。

## 进度记录

**2026-09-26，2.0.11**。改正一处逻辑错：判断做成了闸门，用户要投的它会拦（账没过的 offer 指定了也不投、页面检查没过不发、判 hold 不建系列）。现在判断只给建议：用户明确说了就照做，判断照算，作为建议写进输出与账本；用户没说，Agent 才按判断自己拿主意。日常循环也一样，用户说「这条先别停」，循环就不停，判断的意见记下来。只有第一屏合规姿态那几条不因一句话放行。

**2026-09-26，2.0.10**。选品第一条：有一个词的出价小于每次点击赚的钱，这个 offer 才能投。每次点击赚的钱是 EPC÷100 换成广告账户币种，词的出价用 Keyword Planner 的首页出价低位，品牌词只在联盟许竞价品牌词时才算。首发关键词插件。用我们的账号对 CJ 前 10 家实测：Roborock 每次点击赚 4.56 港币，6 个品类词出价在它下面（最低 vacuum mop 3.79），过；ContactsDirect 每次点击赚 12.52，最便宜的非品牌词要 18.96，出局。前 10 家 3 家过。

**2026-09-25，2.0.9**。接入改成交钥匙：三把钥匙放进环境变量，其余全是 Agent。新增主干「开局」七步（建落地位、选 offer、写页发页、建系列、真点一次、启用、拆），Cloudflare 插件改成一把钥匙建全部（不再要 wrangler、不再要人在控制台点任何东西）。用我们自己的钥匙在真域名上从零到一条系列全程无人跑通并拆净，整条链第一次在真实世界闭合。

**2026-09-25，2.0.8**。README 改成这份叙事版，加「走到哪了」状态表与「进度记录」；此后每版两处都写，细节在 `CHANGELOG.md`，叙事在这里。

**2026-09-25，2.0.7**。CJ 插件用真实发布者凭据只读实测：四个动作全部通过。按实测改正三处：Commission Detail 集合字段叫 `records`，单次查询窗口不超过 31 天（按 30 天切段），Link Search 要推广媒介 ID（新增 `CJ_WEBSITE_ID`）。仓库旧分支各打 `archive/` tag 后删除，main 加保护。

**2026-09-25，2.0.6**。Data Manager 转化上传在真实账号 validate-only 通过。钉下一条：新建的「点击上传」转化操作要传播约一小时 Data Manager 才看得到，脚本判 `retry_later` 自动重试。

**2026-09-25，2.0.5**。Data Manager 请求按实测改正：事件带 `destinationReferences`，`eventSource` 必填，`DUPLICATE_NAME` 自动加后缀。

**2026-09-25，2.0.4**。Data Manager 请求按官方字段映射核对：`accountType` 替代已废弃的 `product`，`encoding`，数字 `productDestinationId`，整包快速失败。

**2026-09-25，2.0.3**。Google Ads api 路补齐并在真实账号实测：建一条日预算 1 港币、建好即暂停的系列，改预算改出价暂停词加否定词，最后连预算一起删净。发现 v25 不认 `startDate`，出价必须是计费单位整数倍，`uploadClickConversions` 对新接入已关闭。

**2026-09-25，2.0.2**。对齐 Google 新政策：developer token 2026-09-09 起废弃，权限级别由 OAuth 所属的 Cloud 项目决定，REST 默认 v25。

**2026-09-25，2.0.1**。拆掉回流通道，循环不往外发任何东西，报告只留本地。学员会不会用看社区机器人的对话日志。

**2026-09-25，2.0.0**。第一个 AI 范式版本。定位改为开源免费的基座加插件，旧 Go 代码归档到 `v1-go-archive`。主干七个部件、首发插件、六份 schema、默认 SOUL、21 项自测。

**2026-09-24 之前**。1.x Go 版本，见 `reference/HANDOFF-v1.md`。

## 三分钟上手（给你的 Agent）

```bash
git clone https://github.com/adsorgcn/AdsPilot && cd AdsPilot
python3 core/agent/selfcheck.py                       # 够不够格无人值守
cp config/adspilot.example.json config/adspilot.json  # 填自己的值，凭据放环境变量
python3 core/loop/daily.py --dry-run                  # 跑一轮，什么都不写外部
```

Claude Code 读 `CLAUDE.md`，Codex 与其他读 `AGENTS.md`，Cursor 读 `.cursor/rules/`。三份一样。之后按 `core/loop/使用方法.md` 装调度器，每天一轮。

## 版本与许可

`VERSION` 三位号。日常改动只动末位；「迭代小版本」动中间位；大版本第一位单独决定。每一版的细节在 `CHANGELOG.md`。

MIT。iLang runtime 副本来自 ilang-spec（MIT）。
