#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '../..');

// Load from apps/frontend/.env.local
config({ path: resolve(rootDir, 'apps/frontend/.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TEST_USER_ID = '37fd3629-a06a-47c8-b33a-31944afaa14c';
const TEST_USER_EMAIL = 'test-user@autoads.dev';

async function createUserProfile() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing environment variables:');
    if (!SUPABASE_URL) console.error('  - NEXT_PUBLIC_SUPABASE_URL');
    if (!SUPABASE_SERVICE_ROLE_KEY) console.error('  - SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log('🔍 Checking if user_profile exists...\n');

  // Check if profile exists
  const { data: existingProfile, error: checkError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', TEST_USER_ID)
    .single();

  if (existingProfile) {
    console.log('✅ User profile already exists:');
    console.log(JSON.stringify(existingProfile, null, 2));
    return;
  }

  console.log('📝 Creating user_profile for test user...\n');

  const profileData = {
    user_id: TEST_USER_ID,
    email: TEST_USER_EMAIL,
    display_name: 'Test User',
    avatar_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: newProfile, error: insertError } = await supabase
    .from('user_profiles')
    .insert([profileData])
    .select()
    .single();

  if (insertError) {
    console.error('❌ Failed to create user_profile:');
    console.error(insertError);
    process.exit(1);
  }

  console.log('✅ User profile created successfully:');
  console.log(JSON.stringify(newProfile, null, 2));
}

createUserProfile();
