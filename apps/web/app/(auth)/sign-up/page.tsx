'use client';

import { authClient } from '@workspace/auth/client';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    const result = await authClient.signUp.email({ name, email, password });
    setLoading(false);
    if (result.error) {
      setError(result.error.message ?? 'Could not create the account.');
      return;
    }
    router.replace('/');
    router.refresh();
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border p-6">
        <div>
          <h1 className="text-2xl font-semibold">Create your Aya account</h1>
          <p className="text-sm text-muted-foreground">Staff managers can sign up here.</p>
        </div>
        <input
          required
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border p-2"
        />
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
          minLength={8}
          type="password"
          placeholder="Password (8+ characters)"
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
          {loading ? 'Creating account…' : 'Create account'}
        </button>
        <a href="/sign-in" className="block text-center text-sm underline">
          Already have an account?
        </a>
      </form>
    </main>
  );
}
