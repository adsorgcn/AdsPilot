/**
 * Navbar Types
 */

import type { ComponentType } from 'react';

export type AppLink = {
  label: string;
  href: string;
  Icon?: ComponentType<{ className?: string }>;
};

export type PublicLink = {
  label: string;
  href: string;
};

export interface NavbarProps {
  className?: string;
}
