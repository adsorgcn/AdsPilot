import ProfileSettingsTabs from './components/ProfileSettingsTabs';
import SettingsContentContainer from '../components/SettingsContentContainer';
import { withI18n } from '~/i18n/with-i18n';

function ProfileSettingsLayout({
  children,
}: React.PropsWithChildren) {
  return (
    <>
      <div>
        <ProfileSettingsTabs />
      </div>

      <SettingsContentContainer>{children}</SettingsContentContainer>
    </>
  );
}

export default withI18n(ProfileSettingsLayout);
