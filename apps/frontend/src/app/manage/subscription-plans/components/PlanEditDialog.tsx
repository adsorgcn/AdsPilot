'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/core/ui/Dialog';
import { Button } from '~/core/ui/Button';
import type { PlanConfig } from '~/lib/api/types/billing';

interface PlanEditDialogProps {
  plan: PlanConfig | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedPlan: Partial<PlanConfig>) => void;
}

type PlanFormState = {
  name: string;
  displayNameEn: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  monthlyTokens: number;
  maxOffers: number;
  maxAdAccounts: number;
  features: string[];
  isActive: boolean;
};

export function PlanEditDialog({ plan, isOpen, onClose, onSave }: PlanEditDialogProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = React.useState<PlanFormState>({
    name: '',
    displayNameEn: '',
    description: '',
    monthlyPrice: 0,
    yearlyPrice: 0,
    monthlyTokens: 0,
    maxOffers: 0,
    maxAdAccounts: 0,
    features: [],
    isActive: true,
  });

  React.useEffect(() => {
    if (!plan) {
      return;
    }

    const marketingSource = plan.marketing_features as unknown;

    let features: string[] = [];
    let description = '';

    if (Array.isArray(marketingSource)) {
      features = marketingSource as string[];
    } else if (marketingSource && typeof marketingSource === 'object') {
      const marketingObject = marketingSource as {
        items?: unknown;
        summary?: unknown;
      };

      if (Array.isArray(marketingObject.items)) {
        features = marketingObject.items as string[];
      }

      if (typeof marketingObject.summary === 'string') {
        description = marketingObject.summary;
      }
    } else if (typeof marketingSource === 'string') {
      description = marketingSource;
    }

    setFormData({
      name: plan.display_name_zh || plan.display_name_en || '',
      displayNameEn: plan.display_name_en || '',
      description,
      monthlyPrice: plan.pricing?.monthly?.amount ?? 0,
      yearlyPrice: plan.pricing?.yearly?.amount ?? 0,
      monthlyTokens: plan.monthly_tokens ?? 0,
      maxOffers: plan.permissions?.offer_creation_limit ?? 0,
      maxAdAccounts: plan.permissions?.ads_account_binding_limit ?? 0,
      features,
      isActive: plan.is_active ?? true,
    });
  }, [plan]);

  if (!plan) {
    return null;
  }

  const handleChange = <Key extends keyof PlanFormState>(field: Key, value: PlanFormState[Key]) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const updatedPricing: Record<string, any> = {
      ...(plan.pricing ?? {}),
      monthly: {
        ...(plan.pricing?.monthly ?? {}),
        amount: formData.monthlyPrice,
      },
    };

    if (plan.pricing?.yearly || formData.yearlyPrice > 0) {
      updatedPricing.yearly = {
        ...(plan.pricing?.yearly ?? {}),
        amount: formData.yearlyPrice,
      };
    }

    const updatedPermissions: Record<string, any> = {
      ...(plan.permissions ?? {}),
      offer_creation_limit: formData.maxOffers,
      ads_account_binding_limit: formData.maxAdAccounts,
    };

    const originalMarketing = plan.marketing_features as unknown;
    let updatedMarketing = originalMarketing;

    if (Array.isArray(originalMarketing)) {
      updatedMarketing = formData.features;
    } else if (originalMarketing && typeof originalMarketing === 'object') {
      updatedMarketing = {
        ...(originalMarketing as Record<string, unknown>),
        summary: formData.description,
        items: formData.features,
      };
    } else if (formData.features.length > 0) {
      updatedMarketing = formData.features;
    } else if (formData.description) {
      updatedMarketing = formData.description;
    }

    onSave({
      display_name_zh: formData.name,
      display_name_en: formData.displayNameEn || formData.name,
      monthly_tokens: formData.monthlyTokens,
      pricing: updatedPricing,
      permissions: updatedPermissions,
      marketing_features: updatedMarketing,
      is_active: formData.isActive,
    });

    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('manage.subscriptionPlans.editPlan', 'Edit Plan')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">
                {t('manage.subscriptionPlans.planName', 'Plan Name')}
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(event) => handleChange('name', event.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-md"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium">
                {t('manage.subscriptionPlans.planNameEn', 'Plan Name (EN)')}
              </label>
              <input
                type="text"
                value={formData.displayNameEn}
                onChange={(event) => handleChange('displayNameEn', event.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-md"
                placeholder={t('manage.subscriptionPlans.planNameEnPlaceholder', 'Optional English name')}
              />
            </div>

            <div>
              <label className="text-sm font-medium">
                {t('manage.subscriptionPlans.description', 'Description')}
              </label>
              <textarea
                value={formData.description}
                onChange={(event) => handleChange('description', event.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-md"
                rows={3}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">
                {t('manage.subscriptionPlans.monthlyPrice', 'Monthly Price')}
              </label>
              <input
                type="number"
                value={formData.monthlyPrice}
                onChange={(event) => {
                  const value = Number.parseFloat(event.target.value);
                  handleChange('monthlyPrice', Number.isNaN(value) ? 0 : value);
                }}
                className="w-full mt-1 px-3 py-2 border rounded-md"
                min="0"
                step="0.01"
              />
            </div>

            <div>
              <label className="text-sm font-medium">
                {t('manage.subscriptionPlans.yearlyPrice', 'Yearly Price')}
              </label>
              <input
                type="number"
                value={formData.yearlyPrice}
                onChange={(event) => {
                  const value = Number.parseFloat(event.target.value);
                  handleChange('yearlyPrice', Number.isNaN(value) ? 0 : value);
                }}
                className="w-full mt-1 px-3 py-2 border rounded-md"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium">
                {t('manage.subscriptionPlans.monthlyTokens', 'Monthly Tokens')}
              </label>
              <input
                type="number"
                value={formData.monthlyTokens}
                onChange={(event) => {
                  const value = Number.parseInt(event.target.value, 10);
                  handleChange('monthlyTokens', Number.isNaN(value) ? 0 : value);
                }}
                className="w-full mt-1 px-3 py-2 border rounded-md"
                min="0"
              />
            </div>

            <div>
              <label className="text-sm font-medium">
                {t('manage.subscriptionPlans.maxOffers', 'Max Offers')}
              </label>
              <input
                type="number"
                value={formData.maxOffers}
                onChange={(event) => {
                  const value = Number.parseInt(event.target.value, 10);
                  handleChange('maxOffers', Number.isNaN(value) ? 0 : value);
                }}
                className="w-full mt-1 px-3 py-2 border rounded-md"
                min="0"
              />
            </div>

            <div>
              <label className="text-sm font-medium">
                {t('manage.subscriptionPlans.maxAdAccounts', 'Max Ad Accounts')}
              </label>
              <input
                type="number"
                value={formData.maxAdAccounts}
                onChange={(event) => {
                  const value = Number.parseInt(event.target.value, 10);
                  handleChange('maxAdAccounts', Number.isNaN(value) ? 0 : value);
                }}
                className="w-full mt-1 px-3 py-2 border rounded-md"
                min="0"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="plan-edit-active"
              checked={formData.isActive}
              onChange={(event) => handleChange('isActive', event.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="plan-edit-active" className="text-sm font-medium">
              {t('manage.subscriptionPlans.isActive', 'Active')}
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit">
              {t('common.save', 'Save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
