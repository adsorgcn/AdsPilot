#!/usr/bin/env bash
set -euo pipefail

# 输出所有需要构建的服务名称（JSON数组）。
# 筛选规则：services 目录下一层具有 Dockerfile 的目录。

ROOT_DIR=$(git rev-parse --show-toplevel)
SERVICES_DIR="${ROOT_DIR}/services"

if [[ ! -d "${SERVICES_DIR}" ]]; then
  echo "[]"
  exit 0
fi

SERVICES=()
while IFS= read -r dir; do
  if [[ -f "${dir}/Dockerfile" ]]; then
    SERVICES+=("$(basename "${dir}")")
  fi
done < <(find "${SERVICES_DIR}" -mindepth 1 -maxdepth 1 -type d | sort)

printf '['
for idx in "${!SERVICES[@]}"; do
  if [[ ${idx} -gt 0 ]]; then
    printf ','
  fi
  printf '"%s"' "${SERVICES[${idx}]}"
done
printf ']'
printf '\n'
