::ILANG::v5.0::ADSPILOT_CORE
[TYPE:index][SCOPE:public][LANG:zh]

# 主干

::STATE{@CORE, rule:"不对任何外部 API 说话", parts:7}

| 目录 | 部件 | 入口 | 使用方法 |
|---|---|---|---|
| `agent/` | Agent 适配与能力自检 | `selfcheck.py`、`ilang_runtime.py` | `agent/使用方法.md` |
| `lp/` | 落地页 | `lp_check.py`、`templates/landing.html` | `lp/使用方法.md` |
| `judge/` | 判断接口（f_v5 冻结） | `judge.py` | `judge/使用方法.md` |
| `ledger/` | sub-id 归因与对账 | `subid.py`、`reconcile.py` | `ledger/使用方法.md` |
| `loop/` | 无人值守日常循环 | `daily.py`、`sentinel.sh`、`systemd/` | `loop/使用方法.md` |
| `selfcheck/` | schema 与一致性自检 | `validate.py` | `selfcheck/使用方法.md` |
| （`soul/` 在仓库根） | 默认 SOUL | `soul/default.soul.md` | `soul/README.md` |

读的顺序：`agent` → `loop` → 需要哪块读哪块。所有脚本只用 Python 标准库，都有 `--selftest`。
