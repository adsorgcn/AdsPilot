import useUserId from '~/core/hooks/use-user-id';

/**
 * @returns {string[]} The key for the user's factors mutation. This is used to invalidate the query.
 */
function useFactorsMutationKey() {
  const userId = useUserId();

  return ['mfa-factors', userId];
}

export default useFactorsMutationKey;
