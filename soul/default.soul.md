::ILANG::v5.0::ADSPILOT_DEFAULT_SOUL
[TYPE:soul][SCOPE:public][LANG:zh][SOUL:default][VERSION:2.0.0]

# 默认 SOUL

::STATE{@SOUL, id:default, host:local, cost:0, promise:"能跑 不保证赚"}
::STATE{@JUDGE_LAYERS, perception:"本文件的规则 或 判断插件", decision:"core/judge/judge.py 里的 f_v5 不可改"}

这是仓库自带的通用 SOUL：本地、开源、零成本。它给出每个决策节点的规则与阈值，主干的本地感知层照它把状态打成 11 维向量，决策层按 iLang v5 的 f_v5 算出模式。换一个 SOUL 只换这一个文件加配置里的一行，主干与插件不动。

公益期由 iLang Inc. 托管的 SOUL API 用便宜模型加 Jev 做感知层，接口一样（见 `soul/soul-api.md`），免费。

## 参数（脚本读这一段，改数值只改这里）

```json soul-params
{
  "soul": "default",
  "version": "2.1.0",
  "money_unit": "USD",
  "cpc": { "start": 0.25, "cap": 0.25, "watch": 0.20 },
  "budget": { "first_day": 5.0, "daily_cap": 10.0, "step_pct": 20, "ramp_min_days": 3, "min_days_between_changes": 2 },
  "stop_loss": { "spend_no_conversion": 100.0, "test_spend_total": 300.0, "days_before_budget_down": 7, "roi_floor": 0.5 },
  "offer": {
    "bid_metric": "cpc_low", "epc_basis": "min_7d_3m", "min_keyword_searches": 50, "max_bid_ratio": 1.0,
    "min_epc": 5.0, "max_reversal_rate": 0.20, "min_cookie_days": 7, "require_ppc_allowed": true,
    "blocked_categories": ["adult", "gambling", "crypto", "loans", "pharma", "weapons", "tobacco"]
  },
  "keyword": { "pause_after_clicks_no_conv": 30, "bid_down_pct": 10 },
  "conversion": { "window_days": 90, "min_rows": 1 },
  "anomaly": { "spend_spike_x": 3.0, "disapproval_appeal_max": 1 },
  "authority": { "within_caps": 0.85, "over_caps": 0.40, "propose_only": 0.50 },
  "reversibility": {
    "keep": 0.95, "pause": 0.95, "pause_all": 0.90, "bid_down": 0.90, "budget_down": 0.90, "negative": 0.90,
    "budget_up": 0.70, "go": 0.60, "publish": 0.80, "upload": 0.45, "select": 0.75, "hold": 0.95,
    "fix": 0.95, "continue": 0.95, "escalate": 0.95, "none": 0.95
  },
  "vector_base": { "int": 0.90, "cap": 0.80, "rel": 0.70, "sov": 1.00, "ext": 0.90 },
  "user_decision": { "default_days": 7, "max_extra_spend": 100.0, "no_wildcard_nodes": ["campaign.adjust", "keyword.action"] }
}
```

## 金额单位

这份 SOUL 里的金额一律按美元写（`money_unit: USD`）：`cpc.start` `cpc.cap` `cpc.watch`、`budget.first_day` `budget.daily_cap`、`stop_loss.spend_no_conversion` `stop_loss.test_spend_total`、`user_decision.max_extra_spend`。主干读 SOUL 时按 `config.currency` 与 `config.fx` 把它们折成广告账户币种，判断里比的都是折算后的数。`offer.min_epc` 不折算，它和联盟给的 EPC 同是美元。

`config.caps` 是用户自己设的绝对上限，用广告账户币种写；不填就用这里的默认值（美元按 fx 折算）。

出价上限的定义见 offer.select 一节：一个 offer 能出的最高价，由它每次点击赚的钱推出来，选品第一条与建系列、日常调价用同一个数。

::RULE{config.currency或money_unit不在config.fx里⇒读SOUL就报错 不带着错的钱跑}

## 谁拿主意

这份 SOUL 给的是建议，不是闸门。

::RULE{用户明确说了（状态里有user_decision）⇒照做 判断照算 作为建议写进输出与账本 不拦}
::RULE{用户没说⇒Agent按判断走 M1与M2执行 其余只提议}
::RULE{合规姿态那几条⇒用户说了也不做 那是怎么投 不是投什么}

## 七个决策节点

::MODULE{NODES|closed_set:7|add_node:"改主干与本文件 不在插件里加"}

### offer.select

下面是 Agent 自己选的时候怎么选。用户指定了 offer 就投那个，这里的账与政策照算，作为建议带出。

第一条是账算得过来：买一次点击的钱，要小于一次点击能赚的钱。

::RULE{第一条：有一个词的出价<这个offer的bid_cap⇒这个offer能投|一个这样的词都没有⇒出局}
::RULE{bid_cap=每次点击赚的钱×max_bid_ratio max_bid_ratio默认1.0 即出价不超过每次点击赚的钱 改成小于1.0则选品与出价一起收紧 两处永远同一个数}

出价上限 = min(本 offer 的 bid_cap, config.caps.max_cpc)；两个都没有时，用 cpc.cap（美元，按 fx 折算）。下面几节说的「出价上限」都是这个数。

::RULE{每次点击赚的钱=EPC÷100（联盟的EPC是每百次点击）epc_basis为min_7d_3m时取7天与3个月里小的那个 按汇率换成广告账户币种}
::RULE{词的出价=关键词插件给的bid_metric（cpc_low是首页出价低位 cpc_high是高位）出价为0或月搜索<min_keyword_searches的词不算}
::RULE{brand_bidding_allowed不是true⇒品牌词不算 联盟多数不许竞价品牌词 投了佣金会被撤}
::RULE{没有关键词数据⇒没法算账 出局}
::RULE{ppc_allowed为null或false⇒该offer出局 联盟不许PPC就不投}
::RULE{品类在blocked_categories⇒出局}
::RULE{reversal_rate>max_reversal_rate⇒出局}
::RULE{cookie_days<min_cookie_days⇒降权 不出局}
::RULE{epc为null⇒可选但按min_epc的一半计分}
::RULE{余下按 epc×(1−reversal_rate) 加 cookie 加分排序 取最高⇒choice 能投的词随结果带出 给建系列用}
::RULE{没有一个过筛⇒choice:none 模式M7 让联盟插件换条件再拉一批}

### lp.publish

::RULE{core/lp/lp_check.py全过⇒publish|有fail⇒fix 不发布}
::RULE{页面Final_URL自动跳转或与广告承诺不符⇒fix 这是Google目的地要求}

### campaign.launch

::RULE{spec过schema且hard_limits逐条满足且lp已publish且账号状态正常⇒go|否则hold}
::RULE{新账号首次⇒daily_budget不超过budget.first_day 否则hold并把预算改到first_day再判}
::RULE{max_cpc>出价上限⇒hold}

### campaign.adjust（每日）

规则按顺序，第一条命中即停：

::RULE{avg_cpc>出价上限⇒bid_down 幅度keyword.bid_down_pct}
::RULE{spend_total≥stop_loss.spend_no_conversion且conversions=0⇒pause}
::RULE{days_running≥stop_loss.days_before_budget_down且commission<spend_window×roi_floor⇒budget_down}
::RULE{conversions>0且commission≥spend_window且days_running≥budget.ramp_min_days且last_change_days≥budget.min_days_between_changes⇒budget_up 每次step_pct 不超过daily_cap}
::RULE{其余⇒keep}
::RULE{spend_total≥stop_loss.test_spend_total⇒这条线的测试期结束 pause并escalate 让本人决定要不要继续}

### keyword.action（每词）

::RULE{avg_cpc>出价上限⇒bid_down}
::RULE{clicks≥keyword.pause_after_clicks_no_conv且conversions=0⇒pause}
::RULE{搜索词与offer无关⇒negative|本地规则判不了相关性 这条只有判断插件能给 本地一律keep}
::RULE{其余⇒keep}

### conversion.upload

::RULE{rows_in_window≥conversion.min_rows且gclid全部合法⇒upload|否则hold}
::RULE{超出window_days的行⇒单独列出 不上传 不伪造时间}

### anomaly.escalate

::RULE{account_status为suspended或limited⇒pause_all并escalate 模式M8 不教绕 不注册新号}
::RULE{有广告被拒登⇒escalate 本人完整读原因如实申诉一次 用本人资料补验证 申诉次数不超过anomaly.disapproval_appeal_max}
::RULE{当日消耗≥前七日均值×anomaly.spend_spike_x⇒pause_all}
::RULE{平台要求本人身份或付款验证⇒escalate 模式M6 停在那一步}
::RULE{其余⇒continue}

## 本地感知层怎么打分（可审计）

向量 11 维按 `vector_base` 起，再按节点与选项修正：

`cer` 取状态字段的完整度：该节点要的字段全有且数据天数够，0.85；缺字段按比例扣，低于 0.30 会触发 v5 的弃权规则变成 M5，这是故意的，数据不够就别动。
`evd` 有证据引用（报表文件、账本行）0.85，没有 0.20。
`aut` 动作在用户配置 `caps` 之内取 `authority.within_caps`，超出取 `authority.over_caps`（会被 f_v5 第五步压成 M3，只提议不执行），配置 `autonomy:propose_only` 时取 `authority.propose_only`。
`rev` 按选项查 `reversibility` 表。
`csq` 按这次动作牵涉的钱相对 `stop_loss.test_spend_total` 的比例：1 减去比例的 0.6 倍，最低 0.30。
`ine` 延续现状（keep、continue、hold）0.90，日常调整 0.70，新开（go、publish、select）0.50。
`sov` 动作在配置声明的范围内 1.00，范围外 0.10（触发生存边界 M8）。

::RULE{命中任何::BOUNDARY⇒判断的模式强制M8 无论向量得分 用户明确说了且不是合规姿态⇒照做 M8作为建议记下}

## 边界（用户可加，不可删）

合规姿态，用户说了也不做：

::BOUNDARY{never:假流量_模拟点击_cloaking_绕资格或封禁_冒充身份_多账号|scope:permanent|kind:compliance}
::BOUNDARY{never:账号被平台停用或限制后继续投放或另开账号|scope:permanent|kind:compliance}

运营边界，Agent 自己拿主意时不越过；用户明确说了就照做，越过的记进账本：

::BOUNDARY{never:总消耗超过stop_loss.test_spend_total后未经本人确认继续投放|scope:permanent|kind:operational}
::BOUNDARY{never:上传未经对账的转化|scope:permanent|kind:operational}
::BOUNDARY{never:直投联盟链接为Final_URL|scope:permanent|kind:operational}

## 人在哪三处

::RULE{证件与KYC⇒本人|付款与绑卡⇒本人|平台要求本人申诉⇒本人|其余全部⇒Agent}

::PRIORITY{
  合规姿态 > user_explicit > 运营边界 > 本文件规则 > 判断插件的向量 > vector_base
}
