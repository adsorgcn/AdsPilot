import type { Meta, StoryObj } from '@storybook/react';
import { HttpResponse, http } from 'msw';

import AIInsightsFeed from '~/app/dashboard/components/AIInsightsFeed';
import type { InsightsResponse } from '~/lib/api/types/console';

const sampleResponse: InsightsResponse = {
  generatedAt: new Date().toISOString(),
  items: [
    {
      id: 'token-low',
      category: 'token',
      title: 'Token 余额偏低',
      message: '当前 Token 余额仅剩 80，建议及时充值以避免评估任务中断。',
      severity: 'warning',
      action: {
        label: '前往 Token 管理',
        url: '/settings/tokens',
      },
      createdAt: new Date().toISOString(),
      meta: {
        balance: '80',
      },
    },
    {
      id: 'task-failed',
      category: 'task',
      title: '任务执行失败',
      message: '落地页评估任务 EX-129 失败，请检查页面可访问性或重试。',
      severity: 'error',
      action: {
        label: '查看任务详情',
        url: '/tasks?taskId=EX-129',
      },
      createdAt: new Date().toISOString(),
    },
    {
      id: 'ads-disconnected',
      category: 'ads',
      title: '广告账号状态异常（Acme Ads）',
      message: '广告账号 Acme Ads 当前状态为 DISCONNECTED，请重新授权。',
      severity: 'error',
      action: {
        label: '查看广告中心',
        url: '/adscenter',
      },
      createdAt: new Date().toISOString(),
    },
  ],
};

const meta = {
  title: 'Dashboard/AIInsightsFeed',
  component: AIInsightsFeed,
  parameters: {
    layout: 'centered',
    msw: {
      handlers: [
        http.get('/api/v1/console/insights', () => HttpResponse.json(sampleResponse)),
        http.get('/api/v1/console/insights/stream', () =>
          HttpResponse.text(`event: insights\ndata: ${JSON.stringify(sampleResponse)}\n\n`, {
            headers: {
              'Content-Type': 'text/event-stream',
            },
          }),
        ),
      ],
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof AIInsightsFeed>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
