#!/usr/bin/env bash
#
# verify-build.sh — 验证所有 Go 服务能独立编译。
#
# 本仓库按【服务独立构建】(GOWORK=off + go mod tidy),与各服务 Dockerfile 一致。
# 根目录 `go build ./...` 不适用(存在独立部署的 cloud function / dev 脚本子模块,
# 且各服务 go.mod 对本地 pkg 使用了不同的伪版本号——独立构建时 replace 优先,无影响)。
#
# 用法:  bash scripts/verify-build.sh
# 需要:  Go 1.25.1+,可访问 proxy.golang.org(首次会拉依赖)。
#
set -u
export GOWORK=off

pass=0
fail=0
failed_list=""

# 找 services/ 下所有含 go.mod 的模块(含 proxy-pool、functions/dispatcher、siterank/scripts 等子模块)
modules=$(find services -name go.mod | sort)

for gomod in $modules; do
    dir=$(dirname "$gomod")
    echo "======================================================"
    echo "==> $dir"
    echo "======================================================"
    if ( cd "$dir" && go mod tidy && go build ./... ); then
        echo "    OK: $dir"
        pass=$((pass + 1))
    else
        echo "    FAIL: $dir"
        fail=$((fail + 1))
        failed_list="$failed_list $dir"
    fi
    echo ""
done

echo "######################################################"
echo "# 通过: $pass    失败: $fail"
if [ "$fail" -gt 0 ]; then
    echo "# 失败的模块:$failed_list"
    echo "# ===编译有失败==="
    echo "######################################################"
    exit 1
fi
echo "# ===全部服务编译通过==="
echo "######################################################"
