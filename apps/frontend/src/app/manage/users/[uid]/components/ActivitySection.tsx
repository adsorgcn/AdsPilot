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
import { formatDateTime } from '../utils/formatters';

interface ActivityItem {
  action?: unknown;
  resource?: unknown;
  createdAt?: string;
  timestamp?: string;
}

interface ActivitySectionProps {
  activity: ActivityItem[];
}

export default function ActivitySection({ activity }: ActivitySectionProps) {
  if (!activity || !activity.length) {
    return null;
  }

  return (
    <Tile>
      <Heading type={4}>Recent Activity</Heading>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Action</TableHead>
            <TableHead>Resource</TableHead>
            <TableHead>Timestamp</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {activity.slice(0, 10).map((item, index) => (
            <TableRow key={index}>
              <TableCell>{String(item.action ?? '—')}</TableCell>
              <TableCell>{String(item.resource ?? '—')}</TableCell>
              <TableCell className={'text-xs text-muted-foreground'}>
                {formatDateTime(String(item.createdAt ?? item.timestamp ?? ''))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Tile>
  );
}
