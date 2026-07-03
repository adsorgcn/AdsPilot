'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/core/ui/Dialog';
import Button from '~/core/ui/Button';
import Badge from '~/core/ui/Badge';
import { Skeleton } from '~/core/ui/Skeleton';
import { useConsoleSubscriptionDetail, useAdjustSubscription } from '~/lib/admin/resources/subscriptions';
import { toast } from 'sonner';

interface SubscriptionDetailDialogProps {
  subscriptionId: string;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export default function SubscriptionDetailDialog({
  subscriptionId,
  open,
  onClose,
  onUpdate,
}: SubscriptionDetailDialogProps) {
  const { data: subscription, isLoading, error } = useConsoleSubscriptionDetail(subscriptionId);
  const { mutateAsync: adjustSubscription, isPending } = useAdjustSubscription(subscriptionId);

  const [adjustMode, setAdjustMode] = useState(false);
  const [newPlan, setNewPlan] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [extendDays, setExtendDays] = useState('');

  const handleAdjust = async () => {
    if (!subscription) return;

    const updates: any = {};
    if (newPlan) updates.planName = newPlan;
    if (newStatus) updates.status = newStatus;
    if (extendDays) updates.days = parseInt(extendDays, 10);

    if (Object.keys(updates).length === 0) {
      toast.warning('No changes', {
        description: 'Please select at least one field to update.',
      });
      return;
    }

    try {
      await adjustSubscription(updates);
      toast.success('Subscription updated', {
        description: 'Subscription has been successfully adjusted.',
      });
      setAdjustMode(false);
      setNewPlan('');
      setNewStatus('');
      setExtendDays('');
      onUpdate();
    } catch (err) {
      toast.error('Update failed', {
        description: err instanceof Error ? err.message : 'Failed to update subscription.',
      });
    }
  };

  if (error) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Error</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center text-destructive">
            Failed to load subscription details
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Subscription Details</DialogTitle>
        </DialogHeader>

        {isLoading || !subscription ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Subscription Info */}
            <div className="space-y-3">
              <h3 className="font-semibold">Subscription Information</h3>
              <div className="grid grid-cols-2 gap-4 rounded-lg border p-4">
                <div>
                  <div className="text-sm text-muted-foreground">User</div>
                  <div className="font-medium">{subscription.userEmail || 'N/A'}</div>
                  {subscription.userName && (
                    <div className="text-sm text-muted-foreground">{subscription.userName}</div>
                  )}
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Plan</div>
                  <Badge className="mt-1">{subscription.planName.toUpperCase()}</Badge>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <Badge className="mt-1">{subscription.status}</Badge>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Period End</div>
                  <div className="font-medium">
                    {subscription.currentPeriodEnd
                      ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                      : 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Created</div>
                  <div className="font-medium">
                    {new Date(subscription.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Updated</div>
                  <div className="font-medium">
                    {new Date(subscription.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Adjust Subscription */}
            {!adjustMode ? (
              <Button onClick={() => setAdjustMode(true)} variant="outline" className="w-full">
                Adjust Subscription
              </Button>
            ) : (
              <div className="space-y-4 rounded-lg border p-4">
                <h3 className="font-semibold">Adjust Subscription</h3>

                <div>
                  <label className="text-sm text-muted-foreground">Change Plan</label>
                  <select
                    value={newPlan}
                    onChange={(e) => setNewPlan(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Keep current plan ({subscription.planName})</option>
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="elite">Elite</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground">Change Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Keep current status ({subscription.status})</option>
                    <option value="active">Active</option>
                    <option value="trialing">Trialing</option>
                    <option value="canceled">Canceled</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground">Extend Period (days)</label>
                  <input
                    type="number"
                    value={extendDays}
                    onChange={(e) => setExtendDays(e.target.value)}
                    placeholder="0"
                    min="0"
                    className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <div className="mt-1 text-xs text-muted-foreground">
                    Extend subscription period from current end date
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleAdjust} disabled={isPending} className="flex-1">
                    {isPending ? 'Updating...' : 'Apply Changes'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAdjustMode(false);
                      setNewPlan('');
                      setNewStatus('');
                      setExtendDays('');
                    }}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end border-t pt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
