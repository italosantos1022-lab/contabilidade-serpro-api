import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate configuration early so deployment failures are explicit
const missing: string[] = [];
if (!supabaseUrl) missing.push('SUPABASE_URL');
if (!supabaseKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');

if (missing.length) {
  throw new Error(`Missing Supabase configuration: ${missing.join(', ')}`);
}

export const supabase = createClient(supabaseUrl!, supabaseKey!);
