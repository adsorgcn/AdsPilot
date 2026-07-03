#!/bin/bash

# 添加Cloud Run域名到Firebase授权域名列表

PROJECT_ID="${GCP_PROJECT_ID}"
CLOUD_RUN_DOMAIN="frontend-preview-yt54xvsg5q-an.a.run.app"

echo "🔧 添加Cloud Run域名到Firebase授权域名..."
echo ""
echo "Project ID: $PROJECT_ID"
echo "Domain: $CLOUD_RUN_DOMAIN"
echo ""

echo "📋 需要在Firebase Console中手动添加:"
echo ""
echo "1. 访问 Firebase Console:"
echo "   https://console.firebase.google.com/project/$PROJECT_ID/authentication/settings"
echo ""
echo "2. 滚动到'授权域名'部分"
echo ""
echo "3. 点击'添加域名'"
echo ""
echo "4. 输入域名:"
echo "   $CLOUD_RUN_DOMAIN"
echo ""
echo "5. 点击'添加'"
echo ""
echo "6. 等待1-2分钟生效"
echo ""
echo "7. 重新测试登录"
echo ""

# 尝试使用Firebase CLI添加（如果可用）
if command -v firebase &> /dev/null; then
    echo "🔍 检测到Firebase CLI，尝试自动添加..."
    
    # 注意：Firebase CLI可能没有直接命令来添加授权域名
    # 需要使用Firebase Admin SDK或REST API
    
    echo "⚠️  Firebase CLI不支持直接添加授权域名"
    echo "   请按照上述步骤手动添加"
else
    echo "ℹ️  未检测到Firebase CLI"
    echo "   请按照上述步骤手动添加"
fi

echo ""
echo "✅ 添加后，还需要添加以下域名（如果还没有）:"
echo "   - www.urlchecker.dev"
echo "   - urlchecker.dev"
echo "   - ${GCP_PROJECT_ID}.firebaseapp.com"
echo "   - ${GCP_PROJECT_ID}.web.app"
echo ""
