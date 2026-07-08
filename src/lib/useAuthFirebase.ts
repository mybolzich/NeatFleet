import { useState, useEffect, useCallback, useRef } from 'react';
import { initializeApp, getApps, App } from 'firebase/app';
import {
  getAuth,
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  Firestore,
} from 'firebase/firestore';

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
  // Start loading=true so we never flash the auth screen before Firebase resolves
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Guard: skip null events that fire before Firebase has resolved its
  // persisted session. Only the FIRST null event is ambiguous; if we are
  // actively registering we skip all intermediate null events.
  const isRegistering = useRef(false);
  const initialCheckDone = useRef(false);

  useEffect(() => {
    const { auth: firebaseAuth } = initFirebase();

    // Ensure session persists across page reloads
    setPersistence(firebaseAuth, browserLocalPersistence).catch(console.error);

    console.log('[AUTH] Setting up Firebase auth listener');

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      console.log('[AUTH] onAuthStateChanged fired:', user?.email ?? 'null', 
        '| initialCheckDone:', initialCheckDone.current,
        '| isRegistering:', isRegistering.current);

      // If registration is in progress, ignore intermediate null events
      if (isRegistering.current) {
        console.log('[AUTH] Skipping event — registration in progress');
        return;
      }

      if (!user) {
        // Only treat null as "logged out" after the first check is done
        // (the very first null is Firebase still reading from localStorage)
        if (!initialCheckDone.current) {
          console.log('[AUTH] Initial null event — waiting for Firebase to resolve session');
          initialCheckDone.current = true;
          setLoading(false);
          return;
        }
        console.log('[AUTH] Confirmed logged out');
        setAuthUser(null);
        setProfile(null);
        setCompany(null);
        setLoading(false);
        return;
      }

      initialCheckDone.current = true;
      console.log('[AUTH] Authenticated user:', user.uid);
      setAuthUser(user);

      try {
        const { db: firestore } = initFirebase();
        const userDocRef = doc(firestore, 'neatfleet_users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        console.log('[AUTH] User doc exists?', userDocSnap.exists());

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          setProfile({
            $id: user.uid,
            email: user.email || '',
            fullName: userData.fullName || '',
            role: userData.role || 'owner',
            companyId: userData.companyId,
          });

          const companyDocRef = doc(firestore, 'neatfleet_companies', userData.companyId);
          const companyDocSnap = await getDoc(companyDocRef);
          console.log('[AUTH] Company doc exists?', companyDocSnap.exists());

          if (companyDocSnap.exists()) {
            const c = companyDocSnap.data();
            setCompany({
              $id: userData.companyId,
              name: c.name,
              slug: c.slug,
              dispatchLat: c.dispatchLat,
              dispatchLng: c.dispatchLng,
              dispatchAddress: c.dispatchAddress || '',
            });
            console.log('[AUTH] Company loaded:', c.name);
          } else {
            console.warn('[AUTH] Company document missing');
          }
        } else {
          console.warn('[AUTH] User document missing — new user with no profile yet');
        }
      } catch (err) {
        console.error('[AUTH] Error loading profile/company:', err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const registerCompany = useCallback(async (
    email: string,
    password: string,
    fullName: string,
    companyName: string,
    dispatchLat: number,
    dispatchLng: number
  ) => {
    setError(null);
    isRegistering.current = true;
    console.log('[AUTH] registerCompany: starting, guard ON');

    try {
      const { auth: firebaseAuth, db: firestore } = initFirebase();

      const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      const userId = userCredential.user.uid;
      console.log('[AUTH] Auth user created:', userId);

      const companyId = `company_${userId}`;

      await setDoc(doc(firestore, 'neatfleet_companies', companyId), {
        name: companyName,
        slug: companyName.toLowerCase().replace(/\s+/g, '-'),
        dispatchLat,
        dispatchLng,
        dispatchAddress: '',
        createdAt: new Date(),
      });
      console.log('[AUTH] Company doc written');

      await setDoc(doc(firestore, 'neatfleet_users', userId), {
        email,
        fullName,
        role: 'owner',
        companyId,
        createdAt: new Date(),
      });
      console.log('[AUTH] User profile doc written');

      // Manually set state so the app transitions without waiting for
      // another onAuthStateChanged round-trip
      setAuthUser(userCredential.user);
      setProfile({ $id: userId, email, fullName, role: 'owner', companyId });
      setCompany({
        $id: companyId,
        name: companyName,
        slug: companyName.toLowerCase().replace(/\s+/g, '-'),
        dispatchLat,
        dispatchLng,
        dispatchAddress: '',
      });
      setLoading(false);
      console.log('[AUTH] Registration complete — state set manually');
    } catch (err: any) {
      console.error('[AUTH] registerCompany error:', err);
      setError(err?.message || 'Registration failed');
      throw err;
    } finally {
      isRegistering.current = false;
      console.log('[AUTH] isRegistering guard OFF');
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    console.log('[AUTH] login: starting');
    try {
      const { auth: firebaseAuth } = initFirebase();
      await signInWithEmailAndPassword(firebaseAuth, email, password);
      // onAuthStateChanged will fire and load the profile
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
    } catch (err: any) {
      console.error('[AUTH] logout error:', err);
    }
  }, []);

  return { authUser, profile, company, loading, error, login, registerCompany, logout };
}
