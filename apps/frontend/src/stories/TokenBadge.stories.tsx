import type { Meta, StoryObj } from '@storybook/react';

// @ts-ignore - Ignore React version conflicts for Storybook
import Badge from '~/core/ui/Badge';

const meta = {
  title: 'Tokens/Badge',
  component: Badge as any,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
    children: 'Badge',
  },
} satisfies Meta<any>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Success: Story = {
  args: {
    color: 'success',
    children: '成功',
  },
};

export const Warning: Story = {
  args: {
    color: 'warn',
    children: '注意',
  },
};

export const Error: Story = {
  args: {
    color: 'error',
    children: '告警',
  },
};
