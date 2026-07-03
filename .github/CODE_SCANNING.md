# GitHub 安全扫描配置说明

## 解决方案：使用 Artifacts 保存扫描结果

由于 GitHub Code Scanning 需要 Advanced Security（私有仓库付费），我已经将安全扫描工作流修改为使用 artifacts 保存结果。

### 当前配置

- ✅ 所有安全扫描工具正常运行
- ✅ 扫描结果保存为 artifacts，可以下载查看
- ✅ 工作流不会因为 Code Scanning 未启用而失败
- ❌ 结果不会显示在 GitHub Security 界面中

### Artifacts 说明

1. **Trivy 扫描结果**：`trivy-security-results`
   - Docker 容器漏洞扫描
   - SARIF 格式，保存 30 天

2. **Snyk 扫描结果**：`snyk-security-results`
   - 依赖项漏洞扫描
   - SARIF 格式，保存 30 天

3. **Checkov 扫描结果**：`checkov-security-results`
   - 基础设施即代码安全扫描
   - SARIF 格式，保存 30 天

### 如何查看扫描结果

1. 进入 GitHub 仓库的 **Actions** 标签页
2. 找到最新的 "Security Scan" 工作流运行
3. 在页面右侧的 **Artifacts** 部分下载 SARIF 文件
4. 使用 SARIF 查看器查看结果：
   - VSCode SARIF Viewer 扩展
   - 或在线 SARIF 查看器

### CodeQL 分析（已禁用）

CodeQL 分析已被注释掉，因为它需要 Advanced Security。如果将来启用 Advanced Security，可以取消注释相关代码。