import type { Meta, StoryObj } from '@storybook/react';
import { Skeleton } from './skeleton';

const meta: Meta<typeof Skeleton> = {
  title: 'UI/Skeleton',
  component: Skeleton,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: '骨架屏组件，用于在内容加载时提供占位符，改善用户体验。',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    className: {
      description: '自定义CSS类名',
      control: 'text',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// 基础骨架屏
export const Default: Story = {
  args: {
    className: 'h-4 w-32',
  },
};

// 不同尺寸
export const Sizes: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-16" />
        <span className="text-sm">Small (h-4)</span>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-20" />
        <span className="text-sm">Medium (h-6)</span>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-24" />
        <span className="text-sm">Large (h-8)</span>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-12 w-32" />
        <span className="text-sm">Extra Large (h-12)</span>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: '不同尺寸的骨架屏，适用于不同类型的占位符。',
      },
    },
  },
};

// 不同宽度
export const Widths: Story = {
  render: () => (
    <div className="space-y-4 w-64">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-1/4" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: '不同宽度的骨架屏，用于模拟不同长度的文本内容。',
      },
    },
  },
};

// 圆形骨架屏
export const Circular: Story = {
  render: () => (
    <div className="flex gap-4">
      <Skeleton className="h-8 w-8 rounded-full" />
      <Skeleton className="h-12 w-12 rounded-full" />
      <Skeleton className="h-16 w-16 rounded-full" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: '圆形骨架屏，适用于头像、图标等圆形元素的占位符。',
      },
    },
  },
};

// 卡片骨架屏
export const CardSkeleton: Story = {
  render: () => (
    <div className="space-y-4 p-6 border rounded-xl w-80">
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/5" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-8 w-16 rounded-lg" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: '卡片骨架屏，模拟完整的卡片内容结构。',
      },
    },
  },
};

// 表格骨架屏
export const TableSkeleton: Story = {
  render: () => (
    <div className="space-y-2 w-full max-w-2xl">
      {/* 表头 */}
      <div className="flex gap-4 p-4 border-b font-semibold">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
      {/* 表格行 */}
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex gap-4 p-4 border-b">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-16 rounded" />
        </div>
      ))}
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: '表格骨架屏，用于表格数据的占位符。',
      },
    },
  },
};

// Hero区域骨架屏
export const HeroSkeleton: Story = {
  render: () => (
    <section className="p-8 bg-gray-50 rounded-xl w-full max-w-4xl">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div className="space-y-6">
          <Skeleton className="h-8 w-32 rounded-full" />
          <div className="space-y-4">
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-12 w-1/2" />
          </div>
          <Skeleton className="h-24 w-2/3" />
          <div className="flex gap-4">
            <Skeleton className="h-12 w-32 rounded-lg" />
            <Skeleton className="h-12 w-32 rounded-lg" />
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-96 w-full rounded-xl" />
          <div className="flex gap-4">
            <Skeleton className="h-16 w-24 rounded-xl" />
            <Skeleton className="h-16 w-24 rounded-xl" />
          </div>
        </div>
      </div>
    </section>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Hero区域骨架屏，模拟首页Hero区域的复杂布局。',
      },
    },
  },
};

// 自定义样式
export const CustomStyled: Story = {
  args: {
    className: 'h-6 w-48 rounded-lg bg-blue-200 dark:bg-blue-800',
  },
  parameters: {
    docs: {
      description: {
        story: '使用自定义CSS类的骨架屏，可以匹配特定的设计风格。',
      },
    },
  },
};

// 动画效果
export const Animated: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">默认动画效果:</div>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-4 w-24" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: '骨架屏的脉冲动画效果，提供视觉反馈表明内容正在加载。',
      },
    },
  },
};