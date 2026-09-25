::ILANG::v5.0::ADSPILOT_SOUL_INTERFACE
[TYPE:contract][SCOPE:public][LANG:zh]

# SOUL 接口

::STATE{@SOUL, what:"判断与策略的全部数值与规则", where:"soul/<name>.soul.md", switch:"config.soul 一行"}

一个 SOUL 就是一个 `*.soul.md` 文件：iLang 声明写规则，一段 ```` ```json soul-params ```` 围栏写数值。主干 `core/judge/judge.py` 只读围栏里的 JSON 和文件里的 `::BOUNDARY` 行；规则文字是给执行 Agent 和判断插件看的。

## 三种 SOUL

| | 在哪 | 感知层 | 费用 |
|---|---|---|---|
| 默认 SOUL | `soul/default.soul.md`，本仓库 | 本地规则 | 0 |
| 托管 SOUL API（公益期） | iLang Inc. 托管，`soul/soul-api.md` 是接口 | 便宜模型加 Jev | 免费 |
| 定制 SOUL | 用户或 iLang Inc. 另写一个 `*.soul.md` | 任一提供者 | 开源稳定后再说 |

## 接口

请求与响应即 `schemas/judgment.schema.json`。感知层给向量与选项，决策层永远在本地按 f_v5 算。换 SOUL 不改主干、不改插件、不改 schema。

::RULE{SOUL可以加::BOUNDARY⇒不可删默认SOUL里的任何一条}
::RULE{SOUL参数只影响感知层与规则⇒f_v5的常数与结构冻结在iLang_v5 不属于SOUL}

## 校验

```bash
python3 core/judge/judge.py --soul soul/default.soul.md --selftest
```
