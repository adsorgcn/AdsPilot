# 📦 安装步骤

## ⚠️ 重要提示

在运行代码之前，必须先安装新的依赖包。

## 🔧 安装命令

```bash
# 进入前端目录
cd apps/frontend

# 清理旧的依赖
rm -rf node_modules package-lock.json

# 安装所有依赖（包括新增的包）
npm install

# 这将安装：
# - next@15.1.3
# - react@19.0.0
# - react-dom@19.0.0
# - @tremor/react@^3.18.3
# - motion@^10.18.0
# - 以及所有更新的类型定义
```

## ✅ 验证安装

```bash
# 检查关键包是否安装成功
npm list next
npm list react
npm list @tremor/react
npm list motion

# 应该看到正确的版本号
```

## 🚀 启动开发服务器

```bash
# 使用 Turbopack 启动（Next.js 15 新特性）
npm run dev

# 应该看到：
# ✓ Ready in Xms (Turbopack)
# ○ Local: http://localhost:3000
```

## 📊 当前状态

- ✅ package.json 已更新
- ✅ 配置文件已更新
- ✅ shadcn/ui 组件已创建
- ✅ Tremor 图表组件已创建
- ⏳ 需要运行 `npm install`

## 🐛 如果遇到问题

### 问题 1: 依赖冲突
```bash
# 使用 --legacy-peer-deps
npm install --legacy-peer-deps
```

### 问题 2: 缓存问题
```bash
# 清理 npm 缓存
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### 问题 3: Node 版本
```bash
# 确保 Node.js >= 18.17.0
node --version

# 如果版本过低，升级 Node.js
```

## 📝 安装后的下一步

1. ✅ 运行 `npm run dev` 测试开发服务器
2. ✅ 运行 `npm run typecheck` 检查类型
3. ✅ 运行 `npm run build` 测试生产构建
4. ✅ 查看 `UPGRADE_INSTRUCTIONS.md` 了解更多信息

---

**注意**: 在运行 `npm install` 之前，导入检查会显示错误，这是正常的。安装完成后错误会消失。