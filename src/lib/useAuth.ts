import { useState, useEffect, useCallback, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export interface CompanyProfile {
  id: string;
  name: string;
  slug: string;
  dispatchLat: number;
  dispatchLng: number;
  dispatchAddress: string;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: 'owner' | 'dispatcher' | 'driver';
  companyId: string;
}

export function useAuth() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isRegistering = useRef(false);

  const loadProfile = useCallback(async (userId: string): Promise<boolean> => {
    const { data: profileRow, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profileErr) {
      console.error('[AUTH] Error loading profile:', profileErr);
      return false;
    }
    if (!profileRow) {
      console.warn('[AUTH] No profile found for user:', userId);
      return false;
    }

    setProfile({
      id: userId,
      email: profileRow.email,
      fullName: profileRow.full_name,
      role: profileRow.role,
      companyId: profileRow.company_id,
    });

    const { data: companyRow, error: companyErr } = await supabase
      .from('companies')
      .select('*')
      .eq('id', profileRow.company_id)
      .maybeSingle();

    if (companyErr) {
      console.error('[AUTH] Error loading company:', companyErr);
      return false;
    }
    if (!companyRow) {
      console.warn('[AUTH] No company found:', profileRow.company_id);
      return false;
    }

    setCompany({
      id: companyRow.id,
      name: companyRow.name,
      slug: companyRow.slug,
      dispatchLat: companyRow.dispatch_lat,
      dispatchLng: companyRow.dispatch_lng,
      dispatchAddress: companyRow.dispatch_address ?? '',
    });

    return true;
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (isRegistering.current) return;

        const user = session?.user ?? null;

        if (!user) {
          setAuthUser(null);
          setProfile(null);
          setCompany(null);
          setLoading(false);
          return;
        }

        setAuthUser(user);
        try {
          await loadProfile(user.id);
        } catch (err) {
          console.error('[AUTH] profile load error:', err);
        } finally {
          setLoading(false);
        }
      }
    );

    // Resolve any pre-existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

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
      const { data: authData, error: signUpErr } = await supabase.auth.signUp({ email, password });
      if (signUpErr) throw signUpErr;
      if (!authData.user) throw new Error('User creation failed.');

      const userId = authData.user.id;
      const companyId = crypto.randomUUID();

      const { error: companyErr } = await supabase.from('companies').insert({
        id: companyId,
        name: companyName,
        slug: companyName.toLowerCase().replace(/\s+/g, '-'),
        dispatch_lat: dispatchLat,
        dispatch_lng: dispatchLng,
        dispatch_address: '',
      });
      if (companyErr) throw companyErr;

      const { error: profileErr } = await supabase.from('profiles').insert({
        id: userId,
        company_id: companyId,
        email,
        full_name: fullName,
        role: 'owner',
      });
      if (profileErr) throw profileErr;

      // Set state manually so the app transitions immediately
      setAuthUser(authData.user);
      setProfile({ id: userId, email, fullName, role: 'owner', companyId });
      setCompany({
        id: companyId,
        name: companyName,
        slug: companyName.toLowerCase().replace(/\s+/g, '-'),
        dispatchLat,
        dispatchLng,
        dispatchAddress: '',
      });
      setLoading(false);
    } catch (err: any) {
      setError(err?.message ?? 'Registration failed.');
      throw err;
    } finally {
      isRegistering.current = false;
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) throw signInErr;
    } catch (err: any) {
      const msg = err?.message ?? 'Login failed.';
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (err: any) {
      console.error('[AUTH] logout error:', err);
    }
  }, []);

  return { authUser, profile, company, loading, error, login, registerCompany, logout };
}
