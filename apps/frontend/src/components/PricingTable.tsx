'use client';

import { useState } from 'react';
import classNames from 'clsx';
import { CheckCircleIcon, SparklesIcon } from '@heroicons/react/24/outline';

import Heading from '~/core/ui/Heading';
import Button from '~/core/ui/Button';
import If from '~/core/ui/If';
import Trans from '~/core/ui/Trans';

import configuration from '~/configuration';
import { usePricingPlans } from '~/hooks/useSubscriptionConfig';
import { useTranslation } from 'react-i18next';

interface CheckoutButtonProps {
  readonly stripePriceId?: string;
  readonly recommended?: boolean;
}

interface PricingItemProps {
  selectable: boolean;
  product: {
    name: string;
    features: string[];
    description: string;
    recommended?: boolean;
    badge?: string;
  };
  plan: {
    name: string;
    stripePriceId?: string;
    price: string;
    label?: string;
    href?: string;
  };
}

const STRIPE_PRODUCTS = configuration.stripe.products;

const STRIPE_PLANS = STRIPE_PRODUCTS.reduce<string[]>((acc, product) => {
  product.plans.forEach((plan) => {
    if (plan.name && !acc.includes(plan.name)) {
      acc.push(plan.name);
    }
  });

  return acc;
}, []);

function PricingTable(
  props: React.PropsWithChildren<{
    CheckoutButton?: React.ComponentType<CheckoutButtonProps>;
  }>,
) {
  const { i18n, t } = useTranslation();
  const currentLanguage = i18n.language || 'zh-CN';
  const currency = currentLanguage.startsWith('zh') ? 'CNY' : 'USD';
  
  // Try to use dynamic pricing from API
  const { plans: dynamicPlans, isLoading } = usePricingPlans(currency);
  
  // Fallback to static configuration if API fails
  const useDynamicPricing = !isLoading && dynamicPlans && dynamicPlans.length > 0;
  
  const [planVariant, setPlanVariant] = useState<string>(STRIPE_PLANS[0]);

  // If using dynamic pricing, convert to the format expected by the component
  if (useDynamicPricing) {
    const dynamicProducts = dynamicPlans!.map((plan) => {
      // Map plan to product format
      const productName = plan.plan.charAt(0).toUpperCase() + plan.plan.slice(1);
      
      return {
        name: productName,
        description: plan.description,
        recommended: plan.recommended,
        badge: plan.badge,
        features: [], // Features will be loaded from i18n
        plans: [
          {
            name: 'Monthly',
            stripePriceId: plan.monthlyStripePriceId,
            price: plan.monthlyPrice,
            label: planVariant === 'Monthly' ? undefined : undefined,
          },
          {
            name: 'Yearly',
            stripePriceId: plan.yearlyStripePriceId,
            price: plan.yearlyPrice,
            label: plan.yearlyDiscount ? `Save ${plan.yearlyDiscount}%` : undefined,
          },
        ],
      };
    });

    return (
      <section 
        className={'flex flex-col space-y-12'}
        aria-labelledby="pricing-heading"
      >
        <h2 id="pricing-heading" className="sr-only">
          {t('common:pricing.title', 'Pricing Plans')}
        </h2>
        
        <div className={'flex justify-center'} role="group" aria-label={t('common:pricing.billingCycle', 'Billing cycle selection')}>
          <PlansSwitcher
            plans={STRIPE_PLANS}
            plan={planVariant}
            setPlan={setPlanVariant}
          />
        </div>

        <div
          className={
            'flex flex-col items-stretch space-y-8 lg:space-y-0' +
            ' justify-center lg:flex-row lg:gap-6 xl:gap-8'
          }
          role="list"
          aria-label={t('common:pricing.availablePlans', 'Available subscription plans')}
        >
          {dynamicProducts.map((product) => {
            const plan =
              product.plans.find((item) => item.name === planVariant) ??
              product.plans[0];

            return (
              <PricingItem
                selectable
                key={plan.stripePriceId ?? plan.name}
                plan={plan}
                product={product}
                CheckoutButton={props.CheckoutButton}
              />
            );
          })}
        </div>
      </section>
    );
  }

  // Fallback to static configuration
  return (
    <section 
      className={'flex flex-col space-y-12'}
      aria-labelledby="pricing-heading"
    >
      <h2 id="pricing-heading" className="sr-only">
        {t('common:pricing.title', 'Pricing Plans')}
      </h2>
      
      <div className={'flex justify-center'} role="group" aria-label={t('common:pricing.billingCycle', 'Billing cycle selection')}>
        <PlansSwitcher
          plans={STRIPE_PLANS}
          plan={planVariant}
          setPlan={setPlanVariant}
        />
      </div>

      <div
        className={
          'flex flex-col items-stretch space-y-8 lg:space-y-0' +
          ' justify-center lg:flex-row lg:gap-6 xl:gap-8'
        }
        role="list"
        aria-label={t('common:pricing.availablePlans', 'Available subscription plans')}
      >
        {STRIPE_PRODUCTS.map((product) => {
          const plan =
            product.plans.find((item) => item.name === planVariant) ??
            product.plans[0];

          return (
            <PricingItem
              selectable
              key={plan.stripePriceId ?? plan.name}
              plan={plan}
              product={product}
              CheckoutButton={props.CheckoutButton}
            />
          );
        })}
      </div>
    </section>
  );
}

export default PricingTable;

PricingTable.Item = PricingItem;
PricingTable.Price = Price;
PricingTable.FeaturesList = FeaturesList;

function PricingItem(
  props: React.PropsWithChildren<
    PricingItemProps & {
      CheckoutButton?: React.ComponentType<CheckoutButtonProps>;
    }
  >,
) {
  const recommended = props.product.recommended ?? false;

  return (
    <article
      data-cy={'subscription-plan'}
      role="listitem"
      aria-label={`${props.product.name} plan`}
      className="relative"
    >
      {recommended && (
        <>
          {/* Glow effect for recommended plan */}
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-20 blur-xl" />
          
          {/* Recommended badge */}
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
            <div className="flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-1.5 text-sm font-medium text-white shadow-lg">
              <SparklesIcon className="h-4 w-4" />
              <span>{props.product.badge || 'Recommended'}</span>
            </div>
          </div>
        </>
      )}
      
      <div
        className={classNames(
          `
           relative flex w-full flex-col justify-between space-y-6 rounded-xl
           p-8 lg:w-4/12 xl:p-10 2xl:w-3/12 xl:max-w-md
           transition-all duration-300 min-h-[500px]
           bg-white/80 dark:bg-slate-900/80 backdrop-blur-md
           border shadow-lg hover:shadow-xl hover:scale-[1.02]
        `,
          {
            ['border-white/20 dark:border-slate-700/30']: !recommended,
            ['border-blue-300/30 dark:border-blue-700/30']: recommended,
          },
        )}
      >
      <div className={'flex flex-col space-y-3'}>
        <div className={'flex items-center justify-between space-x-4'}>
          <Heading type={2}>
            <b className={'font-semibold text-lg lg:text-xl'}>{props.product.name}</b>
          </Heading>

          <If condition={props.product.badge}>
            <div
              className={classNames(
                `rounded-full py-1 px-3 text-xs font-semibold flex items-center gap-1`,
                {
                  ['text-primary-foreground bg-primary']: recommended,
                  ['bg-gray-50 text-gray-500 dark:text-gray-800']: !recommended,
                },
              )}
              role="status"
              aria-label={props.product.badge}
            >
              <If condition={recommended}>
                <SparklesIcon className={'h-3.5 w-3.5'} aria-hidden="true" />
              </If>
              <span>
                <Trans
                  i18nKey={`common:plans.${props.product.name}.badge`}
                  defaults={props.product.badge}
                />
              </span>
            </div>
          </If>
        </div>

        <span className={'text-base text-gray-600 dark:text-gray-300 leading-relaxed'}>
          <Trans
            i18nKey={`common:plans.${props.product.name}.description`}
            defaults={props.product.description}
          />
        </span>
      </div>

      <div className={'flex flex-col gap-2'}>
        <div className={'flex items-end space-x-1'}>
          <Price>{props.plan.price}</Price>

          <If condition={props.plan.name}>
            <span
              className={classNames(
                `text-lg lowercase text-gray-500 dark:text-gray-400`,
              )}
            >
              <span>/</span>
              <span>{props.plan.name}</span>
            </span>
          </If>
        </div>

        <If condition={props.plan.label}>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
            </svg>
            <Trans i18nKey={props.plan.label} defaults={props.plan.label} />
          </span>
        </If>
      </div>

      <div className={'text-current flex-1'}>
        <FeaturesList features={props.product.features} />
      </div>

      <div className={'mt-auto pt-4'}>
        <If condition={props.selectable}>
          <If
            condition={props.plan.stripePriceId && props.CheckoutButton}
            fallback={
              <DefaultCheckoutButton
                recommended={recommended}
                plan={props.plan}
              />
            }
          >
            {(CheckoutButton) => (
              <CheckoutButton
                recommended={recommended}
                stripePriceId={props.plan.stripePriceId}
              />
            )}
          </If>
        </If>
      </div>
      </div>
    </article>
  );
}

function FeaturesList(
  props: React.PropsWithChildren<{
    features: string[];
  }>,
) {
  return (
    <ul className={'flex flex-col space-y-3'} aria-label="Plan features">
      {props.features.map((feature) => {
        return (
          <ListItem key={feature}>
            <Trans
              i18nKey={`common:plans.features.${feature}`}
              defaults={feature}
            />
          </ListItem>
        );
      })}
    </ul>
  );
}

function Price({ children }: React.PropsWithChildren) {
  // little trick to re-animate the price when switching plans
  const key = Math.random();

  return (
    <div
      key={key}
      className={`animate-in duration-500 slide-in-from-left-4 fade-in`}
      role="text"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className={'text-3xl font-bold lg:text-4xl xl:text-5xl'}>
        {children}
      </span>
    </div>
  );
}

function ListItem({ children }: React.PropsWithChildren) {
  return (
    <li className={'flex items-start space-x-3 font-medium leading-relaxed'}>
      <div aria-hidden="true">
        <CheckCircleIcon className={'h-5'} />
      </div>

      <span className={'text-sm text-gray-700 dark:text-gray-200 flex-1'}>
        {children}
      </span>
    </li>
  );
}

function PlansSwitcher(
  props: React.PropsWithChildren<{
    plans: string[];
    plan: string;
    setPlan: (plan: string) => void;
  }>,
) {
  return (
    <div className={'flex'} role="radiogroup">
      {props.plans.map((plan, index) => {
        const selected = plan === props.plan;
        const isYearly = plan === 'Yearly' || plan === '年付';

        const className = classNames('focus:!ring-2 focus:!ring-primary focus:!ring-offset-2 relative', {
          'rounded-r-none border-r-transparent': index === 0,
          'rounded-l-none': index === props.plans.length - 1,
          ['hover:bg-gray-50 dark:hover:bg-background/80']: !selected,
          ['text-primary-800 dark:text-primary-500 font-semibold' +
          ' hover:bg-background hover:text-initial']: selected,
        });

        return (
          <div key={plan} className="relative">
            <Button
              variant={'outline'}
              className={className}
              onClick={() => props.setPlan(plan)}
              role="radio"
              aria-checked={selected}
              aria-label={`${plan} billing cycle${isYearly ? ', includes discount' : ''}`}
            >
              <span className={'flex space-x-1 items-center'}>
                <If condition={selected}>
                  <CheckCircleIcon className={'h-4'} aria-hidden="true" />
                </If>

                <span>
                  <Trans i18nKey={`common:plans.${plan}`} defaults={plan} />
                </span>
              </span>
            </Button>

            <If condition={isYearly}>
              <span 
                className="absolute -top-3 -right-2 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground shadow-md"
                role="status"
                aria-label="Discount available"
              >
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
                </svg>
                <Trans i18nKey="common:plans.discount" defaults="-50%" />
              </span>
            </If>
          </div>
        );
      })}
    </div>
  );
}

function DefaultCheckoutButton(
  props: React.PropsWithChildren<{
    plan: PricingItemProps['plan'];
    recommended?: boolean;
  }>,
) {
  const linkHref =
    props.plan.href ??
    `${configuration.paths.signUp}?utm_source=${props.plan.stripePriceId}`;

  const label = props.plan.label ?? 'common:getStarted';

  return (
    <div className={'w-full'}>
      <Button
        block
        size="lg"
        href={linkHref}
        variant={props.recommended ? 'default' : 'outline'}
        className="h-12 text-base font-semibold"
        aria-label={`Get started with ${props.plan.name} plan`}
      >
        <Trans i18nKey={label} defaults={label} />
      </Button>
    </div>
  );
}
