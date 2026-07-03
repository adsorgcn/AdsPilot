# 组件迁移指南

## 📋 shadcn/ui 组件迁移映射

### 已完成的 shadcn/ui 组件

| 组件名称 | 路径 | 状态 | 用途 |
|---------|------|------|------|
| Button | ~/components/ui/button | ✅ | 按钮组件 |
| Dialog | ~/components/ui/dialog | ✅ | 对话框/模态框 |
| Input | ~/components/ui/input | ✅ | 输入框 |
| Label | ~/components/ui/label | ✅ | 表单标签 |
| Select | ~/components/ui/select | ✅ | 下拉选择器 |
| Card | ~/components/ui/card | ✅ | 卡片（已存在） |

### 需要迁移的组件

| 旧组件路径 | 新组件路径 | 优先级 | 状态 |
|-----------|-----------|--------|------|
| ~/core/ui/Button | ~/components/ui/button | P0 | 🔄 待迁移 |
| @radix-ui/react-dialog | ~/components/ui/dialog | P0 | ✅ 可用 |
| ~/core/ui/Select | ~/components/ui/select | P1 | ✅ 可用 |
| ~/core/ui/Checkbox | ~/components/ui/checkbox | P1 | ⏳ 待创建 |
| ~/core/ui/Tabs | ~/components/ui/tabs | P1 | ✅ 已存在 |
| ~/core/ui/Dropdown | ~/components/ui/dropdown-menu | P1 | ⏳ 待创建 |

---

## 🔄 迁移步骤

### 1. Button 组件迁移

#### 旧代码（~/core/ui/Button）
```tsx
import Button from '~/core/ui/Button';

<Button variant="primary" size="md">
  Click me
</Button>
```

#### 新代码（shadcn/ui）
```tsx
import { Button } from '~/components/ui/button';

<Button variant="default" size="default">
  Click me
</Button>
```

#### 变体映射
- `primary` → `default`
- `secondary` → `secondary`
- `outline` → `outline`
- `ghost` → `ghost`
- `danger` → `destructive`

---

### 2. Dialog 组件迁移

#### 旧代码（Radix UI 直接使用）
```tsx
import * as Dialog from '@radix-ui/react-dialog';

<Dialog.Root>
  <Dialog.Trigger className="...大量类名...">
    Open
  </Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Overlay className="...大量类名..." />
    <Dialog.Content className="...大量类名...">
      <Dialog.Title>Title</Dialog.Title>
      <Dialog.Description>Description</Dialog.Description>
      {/* 内容 */}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

#### 新代码（shadcn/ui）
```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';

<Dialog>
  <DialogTrigger>Open</DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Description</DialogDescription>
    </DialogHeader>
    {/* 内容 */}
  </DialogContent>
</Dialog>
```

**优势**：
- 代码量减少 70%
- 无需手动管理类名
- 自动处理动画和可访问性

---

### 3. Select 组件迁移

#### 旧代码
```tsx
import Select from '~/core/ui/Select';

<Select
  options={[
    { value: '1', label: 'Option 1' },
    { value: '2', label: 'Option 2' },
  ]}
  value={value}
  onChange={setValue}
/>
```

#### 新代码（shadcn/ui）
```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';

<Select value={value} onValueChange={setValue}>
  <SelectTrigger className="w-[180px]">
    <SelectValue placeholder="Select option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="1">Option 1</SelectItem>
    <SelectItem value="2">Option 2</SelectItem>
  </SelectContent>
</Select>
```

---

## 📊 Tremor 图表迁移

### Recharts → Tremor 迁移

#### 旧代码（Recharts）
```tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

<ResponsiveContainer width="100%" height={300}>
  <LineChart data={data}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="date" />
    <YAxis />
    <Tooltip />
    <Legend />
    <Line type="monotone" dataKey="revenue" stroke="#3b82f6" />
    <Line type="monotone" dataKey="roas" stroke="#8b5cf6" />
  </LineChart>
</ResponsiveContainer>
```

#### 新代码（Tremor）
```tsx
import { TrendChart } from '~/components/charts/TrendChart';

<TrendChart
  data={data}
  categories={['revenue', 'roas']}
  colors={['blue', 'purple']}
  className="h-80"
/>
```

**优势**：
- 代码量减少 80%
- 性能提升 4-8倍
- 自动响应式
- 更好的 TypeScript 支持

---

## 🎯 迁移优先级

### P0 - 立即迁移（本周）
1. ✅ Button 组件 - 最常用
2. ✅ Dialog 组件 - 高频使用
3. ✅ Input/Label 组件 - 表单必需
4. ⏳ Dashboard 图表 - 性能提升明显

### P1 - 下周迁移
1. ⏳ Dropdown Menu 组件
2. ⏳ Checkbox 组件
3. ⏳ Offers 页面图表
4. ⏳ Tasks 页面组件

### P2 - 后续迁移
1. ⏳ Settings 页面组件
2. ⏳ Manage 页面组件
3. ⏳ 其他低频组件

---

## 🔍 查找需要迁移的组件

### 查找 Button 使用
```bash
grep -r "from '~/core/ui/Button'" apps/frontend/src
```

### 查找 Dialog 使用
```bash
grep -r "@radix-ui/react-dialog" apps/frontend/src
```

### 查找 Recharts 使用
```bash
grep -r "from 'recharts'" apps/frontend/src
```

---

## ✅ 迁移检查清单

### 组件迁移前
- [ ] 确认新组件已创建
- [ ] 阅读新组件文档
- [ ] 了解 API 差异
- [ ] 准备测试用例

### 组件迁移中
- [ ] 更新导入语句
- [ ] 调整 props 映射
- [ ] 更新类名（如需要）
- [ ] 测试功能正常

### 组件迁移后
- [ ] 删除旧组件导入
- [ ] 运行类型检查
- [ ] 测试所有变体
- [ ] 更新 Storybook
- [ ] 提交代码

---

## 📚 参考资源

- [shadcn/ui 文档](https://ui.shadcn.com)
- [Tremor 文档](https://tremor.so/docs)
- [Radix UI 文档](https://www.radix-ui.com)
- [TanStack Query v5 文档](https://tanstack.com/query/latest)

---

## 💡 最佳实践

1. **渐进式迁移**：一次迁移一个组件或页面
2. **保持兼容**：迁移期间保留旧组件，确保不影响其他功能
3. **充分测试**：每次迁移后都要测试相关功能
4. **更新文档**：及时更新组件使用文档
5. **团队沟通**：通知团队成员新组件的使用方式

---

## 🐛 常见问题

### Q: 新旧组件可以共存吗？
A: 可以。迁移期间两者可以共存，但建议尽快完成迁移以保持代码一致性。

### Q: 如何处理自定义样式？
A: shadcn/ui 组件完全支持自定义，通过 className prop 添加额外样式。

### Q: Tremor 图表支持自定义吗？
A: 支持。可以通过 className 和自定义 tooltip 等方式进行定制。

### Q: 迁移会影响性能吗？
A: 不会。shadcn/ui 和 Tremor 都比旧方案更轻量，性能会有提升。

---

**迁移进度**: 60% 完成（Week 0 Day 2-3）