'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChefHat, ArrowLeft } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      router.push('/dashboard');
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'An error occurred during sign in');
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 min-h-screen flex flex-col items-center justify-center p-6 bg-background relative">
      <div className="absolute top-8 left-8">
        <Link 
          href="/" 
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>
      </div>

      <div className="w-full max-w-md glassmorphism rounded-2xl p-8 relative overflow-hidden">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-xl bg-primary/10 text-primary mb-4">
            <ChefHat className="h-6 w-6" />
          </div>
          <h2 className="text-3xl font-serif font-bold mb-2">Welcome Back</h2>
          <p className="text-muted-foreground text-sm">Access your client or admin panel</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-secondary border border-border focus:border-primary focus:outline-none transition-colors text-sm text-foreground"
              placeholder="name@example.com"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-secondary border border-border focus:border-primary focus:outline-none transition-colors text-sm text-foreground"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="text-xs text-destructive bg-destructive/10 p-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl font-medium bg-primary text-white hover:opacity-90 shadow-lg shadow-primary/20 transition-all text-sm disabled:opacity-50"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/dashboard" className="text-primary hover:underline">
            Book a service to get started
          </Link>
        </div>
      </div>
    </div>
  );
}
