import type UserData from '~/core/session/types/user-data';

/**
 * User roles in the system
 * - 'user': Regular user
 * - 'admin': Administrator with full access
 */
export type UserRole = 'user' | 'admin';

/**
 * This interface combines the user's metadata from
 * Supabase Auth and the user's record in Database
 */
interface UserSession {
  auth: {
    user: {
      id: string;
      email: Maybe<string>;
      phone: Maybe<string>;
    };
  };

  data: Maybe<UserData>;
  role: Maybe<UserRole>;
}

export default UserSession;
