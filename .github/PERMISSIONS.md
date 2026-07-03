# GitHub Actions 权限配置指南

## 问题
当仓库从 public 改为 private 后，GitHub Actions 可能会出现以下错误：
```
HttpError: Resource not accessible by integration - https://docs.github.com/rest/actions/workflow-runs#get-a-workflow-run
```

## 解决方案

### 1. 仓库级别设置（推荐）

1. 进入你的 GitHub 仓库
2. 点击 **Settings** → **Actions** → **General**
3. 滚动到 **Workflow permissions** 部分
4. 选择 **Read and write permissions**
5. 勾选 **Allow GitHub Actions to create and approve pull requests**

### 2. 或者使用 GITHUB_TOKEN 权限

在每个工作流文件中明确指定权限：

```yaml
permissions:
  contents: read
  security-events: write
  actions: read
```

### 3. 对于 CodeQL 和安全扫描

确保安全相关的工作流有以下权限：

```yaml
permissions:
  actions: read
  contents: read
  security-events: write
```

## 已配置的工作流

以下工作流已正确配置权限：
- `security.yml` - 所有安全扫描任务
- `code-quality.yml` - 代码质量检查
- `optimized-build.yml` - 构建和部署
- `deploy-production.yml` - 生产环境部署

## 注意事项

1. **私有仓库需要更严格的权限控制**
2. **GITHUB_TOKEN 的默认权限在私有仓库中更受限制**
3. **安全扫描功能需要 `security-events: write` 权限**

## 验证步骤

1. 提交任何更改触发 GitHub Actions
2. 检查 Actions 标签页中的工作流运行状态
3. 确保没有权限相关的错误