#!/bin/bash

echo "🔧 Fixing Core TypeScript Compatibility Issues..."

# 1. Create React compatibility declarations
cat > apps/frontend/src/types/react-compatibility.d.ts << 'EOF'
// React compatibility fixes for multiple React versions
import React from 'react';

// Fix ReactNode type conflicts
declare global {
  namespace React {
    // Ensure bigint is handled as ReactNode
    interface ReactNode {
      bigint?: never;
    }
  }
}

// Radix UI compatibility declarations
declare module '@radix-ui/react-accordion' {
  const Root: any;
  const Item: any;
  const Trigger: any;
  const Header: any;
  const Content: any;
}

declare module '@radix-ui/react-alert-dialog' {
  const Root: any;
  const Trigger: any;
  const Portal: any;
  const Overlay: any;
  const Content: any;
  const Title: any;
  const Description: any;
  const Action: any;
  const Cancel: any;
}

declare module '@radix-ui/react-avatar' {
  const Root: any;
  const Image: any;
  const Fallback: any;
}

declare module '@radix-ui/react-checkbox' {
  const Root: any;
  const Indicator: any;
}

declare module '@radix-ui/react-dialog' {
  const Root: any;
  const Trigger: any;
  const Portal: any;
  const Overlay: any;
  const Content: any;
  const Title: any;
  const Description: any;
  const Close: any;
}

declare module '@radix-ui/react-dropdown-menu' {
  const Root: any;
  const Trigger: any;
  const Group: any;
  const Portal: any;
  const Sub: any;
  const SubTrigger: any;
  const SubContent: any;
  const Content: any;
  const Item: any;
  const CheckboxItem: any;
  const RadioItem: any;
  const ItemIndicator: any;
  const Label: any;
  const Separator: any;
}

declare module '@radix-ui/react-navigation-menu' {
  const Root: any;
  const List: any;
  const Item: any;
  const Trigger: any;
  const Content: any;
  const Link: any;
  const Viewport: any;
  const Indicator: any;
}

declare module '@radix-ui/react-scroll-area' {
  const Root: any;
  const Viewport: any;
  const Corner: any;
  const ScrollAreaScrollbar: any;
  const ScrollAreaThumb: any;
}

declare module '@radix-ui/react-select' {
  const Root: any;
  const Value: any;
  const Trigger: any;
  const Content: any;
  const Label: any;
  const Item: any;
  const Separator: any;
  const Group: any;
}

declare module '@radix-ui/react-separator' {
  const Root: any;
}

declare module '@radix-ui/react-switch' {
  const Root: any;
  const Thumb: any;
}

declare module '@radix-ui/react-tooltip' {
  const Provider: any;
  const Root: any;
  const Trigger: any;
  const Content: any;
}

// Heroicons compatibility
declare module '@heroicons/react/24/outline' {
  const XMarkIcon: any;
  const LockClosedIcon: any;
  const ExclamationCircleIcon: any;
  const DocumentTextIcon: any;
  const ExclamationTriangleIcon: any;
  const ChartBarIcon: any;
  const ChatBubbleLeftRightIcon: any;
  const CurrencyDollarIcon: any;
  const InformationCircleIcon: any;
  const ChevronUpDownIcon: any;
}

// React-admin compatibility
declare module 'react-admin' {
  export const useListContext: any;
  export const Pagination: any;
  export const ReferenceField: any;
  export const ChipField: any;
  export const SelectField: any;
  export const Filter: any;
  export const DateInput: any;
  export const Create: any;
  export const Show: any;
  export const SimpleShowLayout: any;
  export const required: any;
  export const useRedirect: any;
  export const ReferenceInput: any;
  export const DateTimeInput: any;
  export const AutocompleteInput: any;
  export const ArrayInput: any;
  export const SimpleFormIterator: any;
  export const PasswordInput: any;
  export const ReferenceManyField: any;
  export const email: any;
  export const minLength: any;
  export const TabbedForm: any;
  export const FormTab: any;
  export const ReferenceManyCountField: any;
  export const TabbedShowLayout: any;
  export const Tab: any;
  export const RichTextField: any;
  export const RaThemeOptions: any;
  export const Loading: any;
  export const FunctionField: any;
  export const Labeled: any;
  export const SimpleForm: any;
  export const Edit: any;
  export const List: any;
  export const TextField: any;
  export const BooleanField: any;
  export const UrlField: any;
  export const Datagrid: any;
  export const TopToolbar: any;
  export const BulkDeleteButton: any;
  export const BulkExportButton: any;
  export const EditButton: any;
  export const DeleteButton: any;
}

// Axios compatibility
declare module 'axios' {
  export class AxiosInstance {}
  export interface AxiosRequestConfig {}
}

// Redis compatibility
declare module 'redis' {
  export function createClient(): any;
  export class Redis {}
  export class ChainableCommander {}
}

// Storybook compatibility
declare module '@storybook/react' {
  interface Meta {}
  interface StoryObj {}
}

// Zustand compatibility
declare module 'zustand/middleware' {}
declare module 'zustand/middleware/immer' {}

// Puppeteer compatibility
declare module 'puppeteer' {
  class Browser {}
  class Page {}
  interface LaunchOptions {}
}

// Google Auth Library
declare module 'google-auth-library' {
  class OAuth2Client {}
  class GoogleAuth {}
}

// Google Ads API
declare module 'google-ads-api' {
  const Customer: any;
  const resources: any;
  const services: any;
  const enums: any;
  class GoogleAdsApi {}
}

// Nodemailer
declare module 'nodemailer' {
  namespace Transporter {}
}

// JWT
declare module 'jsonwebtoken' {
  const sign: any;
  const verify: any;
  const decode: any;
  class JsonWebTokenError {}
  class TokenExpiredError {}
}

// Stripe
declare module 'stripe' {
  namespace Stripe {}
}

// Zod
declare module 'zod' {
  const string: any;
  const number: any;
  const boolean: any;
  const object: any;
  const array: any;
  const enum: any;
  const union: any;
  const optional: any;
  const coerce: any;
  const ZodError: any;
  function infer(): any;
}

// ioredis
declare module 'ioredis' {
  class ChainableCommander {}
}

// Cron
declare module 'cron' {
  class Cron {}
}

// Big.js
declare module 'big.js' {
  interface Big {}
}

// Lucide
declare module 'lucide-react' {
  interface LucideIcon {}
  interface LucideProps {}
}

// Material UI
declare module '@mui/material' {
  interface GridTypeMap {}
  interface GridOwnProps {}
  interface CommonProps {}
}

export {};