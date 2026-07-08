import { useState, useEffect, useCallback } from 'react';
import { initializeApp, getApps, App } from 'firebase/app';
import {
  getAuth,
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  Firestore,
} from 'firebase/firestore';

// Use the same Firebase project as ServiRoute (already authorized for GitHub Pages)
const firebaseConfig = {
  apiKey: 'AIzaSyDSIcTiBswVGF2oCSzUocAPEN3qi_muYls',
  authDomain: 'serviroute-3ec0d.firebaseapp.com',
  projectId: 'serviroute-3ec0d',
  storageBucket: 'serviroute-3ec0d.firebasestorage.app',
  messagingSenderId: '203389465925',
  appId: '1:203389465925:web:31658625175d7a5ac53a2c',
};

let firebaseApp: App | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

function initFirebase() {
  if (!firebaseApp) {
    const apps = getApps();
    firebaseApp = apps.length ? apps[0] : initializeApp(firebaseConfig);
    auth = getAuth(firebaseApp);
    db = getFirestore(firebaseApp);
  }
  return { auth: auth!, db: db! };
}

export interface CompanyProfile {
  $id: string;
  name: string;
  slug: string;
  dispatchLat: number;
  dispatchLng: number;
  dispatchAddress: string;
}

export interface UserProfile {
  $id: string;
  email: string;
  fullName: string;
  role: 'owner' | 'dispatcher' | 'driver';
  companyId: string;
}

export function useAuthFirebase() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { auth: firebaseAuth } = initFirebase();
    console.log('[AUTH] Setting up Firebase auth listener');

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      console.log('[AUTH] Auth state changed:', user?.email || 'logged out', 'at', new Date().toISOString());
      
      if (!user) {
        console.log('[AUTH] User logged out - clearing state');
        setAuthUser(null);
        setProfile(null);
        setCompany(null);
        setLoading(false);
        return;
      }

      console.log('[AUTH] User logged in:', user.uid);
      setAuthUser(user);

      try {
        const { db: firestore } = initFirebase();

        // Load user profile from Firestore
        console.log('[AUTH] Loading user profile from Firestore...');
        const userDocRef = doc(firestore, 'neatfleet_users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        console.log('[AUTH] User doc exists?', userDocSnap.exists());

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          console.log('[AUTH] User data:', userData);
          
          const userProfile: UserProfile = {
            $id: user.uid,
            email: user.email || '',
            fullName: userData.fullName || user.displayName || '',
            role: userData.role || 'driver',
            companyId: userData.companyId,
          };
          setProfile(userProfile);
          console.log('[AUTH] Profile set:', userProfile);

          // Load company profile
          console.log('[AUTH] Loading company profile...');
          const companyDocRef = doc(firestore, 'neatfleet_companies', userData.companyId);
          const companyDocSnap = await getDoc(companyDocRef);
          console.log('[AUTH] Company doc exists?', companyDocSnap.exists());

          if (companyDocSnap.exists()) {
            const companyData = companyDocSnap.data();
            const companyProfile: CompanyProfile = {
              $id: userData.companyId,
              name: companyData.name,
              slug: companyData.slug,
              dispatchLat: companyData.dispatchLat,
              dispatchLng: companyData.dispatchLng,
              dispatchAddress: companyData.dispatchAddress || '',
            };
            setCompany(companyProfile);
            console.log('[AUTH] Company set:', companyProfile);
          } else {
            console.warn('[AUTH] Company document not found');
          }
        } else {
          console.warn('[AUTH] User document not found in Firestore');
        }
      } catch (err) {
        console.error('[AUTH] Error loading profile:', err);
      } finally {
        console.log('[AUTH] Setting loading=false');
        setLoading(false);
      }
    });

    return () => {
      console.log('[AUTH] Cleaning up auth listener');
      unsubscribe();
    };
  }, []);

  const registerCompany = useCallback(
    async (
      email: string,
      password: string,
      fullName: string,
      companyName: string,
      dispatchLat: number,
      dispatchLng: number
    ) => {
      console.log('[AUTH] registerCompany: starting');
      setError(null);

      try {
        const { auth: firebaseAuth, db: firestore } = initFirebase();

        // 1. Create Firebase auth user
        console.log('[AUTH] Creating Firebase user...');
        const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
        const userId = userCredential.user.uid;
        console.log('[AUTH] User created:', userId);

        // 2. Create company document
        console.log('[AUTH] Creating company document...');
        const companyId = `company_${Date.now()}`;
        const companyRef = doc(firestore, 'neatfleet_companies', companyId);
        await setDoc(companyRef, {
          name: companyName,
          slug: companyName.toLowerCase().replace(/\s+/g, '-'),
          dispatchLat,
          dispatchLng,
          dispatchAddress: '',
          createdAt: new Date(),
        });
        console.log('[AUTH] Company created:', companyId);

        // 3. Create user profile document
        console.log('[AUTH] Creating user profile document...');
        const userRef = doc(firestore, 'neatfleet_users', userId);
        await setDoc(userRef, {
          email,
          fullName,
          role: 'owner',
          companyId,
          createdAt: new Date(),
        });
        console.log('[AUTH] User profile created');

        console.log('[AUTH] Registration complete');
      } catch (err: any) {
        console.error('[AUTH] registerCompany error:', err);
        const msg = err?.message || 'Registration failed';
        setError(msg);
        throw new Error(msg);
      }
    },
    []
  );

  const login = useCallback(async (email: string, password: string) => {
    console.log('[AUTH] login: starting');
    setError(null);

    try {
      const { auth: firebaseAuth } = initFirebase();

      console.log('[AUTH] Signing in with Firebase...');
      await signInWithEmailAndPassword(firebaseAuth, email, password);
      console.log('[AUTH] Sign in successful');
    } catch (err: any) {
      console.error('[AUTH] login error:', err);
      const msg = err?.message || 'Login failed';
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const { auth: firebaseAuth } = initFirebase();
      await signOut(firebaseAuth);
      setAuthUser(null);
      setProfile(null);
      setCompany(null);
    } catch (err: any) {
      console.error('[AUTH] logout error:', err);
    }
  }, []);

  return { authUser, profile, company, loading, error, login, registerCompany, logout };
}
