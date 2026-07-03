import dynamic from 'next/dynamic';
import { withI18n } from '~/i18n/with-i18n';
import FadeIn from '~/components/FadeIn';
import { SettingsPageLayout } from '~/core/ui/PageLayout';
import type { Metadata } from 'next';

// ✅ 懒加载个人资料表单容器 - 减少首屏包体积
const UpdateProfileFormContainer = dynamic(
  () => import('./components/UpdateProfileFormContainer'),
  {
    loading: () => <div className="h-96 animate-pulse rounded-lg bg-muted" />,
  }
);

export const metadata: Metadata = {
  title: 'Profile Settings',
};

const ProfileDetailsPage = () => {
  return (
    <FadeIn>
      <SettingsPageLayout>
        <UpdateProfileFormContainer />
      </SettingsPageLayout>
    </FadeIn>
  );
};

export default withI18n(ProfileDetailsPage);
