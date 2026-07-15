import { useState, useEffect, useCallback, useRef } from 'react';
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

  // Prevents onAuthStateChange from overwriting state mid-registration
  const isRegistering = useRef(false);

  // ── Load profile + company ──────────────────────────────────────────────
  // Returns true if found, false if no profile row yet, throws on real errors
  const loadProfile = useCallback(async (userId: string): Promise<boolean> => {
    const { data: prof, error: profErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profErr) {
      if (profErr.code === 'PGRST116') { // no rows — not a real error
        setProfile(null); setCompany(null);
        return false;
      }
      throw new Error(profErr.message);
    }

    if (!prof) { setProfile(null); setCompany(null); return false; }
    setProfile(prof as UserProfile);

    const { data: comp, error: compErr } = await supabase
      .from('companies')
      .select('*')
      .eq('id', prof.company_id)
      .single();

    if (compErr) throw new Error(compErr.message);
    if (!comp) { setCompany(null); return false; }
    setCompany(comp as CompanyProfile);
    return true;
  }, []);

  // ── Listen to auth state changes ────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setAuthUser(session.user);
        try { await loadProfile(session.user.id); } catch {}
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setAuthUser(session.user);
          // Skip during registration — registerCompany loads the profile explicitly
          // after inserts are done, avoiding a race condition where this callback
          // runs before the profile row exists and resets state to null.
          if (!isRegistering.current) {
            try { await loadProfile(session.user.id); } catch {}
          }
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
    isRegistering.current = true;

    try {
      // 1. Create auth user
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({ email, password });
      if (signUpErr) throw new Error(signUpErr.message);
      const userId = signUpData.user?.id;
      if (!userId) throw new Error('Sign up succeeded but no user ID returned.');

      // 2. Ensure a session exists for RLS writes.
      //    If signUp already returned a session (email confirm disabled), skip re-login.
      if (!signUpData.session) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) throw new Error(signInErr.message);
      }

      // 3. Create company — pre-generate UUID client-side so we don't need
      //    INSERT...RETURNING, which would also trigger the SELECT policy
      //    (my_company_id() returns NULL before the profile exists → RLS error).
      const companyId = crypto.randomUUID();
      const { error: compErr } = await supabase
        .from('companies')
        .insert({
          id: companyId,
          name: companyName,
          slug: companyName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          dispatch_lat: dispatchLat,
          dispatch_lng: dispatchLng,
          dispatch_address: '',
        });

      if (compErr) throw new Error(compErr.message);

      // 4. Create user profile
      const { error: profErr } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          company_id: companyId,
          email,
          full_name: fullName,
          role: 'owner',
          active: true,
        });

      if (profErr) throw new Error(profErr.message);

      // 5. Load profile — must happen before isRegistering is cleared
      const loaded = await loadProfile(userId);
      if (!loaded) throw new Error('Account created but profile could not be loaded. Please sign in manually.');

      setAuthUser(signUpData.user);
    } finally {
      isRegistering.current = false;
    }
  }, [loadProfile]);

  // ── Logout ───────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setAuthUser(null); setProfile(null); setCompany(null);
  }, []);

  return { authUser, profile, company, loading, error, login, registerCompany, logout };
}
