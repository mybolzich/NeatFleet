import { useState, useEffect, useCallback } from 'react';
import { account, databases, DB_ID, COLLECTIONS, ID, Query } from './appwrite';

export interface UserProfile {
  $id: string;
  companyId: string;
  email: string;
  fullName: string;
  role: 'owner' | 'dispatcher' | 'driver';
  phone: string;
  active: boolean;
}

export interface CompanyProfile {
  $id: string;
  name: string;
  slug: string;
  dispatchLat: number;
  dispatchLng: number;
  dispatchAddress: string;
}

export function useAuth() {
  const [authUser, setAuthUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async (userId: string) => {
    try {
      console.log('[AUTH] loadProfile: starting for userId=', userId);
      const res = await databases.listDocuments(DB_ID, COLLECTIONS.users, [
        Query.equal('$id', userId),
      ]);
      console.log('[AUTH] listDocuments result:', res);
      
      // Appwrite documents use companyId field but the user doc ID = auth user ID (set at creation)
      const userDoc = await databases.getDocument(DB_ID, COLLECTIONS.users, userId).catch((err) => {
        console.error('[AUTH] getDocument failed for user:', err);
        return null;
      });
      console.log('[AUTH] userDoc fetched:', userDoc);
      
      if (!userDoc) {
        console.log('[AUTH] userDoc is null, clearing profile/company');
        setProfile(null);
        setCompany(null);
        setLoading(false);
        return;
      }
      setProfile(userDoc as unknown as UserProfile);

      console.log('[AUTH] fetching company with companyId=', (userDoc as any).companyId);
      const companyDoc = await databases.getDocument(DB_ID, COLLECTIONS.companies, (userDoc as any).companyId);
      console.log('[AUTH] companyDoc fetched:', companyDoc);
      setCompany(companyDoc as unknown as CompanyProfile);
    } catch (e) {
      console.error('[AUTH] loadProfile error:', e);
      setProfile(null);
      setCompany(null);
    } finally {
      console.log('[AUTH] loadProfile complete, setting loading=false');
      setLoading(false);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    console.log('[AUTH] refreshSession: starting');
    setLoading(true);
    try {
      const user = await account.get();
      console.log('[AUTH] got auth user:', user.$id);
      setAuthUser(user);
      console.log('[AUTH] calling loadProfile...');
      await loadProfile(user.$id);
      console.log('[AUTH] refreshSession complete');
    } catch (err: any) {
      console.error('[AUTH] refreshSession error:', err);
      setAuthUser(null);
      setProfile(null);
      setCompany(null);
      setLoading(false);
    }
  }, [loadProfile]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    await account.createEmailPasswordSession(email, password);
    await refreshSession();
  }, [refreshSession]);

  const registerCompany = useCallback(async (
    email: string,
    password: string,
    fullName: string,
    companyName: string,
    dispatchLat: number,
    dispatchLng: number
  ) => {
    setError(null);
    console.log('[AUTH] registerCompany: starting');
    
    try {
      // 1. Create the Appwrite auth user
      console.log('[AUTH] creating auth user...');
      const newUser = await account.create(ID.unique(), email, password, fullName);
      console.log('[AUTH] auth user created:', newUser.$id);

      // 2. Log in immediately (Appwrite requires an active session to write documents
      //    under "users" role permissions)
      console.log('[AUTH] creating session...');
      await account.createEmailPasswordSession(email, password);
      console.log('[AUTH] session created');

      // 3. Create the company document
      console.log('[AUTH] creating company document...');
      const companyDoc = await databases.createDocument(DB_ID, COLLECTIONS.companies, ID.unique(), {
        name: companyName,
        slug: companyName.toLowerCase().replace(/\s+/g, '-'),
        dispatchLat,
        dispatchLng,
        dispatchAddress: '',
      });
      console.log('[AUTH] company document created:', companyDoc.$id);

      // 4. Create the user profile document — document ID matches the auth user ID
      //    so we can look it up directly with getDocument(userId) on future logins
      console.log('[AUTH] creating user profile document with ID=', newUser.$id);
      await databases.createDocument(DB_ID, COLLECTIONS.users, newUser.$id, {
        companyId: companyDoc.$id,
        email,
        fullName,
        role: 'owner',
        phone: '',
        active: true,
      });
      console.log('[AUTH] user profile document created');

      console.log('[AUTH] calling refreshSession...');
      await refreshSession();
      console.log('[AUTH] refreshSession complete');
    } catch (err: any) {
      console.error('[AUTH] registerCompany error:', err);
      throw err;
    }
  }, [refreshSession]);

  const logout = useCallback(async () => {
    try { await account.deleteSession('current'); } catch {}
    setAuthUser(null);
    setProfile(null);
    setCompany(null);
  }, []);

  return { authUser, profile, company, loading, error, login, registerCompany, logout, refreshSession };
}
