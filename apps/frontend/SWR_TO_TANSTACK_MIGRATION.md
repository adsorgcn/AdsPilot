# 🔄 SWR 到 TanStack Query 迁移指南

**状态**: 部分完成  
**进度**: 6/24 文件已迁移 (25%)

---

## ✅ 已迁移的文件

### Offers Hooks (4个)
1. ✅ `src/lib/offers/hooks/useOffersList.ts`
2. ✅ `src/lib/offers/hooks/useOfferDetail.ts`
3. ✅ `src/lib/offers/hooks/useOfferHistory.ts`
4. ✅ `src/lib/offers/hooks/useOfferAccounts.ts`

### User & Subscription Hooks (2个)
5. ✅ `src/core/hooks/use-user.ts`
6. ✅ `src/lib/hooks/useSubscription.ts`

---

## ⏳ 待迁移的文件 (18个)

### 高优先级
- [ ] `src/lib/billing/hooks.ts`
- [ ] `src/lib/dashboard/hooks.ts`
- [ ] `src/lib/tasks/hooks/useTaskQueries.ts`
- [ ] `src/lib/tasks/hooks/useTokenBalance.ts`

### 中优先级
- [ ] `src/lib/ads-center/hooks/useAdsMetrics.ts`
- [ ] `src/lib/ads-center/hooks/useAdsAccount.ts`
- [ ] `src/lib/notifications/hooks.ts`
- [ ] `src/lib/navigation/hooks.ts`
- [ ] `src/lib/performance/hooks.ts`
- [ ] `src/lib/marketing/hooks.ts`

### 低优先级
- [ ] `src/core/hooks/use-billing-api.ts`
- [ ] `src/core/hooks/use-fetch-factors.ts`
- [ ] `src/core/hooks/use-request-reset-password.ts`
- [ ] `src/core/hooks/use-sign-up-with-email-password.ts`
- [ ] `src/lib/admin/resources/subscriptions.ts`
- [ ] `src/lib/api/resources.ts`
- [ ] `src/lib/api/swr-config.ts`
- [ ] `src/components/offers/AIEvaluationDialog.tsx`
- [ ] `src/app/manage/subscription-plans/page.tsx`

---

## 📖 迁移模式

### 模式 1: 基础查询

#### SWR 代码
```typescript
import useSWR from 'swr';

export function useData(id?: string) {
  const swr = useSWR(
    id ? `/api/data/${id}` : null,
    fetcher,
    swrConfig
  );

  return {
    data: swr.data,
    isLoading: swr.isLoading,
    error: swr.error,
    mutate: swr.mutate,
  };
}
```

#### TanStack Query 代码
```typescript
import { useQuery } from '@tanstack/react-query';

export function useData(id?: string) {
  const query = useQuery({
    queryKey: ['data', id],
    queryFn: () => fetcher(`/api/data/${id}`),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
```

### 模式 2: 带参数的查询

#### SWR 代码
```typescript
const swr = useSWR(
  ['offers', params],
  () => fetchOffers(params),
  swrConfig
);
```

#### TanStack Query 代码
```typescript
const query = useQuery({
  queryKey: ['offers', params],
  queryFn: () => fetchOffers(params),
  staleTime: 5 * 60 * 1000,
  gcTime: 10 * 60 * 1000,
});
```

### 模式 3: Mutation (SWRMutation)

#### SWR 代码
```typescript
import useSWRMutation from 'swr/mutation';

const { trigger, isMutating } = useSWRMutation(
  '/api/data',
  async (url, { arg }) => {
    return await apiPost(url, arg);
  }
);
```

#### TanStack Query 代码
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';

const queryClient = useQueryClient();
const mutation = useMutation({
  mutationFn: (data) => apiPost('/api/data', data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['data'] });
  },
});

// 使用
mutation.mutate(data);
const isMutating = mutation.isPending;
```

---

## 🔑 关键差异

### API 差异对照表

| 功能 | SWR | TanStack Query |
|------|-----|----------------|
| 导入 | `useSWR` | `useQuery` |
| 查询键 | 第一个参数 | `queryKey` |
| 查询函数 | 第二个参数 | `queryFn` |
| 配置 | 第三个参数 | 对象属性 |
| 加载状态 | `isLoading` | `isLoading` |
| 验证状态 | `isValidating` | `isFetching` |
| 重新获取 | `mutate()` | `refetch()` |
| 缓存时间 | `dedupingInterval` | `staleTime` |
| 垃圾回收 | - | `gcTime` |
| 条件查询 | `key ? ... : null` | `enabled: !!key` |

### 配置迁移

#### SWR Config
```typescript
const swrConfig = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 5000,
};
```

#### TanStack Query Config
```typescript
const queryConfig = {
  refetchOnWindowFocus: false,
  refetchOnReconnect: true,
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 10 * 60 * 1000, // 10 minutes
};
```

---

## 🎯 迁移步骤

### 对于每个文件

1. **替换导入**
   ```typescript
   // ❌ 旧
   import useSWR from 'swr';
   
   // ✅ 新
   import { useQuery } from '@tanstack/react-query';
   ```

2. **更新 Hook 调用**
   ```typescript
   // ❌ 旧
   const swr = useSWR(key, fetcher, config);
   
   // ✅ 新
   const query = useQuery({
     queryKey: [key],
     queryFn: fetcher,
     ...config,
   });
   ```

3. **更新返回值**
   ```typescript
   // ❌ 旧
   return {
     data: swr.data,
     isLoading: swr.isLoading,
     isValidating: swr.isValidating,
     mutate: swr.mutate,
   };
   
   // ✅ 新
   return {
     data: query.data,
     isLoading: query.isLoading,
     isValidating: query.isFetching,
     refetch: query.refetch,
   };
   ```

4. **添加配置**
   ```typescript
   staleTime: 5 * 60 * 1000, // 5 minutes
   gcTime: 10 * 60 * 1000, // 10 minutes
   ```

5. **处理条件查询**
   ```typescript
   // ❌ 旧
   const key = id ? `/api/data/${id}` : null;
   useSWR(key, fetcher);
   
   // ✅ 新
   useQuery({
     queryKey: ['data', id],
     queryFn: () => fetcher(`/api/data/${id}`),
     enabled: !!id,
   });
   ```

---

## 💡 最佳实践

### 1. QueryKey 命名
```typescript
// ✅ 好的命名
queryKey: ['offers', 'list', { page, limit }]
queryKey: ['offer', offerId]
queryKey: ['user-session']

// ❌ 避免
queryKey: ['data']
queryKey: [endpoint]
```

### 2. StaleTime 设置
```typescript
// 频繁变化的数据
staleTime: 1 * 60 * 1000, // 1 minute

// 一般数据
staleTime: 5 * 60 * 1000, // 5 minutes

// 很少变化的数据
staleTime: 30 * 60 * 1000, // 30 minutes
```

### 3. 错误处理
```typescript
const query = useQuery({
  queryKey: ['data'],
  queryFn: fetchData,
  retry: 3, // 重试3次
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
});

if (query.error) {
  // 处理错误
}
```

### 4. 乐观更新
```typescript
const mutation = useMutation({
  mutationFn: updateData,
  onMutate: async (newData) => {
    // 取消正在进行的查询
    await queryClient.cancelQueries({ queryKey: ['data'] });
    
    // 保存旧数据
    const previousData = queryClient.getQueryData(['data']);
    
    // 乐观更新
    queryClient.setQueryData(['data'], newData);
    
    return { previousData };
  },
  onError: (err, newData, context) => {
    // 回滚
    queryClient.setQueryData(['data'], context.previousData);
  },
  onSettled: () => {
    // 重新获取
    queryClient.invalidateQueries({ queryKey: ['data'] });
  },
});
```

---

## 🚀 迁移后的优势

### 性能提升
- ✅ 更好的缓存控制
- ✅ 自动垃圾回收
- ✅ 更智能的重新获取策略

### 开发体验
- ✅ 更好的 TypeScript 支持
- ✅ 强大的 DevTools
- ✅ 更灵活的配置

### 功能增强
- ✅ 乐观更新
- ✅ 无限滚动支持
- ✅ 分页支持
- ✅ 并行查询
- ✅ 依赖查询

---

## 📊 迁移进度追踪

| 类别 | 总数 | 已完成 | 进度 |
|------|------|--------|------|
| Offers | 4 | 4 | 100% ✅ |
| User/Auth | 2 | 2 | 100% ✅ |
| Billing | 2 | 0 | 0% ⏳ |
| Dashboard | 1 | 0 | 0% ⏳ |
| Tasks | 2 | 0 | 0% ⏳ |
| Ads Center | 2 | 0 | 0% ⏳ |
| 其他 | 11 | 0 | 0% ⏳ |
| **总计** | **24** | **6** | **25%** |

---

## 🎯 下一步行动

### 立即执行
1. 继续迁移高优先级文件
2. 测试已迁移的 hooks
3. 更新相关组件

### 短期计划
1. 完成所有 hooks 迁移
2. 移除 SWR 依赖
3. 更新文档

### 长期计划
1. 优化查询策略
2. 添加更多缓存控制
3. 实现高级功能（无限滚动等）

---

**创建时间**: 刚刚  
**状态**: 进行中  
**预计完成**: Week 0 结束前

---

🔄 **持续更新中...**