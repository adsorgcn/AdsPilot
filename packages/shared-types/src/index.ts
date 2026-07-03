/**
 * @gm/shared-types
 *
 * Shared TypeScript types generated from OpenAPI specifications.
 * All types are generated from `.kiro/specs/google-monetize-system/openapi/*.yaml`
 *
 * @example
 * ```typescript
 * import type { paths as AdscenterPaths } from '@gm/shared-types/adscenter'
 * import type { components as BillingComponents } from '@gm/shared-types/billing'
 *
 * type Account = BillingComponents['schemas']['Account']
 * type ListAccountsResponse = AdscenterPaths['/api/v1/adscenter/accounts']['get']['responses']['200']
 * ```
 */

// Re-export all service types for convenience
export type { paths as AdscenterPaths, components as AdscenterComponents } from './adscenter/types'
export type { paths as BatchopenPaths, components as BatchopenComponents } from './batchopen/types'
export type { paths as BillingPaths, components as BillingComponents } from './billing/types'
export type { paths as ConsolePaths, components as ConsoleComponents } from './console/types'
export type { paths as NotificationsPaths, components as NotificationsComponents } from './notifications/types'
export type { paths as OfferPaths, components as OfferComponents } from './offer/types'
export type { paths as RecommendationsPaths, components as RecommendationsComponents } from './recommendations/types'
export type { paths as SiterankPaths, components as SiterankComponents } from './siterank/types'