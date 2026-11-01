import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const isSupabaseConfigured = Boolean(url && key && !key.includes('replace-with'));
export const supabase: SupabaseClient | null = isSupabaseConfigured ? createClient(url!, key!, { auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } }) : null;
if (Platform.OS !== 'web' && supabase) AppState.addEventListener('change', (state) => state === 'active' ? supabase.auth.startAutoRefresh() : supabase.auth.stopAutoRefresh());
