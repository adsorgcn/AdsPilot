import { useMutation } from '@tanstack/react-query';

import type UserData from '~/core/session/types/user-data';
import { updateUserProfile } from '~/lib/api/user';
import { getCurrentUserId } from '~/lib/api/auth';

type ProfileUpdateExtras = {
  timezone?: string | null;
  language?: string | null;
  preferences?: Record<string, unknown> | null;
};

type Payload = WithId<Partial<UserData & ProfileUpdateExtras>>;

/**
 * @name useUpdateProfile
 * Updated to use API Gateway instead of direct database access
 */
function useUpdateProfile() {
  return useMutation({
    mutationFn: async (data: Payload) => {
    // Get current user ID if not provided
    const userId = data.id || await getCurrentUserId();

    if (!userId) {
      throw new Error('User ID is required for profile update');
    }

    // Convert UserData to API format
    const preferences =
      data.preferences && typeof data.preferences === 'object'
        ? data.preferences
        : undefined;

    const profileData = {
      displayName: data.displayName ?? undefined,
      photoUrl: data.photoUrl ?? undefined,
      name: data.displayName ?? undefined,
      timezone: data.timezone ?? undefined,
      language: data.language ?? undefined,
      preferences,
    };

    return updateUserProfile(userId, profileData);
    },
  });
}

export default useUpdateProfile;
