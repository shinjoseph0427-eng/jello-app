import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { getMyProfile, type Friend } from '@/features/jello/api';
import { supabase } from '@/lib/supabase';

type AuthValue = {
  session: Session | null;
  loading: boolean;
  profile: Friend | null;
  profileLoading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue>({ session: null, loading: true, profile: null, profileLoading: true, refreshProfile: async () => undefined, signOut: async () => undefined });

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [profile, setProfile] = useState<Friend | null>(null);
  const [profileLoading, setProfileLoading] = useState(Boolean(supabase));

  const loadProfile = useCallback(async (activeSession: Session | null) => {
    if (!activeSession) { setProfile(null); setProfileLoading(false); return; }
    setProfileLoading(true);
    try { setProfile(await getMyProfile()); }
    catch { setProfile(null); }
    finally { setProfileLoading(false); }
  }, []);
  const refreshProfile = useCallback(async () => loadProfile(session), [loadProfile, session]);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); void loadProfile(data.session); });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => { setSession(nextSession); setLoading(false); void loadProfile(nextSession); });
    return () => data.subscription.unsubscribe();
  }, [loadProfile]);

  const value = useMemo<AuthValue>(() => ({
    session,
    loading,
    profile,
    profileLoading,
    refreshProfile,
    signOut: async () => { if (supabase) await supabase.auth.signOut(); },
  }), [session, loading, profile, profileLoading, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }
