::ILANG::v5.0::ADSPILOT_PLUGINS
[TYPE:contract][SCOPE:public][LANG:zh]

# 插件总契约

::STATE{@PLUGIN, rule:"凡是要对外部 API 说话的，就是插件口子；剩下的全是主干"}
::STATE{@CORE, external_apis:none}

一个插件就是一个目录。目录里固定四样：`manifest.json`（主干只读这份决定怎么调用）、`使用方法.md`（给执行 Agent 看的，iLang 形状）、脚本（标准库 Python 3.9 以上，或平台自带的 shell）、自测（`selftest.sh` 或 `--selftest` 开关）。加一家只加一个目录，主干一行不改。

## 七类口子

| 目录 | 管什么 | 必备动作 | 首发 |
|---|---|---|---|
| `traffic/<平台>/` | 流量平台 | `spec` `deploy` `report` `convert` | google-ads |
| `affiliate/<网络>/` | 联盟与广告主 | `offers` `link` `commissions` `chargebacks` | cj |
| `judgment/<提供者>/` | 判断引擎的感知层 | `judge` | llm、jev、soul-api |
| `report/<通道>/` | 回流通道 | `post` | feishu |
| `deploy/<目标>/` | 部署目标 | `deploy` `status` | cloudflare-worker |
| `keywords/<来源>/` | 关键词数据源 | `suggest` `volume` | 待首发 |
| `ipintel/<来源>/` | IP 情报 | `lookup` | 待首发 |

每类的动作契约写在该目录的 `契约.md`，动作的输入输出全部是 `schemas/` 里的 JSON 形状。插件之间不互相调用，只跟主干说话。

## manifest.json

按 `schemas/manifest.schema.json`。要点：

::RULE{manifest.external_apis为空⇒这不是插件 应并入主干}
::RULE{manifest.credentials里出现值而不是变量名⇒拒收 凭据只住在用户自己的环境变量}
::RULE{actions里某动作为manual⇒该动作由Agent按使用方法操作平台后台完成 主干把它当成功但记evidence:manual_check}
::RULE{status:alpha⇒主干在报告里标注 未过七天无人值守验收}

## 脚本约定

::RULE{脚本默认dry_run⇒只有--apply才对外部产生写操作}
::RULE{脚本输入输出⇒JSON文件或stdin/stdout 不打印凭据 不打印gclid原文到日志}
::RULE{退出码⇒0成功 2需要本人出手 3外部API失败可重试 4配置或凭据缺失 1其他错误}
::RULE{幂等⇒同一输入跑两次结果一致 写操作带幂等键}
::RULE{依赖⇒只用Python标准库 需要第三方库的能力先在使用方法里写明并给出无依赖的退路}

## 自测

每个插件要能在没有任何凭据的机器上跑通 `--selftest`（用 `tests/fixtures/` 的样例数据），这是 CI 跑的。带凭据的真实调用不进 CI。

::BOUNDARY{never:在插件里写入iLang_Inc自己的developer_token或任何共享凭据|scope:permanent}
::BOUNDARY{never:插件实现假流量_模拟点击_cloaking_绕资格或封禁_多账号|scope:permanent}
