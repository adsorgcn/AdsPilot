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

## 边界怎么写（::BOUNDARY）

主干读 SOUL 里每一行以 `::BOUNDARY{` 开头的行（```` ``` ```` 围栏里的是示例，不读），按文件顺序：

```
::BOUNDARY{never:<名字>|when:<条件>[&<条件>...]|nodes:<n1,n2>|choices:<c1,c2>|kind:operational|scope:...}
```

条件写成 `<state字段><op><字面量>`，几个条件用 `&` 连，全部成立才命中。`op` 是 `>=` `<=` `!=` `==` `>` `<`；字面量是数字、`true`、`false`，或 `[A-Za-z0-9_.-]+` 的一个词（`true`、`false` 和词只能配 `==` 或 `!=`）。state 里没有这个字段，或者类型对不上，这个条件就不成立。不做任何表达式求值。

`nodes` 与 `choices` 用逗号分隔，不写就是全部节点、全部选项；`nodes` 只能写七个决策节点。`kind` 是 `operational`（运营边界，Agent 自己拿主意时不越过，用户明确说了就照做）或 `compliance`（合规姿态，用户说了也不做），不写就是 `operational`。别的字段（`scope`、`reason` 之类）主干不读，照写。

例：均价过 2 且没有转化时，不许维持或加预算：

```
::BOUNDARY{never:cpc_hard_stop|when:avg_cpc>2&conversions==0|nodes:campaign.adjust|choices:keep,budget_up|kind:operational}
```

命中任何一条边界，判断的模式强制 M8，响应里写 `boundary_hit`（名字）与 `boundary_kind`。

默认 SOUL 的五行边界各带一个 `builtin:<代码里的名字>`，对应代码里写死的五个内置边界：`forbidden_action`、`account_suspended_or_limited`（这两个是 compliance）、`test_spend_total_exceeded_without_human_confirmation`、`upload_unreconciled_conversions`、`affiliate_link_as_final_url`（这三个是 operational）。内置边界不依赖 SOUL，SOUL 删了那几行代码照样执行；`builtin` 行的 kind 由代码定，SOUL 里写成别的会报错。`builtin` 只给默认 SOUL 那几行用，自定义边界用 `when`。

没有 `when` 也没有 `builtin` 的行，代码执行不了，只给 Agent 看；自检（`core/agent/selfcheck.py`）会给 warn。

::RULE{BOUNDARY行写坏（条件、kind、nodes、builtin任一处）⇒load_soul报错 坏SOUL不许静默跑}
::RULE{自定义边界只能加 不能删或改内置边界}
::RULE{SOUL参数只影响感知层与规则⇒f_v5的常数与结构冻结在iLang_v5 不属于SOUL}

## 校验

```bash
python3 core/judge/judge.py --soul soul/default.soul.md --selftest
```
