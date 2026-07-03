/**
 * User API Client
 *
 * This file provides API-based methods to replace direct database access
 * in compliance with the architecture requirements.
 */

import configuration from '~/configuration';
import { createAuthenticatedRequest } from './auth';

export interface UserProfile {
  displayName?: string;
  photoUrl?: string;
  name?: string;
  email?: string;
  timezone?: string;
  language?: string;
  preferences?: Record<string, any>;
}

/**
 * Update user profile via API Gateway
 * Replaces direct Supabase database operations
 */
export async function updateUserProfile(userId: string, profileData: Partial<UserProfile>) {
  const token = await createAuthenticatedRequest();

  const response = await fetch(`${configuration.site.siteUrl}/api/v1/user/profile`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      userId,
      ...profileData
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Failed to update user profile: ${response.status}`);
  }

  return response.json();
}

/**
 * Get user profile via API Gateway
 */
export async function getUserProfile(userId: string) {
  const token = await createAuthenticatedRequest();

  const response = await fetch(`${configuration.site.siteUrl}/api/v1/user/profile?userId=${userId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Failed to get user profile: ${response.status}`);
  }

  return response.json();
}

/**
 * Update user preferences via API Gateway
 */
export async function updateUserPreferences(userId: string, preferences: Record<string, any>) {
  const token = await createAuthenticatedRequest();

  const response = await fetch(`${configuration.site.siteUrl}/api/v1/user/preferences`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      userId,
      preferences
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Failed to update user preferences: ${response.status}`);
  }

  return response.json();
}