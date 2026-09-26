# 变更记录

规则：主.次.末。日常改动只动末位；「迭代小版本」动中间位；大版本第一位由老板决定。三处一致：VERSION、本文件最上面一条、git tag。本文件记细节，README 的「进度记录」记叙事，每版两处都写。

## 2.0.14（2026-09-26）SOUL 是变量，换了就要生效

按工程书 ADSPILOT-JUDGE-FIX-20260926 的 T3（续篇 ADSPILOT-JUDGE-FIX-20260926-PART2）。`load_soul` 按新语法解析 `::BOUNDARY` 行（`never`、`when:<字段><op><字面量>[&...]`、`nodes`、`choices`、`kind`、`builtin`），结果 `soul["boundaries"]` 是 `{name, conds, nodes, choices, kind, builtin, enforced}` 列表；写坏的行（条件、kind、nodes、builtin 任一处）让 `load_soul` 抛 ValueError，不做任何表达式求值。默认 SOUL 五行边界补 `builtin:`，与代码里五个内置边界一一对应。`boundary_hit` 返回 `(名字, kind)`：先查五个内置（原逻辑不动，不依赖 SOUL，删不掉），再按文件顺序查有 `when` 的自定义行；`judge()` 的合规判断从名字表改为 `kind == "compliance"`，响应加 `boundary_kind`（`judgment.schema.json` 同步）。`call_provider` 调插件时带 `--soul <path>`；llm 插件的提示词取这个 SOUL 的节点规则，没带才回退默认 SOUL，指定的读不了就退出码 3（主干退回本地）；jev、soul-api 带上 `--soul` 不受影响；`plugins/judgment/契约.md` 加一条 RULE。默认 SOUL 的 campaign.adjust 一节改成与代码同序（测试总额最先），加顺序守卫：文档与 `local_choice` 代码两边都查。自检 `soul_money` 扩成 `soul`：SOUL 解析失败 fail，默认 SOUL 缺内置行 fail，没有 when 也没有 builtin 的行 warn。`soul/README.md` 写 BOUNDARY 语法。自测：T3-a 到 T3-g 先在 2.0.13 上跑出失败再修（a、b、c、e、g 与 f 的提示词一半是真缺陷，d 只是旧接口不带 kind），修后全过；T3-f 用 127.0.0.1 假端点把 llm、jev、soul-api 三个插件的整条链各跑一遍，不出网；既有 12 个判断用例与 5 个用户用例输出与 2.0.13 逐行一致，f_v5 冻结区逐字不变。工程书外的几处：`builtin` 行的 kind 由代码定，SOUL 写成别的报错；围栏里的 BOUNDARY 行当示例不读；顺序守卫多查一遍代码顺序；T3-g 的对调在内存副本上做，不动仓库文件。

真实世界：本版没有碰真实账号与真实判断端点，只跑了自测与样例数据。

## 2.0.13（2026-09-26）用户决定有时间边界和钱的边界

按工程书 ADSPILOT-JUDGE-FIX-20260926 的 T2（续篇 ADSPILOT-JUDGE-FIX-20260926-PART2）。「用户说了就照做」不变，但用户回答的是说话那一刻的情况，情况变了这条就失效、交回判断。`daily.py` 的 `user_decision(node, target, state)` 逐条判：花钱节点（SOUL `user_decision.no_wildcard_nodes`，默认 campaign.adjust 与 keyword.action）上 `target:"*"` 忽略；过了 `until` 失效，没写 `until` 时按 `created`（或第一次看到那天）加 `default_days`（7 天）；campaign.adjust 从第一次看到起多花 `max_extra_spend`（100 美元，已按 fx 折算）或越过 `stop_loss.test_spend_total` 即失效。第一次看到的日子与当时的 `spend_total` 记进账本新表 `user_decision_anchor`（老账本打开时自动补表），`user-decisions.json` 只读不回写。失效与忽略不新增 needs_human、不改退出码。`report.json` 加可选字段 `user_decisions`（applied、expired、ignored，后两者带 why），schema 同步；run.log 每条失效或忽略一行。`core/loop/使用方法.md`「用户说了就照做」一节写字段、边界与 Agent 当场复述的话。自测：原第二轮的 `target:"*"` 无期限写法改为逐条带 `created`；新增 T2-a 到 T2-f（先在 2.0.12 逻辑上跑出 a 到 e 失败再修），另有一个未越界的控制组照做；T1 与既有判断用例不变。工程书外的两处：日期写坏的条目忽略（why `bad_date`），自定义 SOUL 没有 `user_decision` 段时用上述默认值。

真实世界：本版没有碰真实账号，只跑了自测与样例数据；港币配置下核过 `max_extra_spend` 折成 780 港币、测试总额 2340 港币，只折一次。

## 2.0.12（2026-09-26）钱有单位，出价只有一条规则

按工程书 ADSPILOT-JUDGE-FIX-20260926 的 T1。SOUL 参数加 `money_unit: USD`、`offer.max_bid_ratio: 1.0`、`user_decision`（T2 用），版本 2.1.0，正文加「金额单位」一节，四个节点里的 cpc.cap 改称「出价上限」并给出定义。`load_soul(path, cfg)` 按 `config.fx` 把 SOUL 金额（`MONEY_FIELDS`）从美元折成 `config.currency`，币种不在 fx 里就报错；`judge()` 发现 SOUL 币种与配置不一致就报错。`offer_economics` 过线条件改为「出价 < bid_cap = 每次点击赚的钱 × max_bid_ratio」并返回 `bid_cap`；新增 `bid_cap_for`（min(本 offer 的 bid_cap, caps.max_cpc)，都没有才用折算后的 cpc.cap）与 `cap`（null 用 SOUL 默认值），替换 campaign.launch、campaign.adjust、keyword.action、`_within_caps` 里的全部旧写法；campaign.launch 的新账号首日预算也走 `cap`（工程书没列，同类）。开局 offers 步核对关键词插件返回的币种与 `config.currency`，`picked` 带 `bid_cap`；campaign 步把 `bid_cap` 带进 brief 与判断状态，没写出价就取 min(第一个过线词出价, bid_cap)，建成后把预算、出价、出价上限、offer、每次点击赚多少、币种合并写进 `data/inbox/campaigns.json`。`spec.build` 出价上限取 min(brief.bid_cap, caps.max_cpc)，预算上限走 null 感知。日常循环 campaign.adjust 与 keyword.action 的状态带 `bid_cap`，首日预算走 `cap`，`actions-todo.json` 带 `caps_effective`，`deploy_api` 优先用它（caps 为 null 时不再等于没有上限）。配置模板 caps 四项改为 null 并加说明，schema 允许 null；自检加 `soul_money`（十二项）。自测 T1-a 到 T1-f 全过，既有 12 个判断用例与 5 个用户用例与 2.0.11 逐行一致。

真实世界：港币账户配置（`config.currency=HKD`，caps 全 null）对 Roborock 跑开局 offers 与 campaign 两步 dry-run，出价上限 4.56 港币，系列出价 4.42（第一个过线词 roomba vacuum 的首页出价低位），首日预算 39 港币，判断 go M2，未 apply。

## 2.0.11（2026-09-26）判断是建议，不是闸门

改正一处逻辑错：SOUL 早写了「用户明确说的排第一」，代码没实现，结果判断成了闸门，开局里 `--pick` 账没过就拒、页面检查没过不发、建系列判 hold 不建、没真点过不许启用，都在拦用户。现在一条规矩管全部：用户明确说了就照做，判断照算，作为建议（`advice`）写进输出与账本；用户没说，Agent 按判断走，M1、M2 执行，其余只提议。唯一不因用户一句话放行的是合规姿态（假流量、模拟点击、cloaking、绕资格或封禁、冒充身份、多账号、账号被停后继续或另开）。判断响应加 `decided_by`（user、judge、compliance）、`executes`、`advice`、`user_choice`；调用方只看 `executes`。开局每步加用户口子（`--pick`、`--user publish`、`--user go`、`go --user go`），账没过或政策没核照投，警告带出。日常循环读 `data/inbox/user-decisions.json`，用户说过的照做，判断意见记进账本与 `report.json`。SOUL 边界分成合规姿态与运营边界两组，优先级改为：合规姿态 > 用户明确 > 运营边界 > SOUL 规则。架构总图第 5 节、README、入口文件同步改。

## 2.0.10（2026-09-26）选品第一条

选品第一条是账：有一个词的出价小于每次点击赚的钱，这个 offer 才能投。每次点击赚的钱 = EPC÷100（联盟 EPC 是每百次点击），默认取 7 天与 3 个月里小的那个，按 `config.fx` 换成广告账户币种；词的出价默认用 Keyword Planner 的首页出价低位；月搜索不到 50 的词、出价为 0 的词不算；品牌词只在联盟许竞价品牌词时才算。三个数都在 SOUL 参数里（`offer.bid_metric`、`offer.epc_basis`、`offer.min_keyword_searches`）。新增首发关键词插件 `plugins/keywords/google-ads`（suggest、volume，用户自己的 Google Ads 凭据），`judge.offer_economics` 算账，`launch.py offers` 对 EPC 前 N 家查词算账、输出每家一行账、选中的 offer 带出过线的词；`--pick` 只代表政策核过，账照样要过。CJ offers 带出商家网址。

真实世界：我们的账号对 CJ 前 10 家实测，3 家过、7 家出局（见 `plugins/keywords/google-ads/使用方法.md` 实测记录）。

## 2.0.9（2026-09-25）开局

接入改成「交钥匙」：用户把 Cloudflare 全写钥匙、Google Ads、CJ 三把钥匙放进环境变量，其余全是 Agent。新增主干部件 `core/launch`（开局）：deploy 建落地位、offers 选 offer、page 写页发页、campaign 建系列、verify 真点一次、go 启用、teardown 拆，每步幂等，状态在 `runs/launch/launch.json`。`plugins/deploy/cloudflare-worker` 改为 `plugins/deploy/cloudflare`：不再用 wrangler 与 node，`cf_api.py` 用标准库直接调 Cloudflare API，`setup.py` 一次建好 KV、Worker（带绑定与 secret）、自定义域名（DNS 与证书自动），`publish.py` 推页面与 offer 表（只是 KV 写入，不重新部署），`status.py --roundtrip` 真点一次；Worker 同时服务落地页、/go、/export、/health；隐私与条款页模板；`data/deploy.json` 记落地位在哪，主干循环与 `subid.py pull` 从这里读。Google Ads 插件加 `--enable-campaign` / `--pause-campaign`。选品 `ppc_allowed` 为 null 时 SOUL 不放行，Agent 读 Program Terms 后填 policy 或 `--pick`。

真实世界：用我们自己的钥匙在 `reviews.aixray.dev` 从零到一条系列全程无人跑通并拆净（见 `core/launch/使用方法.md` 实测记录）。自测 26 项。

## 2.0.8（2026-09-25）

README 改成叙事版：这是什么、为什么这么做、一个学员的一天、骨架、「走到哪了」逐部件状态表（有没有碰过真实世界）、「进度记录」按版本叙事、还没做的两块。英文版同步。入口文件与本文件加一条规则：每发一版，CHANGELOG 记细节，README 进度记录记叙事。

## 2.0.7（2026-09-25）

CJ 插件用真实发布者凭据只读实测并按实测改正：Commission Detail 的集合字段是 `records`，单次查询窗口不超过 31 天（脚本按 30 天切段并按 `payloadComplete` 翻页），GraphQL 错误原样带出；Advertiser Lookup 分页取齐；Link Search 要的是推广媒介 ID（新增 `CJ_WEBSITE_ID`），`offers.py --with-links` 批量取点击链接；四个动作全部通过。仓库旧分支各打 `archive/` tag 后删除，main 加保护（禁强推、禁删、线性历史）。

## 2.0.6（2026-09-25）

Data Manager 转化上传在真实账号 validate-only 实测通过（HTTP 200，requestId 返回，无警告），Google Ads 插件 api 路到此全部核完。实测钉下一条：新建的「点击上传」转化操作要传播约一小时 Data Manager 才看得到，期间回 `destination_references NOT_FOUND`，`convert_api.py` 判为 `retry_later`，下一轮循环自动重试。测试用的转化操作、系列、预算、临时目录全部删净，账号恢复原样。

## 2.0.5（2026-09-25）

Data Manager 上传按实测改正：事件带 `destinationReferences`、destination 带 `reference`；`eventSource` 必填（默认 WEB）；错误摘要能读 Google 通用 API 的 `fieldViolations`；建转化操作遇 `DUPLICATE_NAME`（删除后的名字仍被占用）自动加后缀。用带 adwords 加 datamanager 两个 scope 的 token 在真实账号上 validate-only 实测：scope、端点、账号与转化操作解析全通，只剩假 gclid 在 `events[0].destination_references` 回 `NOT_FOUND` 这一条，等首个真实点击的 gclid 再核。

## 2.0.4（2026-09-25）

转化上传的 Data Manager 请求按官方字段映射核对并改正：`accountType`（`product` 已废弃）、`encoding`、数字 `productDestinationId`、RFC 3339 时间、币值金额；整包快速失败与异步处理写进使用方法；`ACCESS_TOKEN_SCOPE_INSUFFICIENT` 判为 needs_reauth，`SERVICE_DISABLED` 判为 needs_human（启用 Data Manager API）。在香港机上对真实端点做了 validate-only 探测：端点与 scope 要求与文档一致。

## 2.0.3（2026-09-25）

Google Ads 插件 api 路补齐并在真实账号实测（建一条日预算 1 港币、建好即暂停的系列，改预算改出价暂停词加否定词，最后连预算一起删净）：`deploy_api.py`（`--spec` 建系列，`--actions` 执行主干动作，`--remove-campaign` 删；默认 dry-run，`--validate-only`，中途失败回滚，出价按计费单位取整重试）；`convert_api.py`（自动建「点击上传」转化操作；上传按 Google 2026-09 口径走 Data Manager API，refresh token 缺 datamanager scope 时退出码 2 报 needs_reauth；拒付撤回走转化调整）；`gads_api.py` 公用客户端。主干循环在 `deploy_mode:api` 且凭据齐时自动执行动作与上传，凭据缺失自动退回 manual。实测发现两条平台口径写进使用方法：v25 建系列不认 startDate；新接入的 uploadClickConversions 已被限制。

## 2.0.2（2026-09-25）

Google Ads api 路对齐 Google 新政策：developer token 2026-09-09 起废弃，权限级别由 OAuth 所属的 Google Cloud 项目决定；`report_api.py` 不再强制要 developer token（过渡期有就带），REST 版本默认 v25。契约、使用方法、manifest 同步改。

## 2.0.1（2026-09-25）

拆掉回流通道：删除 `plugins/report/feishu` 与 report 这一类插件口子，循环不再往外发任何东西，哨兵只写本地日志。学员会不会用看社区机器人的对话日志；要看某个人跑得怎么样，让他贴 `runs/<id>/report.json` 与 `run.log`（老板 09-25 定）。架构总图第 6 节、README、config 模板、manifest schema、自测清单同步改。

## 2.0.0（2026-09-25）第一个 AI 范式版本

定位改为开源免费的基座加插件：执行者是用户自己的 Agent，仓库是使用方法加标准库脚本，不是要编译的程序。判据一条：对外部 API 说话的是插件，其余是主干。公益期判断引擎免费（便宜模型加 Jev），商业化等开源稳定再说。

主干（`core/`）：Agent 适配与能力自检（`selfcheck.py`、`ilang_runtime.py`，三份入口文件同内容）；落地页模板与合规检查（`lp_check.py`）；判断接口（`judge.py`，iLang v5 f_v5 冻结在本地，提供者只做感知层，SOUL 边界强制 M8）；sub-id 归因与对账（`subid.py` SQLite 账本、`reconcile.py` 五桶输出、拒付反标）；无人值守日常循环（`daily.py` 九步幂等、退出码、systemd 与 cron 模板、`sentinel.sh`）；schema 自检（`validate.py`，标准库 JSON Schema 子集）。

插件（`plugins/`）：`traffic/google-ads`（spec、manual deploy、CSV 与 API 两条 report 路、离线转化与调整文件）；`affiliate/cj`（offers、link、commissions GraphQL 与 CSV 退路、chargebacks）；`judgment/llm`、`judgment/jev`、`judgment/soul-api`；`report/feishu`（收集接口加 webhook，发前扫凭据与 gclid）；`deploy/cloudflare-worker`（/go 铸 token 存映射 302，/export 拉回）；`keywords`、`ipintel` 只有契约；`_template`。

其他：`schemas/` 六份；`soul/default.soul.md` 默认 SOUL（参数围栏加七节点规则加五条边界）与 SOUL API 接口说明；`reference/ilang` 钉版本 runtime（2026.09.23-65222aa76c8d）与正典校验器；`tests/run.sh` 21 项自测全过（CI）；旧 Go 代码打 tag `v1-go-archive` 后从主分支移除。

已知未完（进 2.0.x）：Google Ads api 路的 deploy 与转化上传；Jev 请求形状按接入文档锁死；所有插件 `status` 为 alpha，七天无人值守验收未做。

## 1.x（Go 版本，归档）

见 tag `v1-go-archive` 与 `reference/HANDOFF-v1.md`。
