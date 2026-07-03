import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { enhancedUnifiedUserService } from '~/lib/services/EnhancedUnifiedUserService';

/**
 * @name useUser
 * @description Enhanced user hook using the unified user service
 * Provides comprehensive user data including permissions and subscription info
 */
function useUser() {
  const router = useRouter();

  const query = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      try {
        const userSession = await enhancedUnifiedUserService.getUserSession();
        return userSession.user;
      } catch (error) {
        console.error('[useUser] Error fetching user:', error);
        router.refresh();
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
  };
}

/**
 * Enhanced hook with comprehensive user session data
 */
export function useUserSession() {
  const router = useRouter();

  const query = useQuery({
    queryKey: ['user-session'],
    queryFn: async () => {
      try {
        return await enhancedUnifiedUserService.getUserSession();
      } catch (error) {
        console.error('[useUserSession] Error fetching session:', error);
        router.refresh();
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
  };
}

/**
 * Hook for user permissions and access control
 */
export function useUserPermissions() {
  const userSession = useUserSession();
  const key = 'user-permissions';

  return useSWR(
    userSession.data ? [key, userSession.data.user.id] : null,
    async () => {
      if (!userSession.data) return null;

      try {
        return await enhancedUnifiedUserService.getUserPermissions(userSession.data.user.id);
      } catch (error) {
        console.error('[useUserPermissions] Error fetching permissions:', error);
        throw error;
      }
    }
  );
}

/**
 * Hook for user profile data
 */
export function useUserProfile() {
  const userSession = useUserSession();
  const key = 'user-profile';

  return useSWR(
    userSession.data ? [key, userSession.data.user.id] : null,
    async () => {
      if (!userSession.data) return null;

      try {
        return await enhancedUnifiedUserService.getUserProfile(userSession.data.user.id);
      } catch (error) {
        console.error('[useUserProfile] Error fetching profile:', error);
        throw error;
      }
    }
  );
}

export default useUser;
