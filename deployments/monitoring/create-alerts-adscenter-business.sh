#!/usr/bin/env bash
set -euo pipefail

# 创建 Adscenter 业务告警策略（示例）：
# 1) 动作执行错误数阈值（ac_execute_action_errors_total 持续增长）
# 2) 派生目标跳过率过高（ac_derived_targets_total{result="skipped"} / total > 阈值）
# 注：需先在 Cloud Run 暴露 /metrics 并接入 Cloud Monitoring Prometheus。

PROJECT=${PROJECT:-${GCP_PROJECT_ID}}
REGION=${REGION:-asia-northeast1}
SERVICE=${SERVICE:-adscenter-preview}

echo "# 提示：以下命令仅为示例，请根据实际监控命名与工作区调整 MQL。"
cat <<'EOF'
# 示例1：动作执行错误数突增告警（近5分钟错误数 > 10）
gcloud monitoring policies create --project=$PROJECT --notification-channels=$CHANNELS --policy ' {
  "displayName": "Adscenter Action Errors Spike",
  "conditions": [ {
    "displayName": "ac_execute_action_errors_total > 10 in 5m",
    "conditionMonitoringQueryLanguage": {
      "duration": "300s",
      "query": "fetch prometheus_target\\n| metric 'prometheus.googleapis.com/ac_execute_action_errors_total/counter'\\n| group_by [], [val_aggregate: aggregate(value.sum())]"
    }
  } ],
  "combiner": "OR",
  "enabled": true
}'

# 示例2：派生目标跳过率（skipped/filled比例）异常
# 说明：实际 MQL 需对 filled 与 skipped 两个序列做比值计算，这里给出思路注释。
echo "# TODO: 使用 MQL 对 ac_derived_targets_total 按 result=skipped 与 filled 计算比率并设阈值。"
EOF

echo "# 注意：以上为示例，建议在控制台中调试 MQL 后再固化到脚本。"

