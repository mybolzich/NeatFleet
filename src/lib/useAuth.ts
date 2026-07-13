import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

export interface UserProfile {
  id: string;
  company_id: string;
  email: string;
  full_name: string;
  role: 'owner' | 'dispatcher' | 'driver';
  active: boolean;
}

export interface CompanyProfile {
  id: string;
  name: string;
  slug: string;
  dispatch_lat: number;
  dispatch_lng: number;
  dispatch_address: string;
}

export function useAuth() {
  const [authUser,  setAuthUser]  = useState<any>(null);
  const [profile,   setProfile]   = useState<UserProfile | null>(null);
  const [company,   setCompany]   = useState<CompanyProfile | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  // ── Load profile + company for a given user ID ──────────────────────────
  const loadProfile = useCallback(async (userId: string) => {
    try {
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profErr || !prof) {
        setProfile(null); setCompany(null); return;
      }
      setProfile(prof as UserProfile);

      const { data: comp, error: compErr } = await supabase
        .from('companies')
        .select('*')
        .eq('id', prof.company_id)
        .single();

      if (compErr || !comp) { setCompany(null); return; }
      setCompany(comp as CompanyProfile);
    } catch (e) {
      console.error('[useAuth] loadProfile error:', e);
      setProfile(null); setCompany(null);
    }
  }, []);

  // ── Listen to Supabase Auth state changes ───────────────────────────────
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setAuthUser(session.user);
        await loadProfile(session.user.id);
      }
      setLoading(false);
    });

    // Subscribe to future auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setAuthUser(session.user);
          await loadProfile(session.user.id);
        } else {
          setAuthUser(null);
          setProfile(null);
          setCompany(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  // ── Login ────────────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }, []);

  // ── Register company + owner ─────────────────────────────────────────────
  const registerCompany = useCallback(async (
    email: string,
    password: string,
    fullName: string,
    companyName: string,
    dispatchLat: number,
    dispatchLng: number,
  ) => {
    setError(null);

    // 1. Create auth user
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({ email, password });
    if (signUpErr) throw new Error(signUpErr.message);
    const userId = signUpData.user?.id;
    if (!userId) throw new Error('Sign up succeeded but no user ID returned.');

    // 2. Sign in immediately (session needed for RLS INSERT policies)
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr) throw new Error(signInErr.message);

    // 3. Create company
    const { data: comp, error: compErr } = await supabase
      .from('companies')
      .insert({
        name: companyName,
        slug: companyName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        dispatch_lat: dispatchLat,
        dispatch_lng: dispatchLng,
        dispatch_address: '',
      })
      .select()
      .single();

    if (compErr || !comp) throw new Error(compErr?.message || 'Failed to create company.');

    // 4. Create user profile — doc ID = auth user ID
    const { error: profErr } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        company_id: comp.id,
        email,
        full_name: fullName,
        role: 'owner',
        active: true,
      });

    if (profErr) throw new Error(profErr.message);

    // 5. Load profile into state
    await loadProfile(userId);
  }, [loadProfile]);

  // ── Logout ───────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setAuthUser(null); setProfile(null); setCompany(null);
  }, []);

  return {
    authUser,
    profile,
    company,
    loading,
    error,
    login,
    registerCompany,
    logout,
  };
}
