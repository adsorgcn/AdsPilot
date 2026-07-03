'use client';

import { useCallback, useContext, useState } from 'react';

import UserSessionContext from '~/core/session/contexts/user-session';
import useUserSession from '~/core/hooks/use-user-session';
import type UserData from '~/core/session/types/user-data';
import Trans from '~/core/ui/Trans';
import If from '~/core/ui/If';
import Button from '~/core/ui/Button';

import UpdatePhoneNumberForm from '../components/UpdatePhoneNumberForm';
import SettingsTile from '../../components/SettingsTile';
import UpdateProfileForm from '../components/UpdateProfileForm';
import ProfileDangerZone from '../components/ProfileDangerZone';

import { refreshSessionAction } from '../actions';

import configuration from '~/configuration';

const allowAccountDeletion = configuration.features.enableAccountDeletion;
const allowPhoneNumberUpdate = configuration.auth.providers.phoneNumber;

function UpdateProfileFormContainer() {
  const { userSession, setUserSession } = useContext(UserSessionContext);
  const session = useUserSession();
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);

  const onUpdateProfileData = useCallback(
    async (data: Partial<UserData>) => {
      const userRecordData = userSession?.data;

      if (userRecordData) {
        setUserSession({
          ...userSession,
          data: {
            ...userRecordData,
            ...data,
          },
        });
      }

      await refreshSessionAction();
    },
    [setUserSession, userSession],
  );

  if (!session) {
    return null;
  }

  return (
    <div className={'flex flex-col space-y-8'}>
      <SettingsTile
        heading={<Trans i18nKey={'profile:generalTab'} />}
        subHeading={<Trans i18nKey={'profile:generalTabSubheading'} />}
      >
        <UpdateProfileForm
          session={session}
          onUpdateProfileData={onUpdateProfileData}
        />
      </SettingsTile>

      <If condition={allowPhoneNumberUpdate}>
        <SettingsTile
          heading={<Trans i18nKey={'profile:updatePhoneNumber'} />}
          subHeading={<Trans i18nKey={'profile:updatePhoneNumberSubheading'} />}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">
                  {session.auth.user?.phone || <Trans i18nKey={'profile:noPhoneNumberSet'} />}
                </p>
              </div>
              <Button
                onClick={() => setIsPhoneModalOpen(true)}
                variant="outline"
              >
                <Trans i18nKey={'profile:updatePhoneNumber'} />
              </Button>
            </div>

            <UpdatePhoneNumberForm
              currentPhone={session.auth.user?.phone || null}
              isModalOpen={isPhoneModalOpen}
              onModalClose={() => setIsPhoneModalOpen(false)}
              onSuccess={async () => {
                await refreshSessionAction();
                setIsPhoneModalOpen(false);
              }}
            />
          </div>
        </SettingsTile>
      </If>

      <If condition={allowAccountDeletion}>
        <SettingsTile
          heading={<Trans i18nKey={'profile:dangerZone'} />}
          subHeading={<Trans i18nKey={'profile:dangerZoneSubheading'} />}
        >
          <ProfileDangerZone />
        </SettingsTile>
      </If>
    </div>
  );
}

export default UpdateProfileFormContainer;
