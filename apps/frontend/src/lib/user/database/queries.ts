import { userApiService } from '~/lib/api/services/UserApiService';
import type { UserProfile } from '~/lib/api/services/UserApiService';

/**
 * @name getUserById
 * @param userId
 * @deprecated This function is deprecated. Use userApiService.getUserProfile() instead.
 * Maintained for backward compatibility during migration.
 */
export async function getUserById(userId: string): Promise<UserProfile | null> {
  try {
    const profile = await userApiService.getUserProfile(userId);
    return profile;
  } catch (error) {
    console.error('Failed to fetch user profile via API:', error);
    return null;
  }
}
