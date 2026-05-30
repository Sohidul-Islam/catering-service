'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChefHat, ArrowLeft, Building2, Mail, Lock, User, Globe, CheckCircle } from 'lucide-react';
import { trpc } from '@/utils/trpc';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const registerMutation = trpc.organization.register.useMutation();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await registerMutation.mutateAsync({
        name,
        billingEmail,
        timezone,
        adminName,
        adminEmail,
        adminPassword,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'An error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex-1 min-h-screen flex flex-col items-center justify-center p-6 bg-background relative text-center">
        <div className="w-full max-w-md glassmorphism rounded-2xl p-8 space-y-6">
          <div className="mx-auto w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center">
            <CheckCircle className="h-10 w-10" />
          </div>
          <h2 className="text-3xl font-serif font-bold">Registration Submitted</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Your organization <strong>{name}</strong> has been registered successfully!
          </p>
          <div className="p-4 bg-secondary/50 rounded-xl text-xs text-muted-foreground leading-relaxed text-left border border-border">
            <strong>Approval Required:</strong> A Super Admin must approve your organization workspace before you can log in. You will receive access once approved.
          </div>
          <Link 
            href="/login" 
            className="block w-full py-3.5 rounded-xl font-medium bg-primary text-white hover:opacity-90 shadow-lg shadow-primary/20 transition-all text-sm"
          >
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

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

      <div className="w-full max-w-lg glassmorphism rounded-2xl p-8 relative overflow-hidden my-12">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-xl bg-primary/10 text-primary mb-4">
            <ChefHat className="h-6 w-6" />
          </div>
          <h2 className="text-3xl font-serif font-bold mb-2">Register Organization</h2>
          <p className="text-muted-foreground text-sm">Set up your workspace tenant and admin account</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-6">
          {/* Organization Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-accent border-b border-border/40 pb-2">1. Organization Details</h3>
            
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Organization Name</label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  required
                  placeholder="e.g., Acme Corporation"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-secondary border border-border focus:border-primary focus:outline-none transition-colors text-sm text-foreground"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Billing Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    type="email"
                    required
                    placeholder="billing@acme.com"
                    value={billingEmail}
                    onChange={(e) => setBillingEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-secondary border border-border focus:border-primary focus:outline-none transition-colors text-sm text-foreground font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Timezone</label>
                <div className="relative">
                  <Globe className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-secondary border border-border focus:border-primary focus:outline-none transition-colors text-sm text-foreground"
                  >
                    <option value="UTC">Coordinated Universal Time (UTC)</option>
                    <option value="America/New_York">Eastern Time (EST)</option>
                    <option value="America/Chicago">Central Time (CST)</option>
                    <option value="America/Los_Angeles">Pacific Time (PST)</option>
                    <option value="Asia/Dhaka">Bangladesh Time (BST)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Administrator Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-accent border-b border-border/40 pb-2">2. Workspace Administrator</h3>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  required
                  placeholder="John Doe"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-secondary border border-border focus:border-primary focus:outline-none transition-colors text-sm text-foreground"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    type="email"
                    required
                    placeholder="john@acme.com"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-secondary border border-border focus:border-primary focus:outline-none transition-colors text-sm text-foreground font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-secondary border border-border focus:border-primary focus:outline-none transition-colors text-sm text-foreground"
                  />
                </div>
              </div>
            </div>
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
            {loading ? 'Registering...' : 'Submit Registration'}
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="text-primary hover:underline font-bold">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
