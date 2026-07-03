import type { Meta, StoryObj } from '@storybook/react';
import { MarketingGlassCard, MarketingGlassCardContent } from './MarketingGlassCard';

const meta: Meta<typeof MarketingGlassCard> = {
  title: 'Marketing/MarketingGlassCard',
  component: MarketingGlassCard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Marketing专用玻璃态卡片组件，具有渐变背景、模糊效果和现代化设计。',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      description: '卡片变体',
      control: 'select',
      options: ['default', 'gradient', 'primary', 'success', 'warning', 'error'],
    },
    hover: {
      description: '是否启用悬停效果',
      control: 'boolean',
    },
    delay: {
      description: '动画延迟时间（秒）',
      control: { type: 'range', min: 0, max: 2, step: 0.1 },
    },
    className: {
      description: '自定义CSS类名',
      control: 'text',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// 基础示例
export const Default: Story = {
  args: {
    variant: 'default',
    hover: true,
    children: (
      <MarketingGlassCardContent className="p-6">
        <h3 className="text-lg font-semibold mb-2">Default Card</h3>
        <p className="text-sm text-muted-foreground">
          这是默认的玻璃态卡片组件，具有毛玻璃效果和现代化设计。
        </p>
      </MarketingGlassCardContent>
    ),
  },
};

// 渐变变体
export const Gradient: Story = {
  args: {
    variant: 'gradient',
    hover: true,
    children: (
      <MarketingGlassCardContent className="p-6">
        <h3 className="text-lg font-semibold mb-2 text-gradient-primary">
          Gradient Card
        </h3>
        <p className="text-sm text-muted-foreground">
          渐变背景的玻璃态卡片，视觉效果更加丰富。
        </p>
      </MarketingGlassCardContent>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: '渐变变体具有彩色背景，适用于需要突出显示的卡片。',
      },
    },
  },
};

// 主要变体
export const Primary: Story = {
  args: {
    variant: 'primary',
    hover: true,
    children: (
      <MarketingGlassCardContent className="p-6">
        <h3 className="text-lg font-semibold mb-2">Primary Card</h3>
        <p className="text-sm text-muted-foreground">
          主要色调的玻璃态卡片，强调重要内容。
        </p>
      </MarketingGlassCardContent>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: '主要变体使用蓝色调，适用于CTA卡片或重要信息。',
      },
    },
  },
};

// 成功变体
export const Success: Story = {
  args: {
    variant: 'success',
    hover: true,
    children: (
      <MarketingGlassCardContent className="p-6">
        <h3 className="text-lg font-semibold mb-2">Success Card</h3>
        <p className="text-sm text-muted-foreground">
          成功状态的玻璃态卡片，用于展示正面信息。
        </p>
      </MarketingGlassCardContent>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: '成功变体使用绿色调，适用于完成状态、成功消息等场景。',
      },
    },
  },
};

// 警告变体
export const Warning: Story = {
  args: {
    variant: 'warning',
    hover: true,
    children: (
      <MarketingGlassCardContent className="p-6">
        <h3 className="text-lg font-semibold mb-2">Warning Card</h3>
        <p className="text-sm text-muted-foreground">
          警告状态的玻璃态卡片，用于提醒用户注意。
        </p>
      </MarketingGlassCardContent>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: '警告变体使用橙色调，适用于需要注意的信息。',
      },
    },
  },
};

// 错误变体
export const Error: Story = {
  args: {
    variant: 'error',
    hover: true,
    children: (
      <MarketingGlassCardContent className="p-6">
        <h3 className="text-lg font-semibold mb-2">Error Card</h3>
        <p className="text-sm text-muted-foreground">
          错误状态的玻璃态卡片，用于显示错误信息。
        </p>
      </MarketingGlassCardContent>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: '错误变体使用红色调，适用于错误消息或警告信息。',
      },
    },
  },
};

// 统计卡片示例
export const StatsCard: Story = {
  args: {
    variant: 'gradient',
    hover: true,
    children: (
      <MarketingGlassCardContent className="p-4 text-center">
        <div className="text-2xl font-bold text-gradient-primary mb-1">1,000+</div>
        <div className="text-xs text-muted-foreground">总评估数</div>
      </MarketingGlassCardContent>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: '统计卡片示例，用于展示关键指标和数据。',
      },
    },
  },
};

// 功能卡片示例
export const FeatureCard: Story = {
  args: {
    variant: 'default',
    hover: true,
    children: (
      <MarketingGlassCardContent className="p-6">
        <div className="h-12 w-12 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-xl flex items-center justify-center mb-4">
          <span className="text-xl">🚀</span>
        </div>
        <h3 className="text-lg font-semibold mb-2">高性能</h3>
        <p className="text-sm text-muted-foreground mb-4">
          优化的性能架构，提供快速的响应速度和流畅的用户体验。
        </p>
        <div className="flex gap-2">
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">性能</span>
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">优化</span>
        </div>
      </MarketingGlassCardContent>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: '功能卡片示例，包含图标、标题、描述和标签。',
      },
    },
  },
};

// 延迟动画示例
export const AnimatedDelay: Story = {
  render: () => (
    <div className="space-y-4 w-96">
      <div className="text-sm text-gray-600">动画延迟效果（按顺序出现）:</div>
      <MarketingGlassCard variant="gradient" delay={0}>
        <MarketingGlassCardContent className="p-4">
          <div className="text-sm">第一个卡片 (0s延迟)</div>
        </MarketingGlassCardContent>
      </MarketingGlassCard>
      <MarketingGlassCard variant="gradient" delay={0.2}>
        <MarketingGlassCardContent className="p-4">
          <div className="text-sm">第二个卡片 (0.2s延迟)</div>
        </MarketingGlassCardContent>
      </MarketingGlassCard>
      <MarketingGlassCard variant="gradient" delay={0.4}>
        <MarketingGlassCardContent className="p-4">
          <div className="text-sm">第三个卡片 (0.4s延迟)</div>
        </MarketingGlassCardContent>
      </MarketingGlassCard>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: '使用延迟属性创建交错动画效果，提升视觉体验。',
      },
    },
  },
};

// 无悬停效果
export const NoHover: Story = {
  args: {
    variant: 'gradient',
    hover: false,
    children: (
      <MarketingGlassCardContent className="p-6">
        <h3 className="text-lg font-semibold mb-2">Static Card</h3>
        <p className="text-sm text-muted-foreground">
          静态卡片，没有悬停效果。
        </p>
      </MarketingGlassCardContent>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: '禁用悬停效果的卡片，适用于不需要交互的场景。',
      },
    },
  },
};