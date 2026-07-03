import Trans from '~/core/ui/Trans';
import Alert from '~/core/ui/Alert';
import { AuthError } from '@supabase/supabase-js';

/**
 * @name AuthErrorMessage
 * @param error This error comes from Supabase as the code returned on errors
 * This error is mapped from the translation auth:errors.{error}
 * To update the error messages, please update the translation file
 * https://github.com/supabase/gotrue-js/blob/master/src/lib/errors.ts
 * @constructor
 */
export default function AuthErrorMessage({
  error,
}: {
  error: Maybe<Error | AuthError | unknown>;
}) {
  if (!error) {
    return null;
  }

  const DefaultError = <Trans i18nKey="auth:errors.default" />;
  const errorCode = error instanceof AuthError ? error.message : error;

  return (
    <Alert className={'w-full'} type={'error'}>
      <Alert.Heading>
        <Trans i18nKey={`auth:errorAlertHeading`} />
      </Alert.Heading>

      <p className={'text-sm font-medium'} data-cy={'auth-error-message'}>
        <Trans
          i18nKey={`auth:errors.${errorCode}`}
          defaults={'<DefaultError />'}
          components={{ DefaultError }}
        />
      </p>
    </Alert>
  );
}
