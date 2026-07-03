# Google-Monetize 简化认证系统

## 架构设计

### 核心原则

1. **基于 Supabase Auth**: 使用 Google OAuth 作为唯一认证方式
2. **支持三层用户架构**: Layer 1 (认证层) → Layer 2 (业务层) → Layer 3 (计费层)
3. **用户直连模式**: 无组织层概念，基于 `user_id` 直接数据隔离
4. **KISS 原则**: 最小化实现，避免过度工程化
5. **类型安全**: 完整的 TypeScript 支持

### 组件架构

```
core/auth/
├── simple-auth-provider.tsx  # React Context Provider
├── auth-guard.tsx           # 认证守卫组件
├── auth-service.ts          # 认证服务类
├── auth-utils.ts            # 工具函数
└── README.md               # 使用文档
```

## 使用方法

### 1. 根级Provider设置

```tsx
// app/layout.tsx
import { Google-MonetizeAuthProvider } from '~/core/auth/simple-auth-provider';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh">
      <body>
        <Google-MonetizeAuthProvider>
          {children}
        </Google-MonetizeAuthProvider>
      </body>
    </html>
  );
}
```

### 2. 认证状态访问

```tsx
// components/UserProfile.tsx
import { useGoogle-MonetizeAuth, useAuthStatus, useUserDisplayName } from '~/core/auth/simple-auth-provider';

export function UserProfile() {
  const { user, signOut } = useGoogle-MonetizeAuth();
  const { isAuthenticated, isAdmin } = useAuthStatus();
  const displayName = useUserDisplayName();

  if (!isAuthenticated) {
    return <div>请先登录</div>;
  }

  return (
    <div>
      <h1>欢迎, {displayName}!</h1>
      <p>邮箱: {user?.email}</p>
      {isAdmin && <span className="badge">管理员</span>}
      <button onClick={signOut}>登出</button>
    </div>
  );
}
```

### 3. 页面级认证守卫

```tsx
// app/admin/page.tsx
import { AdminGuard } from '~/core/auth/auth-guard';

export default function AdminPage() {
  return (
    <AdminGuard>
      <div>
        <h1>管理员专用页面</h1>
        {/* 只有管理员可以访问此内容 */}
      </div>
    </AdminGuard>
  );
}

// app/dashboard/page.tsx
import { UserGuard } from '~/core/auth/auth-guard';

export default function DashboardPage() {
  return (
    <UserGuard>
      <div>
        <h1>用户仪表盘</h1>
        {/* 登录用户可以访问此内容 */}
      </div>
    </UserGuard>
  );
}
```

### 4. 认证服务直接使用

```tsx
// hooks/useAuthAction.ts
import { authService } from '~/core/auth/auth-service';
import { useMutation } from '@tanstack/react-query';

export function useSignInAction() {
  return useMutation({
    mutationFn: () => authService.signInWithGoogle(),
    onSuccess: (data) => {
      console.log('登录成功:', data.user.email);
    },
    onError: (error) => {
      console.error('登录失败:', error.message);
    },
  });
}
```

### 5. 工具函数使用

```tsx
// utils/auth-helpers.ts
import { isAdminUser, getUserDisplayName, isNewUser } from '~/core/auth/auth-utils';

export function formatUserInfo(user: User) {
  return {
    name: getUserDisplayName(user),
    isAdmin: isAdminUser(user),
    isNew: isNewUser(user),
    email: user.email,
  };
}
```

## API 参考

### useGoogle-MonetizeAuth()

返回完整的认证上下文：

```typescript
interface Google-MonetizeAuthContext {
  user: User | null;           // Supabase User对象
  session: Session | null;     // Supabase Session对象
  loading: boolean;            // 加载状态
  isAuthenticated: boolean;     // 是否已认证
  isAdmin: boolean;            // 是否为管理员
  userId: string | null;       // 用户ID
  signOut: () => Promise<void>; // 登出函数
  refresh: () => Promise<void>; // 刷新函数
}
```

### useAuthStatus()

简化的认证状态检查：

```typescript
interface AuthStatus {
  isAuthenticated: boolean;  // 是否已认证
  isLoading: boolean;        // 是否加载中
  needsAuth: boolean;        // 是否需要认证
  isAdmin: boolean;           // 是否为管理员
  user: User | null;         // 用户对象
  userId: string | null;     // 用户ID
  email: string | null;       // 邮箱
}
```

### AuthGuard 组件

认证守卫组件属性：

```typescript
interface AuthGuardProps {
  children: ReactNode;        // 子组件
  requireAdmin?: boolean;      // 是否需要管理员权限
  fallback?: ReactNode;        // 未认证时的显示内容
  redirectTo?: string;        // 重定向路径，默认 '/auth/signin'
}
```

## 认证流程

### Google OAuth 登录流程

1. **调用**: `authService.signInWithGoogle()`
2. **重定向**: Supabase OAuth 页面
3. **授权**: 用户授权 Google 应用
4. **回调**: 重定向回应用 (`/auth/callback`)
5. **完成**: 自动设置认证状态

### 会话管理

1. **自动刷新**: Token 接近过期时自动刷新
2. **状态同步**: 多 Tab 页面间状态同步
3. **错误恢复**: 网络错误自动重试
4. **登出清理**: 完全清理本地数据和会话

## 权限控制

### 基于角色的权限

- **普通用户**: `UserRole.User`
- **管理员**: `UserRole.Admin` (对应 Supabase `app_metadata.role = 'SuperAdmin'`)

### 数据访问模式

```
Layer 1: Supabase auth.users (认证数据源)
    ↓ JWT Token 验证
Layer 2: Cloud SQL user.users (业务用户数据)
    ↓ 基于user_id的RLS策略
Layer 3: Cloud SQL billing.accounts (计费数据)
    ↓ 基于user_id的权限检查
```

## 最佳实践

### 1. 错误处理

```tsx
// 使用 try-catch 包装认证操作
try {
  await authService.signInWithGoogle();
} catch (error) {
  // 用户友好的错误提示
  alert(`登录失败: ${error.message}`);
}
```

### 2. 加载状态

```tsx
// 显示加载指示器
const { loading } = useGoogle-MonetizeAuth();

if (loading) {
  return <Spinner />;
}
```

### 3. 类型安全

```tsx
// 使用类型守卫确保用户存在
const { user } = useGoogle-MonetizeAuth();

if (user) {
  // TypeScript 知道 user 不为 null
  console.log(user.email);
}
```

### 4. 性能优化

- 使用 `useGoogle-MonetizeAuth()` 而不是多个独立的 hooks
- 避免在渲染循环中调用认证函数
- 使用 React.memo 包装大型认证相关组件

## 与旧系统对比

### 旧认证系统问题

1. **过度抽象**: 多层 Provider 和复杂的状态管理
2. **组织层复杂**: 支持团队/组织概念，不符合用户直连模式
3. **多个数据源**: 混合使用不同的认证数据源
4. **复杂的会话管理**: 多种会话状态和同步机制

### 新系统优势

1. **简化设计**: 基于 Supabase Auth 的最小化实现
2. **类型安全**: 完整的 TypeScript 类型定义
3. **性能优化**: 减少不必要的数据获取和状态更新
4. **易于维护**: 清晰的代码结构和完整的文档
5. **架构一致**: 完全符合 Google-Monetize 三层用户架构

## 故障排除

### 常见问题

1. **Google OAuth 失败**
   - 检查 Supabase 配置中的 Google OAuth 设置
   - 确认回调 URL 正确配置
   - 检查网络连接

2. **认证状态不更新**
   - 确认使用了 `Google-MonetizeAuthProvider` 包装应用
   - 检查浏览器控制台错误信息
   - 验证 Supabase 项目配置

3. **管理员权限失效**
   - 检查用户 `app_metadata.role` 是否为 'SuperAdmin'
   - 确认 Supabase 用户管理设置

### 调试技巧

1. 开启浏览器开发者工具查看 Console 日志
2. 检查 Network 面板确认 Supabase API 调用
3. 使用 Supabase Dashboard 查看用户认证状态
4. 检查本地存储中的认证数据

## 迁移指南

### 从旧系统迁移

1. **替换 Provider**:
   ```tsx
   // 旧系统
   import { AuthProvider } from '~/components/SupabaseAuthProvider';

   // 新系统
   import { Google-MonetizeAuthProvider } from '~/core/auth/simple-auth-provider';
   ```

2. **更新 Hook 调用**:
   ```tsx
   // 旧系统
   const { userSession } = useContext(UserSessionContext);

   // 新系统
   const { user, isAuthenticated } = useGoogle-MonetizeAuth();
   ```

3. **简化认证检查**:
   ```tsx
   // 旧系统
   const session = useRequireAuth();

   // 新系统
   const { isAuthenticated, isAdmin } = useAuthStatus();
   ```

## 更新日志

### v1.0.0 (2024-01-22)
- ✅ 创建基础认证系统
- ✅ 实现 Google OAuth 登录
- ✅ 添加管理员权限检查
- ✅ 完整 TypeScript 支持
- ✅ 符合 Google-Monetize 三层架构
- ✅ 简化设计，避免过度工程化