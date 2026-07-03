import type { Meta, StoryObj } from '@storybook/react';
import { OptimizedImage, ImageVariants } from './OptimizedImage';

const meta: Meta<typeof OptimizedImage> = {
  title: 'UI/OptimizedImage',
  component: OptimizedImage,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: '优化的图片组件，支持自动质量调整、响应式尺寸、加载状态和错误处理。',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    src: {
      description: '图片URL',
      control: 'text',
    },
    alt: {
      description: '图片alt文本',
      control: 'text',
    },
    width: {
      description: '图片宽度',
      control: 'number',
    },
    height: {
      description: '图片高度',
      control: 'number',
    },
    priority: {
      description: '是否优先加载',
      control: 'boolean',
    },
    quality: {
      description: '图片质量(1-100)',
      control: { type: 'range', min: 1, max: 100, step: 1 },
    },
    placeholder: {
      description: '占位符类型',
      control: 'select',
      options: ['blur', 'empty'],
    },
    loading: {
      description: '加载策略',
      control: 'select',
      options: ['lazy', 'eager'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// 基础示例
export const Default: Story = {
  args: {
    src: '/assets/images/dashboard.webp',
    alt: 'Optimized Image Example',
    width: 400,
    height: 250,
  },
};

// 优先加载
export const Priority: Story = {
  args: {
    src: '/assets/images/dashboard.webp',
    alt: 'Priority Image',
    width: 400,
    height: 250,
    priority: true,
  },
};

// 高质量
export const HighQuality: Story = {
  args: {
    src: '/assets/images/dashboard.webp',
    alt: 'High Quality Image',
    width: 400,
    height: 250,
    quality: 95,
  },
};

// 填充模式
export const Fill: Story = {
  args: {
    src: '/assets/images/dashboard.webp',
    alt: 'Fill Image',
    fill: true,
    style: { width: '400px', height: '250px' },
  },
};

// Hero变体示例
export const HeroVariant: Story = {
  render: () => (
    <div style={{ width: '600px', height: '300px' }}>
      <ImageVariants.Hero
        src="/assets/images/dashboard.webp"
        alt="Hero Image Example"
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Hero变体适用于首页大图展示，自动优化性能参数。',
      },
    },
  },
};

// Card变体示例
export const CardVariant: Story = {
  render: () => (
    <div style={{ width: '300px', height: '200px' }}>
      <ImageVariants.Card
        src="/assets/images/dashboard.webp"
        alt="Card Image Example"
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Card变体适用于卡片图片，平衡质量和文件大小。',
      },
    },
  },
};

// Avatar变体示例
export const AvatarVariant: Story = {
  render: () => (
    <div style={{ width: '48px', height: '48px' }}>
      <ImageVariants.Avatar
        src="/assets/images/dashboard.webp"
        alt="Avatar Example"
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Avatar变体适用于用户头像，快速加载且文件小。',
      },
    },
  },
};

// 错误状态
export const ErrorState: Story = {
  args: {
    src: '/non-existent-image.jpg',
    alt: 'Error State',
    width: 400,
    height: 250,
  },
  parameters: {
    docs: {
      description: {
        story: '图片加载失败时的错误处理和回退显示。',
      },
    },
  },
};

// 响应式示例
export const Responsive: Story = {
  render: () => (
    <div style={{ width: '100%', maxWidth: '600px' }}>
      <OptimizedImage
        src="/assets/images/dashboard.webp"
        alt="Responsive Image"
        fill
        style={{ aspectRatio: '16/9' }}
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: '响应式图片，根据屏幕尺寸自动调整。',
      },
    },
  },
};

// 自定义样式
export const CustomStyled: Story = {
  args: {
    src: '/assets/images/dashboard.webp',
    alt: 'Custom Styled Image',
    width: 300,
    height: 200,
    className: 'rounded-xl shadow-lg',
    style: {
      border: '2px solid #3b82f6',
      borderRadius: '12px',
    },
  },
};