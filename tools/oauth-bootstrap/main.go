// Command oauth-bootstrap 一次性跑通 Google 授权,拿到 Google Ads API 的 refresh token。
//
// 用途:填补 .env 里空着的 GOOGLE_ADS_REFRESH_TOKEN。
// 流程:本机起一个临时 loopback 服务器 -> 浏览器完成 Google 同意 -> 用授权码换 token。
// 依赖:纯标准库,无第三方包(离线也能编译)。
//
// 运行前需在环境变量里提供(可直接 source 你的 .env):
//
//	GOOGLE_ADS_OAUTH_CLIENT_ID
//	GOOGLE_ADS_OAUTH_CLIENT_SECRET
//
// 可选:
//
//	OAUTH_PORT   loopback 端口,默认 8815
//
// 官方依据:手动复制粘贴(OOB)已废弃,必须用 loopback;access_type=offline +
// prompt=consent 才能拿到 refresh token;scope = adwords。
package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

const (
	authEndpoint  = "https://accounts.google.com/o/oauth2/v2/auth"
	tokenEndpoint = "https://oauth2.googleapis.com/token"
	adsScope      = "https://www.googleapis.com/auth/adwords"
)

func main() {
	clientID := strings.TrimSpace(os.Getenv("GOOGLE_ADS_OAUTH_CLIENT_ID"))
	clientSecret := strings.TrimSpace(os.Getenv("GOOGLE_ADS_OAUTH_CLIENT_SECRET"))
	if clientID == "" || clientSecret == "" {
		fmt.Println("缺少环境变量:请先设置 GOOGLE_ADS_OAUTH_CLIENT_ID 和 GOOGLE_ADS_OAUTH_CLIENT_SECRET")
		fmt.Println("(可以直接 source 你的 .env,或 export 这两个变量后再运行)")
		os.Exit(1)
	}

	port := strings.TrimSpace(os.Getenv("OAUTH_PORT"))
	if port == "" {
		port = "8815"
	}
	redirectURI := fmt.Sprintf("http://127.0.0.1:%s/oauth2callback", port)

	// PKCE:verifier 随机串,challenge = base64url(sha256(verifier))
	verifier := randomURLSafe(32)
	sum := sha256.Sum256([]byte(verifier))
	challenge := base64.RawURLEncoding.EncodeToString(sum[:])
	state := randomURLSafe(16)

	authURL := authEndpoint + "?" + url.Values{
		"client_id":             {clientID},
		"redirect_uri":          {redirectURI},
		"response_type":         {"code"},
		"scope":                 {adsScope},
		"access_type":           {"offline"},
		"prompt":                {"consent"},
		"state":                 {state},
		"code_challenge":        {challenge},
		"code_challenge_method": {"S256"},
	}.Encode()

	// 先确认端口能监听,失败早报
	ln, err := net.Listen("tcp", "127.0.0.1:"+port)
	if err != nil {
		fmt.Printf("无法监听 127.0.0.1:%s -> %v\n", port, err)
		fmt.Println("换个端口:OAUTH_PORT=<其它端口> 再运行。")
		os.Exit(1)
	}

	type result struct {
		code string
		err  error
	}
	resultCh := make(chan result, 1)

	mux := http.NewServeMux()
	mux.HandleFunc("/oauth2callback", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		if e := q.Get("error"); e != "" {
			writeHTML(w, "授权被拒绝或出错:"+e)
			resultCh <- result{err: fmt.Errorf("授权返回错误: %s", e)}
			return
		}
		if q.Get("state") != state {
			writeHTML(w, "state 不匹配,可能是伪造请求,已中止。")
			resultCh <- result{err: fmt.Errorf("state 不匹配")}
			return
		}
		code := q.Get("code")
		if code == "" {
			writeHTML(w, "没拿到授权码。")
			resultCh <- result{err: fmt.Errorf("回调里没有 code")}
			return
		}
		writeHTML(w, "授权成功!可以关闭此页面,回到终端查看你的 refresh token。")
		resultCh <- result{code: code}
	})

	srv := &http.Server{Handler: mux}
	go srv.Serve(ln)

	fmt.Println("========================================================")
	fmt.Println("在浏览器打开下面这个链接,用你管理 Google Ads 的那个 Google 账号登录并同意:")
	fmt.Println()
	fmt.Println(authURL)
	fmt.Println()
	fmt.Printf("(本机正在 %s 等待回调。若在无界面服务器上跑,用 SSH 端口转发把本机浏览器接过来。)\n", redirectURI)
	fmt.Println("========================================================")
	tryOpenBrowser(authURL)

	var code string
	select {
	case res := <-resultCh:
		if res.err != nil {
			fmt.Printf("\n失败:%v\n", res.err)
			shutdown(srv)
			os.Exit(1)
		}
		code = res.code
	case <-time.After(5 * time.Minute):
		fmt.Println("\n超时(5分钟没完成授权)。重新运行即可。")
		shutdown(srv)
		os.Exit(1)
	}
	shutdown(srv)

	// 用授权码 + PKCE verifier 换 token
	fmt.Println("\n拿到授权码,正在换取 token ...")
	resp, err := http.PostForm(tokenEndpoint, url.Values{
		"code":          {code},
		"client_id":     {clientID},
		"client_secret": {clientSecret},
		"redirect_uri":  {redirectURI},
		"grant_type":    {"authorization_code"},
		"code_verifier": {verifier},
	})
	if err != nil {
		fmt.Printf("换取 token 请求失败:%v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	var tok struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int    `json:"expires_in"`
		Scope        string `json:"scope"`
		TokenType    string `json:"token_type"`
		Error        string `json:"error"`
		ErrorDesc    string `json:"error_description"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tok); err != nil {
		fmt.Printf("解析 token 响应失败:%v\n", err)
		os.Exit(1)
	}
	if tok.Error != "" {
		fmt.Printf("Google 返回错误:%s - %s\n", tok.Error, tok.ErrorDesc)
		os.Exit(1)
	}
	if tok.RefreshToken == "" {
		fmt.Println("换到了 access token,但没有 refresh token。")
		fmt.Println("通常是这个账号之前已授权过。到 https://myaccount.google.com/permissions 撤销本应用授权,再重新运行本工具。")
		os.Exit(1)
	}

	fmt.Println("\n========================================================")
	fmt.Println("成功!把下面这行填进你的 .env(替换掉空的 GOOGLE_ADS_REFRESH_TOKEN=):")
	fmt.Println()
	fmt.Println("GOOGLE_ADS_REFRESH_TOKEN=" + tok.RefreshToken)
	fmt.Println()
	fmt.Printf("(access token %d 秒后过期是正常的;真正要保存的是上面这行 refresh token。授权范围:%s)\n", tok.ExpiresIn, tok.Scope)
	fmt.Println("提醒:若 Google Cloud 的 OAuth 同意屏幕还在 Testing 状态,这个 refresh token 7 天后会失效;改成 In production 才长期有效。")
	fmt.Println("========================================================")
}

func randomURLSafe(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return base64.RawURLEncoding.EncodeToString(b)
}

func writeHTML(w http.ResponseWriter, msg string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	fmt.Fprintf(w, "<html><body style='font-family:sans-serif;text-align:center;margin-top:80px'><h2>%s</h2></body></html>", msg)
}

func tryOpenBrowser(u string) {
	var cmd string
	var args []string
	switch runtime.GOOS {
	case "darwin":
		cmd = "open"
		args = []string{u}
	case "windows":
		cmd = "rundll32"
		args = []string{"url.dll,FileProtocolHandler", u}
	default:
		cmd = "xdg-open"
		args = []string{u}
	}
	_ = exec.Command(cmd, args...).Start()
}

func shutdown(srv *http.Server) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
}
