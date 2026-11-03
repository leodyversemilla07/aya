'use client';

import { authClient } from '@workspace/auth/client';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    const result = await authClient.signIn.email({ email, password });
    setLoading(false);
    if (result.error) {
      setError(result.error.message ?? 'Could not sign in.');
      return;
    }
    router.replace('/');
    router.refresh();
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border p-6">
        <div>
          <h1 className="text-2xl font-semibold">Sign in to Aya</h1>
          <p className="text-sm text-muted-foreground">Use your work account.</p>
        </div>
        <input
          required
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border p-2"
        />
        <input
          required
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border p-2"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-primary p-2 text-primary-foreground"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        <a href="/sign-up" className="block text-center text-sm underline">
          Create an account
        </a>
      </form>
    </main>
  );
}
