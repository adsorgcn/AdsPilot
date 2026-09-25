# 变更记录

规则：主.次.末。日常改动只动末位；「迭代小版本」动中间位；大版本第一位由老板决定。三处一致：VERSION、本文件最上面一条、git tag。

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
