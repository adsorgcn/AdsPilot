'use client';

import Button from '~/core/ui/Button';
import TextField from '~/core/ui/TextField';
import { useTranslation } from 'react-i18next';

const ConvertkitSignupForm: React.FCC<{
  formId: string;
}> = ({ formId, children }) => {
  const action = `https://app.convertkit.com/forms/${formId}/subscriptions`;
  const { t } = useTranslation('marketing');

  return (
    <form
      action={action}
      method={'POST'}
      target="_blank"
      className={`flex w-full flex-col justify-center space-y-2 lg:flex-row lg:space-y-0 lg:space-x-1.5`}
    >
      <TextField.Input
        type="email"
        className="w-full 2xl:w-60"
        name="email_address"
        aria-label={t('newsletter.emailAriaLabel')}
        placeholder={t('newsletter.emailPlaceholder')}
        required
      />

      <Button>{children}</Button>
    </form>
  );
};

export default ConvertkitSignupForm;
