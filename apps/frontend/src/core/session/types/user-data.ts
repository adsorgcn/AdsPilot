import UserRole from '~/lib/types/user-role';

/**
 * This interface represents the user record in the Database
 * Not to be confused with {@link User} defined in Supabase Auth
 * This data is always present in {@link UserSession}
 */
interface UserData {
  id: string;
  photoUrl?: string | null;
  displayName?: string | null;
  onboarded: boolean;
  role?: UserRole | string;  // User-level role (user/admin)
}

export default UserData;
