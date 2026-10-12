'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Plane, ArrowRight, ShieldCheck } from 'lucide-react';
export function AuthPanel({ reset = false }: { reset?: boolean }) {
  const router = useRouter();
  const [recovery, setRecovery] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    const form = new FormData(e.currentTarget);
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: reset ? 'password' : recovery ? 'recover' : 'login',
          email: reset ? undefined : form.get('email'),
          password: recovery ? undefined : form.get('password'),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      if (recovery)
        setMessage('If this account is eligible, a recovery link will arrive by email.');
      else {
        router.push('/');
        router.refresh();
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Please try again');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-screen">
      <section className="auth-story">
        <div className="brand">
          <span className="brand-mark">
            <Plane size={22} />
          </span>
          Travel<span>IQ</span>
        </div>
        <p className="eyebrow">YOUR AGENCY. A CLEARER PICTURE.</p>
        <h1>
          Great journeys.
          <br />
          Smarter business.
        </h1>
        <p>
          One thoughtful workspace for every booking, every traveller, and every business decision.
        </p>
        <div className="auth-orbit">
          <Plane size={60} />
          <span>BOM</span>
          <span>DXB</span>
        </div>
        <small>
          <ShieldCheck size={16} /> Private access · Invitation only
        </small>
      </section>
      <section className="auth-form">
        <p className="eyebrow">TRAVELIQ AGENCY</p>
        <h2>{reset ? 'Set your password' : recovery ? 'Recover your account' : 'Welcome back.'}</h2>
        <p>
          {reset
            ? 'Choose a unique password of at least 12 characters.'
            : recovery
              ? 'We’ll email you a secure recovery link.'
              : 'Sign in to your agency workspace.'}
        </p>
        <form onSubmit={submit}>
          {!reset && (
            <label>
              Email address
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@youragency.com"
              />
            </label>
          )}
          {!recovery && (
            <label>
              Password
              <input
                name="password"
                type="password"
                minLength={12}
                maxLength={128}
                required
                autoComplete={reset ? 'new-password' : 'current-password'}
              />
            </label>
          )}
          <button className="primary" disabled={busy}>
            {busy
              ? 'Please wait…'
              : reset
                ? 'Save password'
                : recovery
                  ? 'Send recovery link'
                  : 'Sign in'}
            <ArrowRight size={16} />
          </button>
        </form>
        <p role="status">{message}</p>
        {!reset && (
          <button
            className="text-button"
            onClick={() => {
              setRecovery(!recovery);
              setMessage('');
            }}
          >
            {recovery ? 'Back to sign in' : 'Forgot your password?'}
          </button>
        )}
        <div className="notice">
          Accounts are created by your agency administrator. Public registration is disabled.
        </div>
      </section>
    </main>
  );
}
