import { useState } from 'react';
import { Truck, Loader2 } from 'lucide-react';
import { useAuth } from '../lib/useAuth';

interface AuthScreenProps {
  auth: ReturnType<typeof useAuth>;
}

export function AuthScreen({ auth }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Register fields
  const [regCompany, setRegCompany] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regLat, setRegLat] = useState('28.1518');
  const [regLng, setRegLng] = useState('-82.3743');

  async function handleLogin(e: any) {
    e.preventDefault();
    setError(null);
    if (!email || !password) { setError('Enter email and password.'); return; }
    setLoading(true);
    try {
      await auth.login(email, password);
    } catch (err: any) {
      setError(err?.message || 'Login failed. Check your email and password.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: any) {
    e.preventDefault();
    setError(null);
    if (!regCompany || !regName || !regEmail || !regPassword) {
      setError('All fields are required.');
      return;
    }
    if (regPassword.length < 8) {
      setError('Password must be at least 8 characters (Appwrite requirement).');
      return;
    }
    setLoading(true);
    try {
      await auth.registerCompany(
        regEmail,
        regPassword,
        regName,
        regCompany,
        parseFloat(regLat) || 0,
        parseFloat(regLng) || 0
      );
    } catch (err: any) {
      let msg = err?.message || 'Registration failed.';
      if (err?.code === 409) msg = 'This email is already registered. Try signing in instead.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
        <div className="flex items-center gap-2 mb-1">
          <div className="p-2 bg-blue-600 rounded-lg">
            <Truck size={20} className="text-white" />
          </div>
          <span className="text-xl font-bold text-slate-900 tracking-tight">NeatFleet</span>
        </div>
        <p className="text-sm text-slate-500 mb-6">Fleet routing & dispatch dashboard</p>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-60"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
            <p className="text-center text-sm text-slate-500 pt-2">
              New company?{' '}
              <button type="button" onClick={() => { setMode('register'); setError(null); }} className="text-blue-600 font-medium hover:underline">
                Register here
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Company Name</label>
              <input
                type="text" value={regCompany} onChange={(e) => setRegCompany(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="Cornerstone Landscape"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Your Full Name</label>
              <input
                type="text" value={regName} onChange={(e) => setRegName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="Jane Smith"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Email</label>
                <input
                  type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Password</label>
                <input
                  type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="8+ characters"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Dispatch Lat</label>
                <input
                  type="number" step="0.0001" value={regLat} onChange={(e) => setRegLat(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Dispatch Lng</label>
                <input
                  type="number" step="0.0001" value={regLng} onChange={(e) => setRegLng(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-60"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Creating…' : 'Create Company & Sign In'}
            </button>
            <p className="text-center text-sm text-slate-500 pt-2">
              Already registered?{' '}
              <button type="button" onClick={() => { setMode('login'); setError(null); }} className="text-blue-600 font-medium hover:underline">
                Sign in
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
