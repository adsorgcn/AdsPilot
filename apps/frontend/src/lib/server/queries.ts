import { userApiService } from '~/lib/api/services/UserApiService';
import type { UserProfile } from '~/lib/api/services/UserApiService';

/**
 * @description Fetch user object data (not auth!) by ID {@link userId}
 * @deprecated This function is deprecated. Use userApiService.getUserProfile() instead.
 * Maintained for backward compatibility during migration.
 */
export async function getUserDataById(
  userId: string,
): Promise<UserProfile | null> {
  try {
    const profile = await userApiService.getUserProfile(userId);
    return profile;
  } catch (error) {
    console.error('Failed to fetch user profile via API:', error);
    // Return null instead of throwing to maintain compatibility
    return null;
  }
}
