# AdsPilot

**开源、免费。** 把整套广告联盟投放能力做成基座加插件，交给你自己的 Agent（Claude Code、Codex、OpenClaw、Hermes 或同类），在你自己的账号、你自己的机器上无人值守地跑。不登录、不托管、不收费。

**合规姿态，与开源免费并排写在第一屏。** 本人真实身份、单账号，平台要 KYC 照实做；不造流量、不模拟点击、不做 cloaking、不绕平台资格与封禁、不冒充身份、不做多账号；凭据零留存，一切在你自己的机器与账号里。做不到这几条的，这个仓库帮不上。

*English: [README.en.md](README.en.md)*

## 这是什么

传统投放 SaaS 的架构是「平台替你干活」，所以要登录、计费、多租户、托管你的 token。AdsPilot 的架构是「你的 Agent 替你干活」：仓库里是一套 **使用方法**（iLang 形状，任何 Agent 读了都同样执行）加一组标准库脚本，你的 Agent 读完就能建广告、拉报表、对账、灌转化、每天自己跑。

能跑起来是基座保证的。跑得好不好取决于 SOUL：仓库自带一个通用默认 SOUL，本地、开源、零成本。公益期由 iLang Inc. 托管一个判断服务（便宜模型加 Jev），免费给大家用，用真实数据把判断磨准。

这也是 [iLang 协议](https://github.com/ilang-ai/ilang-spec) 第一个较大的商用应用：v3 通信层、v4 执行层、v5 判断层各管一段。

## 一条判据

**凡是要对外部 API 说话的，就是插件口子；剩下的全是主干。** 主干不依赖任何一家外部服务。

```
core/       主干：agent 适配与自检 · lp 落地页 · judge 判断（f_v5 冻结） · ledger 归因对账 · loop 无人值守循环 · selfcheck
plugins/    插件：traffic/google-ads · affiliate/cj · judgment/{llm,jev,soul-api} · deploy/cloudflare-worker · keywords · ipintel
soul/       默认 SOUL、SOUL 接口、SOUL API 接口说明
schemas/    manifest · judgment · report · traffic-spec · traffic-report · commissions
reference/  iLang runtime（钉版本）· affiliate-design · v1 交接
```

## 三分钟上手（给你的 Agent）

```bash
git clone https://github.com/adsorgcn/AdsPilot && cd AdsPilot
python3 core/agent/selfcheck.py                     # 够不够格无人值守
cp config/adspilot.example.json config/adspilot.json  # 填自己的值，凭据放环境变量
python3 core/loop/daily.py --dry-run                # 跑一轮，什么都不写外部
```

Claude Code 读 `CLAUDE.md`，Codex 与其他读 `AGENTS.md`，Cursor 读 `.cursor/rules/`。三份一样。之后按 `core/loop/使用方法.md` 装调度器，每天一轮。

## 人只在三处出现

证件与 KYC、付款与绑卡、平台要求本人申诉。其余全是 Agent 与脚本。每个插件要在一台干净的用户环境里连续七天无人干预跑完日常循环，才能从 alpha 标成 stable。

## 每轮留下什么

每轮在 `runs/<id>/` 留一份 `report.json`（花费、点击、转化、每个判断的向量与模式、证据引用，不含凭据与 gclid 原文）和 `run.log`。有人要看你跑得怎么样，贴这两个文件就行；没有任何东西自动往外发。

## 版本

`VERSION` 三位号。日常改动只动末位；「迭代小版本」动中间位；大版本第一位单独决定。旧 Go 代码在 tag `v1-go-archive`。

## 许可

MIT。iLang runtime 副本来自 ilang-spec（MIT）。
