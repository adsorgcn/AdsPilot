# 联盟模块设计规范(① AffiliateProvider + Sub-ID 归因)

本规范锁定 ① 联盟接入 + sub-id 归因的架构,是后续编码的地基。核心原则:基建(缝合、生成、存储、对账)开源;判断(选 offer、写文案、挑注入形态、何时对账、砍哪个维度)交给 AI。一句话概括:**上游适配联盟网络,下游适配流量落地,中间靠一个不变的核心把两头缝起来。**

## 一、不变的核心

三样东西不随网络或落地形态变:

1. **可移植短 token**:约 32 字符以内、纯字母数字。跨网络的最低公分母(有的网络 sub-id 只给 34 字符,gclid 能到 100 字符、放不进),所以 token 必须短、哪家都装得下。
2. **映射表**:`{token → gclid, campaign, adgroup, keyword, page, ip, timestamp, network, offer}`。token 进 sub-id,其余全进映射表。gclid 是其中一个字段,专供离线转化回灌。
3. **gclid 离线转化回灌**:对账拿到 token 后 join 出 gclid,拼成 Google Ads 离线转化导入(按 gclid),转化在关键词级灌回 Google Ads。

## 二、上游适配:AffiliateProvider(每网络一个)

每个联盟网络的参数名、长度、槽数、深链格式、API、废弃点都不同。AffiliateProvider 接口把这些差异封在各自实现里,主干只认接口。

**网络能力注册表(每 provider 声明)**:sub-id 参数名、槽数、长度上限、允许字符、深链模板、废弃/特例说明。

**已知网络差异(建 provider 时对照)**:

| 网络 | sub-id 参数 | 槽数 | 长度/备注 |
|---|---|---|---|
| CJ | 链接用 `sid`;回传字段用 `shopperId`(`sid` 字段已废弃) | 1 | 见下 CJ 专节 |
| Rakuten/LinkShare | `u1` | 1 | 72 字符 |
| Awin | `clickref`(可到 clickref6) | 6 | 每个 50 字符 |
| ShareASale | `afftrack` | 1 | |
| Impact | `subId1`..`subId5` | 5 | subId1/2 各 64、subId3 32 |
| Tradedoubler | `epi` | 2 | |
| eBay | `customid` | 1 | |
| Amazon | 不支持 sub-id,用 Tracking ID(tag) | | 特例,单独机制 |

设计上只依赖"1 个槽 + 32 字符 token",哪家都能装,不吃多槽红利也不踩短限制。

### CJ(首发实现)

- **认证**:Personal Access Token(Bearer)+ Company ID(CID,members.cj.com 上约 7 位)+ 站点 ID。BYOC:用户填自己的,存本机、零留存(复用 localcreds 形态)。
- **sub-id**:链接上追加 `sid=<token>`;从 Commission Detail API 读回时读 `shopperId` 字段(旧 `sid` 字段官方 schema 已标 @deprecated)。
- **数据接入(GraphQL)**:`ads.api.cj.com/query`(商品/广告主发现,`shoppingProductFeeds` 冷发现全网 15k+ 广告主,`products` 只返已 join);`commissions.api.cj.com/query`(佣金明细)。REST:`advertiser-lookup.api.cj.com`(广告主 + EPC + network-rank),Program Terms(佣金率)。
- **对账**:拉 Commission Detail(回来带 shopperId=token)→ join 映射 → gclid → Google 离线转化导入。
- **拒付/纠正(给 ③)**:纠正记录 `original: false`,同 orderId、不同 commissionId、负值。
- **待确认**:CJ 官方提到完整集成需 CJ Technical Integration Engineer 配合;`sid` 确切长度上限。实现时对最新文档锁死。

## 三、下游适配:token 注入形态(按场景选,用户/AI 挑)

落地页和直链都做,不二选一:

1. **落地页 + 第一方标签(顶端做法、合规、per-click)**:Google Ads 流量到用户自己的内容/落地页,页面上的第一方标签读进来的 gclid、生成 token、写映射、把 token 拼进出站联盟深链的 sub-id。这是顶端(Trackonomics Funnel Relay)的做法,也符合 Google Ads 对薄联盟页/直投的限制。
2. **直链 + 跳转注入(per-click,但担 Google 政策风险)**:没有落地页、直投商家深链时,用一个极轻的跳转(读 gclid → 写 token/映射 → 拼 sub-id → 302)。跳转有被 Google 当 cloaking + 掉点击的风险,作退路而非主路。
3. **原生 ValueTrack 维度级(零基建、零风险、非 per-click)**:纯 Google Ads 原生,sub-id 直接用 `sid={campaignid}-{adgroupid}`。不需要任何注入组件,只能到维度级、拿不到 per-click。作最省事的保底。

三种都保留,由用户/AI 按"有没有落地页、要不要 per-click、能不能担政策风险"来选。

## 四、对账流程(随时手动 / AI 触发,不定时轮询)

不做固定 cron。用户或 AI 按需触发:
1. 拉各网络佣金明细(CJ 走 Commission Detail,回来带 token)。
2. token join 映射表,还原 gclid + 维度 + 页面。
3. 拼 Google Ads 离线转化导入(gclid + 转化名 + 时间 + 金额 + 币种),灌回 Google Ads(关键词级,可驱动自动出价)。
4. 同一份对账数据同时喂:投放优化(哪个词带来联盟转化)+ ③ 反作弊第四层(拒付 = 那个 gclid 的负转化 / 排除)。

## 五、开源 vs AI 的切分

- **开源代码(基建)**:AffiliateProvider 各网络实现、token 生成、映射存储、深链构造、佣金明细拉取、gclid↔转化对账、离线导入格式化、三种注入形态的模板。
- **AI / skill(判断)**:选 offer、写广告文案、挑注入形态、何时对账、砍哪个维度、怎么根据对账结果调投放。不硬编码进服务。

## 六、边界与约束

- 不刷量、不做假流量、不 cloak;跳转注入只作退路并明示其风险。
- token 不超过 32 字符、纯字母数字(跨网络可移植)。
- 凭证(CJ PAT/CID、Google token)BYOC、存本机、零留存。
- 反作弊 = 只过滤,不制造。

## 七、暂缓 / 待办

- **Google 隐私适配(第二条适配线)**:cookieless/同意模式下 gclid 退化(gbraid/wbraid、enhanced conversions、consent mode),回灌链路要跟着改。本规范未覆盖,单独立项再查。
- CJ Technical Integration Engineer 配合要求、`sid` 长度上限:实现时锁死。
- 映射表存储位置:本机(直链/维度级场景)vs 用户边缘(落地页标签场景)的取舍,编码时定。
