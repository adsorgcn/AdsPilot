# @gm/shared-types

共享的 TypeScript 类型定义，由 OpenAPI 规范自动生成。

## 使用方法

```typescript
// 导入特定服务的类型
import type { paths } from '@gm/shared-types/adscenter'
import type { components } from '@gm/shared-types/billing'

// 使用类型
type Account = components['schemas']['Account']
type ListAccountsResponse = paths['/api/v1/adscenter/accounts']['get']['responses']['200']['content']['application/json']
```

## 可用服务

- `adscenter` - Google Ads 管理服务
- `batchopen` - 批量访问服务
- `billing` - 计费服务
- `console` - 管理控制台 API
- `notifications` - 通知服务
- `offer` - 广告优化建议服务
- `recommendations` - 推荐服务
- `siterank` - 站点排名分析服务

## 生成类型

类型文件由 OpenAPI 规范自动生成：

```bash
npm run generate
```

生成脚本会从 `.kiro/specs/google-monetize-system/openapi/*.yaml` 读取规范，生成到 `src/*/types.d.ts`。

## 架构

```
packages/shared-types/
├── src/
│   ├── adscenter/types.d.ts      # 从 OpenAPI 生成
│   ├── batchopen/types.d.ts
│   ├── billing/types.d.ts
│   ├── console/types.d.ts
│   ├── notifications/types.d.ts
│   ├── offer/types.d.ts
│   ├── recommendations/types.d.ts
│   ├── siterank/types.d.ts
│   └── index.ts                   # 统一导出
├── package.json
├── tsconfig.json
└── README.md
```

## 注意事项

⚠️ **不要手动编辑生成的类型文件**

所有类型定义都从 OpenAPI 规范生成。如需修改：
1. 编辑 `.kiro/specs/google-monetize-system/openapi/*.yaml`
2. 运行 `npm run generate`
3. 验证生成的类型