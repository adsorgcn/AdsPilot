# 本地运行（单用户模式）

AdsPilot 的本地形态没有登录、没有网关。设 `ADSPILOT_LOCAL=1` 即进入单用户
本地模式，所有服务的行为随之改变：

| 行为 | 云端形态（默认） | 本地模式（`ADSPILOT_LOCAL=1`） |
| --- | --- | --- |
| 监听地址 | `0.0.0.0`（容器内） | 仅 `127.0.0.1`，不对外暴露 |
| 请求身份 | 网关注入 `X-User-ID` 头，缺失即 401 | 来自本机回环地址的请求自动记为固定用户 `local` |
| 数据库 | 必须配置 `DATABASE_URL` | 不配置时自动拉起内嵌 PostgreSQL |

## 一条命令启动

```bash
# macOS / Linux
./scripts/dev-local.sh                # adscenter,127.0.0.1:8080
./scripts/dev-local.sh aicore 8082    # aicore,127.0.0.1:8082
```

```powershell
# Windows
.\scripts\dev-local.ps1
.\scripts\dev-local.ps1 aicore 8082
```

或者用 npm 一次拉起 adscenter + aicore：

```bash
npm run dev
```

前置条件只有 Go 1.25+。首次启动会多花约一分钟:内嵌 PostgreSQL 需要下载
一次二进制(缓存在 `~/.adspilot/pg/cache`),然后初始化数据目录并跑完数据库
迁移。之后每次启动都是秒级。

## 内嵌 PostgreSQL

- 数据持久化在 `~/.adspilot/pg/data`,删掉这个目录即回到全新状态。
- 默认端口 `5517`,被占用时用 `ADSPILOT_PG_PORT` 换一个。
- 想用自己的数据库?设置 `DATABASE_URL`,内嵌数据库就不会启动。

## 验证

```bash
curl http://127.0.0.1:8080/health          # 200
curl http://127.0.0.1:8080/readyz          # 200(数据库就绪)
```

接下来连上你的 Google Ads 账号,见 [本地授权指南](local-auth.md)。

## 安全边界

本地模式的信任模型是「这台机器上的东西都是机器主人的」:

- 服务只绑定回环地址,局域网内其他设备无法访问;
- 自动身份注入同样只对来自回环地址的请求生效(双重保险);
- 生产/云端部署绝不要设置 `ADSPILOT_LOCAL`。
