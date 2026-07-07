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
      const res = await databases.listDocuments(DB_ID, COLLECTIONS.users, [
        Query.equal('$id', userId),
      ]);
      // Appwrite documents use companyId field but the user doc ID = auth user ID (set at creation)
      const userDoc = await databases.getDocument(DB_ID, COLLECTIONS.users, userId).catch(() => null);
      if (!userDoc) {
        setProfile(null);
        setCompany(null);
        setLoading(false);
        return;
      }
      setProfile(userDoc as unknown as UserProfile);

      const companyDoc = await databases.getDocument(DB_ID, COLLECTIONS.companies, (userDoc as any).companyId);
      setCompany(companyDoc as unknown as CompanyProfile);
    } catch (e) {
      setProfile(null);
      setCompany(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    setLoading(true);
    try {
      const user = await account.get();
      setAuthUser(user);
      await loadProfile(user.$id);
    } catch {
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
    // 1. Create the Appwrite auth user
    const newUser = await account.create(ID.unique(), email, password, fullName);

    // 2. Log in immediately (Appwrite requires an active session to write documents
    //    under "users" role permissions)
    await account.createEmailPasswordSession(email, password);

    // 3. Create the company document
    const companyDoc = await databases.createDocument(DB_ID, COLLECTIONS.companies, ID.unique(), {
      name: companyName,
      slug: companyName.toLowerCase().replace(/\s+/g, '-'),
      dispatchLat,
      dispatchLng,
      dispatchAddress: '',
    });

    // 4. Create the user profile document — document ID matches the auth user ID
    //    so we can look it up directly with getDocument(userId) on future logins
    await databases.createDocument(DB_ID, COLLECTIONS.users, newUser.$id, {
      companyId: companyDoc.$id,
      email,
      fullName,
      role: 'owner',
      phone: '',
      active: true,
    });

    await refreshSession();
  }, [refreshSession]);

  const logout = useCallback(async () => {
    try { await account.deleteSession('current'); } catch {}
    setAuthUser(null);
    setProfile(null);
    setCompany(null);
  }, []);

  return { authUser, profile, company, loading, error, login, registerCompany, logout, refreshSession };
}
