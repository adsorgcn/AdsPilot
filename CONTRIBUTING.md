# AdsPilot 插件贡献使用方法

```ilang
::ILANG::v5.0::ADSPILOT_CONTRIBUTING
[TYPE:contract][SCOPE:public][LANG:zh]
::STATE{@CONTRIBUTOR, writes:plugins/ 与 integrations/, reviews:由维护者核对证据}
::OBJECTIVE{id:plugin_contribution|owner:@CONTRIBUTOR|trust:untrusted|version:1|status:active}
  target: 一类插件一份契约，每个动作都有明确输入、输出和离线自测
  ACCEPT: manifest 可校验；每个动作的样例通过请求与响应 schema；自测不出网；PR 有逐项证据
  NON_GOALS: 登录、计费、托管或投放真实预算
::RULE{外部贡献者只向 plugins/ 与 integrations/ 提交改动⇒插件新增 schema 与测试样例放插件目录并在提案中写清注册映射 由维护者接入中央注册表和测试}
::RULE{修改 core/、soul/ 或 ARCHITECTURE.md⇒先开 issue 征得仓库所有者同意}
::BOUNDARY{never:假流量_模拟点击_cloaking_绕资格或封禁_多账号|scope:permanent}
::BOUNDARY{never:在提交_自测输出_报告中留下凭据_gclid原文_他人数据|scope:permanent}
::RULE{所有动作⇒只用 Python 标准库 默认 dry-run JSON 输入输出 退出码按 plugins/README.md}
::RULE{每个证据块⇒列出自测命令和脱敏输出原文 标明样例或实测及范围 写明零留存并勾选合规姿态}
```

## traffic：流量平台

```ilang
::MODULE{traffic}
  [STEP] 契约：见 plugins/traffic/契约.md。说明 spec、deploy、report、convert 的平台动作与幂等规则。
  [STEP] schema：规格用 schemas/traffic-spec.schema.json，报表用 schemas/traffic-report.schema.json。写操作的输入须写明 dry-run 与 apply。
  [STEP] 自测：用虚构规格和报表测正常行、缺字段与重复输入；运行插件 --selftest，无凭据完成。
  [STEP] 证据块：按动作写清样例、只读查询或实际执行及清理范围；转化回传证据只保留计数。
```

## affiliate：联盟与广告主

```ilang
::MODULE{affiliate}
  [STEP] 契约：见 plugins/affiliate/契约.md。实现 offers、link、commissions、chargebacks。取不到的政策填 null。
  [STEP] schema：佣金和负额拒付沿用 schemas/commissions.schema.json；offers 和 link 声明各自的输入与输出。
  [STEP] 自测：用虚构 offer、归因 token 与负额拒付检查字段映射和原事件关联；运行插件 --selftest。
  [STEP] 证据块：分别记录已测动作与只读范围；缺项目或零行结果照实记录。
```

## judgment：判断提供者

```ilang
::MODULE{judgment}
  [STEP] 契约：见 plugins/judgment/契约.md。judge 只提供观察、选择与证据，最终模式由主干 f_v5 决定。
  [STEP] schema：沿用 schemas/judgment.schema.json，声明请求的 SOUL、状态和备选项。
  [STEP] 自测：正常响应、缺维度和提供者错误均有离线样例；运行插件 --selftest，核对回退行为。
  [STEP] 证据块：区分本地响应样例与实际调用的模型和端点；保留脱敏的本地判定。
```

## deploy：落地位部署

```ilang
::MODULE{deploy}
  [STEP] 契约：见 plugins/deploy/契约.md。setup、publish、status 只操作用户自己的部署目标。
  [STEP] schema：对每个动作登记请求与响应，写明发布目标、计划、是否已应用及健康状态。
  [STEP] 自测：对虚构目标运行 --selftest，覆盖重复部署、退出码与 dry-run 的无外部写入。
  [STEP] 证据块：用样例说明计划内容；若实测，只报告已操作的资源种类、健康结果和清理结果。
```

## keywords：关键词数据

```ilang
::MODULE{keywords}
  [STEP] 契约：见 plugins/keywords/契约.md。suggest 接种子词，volume 接词表，来源是用户自己的数据。
  [STEP] schema：声明请求的地区和词列表；响应注明账户币种及月搜索量、首页出价区间。
  [STEP] 自测：以离线样例检查零条结果、未知出价与币种；运行插件 --selftest。
  [STEP] 证据块：写明输入类型、返回条数和币种；仅跑样例就标样例。
```

## ipintel：IP 情报

```ilang
::MODULE{ipintel}
  [STEP] 契约：见 plugins/ipintel/契约.md。lookup 只做过滤与目标市场核对。
  [STEP] schema：声明 IP 列表输入与 country、is_datacenter、is_proxy、可选 risk 输出。
  [STEP] 自测：使用保留测试地址与官方响应形状的样例，检查错误分类；运行插件 --selftest。
  [STEP] 证据块：附官方 API 文档、样例或实测标记与原始自测输出，省略访客地址。
::BOUNDARY{never:用IP情报做cloaking或按访客身份改内容|scope:permanent}
```
