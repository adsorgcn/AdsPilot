# AdsPilot / Google-Monetize 工程书进度表(接手版)

> 历史文档，不作为当前验收证据。2026-09-06 已转向纯指令 Agent Skill；
> 下文“11 个服务全绿”“本机运行”描述不是当前产品定义或本次测试结论。
> 请先读 [当前路线图 v2](AGENT_NATIVE_ROADMAP_v2_2026-09-06.md)。

> 看完不靠猜就能接手。所有工作已合入 `main`。
> 仓库状态:**11 个服务全部编译通过(verify-build 全绿),本地模式(ADSPILOT_LOCAL=1 + 内嵌 PostgreSQL)可一键启动,本地 Google Ads OAuth 流已跑通到"差真 Google 登录"这一步,全仓已做过一轮大清理(见第 10 节)。**

## 0. 一句话现状

Go monorepo(Google Ads 自动投放工具)。地基已清干净:全绿 + 本地模式一键起 + OAuth 链路可达 + 云时代遗留全部清除。下一步是拿真 Google 凭证把最后一段(真 refresh token 换取 到 调 Ads API)跑通。

## 1. 项目身份与环境

- 远端仓库:`github.com/adsorgcn/AdsPilot`(注意:不是旧交接文档里写的 `ScientificInternet/Google-Monetize`)。
- Go module / import 路径:仍是 `github.com/ScientificInternet/Google-Monetize/...`。这是代码里的模块名,别去改,和远端仓库名不一致是正常的。
- 语言:后端 Go 1.25.1(go.work);前端 Next.js 15 + React 19,包管理是 npm(根 `packageManager: npm@10.8.2`,pnpm 被 package.json 挡掉,别用 pnpm)。
- 安全红线(立即处理):旧交接文档第 1 节明文贴了一个全权限 GitHub PAT。它已经泄露,吊销重发。别再往文档里贴活凭证。

## 2. 执行 / 验证模型

- 后端按服务独立构建:`GOWORK=off` + `go mod tidy` + `go build ./...`,和各服务 Dockerfile 一致。根目录 `go build ./...` 不适用(根目录有游离 .go 文件,不属于任何 module)。
- 一键验证:`bash scripts/verify-build.sh`,输出 `# ===全部服务编译通过===` 即全绿(当前 `通过 11 失败 0`)。
- 关键坑(沿用且已证实):
  1. `GOWORK=off` 独立构建时 replace 指令不传递,每个 go.mod 要自带全部 `pkg/*` 的 replace。
  2. 各模块 `go.mod`/`go.sum` 已按独立构建对齐入库;改依赖后记得在该模块下 `GOWORK=off go mod tidy`。
  3. `.gitignore` 的 `secrets/` 陷阱已修(锚定为 `/secrets/`,只匹配仓库根)。历史教训:未锚定时吞过两次 `internal/secrets` 代码,别再改回去。
- 前端要跑 `next dev`:根目录 `npm install`,然后 `cd apps/frontend && npm run dev`(:3000)。公开营销页不需要真凭证;登录相关页要真 Supabase key。

## 3. 产品范式(最核心,已按最新口径更新)

AI 就是操作层,管理界面整体取消。用户不点后台,而是对 AI 说话,AI 操作 Google Ads。

最新收紧(Max 本轮明确):不需要考虑"终端用户使用"这一层,不做面向用户的东西。目标是让 AI Agent 配合人(Max)把链路实际跑通即可。粗糙没关系,交给"推出去 + AI + PR"磨。

判断任何功能一句话:这东西是让 AI 更好地代替人操作,还是又在给人做界面?后者砍。

安全线不松(永久,不可越):token 零留存、绝不碰用户凭证、绝不做刷量/假流量/伪造点击转化/反检测/cloaking。反作弊只过滤假流量。proxy-pool 是中性 IP 基建,保留。

## 4. 判断纪律(沿用,最需要警惕)

> 别用你看不到的可能性,去论断你看得到的事实。

不可核实的争议(代码归属等)按最坏情况钉死搁一边,只在看得见的事实上判断。遇到不确定先去看实际的(读代码、跑起来、fetch 网页),不要凭名字/印象论断。该拦时拦:真风险(刷量/cloak/碰用户凭证)直说,不做应声虫。

## 5. 仓库现状(服务清单)

go.work 里 9 个服务 + proxy-pool(脚本单独构建),verify-build 找到 11 个含 go.mod 的模块,全绿。

`aicore` `adscenter` `bff` `console` `gateway-middleware` `projector` `recommendations` `siterank` `useractivity` `affiliate`(库,无 HTTP)+ `proxy-pool`。

- 零依赖可直接起:`aicore`(:8080,`/health` `/healthz` `/readyz` `/metrics`)、`bff`、`recommendations`、`projector`。
- 需要 Postgres 才起:`adscenter` `console` `useractivity`;`siterank` 还需要 GCP 凭证(Vertex 客户端在启动时初始化)。

## 6. 已完成的改动(分支 `cursor/setup-dev-environment-abdb`,PR #1)

4 个 commit:

```
8bb9a78 fix(adscenter): make OpenAPI routes reachable (BaseURL, fallback)
30fe6cd fix(adscenter): restore missing internal/secrets package
1dad93d fix(frontend): repair invalid identifiers from botched brand rename
016bc6f chore(env): add Cloud Agent dev environment config
```

1. `.cursor/environment.json` + `.cursor/install.sh`:Cloud Agent 开发环境(`go work sync` + `npm install`,起 aicore 和前端 dev)。这是给 Cloud Agent 用的,桌面版可忽略。合并后对 Cloud Agent 生效。

2. 前端非法标识符:上一手全局改名把带连字符的 `Google-Monetize` 塞进了 JS 标识符(如 `useGoogle-MonetizeStructuredData`、`Google-MonetizeAuthProvider`),语法错,`next dev`/`build` 每页都崩。改的是 `apps/frontend/src` 下 4 个文件的标识符,品牌字符串和 i18n key 没动。改完前端能跑(首页、/pricing 都 200)。

3. adscenter `internal/secrets` 缺失:被 `.gitignore` 的 `secrets/` 吞了,这个 fork 里工作树和历史都没有,发布模块也拉不到。重建为 `pkg/config.Secret` 的薄封装,`git add -f` 入库。修完 verify-build 全绿。

4. adscenter OpenAPI 路由不可达(真 bug):`ChiServerOptions.BaseURL` 是 `"/"`,把生成路由全注册成双斜杠 `//api/v1/...`,所有 OpenAPI-only 端点(本地 OAuth、limits、executions、link-rotation 设置等)全 404。改成 `BaseURL=""` 并用 `NotFound` 兜底(让没被 `RegisterRoutes` 显式认领的路径落到生成路由)。

## 7. adscenter 怎么真跑起来(可复现)

本地模式一键起(Windows;Linux/macOS 用 `./scripts/dev-local.sh`):

```powershell
# 凭证填仓库根 .env(模板 .env.example),脚本启动时自动加载
.\scripts\dev-local.ps1
```

`ADSPILOT_LOCAL=1` 下服务绑 127.0.0.1:8080,`DATABASE_URL` 未设置时自动拉起内嵌
PostgreSQL(数据在 `~/.adspilot/pg`,迁移在 `services/adscenter/internal/migrations/local`)。

验证 OAuth 链路(另开一个终端):

```powershell
curl.exe -s http://127.0.0.1:8080/api/v1/adscenter/oauth/url
```

返回 200 和 Google 同意链接(`access_type=offline`、`prompt=consent`、PKCE `S256`、`scope=adwords`、loopback `redirect_uri`、`state`)。callback 传 `error=` 或未知 `state` 都返回 400,证明回调 + PKCE state 校验在跑。

## 8. 下一步任务(按优先级)

### 任务 A:本地 OAuth 授权流 = 代码已全，且已跑通到边界

- loopback + PKCE、本机存 token(`~/.adspilot/credentials.json`,0600)、revoke、路由挂载,全在 `services/adscenter/internal/api/oauth_local.go` + `internal/localcreds/`,本轮已修好路由让它可达并验证。
- 纠错:上一版说"代码已全"不准确。当时 token 只是存进本机文件,`LoadAdsCreds`(所有 Ads API handler 的凭据入口)从不读它,授权完 API 还是拿不到 token。已修(桌面机这轮):`LoadAdsCreds` 在 env/Secret Manager 都没有 refresh token 时回退读 localcreds(带 client ID 匹配保护),callback/revoke 后同步失效凭据缓存(不然要等 10 分钟 TTL)。测试覆盖:`internal/config/ads_test.go`。现在授权一完成,token 自动生效。
- 只差最后一段(需要真凭证,任务 D):真 Google 登录 到 授权码 到 换 token 到 存本机 到 调 Ads API。要一个 Desktop 类型 OAuth client + 一次人工 Google 同意。工具:`tools/oauth-bootstrap`(纯 stdlib)。VPS 无界面要 SSH 端口转发。有 client 后一个块:

```bash
cd tools/oauth-bootstrap && GOOGLE_ADS_OAUTH_CLIENT_ID='你的' GOOGLE_ADS_OAUTH_CLIENT_SECRET='你的' go run .
```

### 任务 B:sub-id 结构设计 = PENDING,卡在 Max

卡点没变:Max 还没定"换"还是"分得清"、一个 sub-id 代表一批什么、什么条件切。这是投放方法论,得 Max 定,别脑补别催。Claude 的判断仍是:真正要的可能是"分得清"不是"换",若是"分得清"回传慢就不是问题。

### 任务 C:CloakBrowser 多账户隔离 = 未来积木,现在不做

记着 `cloakbrowser.dev`(开源指纹浏览器)能做多账户隔离(正当用途)。Max 决定:东西没成型前不谈授权/买,免费版够开发。现在啥都不做。

### 任务 D:测试凭证 = Max 已 defer

干净路子:Google Ads 的即时 test manager account + test developer token + 自建 Desktop OAuth client(几分钟)。别用别人的凭证。Max 说"全绿再说",别催。

## 9. 已知未完成 / 已知问题(接受或待清)

- ~~go vet 失败~~ 已清:两个死文件(`pkg/cache/integration_examples.go`、`pkg/database/cloud_sql_url_converter.go`)整体删除,vet 干净。
- ~~ROTATE_LINK 待砍~~ 已砍干净(见第 10 节)。
- adscenter 本地迁移在 `internal/migrations/local`,内嵌 PostgreSQL 启动时自动应用;云时代的根 `migrations/`、`database/`、`schemas/` 之外的迁移残留已删(`schemas/sql` 保留作 schema 参考)。
- 前端登录/dashboard 等要真 Supabase key;公开页不需要。
- siterank 内部还有 browserexec 客户端代码(env-gated,默认关闭,不影响编译运行)。这是有意留下的边界:siterank 不在 Ads 主线上,动它收益为零。哪天真做 siterank 再决定去留。

## 10. 大清理轮(本轮完成)

按"单用户本地模式、AI+人协作、Google Ads 跑通"为标准做了一轮全仓清理,主题:

1. **云时代整目录删除**:`deployments/`(Cloud Run/compose/scaling 全套)、`monitoring/`、`infrastructure/`、`configs/`、`hosting/`(独立 Next.js 壳)、`pattern-craft/`(无关 Next.js 项目)、`claudedocs/`、根 `frontend/`(孤儿组件)、根 `test/`(游离 Go 文件)、`database/`、`migrations/`、`archived_migrations/`、已提交的 `.turbo/` 构建缓存。
2. **根目录垃圾**:4 个 docker-compose、4 个 cloudbuild、firebase/firestore/nginx/sonar/flake 配置、约 20 个一次性 fix-*/test-* 脚本、5 个过时 .env 模板、pnpm 残留(npm 是唯一包管理器)。
3. **scripts/ 瘦身**:约 150 个文件删到 8 个(dev-local.*、verify-build.sh、check-go-mod-tidy.sh、openapi/ 生成工具、security/ 钩子)。
4. **ROTATE_LINK 全链路移除**:OpenAPI 规范源 + 重新生成的 Go/TS 代码、executor(stub 和 ads_live 两个变体)、diagnose/bulk_rollback/misc、console 静态页、recommendations 的死建议、LinkRotationSettings 端点。顺带修复:规范源漏了三个 OAuth 端点(生成代码有但 spec 没有),已补回,`specs/openapi/adscenter.yaml` 现在是真正的单一事实源。
5. **browser-exec 残余**:pkg/serviceclient 注册表条目、pkg/events 常量、adscenter `internal/clients` 死包(billing+browser-exec 客户端,只有自己的测试引用)。preflight 的落地页检查从"调 browser-exec"改为进程内直接 HTTP 探测。
6. **孤儿模块删除**:`pkg/redislock`、`pkg/testutil`(零引用);`pkg/metrics`、`pkg/dbadmin`、`pkg/ratelimitredis` 有真实引用,保留。
7. **元文件纠偏**:CLAUDE.md 重写为当前范式;package.json 清掉 docker:*/deploy:* 死脚本和 puppeteer 遗留依赖;go.work 删营销注释;.gitignore 锚定 `/secrets/`;shared-types 删死服务类型并修复本就坏掉的 index.ts;adscenter README 重写。
8. **一次性文档**:18 个 *-COMPLETE/DEPLOYMENT/STATUS 报告删除。

恢复任何被删内容:`git log --diff-filter=D --summary | rg <名字>` 找到 commit 后 `git show`。

## 11. Max 铁律(跨项目)

- GENE-001:"可以"=立即动手;"先讨论"=只讨论;"你看看"=自己找问题;贴报错=直接给修复;"不急"=真不急。
- 只输出一个版本的代码,别给多选项。改任何文件前先完整读。
- Max 用 XShell,无 GUI,不用 nano/vim、不用 screen/tmux,后台用 nohup。给命令要单条可执行块。
- 直接认错,不谄媚,不过度道歉。文章不用破折号。
- Max 加拿大籍,公司全加拿大所有。
