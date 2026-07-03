import configuration from '~/configuration';
import getLogger from '~/core/logger';

import { USERS_TABLE } from '~/lib/db-tables';
import type { SupabaseClientInstance } from '~/database.types';
import getSupabaseServerActionClient from '~/core/supabase/action-client';
import sendEmail from '~/core/email/send-email';
import renderAccountDeleteEmail from '~/lib/emails/account-delete';

type Params = {
  client: SupabaseClientInstance;
  userId: string;
};

type SendEmailParams =
  | {
      email: string | undefined;
      sendEmail: true;
    }
  | {
      sendEmail?: false;
    };

type DeleteUserParams = Params & SendEmailParams;

/**
 * Deletes a user and associated records from the database.
 * Note: Organization deletion logic has been removed during user-centric refactoring.
 *
 * @param {DeleteUserParams} params - The parameters for deleting a user.
 */
export async function deleteUser(params: DeleteUserParams) {
  const { userId } = params;
  const logger = getLogger();

  const adminClient = getSupabaseServerActionClient({ admin: true });

  logger.info({ userId }, `Deleting user record and auth record...`);

  const displayName = await getDisplayName(adminClient, userId);
  const deleteUserResponse = await adminClient.auth.admin.deleteUser(userId);

  if (deleteUserResponse.error) {
    const ctx = { userId, error: deleteUserResponse.error };

    logger.error(ctx, `Error deleting user record or auth record.`);

    throw new Error();
  }

  logger.info({ userId }, `Deleted user record and auth record.`);

  if (params.sendEmail && params.email) {
    logger.info({ userId }, `Sending account deletion email...`);

    const userDisplayName = displayName || params.email;

    await sendAccountDeleteEmail({
      userDisplayName,
      email: params.email,
    }).catch((error) => {
      logger.error(
        {
          userId,
          error,
        },
        `Error sending account deletion email`,
      );
    });

    logger.info({ userId }, `Successfully sent account deletion email.`);
  }

  logger.info(
    {
      userId,
    },
    `Successfully deleted all user data`,
  );
}

/**
 * Returns the display name of a user. This is used to fill the email template.
 *
 * @param {SupabaseClientInstance} client - The Supabase client instance.
 * @param {string} userId - The ID of the user.
 **/
function getDisplayName(client: SupabaseClientInstance, userId: string) {
  return client
    .from(USERS_TABLE)
    .select(
      `
      display_name
    `,
    )
    .eq('id', userId)
    .single()
    .then(({ data }) => data?.display_name);
}

/**
 * Sends an email to the user confirming the deletion of their account.
 *
 * @param {Object} params - The parameters for sending the email.
 * @param {string} params.userDisplayName - The display name of the user.
 * @param {string} params.email - The email address of the user.
 * @throws {Error} If the EMAIL_SENDER environmental variable is missing.
 */
async function sendAccountDeleteEmail(params: {
  userDisplayName: string;
  email: string;
}) {
  const productName = configuration.site.siteName;

  const accountDeleteEmail = await renderAccountDeleteEmail({
    productName,
    userDisplayName: params.userDisplayName,
  });

  const subject = `Confirmation of Account Deletion on ${productName}`;
  const from = process.env.EMAIL_SENDER;

  if (!from) {
    throw new Error(`Missing EMAIL_SENDER env variable.`);
  }

  return sendEmail({
    to: params.email,
    subject,
    html: accountDeleteEmail,
    from,
  });
}
