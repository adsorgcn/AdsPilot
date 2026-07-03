import Tile from '~/core/ui/Tile';
import Heading from '~/core/ui/Heading';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/core/ui/Table';
import { formatNumber, formatDateTime } from '../utils/formatters';
import type { AdminUser } from '~/lib/admin';

interface StatBlockProps {
  heading: string;
  value: string;
  helper?: string;
}

function StatBlock({ heading, value, helper }: StatBlockProps) {
  return (
    <div className={'rounded-lg border border-border bg-muted/20 p-4'}>
      <p className={'text-xs text-muted-foreground'}>{heading}</p>
      <p className={'mt-2 text-lg font-semibold text-foreground'}>{value}</p>
      {helper ? (
        <p className={'text-xs text-muted-foreground'}>{helper}</p>
      ) : null}
    </div>
  );
}

interface TokensSectionProps {
  user: AdminUser;
  tokens: {
    balance: number;
    items: Array<{
      id: string;
      type: string;
      amount: number;
      description?: string;
      createdAt: string;
    }>;
  } | null;
}

export default function TokensSection({ user, tokens }: TokensSectionProps) {
  return (
    <Tile>
      <Heading type={4}>Subscription & Token</Heading>

      <div className={'grid gap-4 md:grid-cols-2 lg:grid-cols-4'}>
        <StatBlock
          heading={'Token Balance'}
          value={formatNumber(tokens?.balance ?? user.tokenBalance ?? 0)}
          helper={'当前账户可用 Token'}
        />

        <StatBlock
          heading={'Plan'}
          value={user.planName ?? '—'}
          helper={'订阅计划名称'}
        />

        <StatBlock
          heading={'Subscription'}
          value={user.subscription ?? '—'}
          helper={'订阅状态'}
        />

        <StatBlock
          heading={'Role'}
          value={(user.role ?? 'user').toUpperCase()}
          helper={'App Metadata 中记录的角色'}
        />
      </div>

      {tokens ? (
        <div className={'mt-4 space-y-2'}>
          <Heading type={6}>Recent Token Transactions</Heading>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className={'hidden lg:table-cell'}>
                  Description
                </TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {tokens.items.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className={'text-xs text-muted-foreground'}>
                    {tx.id}
                  </TableCell>
                  <TableCell className={'uppercase text-xs font-medium'}>
                    {tx.type}
                  </TableCell>
                  <TableCell>{formatNumber(tx.amount)}</TableCell>
                  <TableCell className={'hidden lg:table-cell text-xs text-muted-foreground'}>
                    {tx.description ?? '—'}
                  </TableCell>
                  <TableCell className={'text-xs text-muted-foreground'}>
                    {formatDateTime(tx.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </Tile>
  );
}
