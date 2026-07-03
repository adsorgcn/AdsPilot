"use client";

import { useTranslation } from 'react-i18next';
import { ShieldCheckIcon, KeyIcon, ClockIcon, DevicePhoneMobileIcon } from '@heroicons/react/24/outline';
import SettingsContentContainer from '../../components/SettingsContentContainer';
import Tile from '~/core/ui/Tile';
import Button from '~/core/ui/Button';

export default function SecurityPage() {
  const { t } = useTranslation('profile');

  const securityTools = [
    {
      icon: KeyIcon,
      title: t('security.tools.password.title', { defaultValue: '密码管理' }),
      description: t('security.tools.password.description', {
        defaultValue: '修改密码、启用双因素认证'
      }),
      action: t('security.tools.password.action', { defaultValue: '前往 Supabase Auth' }),
      href: process.env.NEXT_PUBLIC_SUPABASE_URL
        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL.replace('.supabase.co', '')}.supabase.co/project/_/auth/users`
        : 'https://app.supabase.com',
    },
    {
      icon: ClockIcon,
      title: t('security.tools.auditLogs.title', { defaultValue: '审计日志' }),
      description: t('security.tools.auditLogs.description', {
        defaultValue: '查看账户活动记录和安全事件'
      }),
      action: t('security.tools.auditLogs.action', { defaultValue: '前往 GCP Audit Logs' }),
      href: 'https://console.cloud.google.com/logs/query',
    },
    {
      icon: DevicePhoneMobileIcon,
      title: t('security.tools.sessions.title', { defaultValue: '设备会话' }),
      description: t('security.tools.sessions.description', {
        defaultValue: '管理登录设备和会话'
      }),
      action: t('security.tools.sessions.action', { defaultValue: '前往 Supabase Auth' }),
      href: process.env.NEXT_PUBLIC_SUPABASE_URL
        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL.replace('.supabase.co', '')}.supabase.co/project/_/auth/users`
        : 'https://app.supabase.com',
    },
  ];

  return (
    <SettingsContentContainer>
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <ShieldCheckIcon className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">
              {t('security.pageTitle', { defaultValue: '安全设置' })}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {t('security.pageDescription', {
                defaultValue: '我们使用专业的安全工具来保护您的账户。请通过以下工具管理您的安全设置。'
              })}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {securityTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Tile key={tool.title}>
                <Tile.Body>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <Icon className="h-6 w-6 text-primary" />
                      <div>
                        <h3 className="font-semibold">{tool.title}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {tool.description}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      href={tool.href}
                      className="w-full"
                    >
                      {tool.action}
                    </Button>
                  </div>
                </Tile.Body>
              </Tile>
            );
          })}
        </div>

        <Tile>
          <Tile.Heading>
            {t('security.why.title', { defaultValue: '为什么使用专业工具？' })}
          </Tile.Heading>
          <Tile.Body>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                ✅ {t('security.why.reason1', {
                  defaultValue: '更高的安全性 - 使用行业标准的安全实践'
                })}
              </li>
              <li>
                ✅ {t('security.why.reason2', {
                  defaultValue: '更完整的功能 - 专业工具提供更丰富的安全选项'
                })}
              </li>
              <li>
                ✅ {t('security.why.reason3', {
                  defaultValue: '更好的审计 - 完整的日志记录和合规支持'
                })}
              </li>
            </ul>
          </Tile.Body>
        </Tile>
      </div>
    </SettingsContentContainer>
  );
}
