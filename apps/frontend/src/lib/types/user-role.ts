/**
 * User-level roles for global permission control
 * NOT to be confused with organization membership roles (removed)
 *
 * @enum {string}
 */
enum UserRole {
  /**
   * Regular user - default role
   * Can access main features but not admin panel
   */
  User = 'user',

  /**
   * System administrator
   * Can access admin panel and all features
   */
  Admin = 'admin',
}

export default UserRole;
