# 变更记录

规则：主.次.末。日常改动只动末位；「迭代小版本」动中间位；大版本第一位由老板决定。三处一致：VERSION、本文件最上面一条、git tag。

## 2.0.0（2026-09-25）第一个 AI 范式版本

定位改为开源免费的基座加插件：执行者是用户自己的 Agent，仓库是使用方法加标准库脚本，不是要编译的程序。判据一条：对外部 API 说话的是插件，其余是主干。公益期判断引擎免费（便宜模型加 Jev），商业化等开源稳定再说。

主干（`core/`）：Agent 适配与能力自检（`selfcheck.py`、`ilang_runtime.py`，三份入口文件同内容）；落地页模板与合规检查（`lp_check.py`）；判断接口（`judge.py`，iLang v5 f_v5 冻结在本地，提供者只做感知层，SOUL 边界强制 M8）；sub-id 归因与对账（`subid.py` SQLite 账本、`reconcile.py` 五桶输出、拒付反标）；无人值守日常循环（`daily.py` 九步幂等、退出码、systemd 与 cron 模板、`sentinel.sh`）；schema 自检（`validate.py`，标准库 JSON Schema 子集）。

插件（`plugins/`）：`traffic/google-ads`（spec、manual deploy、CSV 与 API 两条 report 路、离线转化与调整文件）；`affiliate/cj`（offers、link、commissions GraphQL 与 CSV 退路、chargebacks）；`judgment/llm`、`judgment/jev`、`judgment/soul-api`；`report/feishu`（收集接口加 webhook，发前扫凭据与 gclid）；`deploy/cloudflare-worker`（/go 铸 token 存映射 302，/export 拉回）；`keywords`、`ipintel` 只有契约；`_template`。

其他：`schemas/` 六份；`soul/default.soul.md` 默认 SOUL（参数围栏加七节点规则加五条边界）与 SOUL API 接口说明；`reference/ilang` 钉版本 runtime（2026.09.23-65222aa76c8d）与正典校验器；`tests/run.sh` 21 项自测全过（CI）；旧 Go 代码打 tag `v1-go-archive` 后从主分支移除。

已知未完（进 2.0.x）：Google Ads api 路的 deploy 与转化上传；Jev 请求形状按接入文档锁死；所有插件 `status` 为 alpha，七天无人值守验收未做。

## 1.x（Go 版本，归档）

见 tag `v1-go-archive` 与 `reference/HANDOFF-v1.md`。
