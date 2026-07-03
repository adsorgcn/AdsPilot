/**
 * @name GlobalRole
 * @description This enum represents the roles of users that can access the
 * super admin by default, we have 1 role = super-admin. You can extend this
 * with other roles you want to assign to your collaborators.
 */
enum GlobalRole {
  SuperAdmin = 'super-admin',
}

export default GlobalRole;
