# AdsPilot / Google-Monetize 工程书进度表(接手版)

> 给桌面版接手用。看完不靠猜就能接手。
> 对应分支:`cursor/setup-dev-environment-abdb`(PR #1,未合并)。仓库状态:**11 个服务全部编译通过(verify-build 全绿),adscenter 能真启动,本地 Google Ads OAuth 流已跑通到"差真 Google 登录"这一步。**

## 0. 一句话现状

Go monorepo(Google Ads 自动投放工具)。上一轮把地基从"adscenter 编译失败、前端整个跑不起来"清到"全绿 + 前端能跑 + adscenter 能起 + 本地 OAuth 链路可达并验证过"。下一步是拿真 Google 凭证把最后一段(真 refresh token 换取 到 调 Ads API)跑通。

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
  2. `go.sum` 不入库,由 `go mod tidy` 每次现生成。所以 `git clean -fd` 后 pull 再 verify 是对的。
  3. `.gitignore` 有 `secrets/` 规则,会静默吞掉任何叫 secrets 的目录。碰这类目录用 `git add -f`。
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

在 VM 里临时装 Postgres 跑通的。复现(一个块):

```bash
sudo apt-get install -y postgresql && sudo pg_ctlcluster 16 main start
sudo -u postgres psql -c "CREATE ROLE adspilot LOGIN PASSWORD 'adspilot';"
sudo -u postgres psql -c "CREATE DATABASE adscenter OWNER adspilot;"
cd services/adscenter && GOWORK=off go build -o /tmp/adscenter . && \
DATABASE_URL='postgresql://adspilot:adspilot@127.0.0.1:5432/adscenter?sslmode=disable' \
ADSCENTER_SKIP_MIGRATIONS=1 PORT=8092 \
GOOGLE_ADS_OAUTH_CLIENT_ID='dummy.apps.googleusercontent.com' \
GOOGLE_ADS_OAUTH_CLIENT_SECRET='dummy' /tmp/adscenter
```

验证 OAuth 链路(另开一个终端):

```bash
curl -s localhost:8092/api/v1/adscenter/oauth/url
```

返回 200 和 Google 同意链接(`access_type=offline`、`prompt=consent`、PKCE `S256`、`scope=adwords`、loopback `redirect_uri`、`state`)。callback 传 `error=` 或未知 `state` 都返回 400,证明回调 + PKCE state 校验在跑。

## 8. 下一步任务(按优先级)

### 任务 A:本地 OAuth 授权流 = 代码已全，且已跑通到边界

- loopback + PKCE、本机存 token(`~/.adspilot/credentials.json`,0600)、revoke、路由挂载,全在 `services/adscenter/internal/api/oauth_local.go` + `internal/localcreds/`,本轮已修好路由让它可达并验证。
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

- go vet 失败(预存):`pkg/cache/integration_examples.go` 和 `pkg/database/cloud_sql_url_converter.go` 有坏的 `fmt.Sprintf`。这俩在 `go test` 下暴露,`verify-build.sh` 不跑 vet 所以不受影响。要不要清由 Max 定。
- ROTATE_LINK 待砍(沿用):改的是 `final_url_suffix`(追踪后缀,不是落地页,做不了 cloak),靠已删的 browser-exec,现在坏的但无害。做 OpenClaw skill 那步顺手清,现在别动。
- migrations 是 no-op 占位,schema 用 psql 单独应用(adscenter 用 `ADSCENTER_SKIP_MIGRATIONS=1` 跳过)。
- 前端登录/dashboard 等要真 Supabase key;公开页不需要。

## 10. Max 铁律(跨项目)

- GENE-001:"可以"=立即动手;"先讨论"=只讨论;"你看看"=自己找问题;贴报错=直接给修复;"不急"=真不急。
- 只输出一个版本的代码,别给多选项。改任何文件前先完整读。
- Max 用 XShell,无 GUI,不用 nano/vim、不用 screen/tmux,后台用 nohup。给命令要单条可执行块。
- 直接认错,不谄媚,不过度道歉。文章不用破折号。
- Max 加拿大籍,公司全加拿大所有。
