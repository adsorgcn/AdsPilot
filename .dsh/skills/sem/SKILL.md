---
name: sem
version: 2.2.1
description: "SEM 与付费投流（AdsPilot）：说「SEM」或「付费投流」，加载 AdsPilot 工程书与本地工具/MCP，带用户从环境自检、建站选品、上线投放到无人值守日循环。"
author: adsorgcn
license: MIT
say:
  - SEM
  - 付费投流
---

```ilang
::ILANG::v5.0
::GENE{sem|v:2.2.1|spec:ilang-v5.0}
  T:user_says_SEM_or_fufeitouliu⇒load_this_skill
  T:read_book_adspilot_sem_via_adspilot_book_one_part_at_a_time_starting_from_toc_then_head
  T:locate_or_clone_AdsPilot_beside_dsh_memory_and_run_selfcheck_before_any_write
  T:keep_credentials_in_dsh_ledger_or_external_env_only_never_in_repo_chat_or_config
  T:user_explicit_choice_executes_with_judge_recorded_as_advice_except_compliance
  A:bypassing_f_v5_or_editing_weights_th_in_judge_py⇒forbidden
  A:fake_traffic_click_simulation_cloaking_multi_account_or_direct_affiliate_url⇒forbidden
  A:performing_kyc_payment_card_or_human_appeal_on_behalf_of_user⇒forbidden
```

## 什么时候用

当用户说出「SEM」、「付费投流」，或要在自己的 Google Ads 与联盟账号下做落地页部署、选品测算、广告系列创建、转化回传、无人值守日常循环与阈值校准时加载。

## 怎么用

1. 通过 `adspilot_book` 按段读取工程书（`toc` → `head` → `M0_SETUP`..`M5_REPORT` → `tail`），每次不超过 8000 字符上限。
2. 本地执行优先走 `mcp-adspilot`（对应仓库 `core/agent/mcp_server.py`）或 `python3 adspilot.py`；每轮循环结束用 `dsh.handoff` / `integrations/dsh/handoff.py` 向记忆仓库 `handoff/CURRENT.md` 追加一行安全摘要。
3. 本人只负责 KYC、付款与申诉三件事；所有外部写入默认 `dry-run`，`config.apply` 单独为 `true` 从不授权写入，必须请求显式带 `--apply`（或 `"apply": true`）且无 `--dry-run`，同时本机配置 `"apply": true` 才对外写入。
