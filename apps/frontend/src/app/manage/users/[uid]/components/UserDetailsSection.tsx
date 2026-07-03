import Tile from '~/core/ui/Tile';
import Heading from '~/core/ui/Heading';
import Label from '~/core/ui/Label';
import Badge from '~/core/ui/Badge';
import { TextFieldInput, TextFieldLabel } from '~/core/ui/TextField';
import { formatDate, formatDateTime } from '../utils/formatters';
import type { AdminUser } from '~/lib/admin';

interface UserDetailsSectionProps {
  user: AdminUser;
  displayName: string | undefined;
  email: string | undefined;
  isBanned: boolean;
}

export default function UserDetailsSection({
  user,
  displayName,
  email,
  isBanned,
}: UserDetailsSectionProps) {
  return (
    <Tile>
      <Heading type={4}>User Details</Heading>

      <div className={'flex space-x-2 items-center'}>
        <div>
          <Label>Status</Label>
        </div>

        <div className={'inline-flex'}>
          {isBanned ? (
            <Badge size={'small'} color={'error'}>
              Banned
            </Badge>
          ) : (
            <Badge size={'small'} color={'success'}>
              Active
            </Badge>
          )}
        </div>
      </div>

      <TextFieldLabel>
        Display name
        <TextFieldInput
          className={'max-w-sm'}
          defaultValue={displayName ?? ''}
          disabled
        />
      </TextFieldLabel>

      <TextFieldLabel>
        Email
        <TextFieldInput
          className={'max-w-sm'}
          defaultValue={email ?? ''}
          disabled
        />
      </TextFieldLabel>

      <TextFieldLabel>
        Role
        <TextFieldInput
          className={'max-w-sm'}
          defaultValue={user.role ?? 'USER'}
          disabled
        />
      </TextFieldLabel>

      <TextFieldLabel>
        Created at
        <TextFieldInput
          className={'max-w-sm'}
          defaultValue={formatDate(user.createdAt)}
          disabled
        />
      </TextFieldLabel>

      <TextFieldLabel>
        Last sign in
        <TextFieldInput
          className={'max-w-sm'}
          defaultValue={formatDateTime(user.lastSignInAt)}
          disabled
        />
      </TextFieldLabel>
    </Tile>
  );
}
