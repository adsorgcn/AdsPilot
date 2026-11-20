::ILANG::v5.0::ENGINEERING_BOOK
[TYPE:engineering_book]
[ID:ADSPILOT-SEM]
[VERSION:2.2.2]
[DATE:2026-11-20]
[LANG:zh]

::STATE{@USER, role:decision_maker, does:点头确认_KYC身份验证_付款绑卡_平台申诉}
::STATE{@AGENT, role:user_own_executor_in_dsh_or_cli, does:环境适配_建站选品_广告上线_每日对账判断_汇报交接, never:替本人过KYC_绑卡付款_提交申诉_伪造数据}
::STATE{@ADSPILOT, role:local_repo_and_scripts, repo:"https://github.com/adsorgcn/AdsPilot", homepage:"https://ilang.ai", dir_convention:"../AdsPilot（与 dsh-memory 同级）", private_dirs:"config/ data/ runs/ site/", version:"2.2.2"}
::STATE{@LEDGER, role:local_attribution_and_secrets_boundary, db:"data/ledger.db（仅存本地）", secrets_storage:"DSH 3.1 env/ledger.env + env/keys.env（经 grant 按需注入进程），或仓库外 0600 env 文件"}
::STATE{@JUDGMENT_CORE, perception:"SOUL（soul/default.soul.md 或自定义 SOUL）与 plugins/judgment/*", decision:"core/judge/judge.py 冻结 f_v5，只输出 M1..M8", rule:"M1/M2 可执行，M3..M8 只提议或交本人"}

::OBJECTIVE{id:sem_unattended|owner:user|trust:trusted|version:2|status:active}
  target: 带用户在自有机器与自有账号下完成合规 SEM 联盟投放全链路：装机自检 -> 建落地位与选品 -> 写评测页并建系列验证闭环 -> 无人值守日循环、对账与哨兵 -> 7 天验收、评估与数据校准
  ACCEPT: tail 全部 ::RUBRIC 项通过 AND runs/<id>/report.json 持续落盘且 needs_human 仅出现在证件、付款、申诉三处
  NON_GOALS: 托管账号或密钥；替人代做 KYC/付款/申诉；绕开平台审核；改动 core/judge/judge.py 中的 f_v5 与常数

::BOUNDARY{never:假流量_模拟点击_cloaking_绕过资格或封禁_冒充身份_多账号|scope:permanent}
::BOUNDARY{never:直接把联盟追踪链接设为广告Final_URL|scope:permanent}
::BOUNDARY{never:把任何令牌_密钥_私钥_原始gclid或访客IP写入仓库_记忆_config_对话或MCP返回|scope:permanent}
::BOUNDARY{never:改动core/judge/judge.py里的WEIGHTS_TH_f_v5结构与决策顺序|scope:permanent}
::BOUNDARY{never:在M3及以上模式下擅自对外执行花钱或上传动作|scope:permanent}
::BOUNDARY{never:替用户完成KYC_绑卡付款或申诉|scope:permanent}

::RULE{dry_run_first then 所有入口默认只读预览且配置单独为 true 不授权写入；日循环与统一入口及 MCP 只有请求显式开启 apply 且无 dry_run 且本机 config.apply 为布尔 true 才对外写|source:AGENTS.md}
::RULE{user_override then 用户明确说了要投什么 offer 或怎么调某条系列/词，就照做并把判断算出的结果记入 advice；但永久合规姿态不因口头要求放行|source:SOUL_2.4}
::RULE{one_question then 向用户索要账号授权、KYC、付款或选品拍板时，一次只问一件事并写清选项与后果|source:kit_onboarding}
::RULE{resume then 每次启动先看 runs/launch/launch.json、runs/run-* 与 ../dsh-memory/handoff/CURRENT.md；用户再次说 SEM 或 付费投流 时从断掉的那一环续接|source:kit_handoff}
::RULE{least_hands then 能由 Agent 跑脚本生成规格、页面、OAuth 本地回调、自检和 MCP 配置的，全部由你完成，不让用户手抄 JSON|source:owner_principle}

::MODULE{M0_SETUP|title:第零环 装机、凭据账本、OAuth 与 MCP 接入}
  [STEP] 1 定位或克隆仓库：检查当前目录或 ../AdsPilot 是否已克隆 https://github.com/adsorgcn/AdsPilot。若没有，在 DSH 记忆仓库（dsh-memory）同级目录克隆，绝不把 AdsPilot 的 config/、runs/、data/ 放进 dsh-memory。
  [STEP] 2 校验运行环境与语法基准：运行 `python3 core/agent/ilang_runtime.py verify` 与 `python3 core/agent/selfcheck.py`（Windows 用 python 加 PYTHONUTF8=1）。任一 FAIL 立即停止并原样贴给用户；WARN 记录进首轮准备说明。
  [STEP] 3 初始化本机配置：若 `config/adspilot.json` 不存在，复制 `config/adspilot.example.json` 为 `config/adspilot.json`，先保持 `"apply": false`，填妥 `currency`（须在 `fx` 内）、`timezone`、`judgment.provider`（可选 `local` / `llm` / `jev` / `soul-api`）与可选 `provider_chain`、`sentinel.notify_webhook_env`。config 里只写环境变量名，绝不写密钥字面值。
  [STEP] 4 建立凭据边界：需要三组外部钥匙与可选感知钥匙：
    - Cloudflare（Cloudflare Worker 与 KV 部署）：`CF_API_TOKEN`（或 `CF_EMAIL` + `CF_GLOBAL_API_KEY`）。
    - Google Ads：`GOOGLE_ADS_CLIENT_ID`、`GOOGLE_ADS_CLIENT_SECRET`、`GOOGLE_ADS_REFRESH_TOKEN`、`GOOGLE_ADS_CUSTOMER_ID`（按需填 `GOOGLE_ADS_LOGIN_CUSTOMER_ID`、`GOOGLE_ADS_DEVELOPER_TOKEN`、`GOOGLE_ADS_CONVERSION_ACTION`、`GOOGLE_ADS_DATA_MANAGER_PRODUCT_DESTINATION_ID`）。
    - 联盟网络（二选一单线起步）：CJ（`CJ_ACCESS_TOKEN`、`CJ_PUBLISHER_ID`、`CJ_WEBSITE_ID`）或 Impact（`IMPACT_ACCOUNT_SID`、`IMPACT_AUTH_TOKEN`）。
    - 可选能力：`IPAPI_IS_API_KEY`（ipintel 代理/机房流量排查）、`LLM_BASE_URL` + `LLM_API_KEY` + `LLM_MODEL`（或 `JEV_ENDPOINT`/`SOUL_API_URL`）、`ADSPILOT_NOTIFY_WEBHOOK`（哨兵告警通知）。
    - 在 DSH 3.1 中通过 `tools/brain.py ledger add` / `grant` 将钥匙存入私有记忆库的 `env/ledger.env` + `env/keys.env`（仅由本机授权在启动子进程或计划任务时注入进程环境，或用 `${credential:REF}` / 仓库外 `0600` 文件），绝不进 git 或对话记录。
  [STEP] 5 Google Ads OAuth 引导：若用户尚未取得含 `adwords` 与 `datamanager` 双作用域的 refresh token，由你运行 `python3 plugins/traffic/google-ads/oauth_helper.py`（无浏览器环境加 `--no-browser` 或 `--manual`）用 PKCE 拉起本地回环授权，请用户在浏览器亲自登录同意；授权后用 `--out-env` 写到仓库外 `0600` 文件或交由 DSH 账本保存，并用 `oauth_helper.py --check` 核验双作用域齐全。
  [STEP] 6 接入本地 MCP（mcp-adspilot）：按 `integrations/dsh/mcp.json` 把 `/home/learner/AdsPilot` 与 `/usr/bin/python3` 替换为用户本机的真实绝对路径后加入 Cordis 用户配置；离线自测用 `adspilot.example.json`，启用实盘外部读取时在获准配置行里通过 `!!js process.env.<VAR>` 显式映射本次需要的环境变量。连接后调用 `judge.judge` 的 fixture 自测返回 `judgment.response` 即通。
  [STEP] 7 实盘前总检（Preflight）：运行 `python3 core/selfcheck/preflight.py` 做离线核查；真钥匙就位并准备开局前，运行 `python3 core/selfcheck/preflight.py --apply` 实测 Google Ads 账户币种是否等于 `config.currency`、OAuth 双作用域与 Cloudflare Worker `/health`、`/export` 鉴权。任何 fail 必须先修再进入第一环。

::MODULE{M1_LAUNCH_OFFER|title:第一环 建落地位与选品第一条}
  [STEP] 1 部署中转与落地位：确认用户在 Cloudflare 已绑定自有域名且环境变量就位，运行 `python3 core/launch/launch.py deploy --host <子域名> --site-name "<站点名>" --contact <联系邮箱> --apply`。验证 `/health`、KV 存储、Worker、HTTPS 与隐私/条款页就绪，状态落盘至 `runs/launch/launch.json`。
  [STEP] 2 拉取并测算 Offer（选品第一条）：运行 `python3 core/launch/launch.py offers --top 10`（可用 `affiliate.cj.offers` 或 `affiliate.impact.offers` 配合关键词插件）。
    - 第一条硬账：存在至少一个合格非品牌关键词（或联盟明确允许竞价品牌词）的首页低位出价 < 该 offer 每次点击预计收益（`EPC / 100 * max_bid_ratio` 按 `config.fx` 折成账户币种）。
    - 政策校验：联盟 API 不给完整 PPC 政策文本；若 `ppc_allowed` 或 `brand_bidding_allowed` 为 `null`，由你在联盟后台核对 Program Terms 并写入 `data/inbox/cj-offer-policy.json`（或 `impact-offer-policy.json`）后重算。
    - Impact 说明：Impact API 不返回项目级 EPC（`epc: null`），开局首轮需把可投清单交给用户决定并用 `--pick <offer_ref>` 确认；跑起来之后再用联盟报表真实转化算出自己的 EPC。
  [STEP] 3 尊重用户拍板：用户明确选定某个 offer 时，用 `--pick <offer_ref>` 照做；即便算账或政策不通过，也执行用户选择并把判断警告完整记入 `picked.warnings` 与 `judge.advice`（永久合规红线除外）。

::MODULE{M2_LP_CAMPAIGN|title:第二环 真实落地页、系列上线与点击闭环}
  [STEP] 1 撰写真实内容页：按 `core/lp/使用方法.md` 生成站点内容 JSON（参考 `tests/fixtures/lp-content.example.json`），至少 300 词实质评测或购买指南、披露联盟佣金关系、包含隐私与条款、页面出站 CTA 走自有域名 `/go/<slug>` 并禁止直接把联盟跳转链接作为广告 Final URL。
  [STEP] 2 合规检查与发布：运行 `python3 core/launch/launch.py page --content <content.json> --slug <slug> --apply`。该步自动跑 `core/lp/lp_check.py` 与 `lp.publish` 节点；若命中 `fix` 且用户未覆写，则改内容后再推。
  [STEP] 3 生成并校验投放规格：撰写 campaign brief（参考 `tests/fixtures/brief.example.json`）。出价方式默认 `maximize_clicks`（Google `TARGET_SPEND`），系列每次点击上限取 offer `bid_cap` 与 `config.caps.max_cpc` 较小值；预算优先按 Google `budget_api.py --new` 返回推荐预算（仅当币种等于 `config.currency`），或由用户 brief 显式指定。运行 `python3 core/launch/launch.py campaign --brief <brief.json> --apply`，内部会先走 Google Ads `validate-only` 整系列校验再以 PAUSED 状态创建系列，并将上下文记入 `data/inbox/campaigns.json`。
  [STEP] 4 验证点击与归因全链路：运行 `python3 core/launch/launch.py verify`。用测试 `gclid` 访问落地页 -> `/go` 302 附 20 位 `sid` -> Worker 写入 KV -> `/export` -> `core/ledger/subid.py` 拉入本地 SQLite 账本，确认 `gclid_matches: true` 且响应中不回传原始 `gclid` 或访客 IP。
  [STEP] 5 启用投放：仅当确认预算上限、政策、落地页与闭环均通过且判定为 `M1`/`M2`（或用户明确指令 `--user go`）时，运行 `python3 core/launch/launch.py go --apply` 将系列置为 ENABLED，并转入第三环日循环。

::MODULE{M3_DAILY_LOOP|title:第三环 无人值守日循环、对账与双轨哨兵}
  [STEP] 1 跑通首轮 dry-run：先执行 `python3 core/loop/daily.py --dry-run`（哪怕配置里写了 `"apply": true`，未显式加 `--apply` 仍只做只读预览；绝不产出可执行 `actions-todo.json` 或发送外部写动作）。检查退出码（0 正常，2 需要本人处理，3 暂时失败，4 配置/凭据或写门控错，1 输入/参数错）与生成的 `runs/<id>/report.json`、`runs/<id>/run.log`。
  [STEP] 2 跑完一轮的标准流水线：每轮 `daily.py` 按固定顺序幂等执行：
    1) `selfcheck.py --quick`；
    2) `subid.py pull` 增量游标拉取 Worker 点击映射；
    3) `report_api.py`（或 `report_import.py`）拉取系列/关键词表现、拒绝审原因、账户状态与搜索词；
    4) `budget_api.py --campaigns` 读取 Google 对现有系列的推荐预算；
    5) 可选 `plugins/ipintel/ipapi-is/lookup.py` 读取摘要态代理/机房占比（出外部判断前脱敏，不传原始 IP）；
    6) 联盟 `commissions.py`（含退单/拒付负行 `chargebacks`）拉佣金；
    7) `core/ledger/reconcile.py` 按 `gclid`/`gbraid`/`wbraid` 对账并维护 `schema_version=1` 与已上传游标；
    8) 对 `anomaly.escalate`、`campaign.adjust`、`keyword.action`、`conversion.upload` 四类节点调判断；
    9) 严格只对 `M1`/`M2` 或未过期且未超额外花费红线的用户明确决定执行写动作（`deploy_api.py` 改预算/上限/停词/加否定词，`convert_api.py` 通过 Data Manager 上传转化，遇新建转化操作传播延迟判 `retry_later` 下轮自动重试），`M3..M8` 只记报告与动作清单；
    10) 生成 `runs/<id>/report.json`。
  [STEP] 3 记忆交接：每轮结束执行 `python3 integrations/dsh/handoff.py --report runs/<id>/report.json --memory ../dsh-memory`（或调用 MCP `dsh.handoff`），仅向 `../dsh-memory/handoff/CURRENT.md` 追加一行含轮次编号、状态、退出码与是否需本人处理的摘要；禁止把 `data/`、`runs/`、配置或密钥拷入记忆库。
  [STEP] 4 配置定时调度与双轨哨兵：
    - 仓库随附调度模板（Linux `core/loop/systemd/adspilot-daily.service` + `.timer`、`core/loop/crontab.example`、Windows `core/loop/windows/register-task.ps1`）默认一律显式传 `--dry-run`（Windows 注入 `-DryRun`）只做只读预览；`config.apply: true` 单独存在从不触发实盘写入，也不会自动迁移或改写本机已安装的旧任务；
    - 仅在所有者明确授权后，方可单独改为实盘调度：须同时在 `config/adspilot.json` 设置布尔 `"apply": true`，并显式配置带 `--apply` 的独立调用（Windows 须显式用 `-Apply` 重新注册，且旧版只靠配置开启的实盘调度需显式补齐 `--apply` 才会继续写外部）；
    - 每小时跑 `core/loop/sentinel.sh`（Windows 为 `sentinel.ps1`）：当最新 `run.log` 超过 26 小时未更新或最近退出码为 1/3 时写 `runs/sentinel.log` 并返回退出码 2；若环境配置了 `ADSPILOT_NOTIFY_WEBHOOK` 则 POST 一条仅含轮次与退出码的安全告警。
  [STEP] 5 Manual 模式兜底：若广告或联盟处于手工导表模式（`report_source: csv_export` / `deploy_mode: manual`），每日按 `runs/<id>/actions-todo.json` 与 `data/inbox/` 完成后台操作后执行 `python3 core/loop/daily.py --ack <run_id>`。

::MODULE{M4_CALIBRATE_PLUGINS|title:第四环 七天验收、判断评测与数据校准}
  [STEP] 1 离线 7 天模拟验收（投产前必过）：运行 `python3 core/loop/daily.py --simulate-days 7 --runs-dir /tmp/ap-sim` 后运行 `python3 core/selfcheck/validate.py --acceptance /tmp/ap-sim`。确认模拟 7 天连续无退出码 1/3、所有天均有账本记录且 `needs_human` 原因合规。
  [STEP] 2 真实 7 天运行验收：在连续运行至少 7 天实盘循环后，对生产 `runs_dir` 运行 `python3 core/selfcheck/validate.py --acceptance <runs_dir> --ledger <data/ledger.db>`，通过后方可评估插件从 alpha 升级为 stable。
  [STEP] 3 判断插件基准评测：启用 `llm`、`jev`、`soul-api` 或自行基于 `plugins/judgment/_template/` 开发感知插件时，运行 `python3 core/judge/eval_provider.py --provider <name> --benchmark tests/fixtures/judge-benchmark.json`（或 MCP `judge.eval`），核验 L2 `schema_validity`、`mode_consistency`、与基线一致率及未配置时干净回退到本地规则。
  [STEP] 4 真实数据阈值校准：积累足够真实周期后，运行 `python3 core/judge/calibrate.py --runs-dir <runs_dir> --ledger <data/ledger.db>`（或 MCP `judge.calibrate`），产出仅作建议的 `runs/calibration-<date>.json`（按当轮汇率折回 SOUL 币种、去重窗口快照、按账本延迟 P90 估计归因窗口）。任何 SOUL 阈值改动都必须由用户审阅后显式决定，脚本绝不自动改 `soul/*.soul.md` 或 `f_v5`。

::MODULE{M5_REPORT|title:第五环 状态汇报与六行交接格式}
  [STEP] 1 每次完成关键阶段、日循环交付或遇到 `needs_human`/故障时，按以下六项向用户简明汇报：
    - 结果：当前停在哪个环（M0 到 M5），状态 pass / warn / needs_human / fail。
    - 验了什么：实际运行过的自检、Preflight、validate、dry-run 或 live 命令及退出码。
    - 改了什么：创建或变更的配置/状态文件（只写相对路径与变量名，不打凭据值）。
    - 怎么用和怎么还原：下一步命令或调度状态，以及回滚/teardown/改回 `apply: false` 方法。
    - 剩什么：当前待办或需要本人操作的单个事项（KYC / 付款 / 申诉 / 选品确认）。
    - 记录去向：本轮 `runs/<id>/report.json` 与已追加到 `../dsh-memory/handoff/CURRENT.md` 的摘要标识。

::RUBRIC{S1: iLang runtime 与核心能力自检通过|check:cmd|run:"python3 core/agent/ilang_runtime.py verify && python3 core/agent/selfcheck.py --quick"|expect:0}
::RUBRIC{S2: 仓库密钥扫描干净|check:cmd|run:"python3 core/agent/selfcheck.py --secrets"|expect:0}
::RUBRIC{S3: 全部插件 manifest、config、schema 与 39 个统一接口核验通过|check:cmd|run:"python3 core/selfcheck/validate.py --all && python3 core/selfcheck/validate.py --interfaces"|expect:0}
::RUBRIC{S4: 离线与可配置前置核查无 FAIL|check:cmd|run:"python3 core/selfcheck/preflight.py"|expect:0}
::RUBRIC{S5: 日常循环离线自测与 7 天模拟验收通过|check:cmd|run:"python3 core/loop/daily.py --selftest && python3 core/judge/eval_provider.py --selftest"|expect:0}
::RUBRIC{S6: 本轮 dry-run 或实盘生成合法 report.json 且未越权执行 M3 及以上动作|check:human}
::RUBRIC{S7: DSH 记忆仓库只收 CURRENT.md 单行摘要且无凭据或私有目录|check:human}
::RUBRIC{S8: KYC、付款、申诉三处之外未出现 needs_human|check:human}

::FALLBACK{adspilot_repo_missing then 在dsh-memory同级目录克隆https://github.com/adsorgcn/AdsPilot再从M0第2步续跑|oauth_scope_missing then 用plugins/traffic/google-ads/oauth_helper.py重走PKCE双作用域授权并写回仓库外env与DSH账本|preflight_currency_mismatch then 停留在干跑模式并请用户把config/adspilot.json里的currency与fx对齐Google Ads账户币种|data_manager_retry_later then 新建点击转化操作需约一小时生效保持conversions.json游标不丢失由下轮自动重试|rate_limit_or_network_error then 记录退出码3与原因保留游标下轮幂等续传不重复造转化或乱加动作|judgment_provider_unavailable then 自动fallback到SOUL本地规则并在report中标记fallback为true绝不阻塞日常风控|needs_human_gate then 遇到KYC或付款或本人申诉立即停在当前环输出needs_human与明确一步操作由用户本人完成后再继续}

::PRIORITY{
  compliance_boundary > user_decision > OBJECTIVE > RUBRIC > RULE > MODULE
}
::ILANG::v5.0::ENGINEERING_BOOK
