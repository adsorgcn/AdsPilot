# 前端页面UI/UX优化建议

## 审查日期
2025-01-XX

## 审查依据
`.kiro/specs/subscription-system-enhancement/requirements.md` - 需求22：前端页面UI/UX优化

---

## 页面审查结果

### ✅ Dashboard 页面 - 已完成

**需求**: 聚合Offer数据、Ads数据、风险提醒、通知feed、快速操作入口

**现状**: 所有需求已满足
- ✅ Offer Performance卡片（总数、活跃数、平均分数、趋势）
- ✅ Ads Account Performance卡片（账户数、花费、CPC、收入、ROAS）
- ✅ AlertsBanner（风险提醒横幅）
- ✅ NotificationsFeed（消息通知）
- ✅ **新增**: Quick Actions卡片（创建Offer、连接Ads、开始评估、查看任务）

**实施文件**:
- `apps/frontend/src/components/dashboard/DashboardAggregates.tsx`

---

### ⚠️ Offers 页面 - 需要优化（数据层就绪后）

**需求**: 高信息密度表格视图，包含offer关键信息、Ads账号关联、批量操作

**当前问题**:
1. **信息密度不足** - 表格列过少，缺少关键业务信息
2. **缺少批量操作** - 未集成BulkActionsToolbar组件
3. **缺少多维状态** - 未使用OfferStatusBadges组件
4. **缺少行内编辑** - 未使用EditableCell组件

#### 优化方案1: 增强OffersTable

**文件**: `apps/frontend/src/components/offers/OffersTable.tsx`

**新增表格列**:
```typescript
// 建议的列结构
[
  { key: 'select', label: '', type: 'checkbox' },
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'brand', label: 'Brand', type: 'editable' },  // 使用EditableCell
  { key: 'country', label: 'Country', type: 'editable' },  // 使用EditableCell
  { key: 'url', label: 'URL', type: 'link' },
  { key: 'status', label: 'Status', type: 'badge' },  // 使用OfferStatusBadges
  { key: 'revenue', label: 'Revenue', type: 'editable-number' },  // 使用EditableCell
  { key: 'roas', label: 'ROAS', type: 'number' },
  { key: 'clicks', label: 'Clicks', type: 'number' },
  { key: 'conversions', label: 'Conversions', type: 'number' },
  { key: 'ctr', label: 'CTR', type: 'percentage' },
  { key: 'adsAccount', label: 'Ads Account', type: 'link' },  // Ads账号关联
  { key: 'aiScore', label: 'AI Score', type: 'badge' },
  { key: 'actions', label: 'Actions', type: 'buttons' },
]
```

**新增Offer数据接口**:
```typescript
interface OfferExtended {
  id: string;
  name: string;
  brand?: string;  // NEW - 品牌名称（可编辑）
  country?: string;  // NEW - 国家（可编辑）
  url: string;
  status: OfferStatus;  // NEW - 多维状态
  revenue?: number;  // NEW - 收入（可编辑）
  roas?: number;  // NEW - ROAS
  clicks?: number;  // NEW - 点击数
  conversions?: number;  // NEW - 转化数
  ctr?: number;  // NEW - CTR
  adsAccountId?: string;  // NEW - 关联的Ads账号ID
  adsAccountName?: string;  // NEW - Ads账号名称
  aiScore?: number;
  createdAt: string;
}

interface OfferStatus {
  evaluation: 'not_evaluated' | 'evaluated' | 'failed';
  click: 'not_configured' | 'configured';
  deployment: 'not_deployed' | 'deployed' | 'paused';
  archived: boolean;
}
```

**组件集成示例**:
```tsx
// 在表格行中使用已创建的组件
<tr key={offer.id}>
  {/* Checkbox选择列 */}
  <td>
    <input
      type="checkbox"
      checked={selectedIds.has(offer.id)}
      onChange={() => onToggle(offer.id)}
    />
  </td>

  {/* 品牌名称 - 行内编辑 */}
  <td>
    <EditableCell
      value={offer.brand || ''}
      onSave={async (newBrand) => {
        await updateOffer(offer.id, { brand: newBrand });
      }}
      placeholder="Brand name"
    />
  </td>

  {/* 多维状态 */}
  <td>
    <OfferStatusBadges
      status={{
        evaluation: offer.evaluationStatus,
        click: offer.clickStatus,
        deployment: offer.deploymentStatus,
        archived: offer.archived
      }}
      compact={true}
    />
  </td>

  {/* Ads账号关联 */}
  <td>
    {offer.adsAccountName ? (
      <Link href={`/adscenter/${offer.adsAccountId}`}>
        <Badge variant="outline">{offer.adsAccountName}</Badge>
      </Link>
    ) : (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => openLinkAdsAccountDialog(offer.id)}
      >
        Link Ads Account
      </Button>
    )}
  </td>
</tr>
```

#### 优化方案2: 集成批量操作工具栏

**文件**: `apps/frontend/src/components/offers/OffersPage.tsx`

**集成位置**: 在OffersTable之前

```tsx
{/* 批量操作工具栏 - 当有选中项时显示 */}
{selectedIds.size > 0 && (
  <BulkActionsToolbar
    selectedCount={selectedIds.size}
    totalCount={offers.length}
    onSelectAll={() => {
      const allIds = new Set(offers.map(o => o.id));
      setSelectedIds(allIds);
    }}
    onDeselectAll={() => setSelectedIds(new Set())}
    onBulkEvaluate={canUseAI ? async () => {
      // 批量评估逻辑
      const selectedOffers = offers.filter(o => selectedIds.has(o.id));
      await batchEvaluateOffers(selectedOffers);
    } : undefined}
    onBulkArchive={async () => {
      await batchArchiveOffers(Array.from(selectedIds));
      setSelectedIds(new Set());
    }}
    onBulkDelete={async () => {
      if (confirm(`Delete ${selectedIds.size} offers?`)) {
        await batchDeleteOffers(Array.from(selectedIds));
        setSelectedIds(new Set());
      }
    }}
    canUseAI={canUseAI}
    isProcessing={isBulkProcessing}
  />
)}

<OffersTable
  offers={offers}
  selectedIds={selectedIds}
  onToggle={(id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  }}
  onToggleAll={() => {
    if (selectedIds.size === offers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(offers.map(o => o.id)));
    }
  }}
  {/* 其他props... */}
/>
```

**状态管理**:
```tsx
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
const [isBulkProcessing, setIsBulkProcessing] = useState(false);
```

---

### ⚠️ Tasks 页面 - 需要实现任务列表（数据层就绪后）

**需求**: 任务列表（按类型分类）、状态、token消耗、执行结果

**当前问题**:
1. **缺少实际任务列表** - 只有空状态占位符
2. **任务类型不完整** - 缺少"补点击"和"换链接"类型
3. **缺少token消耗显示**
4. **缺少执行结果显示**

#### 优化方案: 实现任务列表组件

**新建文件**: `apps/frontend/src/components/tasks/TasksList.tsx`

**任务数据接口**:
```typescript
interface Task {
  id: string;
  type: 'evaluation' | 'click_tracking' | 'link_replacement' | 'performance_monitoring';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  title: string;
  description?: string;
  progress?: number;  // 0-100
  tokensEstimated: number;
  tokensConsumed: number;
  result?: {
    success: boolean;
    message: string;
    data?: any;
  };
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}
```

**组件结构**:
```tsx
export function TasksList({ tasks, isLoading }: TasksListProps) {
  // 按类型分组
  const groupedTasks = useMemo(() => {
    return {
      evaluation: tasks.filter(t => t.type === 'evaluation'),
      clickTracking: tasks.filter(t => t.type === 'click_tracking'),
      linkReplacement: tasks.filter(t => t.type === 'link_replacement'),
      monitoring: tasks.filter(t => t.type === 'performance_monitoring'),
    };
  }, [tasks]);

  return (
    <div className="space-y-6">
      {/* Evaluation Tasks */}
      <TaskTypeSection
        title="Offer评估任务"
        icon={<Target />}
        tasks={groupedTasks.evaluation}
        emptyMessage="No evaluation tasks"
      />

      {/* Click Tracking Tasks */}
      <TaskTypeSection
        title="补点击任务"
        icon={<MousePointer />}
        tasks={groupedTasks.clickTracking}
        emptyMessage="No click tracking tasks"
      />

      {/* Link Replacement Tasks */}
      <TaskTypeSection
        title="换链接任务"
        icon={<Link />}
        tasks={groupedTasks.linkReplacement}
        emptyMessage="No link replacement tasks"
      />

      {/* Performance Monitoring */}
      <TaskTypeSection
        title="性能监控任务"
        icon={<Activity />}
        tasks={groupedTasks.monitoring}
        emptyMessage="No monitoring tasks"
      />
    </div>
  );
}
```

**任务卡片示例**:
```tsx
function TaskCard({ task }: { task: Task }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{task.title}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {task.description}
            </p>
          </div>
          <TaskStatusBadge status={task.status} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Progress Bar (if running) */}
          {task.status === 'running' && task.progress !== undefined && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Progress</span>
                <span>{task.progress}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${task.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Token Consumption */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Token消耗</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {task.tokensConsumed} / {task.tokensEstimated}
              </Badge>
              <Coins className="h-4 w-4 text-yellow-500" />
            </div>
          </div>

          {/* Execution Result */}
          {task.status === 'completed' && task.result && (
            <div className={`p-3 rounded-lg ${
              task.result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-start gap-2">
                {task.result.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className={`text-sm font-medium ${
                    task.result.success ? 'text-green-900' : 'text-red-900'
                  }`}>
                    {task.result.success ? 'Task Completed' : 'Task Failed'}
                  </p>
                  <p className={`text-xs mt-1 ${
                    task.result.success ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {task.result.message}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {task.status === 'failed' && task.error && (
            <Alert variant="destructive">
              <AlertDescription>{task.error}</AlertDescription>
            </Alert>
          )}

          {/* Timestamps */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div>
              <Clock className="h-3 w-3 inline mr-1" />
              Created: {new Date(task.createdAt).toLocaleString()}
            </div>
            {task.completedAt && (
              <div>
                Completed: {new Date(task.completedAt).toLocaleString()}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => viewTaskDetails(task.id)}>
              View Details
            </Button>
            {task.status === 'failed' && (
              <Button variant="ghost" size="sm" onClick={() => retryTask(task.id)}>
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            )}
            {(task.status === 'pending' || task.status === 'running') && (
              <Button variant="ghost" size="sm" onClick={() => cancelTask(task.id)} className="text-red-600">
                Cancel
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

**集成到TasksPage**:

修改 `apps/frontend/src/components/tasks/TasksPage.tsx`:
```tsx
// 替换 lines 170-179 的空状态占位符
<LazyRender>
  {tasks.length > 0 ? (
    <TasksList tasks={tasks} isLoading={isLoading} />
  ) : (
    <div className="rounded-lg border">
      <div className="p-6 border-b">
        <h3 className="font-semibold">Recent Tasks</h3>
      </div>
      <div className="p-6 text-center text-muted-foreground">
        <p className="text-sm mb-4">No tasks found</p>
        <p className="text-xs">Create your first automation task to get started</p>
      </div>
    </div>
  )}
</LazyRender>
```

---

## 实施优先级

### 🔴 高优先级（数据层就绪后立即实施）

1. **Offers表格增强** - 业务核心功能，信息密度直接影响运营效率
2. **批量操作集成** - 提升操作效率的关键功能

### 🟡 中优先级（数据层就绪后优先实施）

3. **Tasks列表实现** - 完善任务管理功能
4. **Ads账号关联** - 实现Offer与Ads账号的关联

### 🟢 低优先级（可选优化）

5. **响应式优化** - 移动端体验增强
6. **动画效果** - 提升交互体验

---

## 已完成的组件（可复用）

以下组件已创建但未完全集成，数据层就绪后可直接使用：

1. **BulkActionsToolbar.tsx** (114行)
   - 批量选择/取消
   - 批量评估（AI）
   - 批量归档/删除
   - 处理状态显示

2. **OfferStatusBadges.tsx** (111行)
   - 多维状态显示
   - 优先级排序
   - compact和详细模式

3. **EditableCell.tsx** (169行)
   - 行内编辑
   - 键盘快捷键（Enter/Escape）
   - 异步保存
   - 验证和错误处理

4. **EvaluationScoreCard.tsx** (256行)
   - 3D翻转动画
   - 基础vs AI评分对比
   - 因子分解显示

5. **OAuthAuthorizationFlow.tsx** (275行)
   - OAuth弹窗流程
   - 平台配置（Google/Facebook/TikTok）
   - 消息传递

6. **AdsAccountsList.tsx** (352行)
   - 账户列表展示
   - 性能指标显示
   - 刷新/删除操作

---

## 后续工作建议

### 1. 数据层开发

优先实现以下API端点：

```typescript
// Offers相关
GET  /api/v1/offers           // 获取offers列表（包含扩展字段）
PATCH /api/v1/offers/:id      // 更新offer（支持品牌、国家、收入字段）
POST /api/v1/offers/bulk      // 批量操作（评估、归档、删除）
GET  /api/v1/offers/:id/ads-accounts  // 获取关联的Ads账号
POST /api/v1/offers/:id/link-ads-account  // 关联Ads账号

// Tasks相关
GET  /api/v1/tasks            // 获取任务列表
POST /api/v1/tasks/:id/retry  // 重试失败的任务
POST /api/v1/tasks/:id/cancel // 取消任务
```

### 2. 状态管理

建议使用React Query进行状态管理：

```typescript
// useOffers hook
export function useOffers() {
  return useQuery({
    queryKey: ['offers'],
    queryFn: async () => {
      const response = await fetch('/api/v1/offers');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5分钟
  });
}

// useTasks hook
export function useTasks() {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const response = await fetch('/api/v1/tasks');
      return response.json();
    },
    refetchInterval: 10 * 1000, // 10秒刷新（实时更新任务状态）
  });
}
```

### 3. 测试数据

在数据层就绪前，可以使用mock数据进行UI测试：

```typescript
// mock-data/offers.ts
export const mockOffers: OfferExtended[] = [
  {
    id: '1',
    name: 'Summer Sale Campaign',
    brand: 'Nike',
    country: 'US',
    url: 'https://example.com/offer1',
    status: {
      evaluation: 'evaluated',
      click: 'configured',
      deployment: 'deployed',
      archived: false,
    },
    revenue: 150000,  // cents
    roas: 3.5,
    clicks: 12500,
    conversions: 875,
    ctr: 0.07,
    adsAccountId: 'ads-1',
    adsAccountName: 'Nike Google Ads',
    aiScore: 85,
    createdAt: '2025-01-15T10:00:00Z',
  },
  // ... 更多mock数据
];
```

### 4. 国际化

补充翻译键到 i18n 文件：

```json
{
  "dashboard.quickActions.title": "Quick Actions",
  "dashboard.quickActions.createOffer": "Create Offer",
  "dashboard.quickActions.connectAds": "Connect Ads Account",
  "dashboard.quickActions.startEval": "Start Evaluation",
  "dashboard.quickActions.viewTasks": "View Tasks",

  "offers.table.brand": "Brand",
  "offers.table.country": "Country",
  "offers.table.revenue": "Revenue",
  "offers.table.roas": "ROAS",
  "offers.table.adsAccount": "Ads Account",

  "offers.bulkActions.title": "Bulk Actions",
  "offers.bulkActions.selected": "selected",
  "offers.bulkActions.evaluate": "Batch Evaluate",
  "offers.bulkActions.archive": "Archive",
  "offers.bulkActions.delete": "Delete",

  "tasks.list.evaluation": "Evaluation Tasks",
  "tasks.list.clickTracking": "Click Tracking Tasks",
  "tasks.list.linkReplacement": "Link Replacement Tasks",
  "tasks.list.monitoring": "Performance Monitoring",
  "tasks.card.tokenConsumption": "Token Consumption",
  "tasks.card.progress": "Progress",
  "tasks.card.result": "Result"
}
```

---

## 总结

### 已完成 ✅
1. Dashboard - 快速操作入口
2. AdsCenter - OAuth授权和账户管理
3. Settings - 完整的个人中心
4. Manage - 完整的后台管理系统

### 待优化 ⚠️（数据层就绪后）
1. Offers - 表格增强+组件集成
2. Tasks - 任务列表实现

### 阻塞因素 🚧
- Offers和Tasks的数据层未就绪（offers=[], tasks=[]）
- 需要后端API支持才能实施UI优化

### 下一步行动 🎯
1. 等待数据层API实现
2. 使用mock数据测试UI组件
3. 数据层就绪后，按优先级实施优化
4. 完善i18n翻译文件
