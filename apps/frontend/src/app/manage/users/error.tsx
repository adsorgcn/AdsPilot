'use client';

import Alert from '~/core/ui/Alert';
import { AdminPageLayout } from '~/core/ui/PageLayout';

function UsersAdminPageError() {
  return (
    <AdminPageLayout>
      <Alert type={'error'}>
        <Alert.Heading>Could not load users</Alert.Heading>
        <p>
          There was an error loading the users. Please check your console
          errors.
        </p>
      </Alert>
    </AdminPageLayout>
  );
}

export default UsersAdminPageError;
