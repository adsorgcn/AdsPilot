::ILANG::v5.0::ADSPILOT_SOUL_API
[TYPE:contract][SCOPE:public][LANG:zh][PHASE:public_good]

# SOUL API 接口说明（公益期）

::STATE{@SOUL_API, host:"iLang Inc.", phase:public_good, price:0, perception:"便宜模型加 Jev", decision:"仍在用户本地按 f_v5 算"}

服务端代码不在本仓库。用户环境只看到一个 HTTPS 端点，配置 `judgment.provider` 为 `soul-api` 并在环境变量里放端点与密钥即可。

## 请求

`POST <SOUL_API_ENDPOINT>/v1/judge`，头 `Authorization: Bearer <SOUL_API_KEY>`，体为 `schemas/judgment.schema.json` 的 request。

不发送：凭据、gclid 原文、他人数据。主干在发前扫一遍。

## 响应

`schemas/judgment.schema.json` 的 response 去掉 `mode_local`（那是主干自己算的）。`judge.v` 十一维两位小数，`choice` 是 request.choices 里的 id，`distribution` 可选。

## 时限与退路

::BUDGET{id:sa|scope:@JUDGE|kind:time|limit:8s|authority:@CORE}
::RULE{超时或非200⇒主干退回本地规则 记fallback:true 循环不停}

## 版本

端点路径带 `/v1/`。请求与响应的 `schema_version` 为 1。改形状要同时改 `schemas/judgment.schema.json`，走末位版本。

## 公益期之后

开源稳定后再谈。届时只会加计费头，不改形状。
