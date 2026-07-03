# 本地授权指南

AdsPilot 用你自己的 Google Ads 账号授权,采用 RFC 8252 本机回环 + RFC 7636 PKCE 流程。
授权在你本机的浏览器里完成,得到的 refresh token 只保存在你自己的机器上,不发往任何服务器。

*English: [local-auth.en.md](local-auth.en.md)*

## 前置条件

1. **Desktop 类型的 OAuth 客户端**。在 Google Cloud 项目里新建一个"桌面应用(Desktop app)"
   类型的 OAuth 客户端。桌面类型不需要预先注册回调地址,回环任意端口 + PKCE 即可通过。
   不要用"Web 应用"类型,它会导致 `redirect_uri_mismatch`。

2. **环境变量**(填进 `.env`):

   | 变量 | 说明 |
   |---|---|
   | `GOOGLE_ADS_OAUTH_CLIENT_ID` | 桌面类型客户端的 Client ID |
   | `GOOGLE_ADS_OAUTH_CLIENT_SECRET` | 桌面类型客户端的 Client Secret |
   | `GOOGLE_ADS_DEVELOPER_TOKEN` | 你的 Google Ads Developer Token |
   | `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | 你的 MCC / 登录客户 ID |
   | `ADSPILOT_OAUTH_REDIRECT_URI` | 回环回调地址,默认 `http://127.0.0.1:8080/api/v1/adscenter/oauth/callback`,端口要和 adscenter 实际监听的一致 |
   | `ADSPILOT_CREDENTIALS_PATH` | 可选,凭证文件路径,默认 `~/.adspilot/credentials.json` |

3. **OAuth 同意屏幕设为 In production**。若停留在 Testing 状态,拿到的 refresh token 7 天后失效。

## 授权流程

1. 在本机启动 adscenter(本地模型下它绑定回环地址)。

2. 请求授权链接:

   ```bash
   curl http://127.0.0.1:8080/api/v1/adscenter/oauth/url
   ```

   返回 JSON:

   ```json
   {"url": "https://accounts.google.com/o/oauth2/v2/auth?...", "state": "..."}
   ```

3. 在浏览器打开返回的 `url`,用管理你 Google Ads 的那个 Google 账号登录并同意。

4. 同意后,Google 会重定向到 `/api/v1/adscenter/oauth/callback`。adscenter 自动用授权码
   换取 token、把 refresh token 存到本机,并显示一个成功页面。

5. 确认凭证已生成:

   ```bash
   ls -l ~/.adspilot/credentials.json
   ```

   权限应为 `-rw-------`(0600)。文件内容是 refresh token 及元数据,只在你本机。

## 撤销

```bash
curl -X POST http://127.0.0.1:8080/api/v1/adscenter/oauth/revoke
```

会去 Google 撤销该 token,并删除本机的凭证文件。

## 凭证存储与安全

- refresh token 存在 `~/.adspilot/credentials.json`(或 `ADSPILOT_CREDENTIALS_PATH` 指定的路径),权限 0600。
- 服务端零留存:token 从不上传、也不存于任何服务器。
- 三个 oauth 端点(url / callback / revoke)在本地单用户模型下不需要登录 token。这依赖 adscenter 绑定在回环地址上,只有本机进程能访问。

## 常见问题

- **浏览器报 `redirect_uri_mismatch`**:你的 OAuth 客户端是 Web 类型。换成 Desktop 类型即可。
- **没拿到 refresh token**:这个 Google 账号之前已授权过本应用。到 https://myaccount.google.com/permissions 撤销本应用的授权,再重新走一遍。
- **refresh token 7 天就失效**:OAuth 同意屏幕还在 Testing 状态,改成 In production。
