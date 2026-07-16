import { useState, type ReactNode } from 'react';
import { Truck, Loader2 } from 'lucide-react';
import { useAuth } from '../lib/useAuth';

interface AuthScreenProps {
  auth: ReturnType<typeof useAuth>;
}

export function AuthScreen({ auth }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await auth.registerCompany(
        regEmail, regPassword, regName, regCompany,
        parseFloat(regLat) || 0, parseFloat(regLng) || 0
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
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: '24px 16px',
    }}>
      {/* Card */}
      <div className="card fade-in" style={{
        width: '100%',
        maxWidth: 420,
        padding: '32px 28px',
      }}>

        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{
            width: 44, height: 44,
            borderRadius: 12,
            background: 'var(--green-dark)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow-md)',
          }}>
            <Truck size={22} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
              NeatFleet
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.03em' }}>
              Fleet routing & dispatch
            </div>
          </div>
        </div>

        {/* Mode toggle */}
        <div style={{
          display: 'flex',
          background: 'var(--bg)',
          borderRadius: 'var(--radius-sm)',
          padding: 4,
          marginTop: 24,
          marginBottom: 24,
        }}>
          {(['login', 'register'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(null); }} style={{
              flex: 1,
              padding: '8px 0',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              border: 'none',
              background: mode === m ? 'var(--surface)' : 'transparent',
              color: mode === m ? 'var(--text-1)' : 'var(--text-3)',
              boxShadow: mode === m ? 'var(--shadow)' : 'none',
              transition: 'all .15s',
            }}>
              {m === 'login' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            marginBottom: 16,
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--red-light)',
            border: '1px solid #FECACA',
            color: 'var(--red)',
            fontSize: 13,
            fontWeight: 600,
          }}>
            {error}
          </div>
        )}

        {mode === 'login' ? (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Email">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="input" placeholder="you@company.com" />
            </Field>
            <Field label="Password">
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="input" placeholder="••••••••" />
            </Field>
            <button type="submit" disabled={loading} className="btn btn-green btn-full" style={{ marginTop: 4 }}>
              {loading
                ? <><Loader2 size={16} style={{ animation: 'spin .7s linear infinite' }} /> Signing in…</>
                : 'Sign In'
              }
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Company Name">
              <input type="text" value={regCompany} onChange={e => setRegCompany(e.target.value)}
                className="input" placeholder="Acme Logistics" />
            </Field>
            <Field label="Your Full Name">
              <input type="text" value={regName} onChange={e => setRegName(e.target.value)}
                className="input" placeholder="Jane Smith" />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Email">
                <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)}
                  className="input" />
              </Field>
              <Field label="Password">
                <input type="password" value={regPassword} onChange={e => setRegPassword(e.target.value)}
                  className="input" placeholder="8+ chars" />
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Depot Lat">
                <input type="number" step="0.0001" value={regLat} onChange={e => setRegLat(e.target.value)}
                  className="input" />
              </Field>
              <Field label="Depot Lng">
                <input type="number" step="0.0001" value={regLng} onChange={e => setRegLng(e.target.value)}
                  className="input" />
              </Field>
            </div>
            <button type="submit" disabled={loading} className="btn btn-green btn-full" style={{ marginTop: 4 }}>
              {loading
                ? <><Loader2 size={16} style={{ animation: 'spin .7s linear infinite' }} /> Creating…</>
                : 'Create Company & Sign In'
              }
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="label-sm" style={{ marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}
