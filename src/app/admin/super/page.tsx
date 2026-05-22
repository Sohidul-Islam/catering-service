'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChefHat, Building2, Users, DollarSign, Plus, Mail, Globe, Sparkles } from 'lucide-react';
import { trpc } from '@/utils/trpc';

export default function SuperAdminConsole() {
  const [name, setName] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // tRPC queries & mutations
  const { data: orgs = [], refetch } = trpc.organization.getAll.useQuery();
  const createOrgMutation = trpc.organization.create.useMutation();

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await createOrgMutation.mutateAsync({
        name,
        billingEmail,
        timezone,
      });
      setName('');
      setBillingEmail('');
      setTimezone('UTC');
      setShowModal(false);
      refetch();
    } catch (err) {
      console.error('Failed to create organization:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mock aggregated SaaS statistics
  const totalOrganizationsCount = orgs.length;
  const totalStaffCount = totalOrganizationsCount * 145 + 12; // simulated
  const monthlyAggregatedMeals = totalOrganizationsCount * 2200 + 450;
  const billingTotals = monthlyAggregatedMeals * 11.20;

  return (
    <div className="flex-grow min-h-screen bg-background flex flex-col font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full glassmorphism border-b border-border/40">
        <div className="max-w-7xl mx-auto px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2.5 rounded-xl bg-gradient-to-tr from-primary to-accent text-white shadow-lg flex items-center">
              <ChefHat className="h-6 w-6" />
            </Link>
            <span className="font-serif text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-accent">
              LuxeCater SuperAdmin
            </span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Return Home
            </Link>
            <span className="h-5 w-px bg-border/40" />
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping" />
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                Console Live
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-8 py-10 w-full space-y-8 flex-grow">
        {/* Statistics Widgets */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="glassmorphism p-6 rounded-2xl flex items-center gap-5">
            <div className="p-3.5 rounded-xl bg-primary/15 text-primary">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Active Organizations
              </span>
              <span className="text-2xl font-serif font-bold text-foreground">
                {totalOrganizationsCount} Clients
              </span>
            </div>
          </div>

          <div className="glassmorphism p-6 rounded-2xl flex items-center gap-5">
            <div className="p-3.5 rounded-xl bg-accent/15 text-accent">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                SaaS Active Members
              </span>
              <span className="text-2xl font-serif font-bold text-foreground">
                {totalStaffCount} Employees
              </span>
            </div>
          </div>

          <div className="glassmorphism p-6 rounded-2xl flex items-center gap-5">
            <div className="p-3.5 rounded-xl bg-emerald-500/15 text-emerald-400">
              <ChefHat className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Monthly Meals Aggregated
              </span>
              <span className="text-2xl font-serif font-bold text-foreground">
                {monthlyAggregatedMeals.toLocaleString()} Meals
              </span>
            </div>
          </div>

          <div className="glassmorphism p-6 rounded-2xl flex items-center gap-5">
            <div className="p-3.5 rounded-xl bg-amber-500/15 text-amber-400">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Total SaaS Billings
              </span>
              <span className="text-2xl font-serif font-bold text-foreground">
                ${billingTotals.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Client Board & Onboard Button */}
        <div className="glassmorphism rounded-2xl border border-border/40 overflow-hidden">
          <div className="px-8 py-5 border-b border-border/40 bg-card/10 flex items-center justify-between">
            <div>
              <h3 className="font-serif text-lg font-bold">Onboarded Clients</h3>
              <p className="text-xs text-muted-foreground">List of active corporate organizations using LuxeCater SaaS.</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:opacity-90 shadow-lg shadow-primary/20 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Onboard Organization
            </button>
          </div>

          {orgs.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground space-y-3">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground/30 animate-pulse" />
              <p className="font-serif text-lg">No Organizations Onboarded Yet</p>
              <p className="text-xs max-w-sm mx-auto">Click &quot;Onboard Organization&quot; to bootstrap your first catering tenant.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted-foreground uppercase bg-secondary/20">
                  <tr>
                    <th className="px-8 py-4">Organization Name</th>
                    <th className="px-6 py-4">Billing Email</th>
                    <th className="px-6 py-4">Timezone</th>
                    <th className="px-6 py-4">Onboarded Date</th>
                    <th className="px-8 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {orgs.map((org) => (
                    <tr key={org.id} className="hover:bg-secondary/10 transition-colors">
                      <td className="px-8 py-5 font-semibold text-foreground flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold font-serif text-xs">
                          {org.name.slice(0, 2).toUpperCase()}
                        </span>
                        {org.name}
                      </td>
                      <td className="px-6 py-5 text-muted-foreground font-mono text-xs">{org.billingEmail}</td>
                      <td className="px-6 py-5 text-muted-foreground">{org.timezone}</td>
                      <td className="px-6 py-5 text-muted-foreground">
                        {new Date(org.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-8 py-5 text-right">
                        <Link href="/dashboard" className="text-xs text-accent hover:underline font-bold">
                          Impersonate Admin
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Add Org Modal Overlay */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glassmorphism max-w-md w-full p-8 rounded-2xl border border-accent/20 relative shadow-2xl">
            <h3 className="font-serif text-xl font-bold mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" /> Onboard Corporate Client
            </h3>
            <p className="text-xs text-muted-foreground mb-6">Create a separate workspace tenant for the organization to configure their portal, employees, and slots.</p>
            
            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Organization Name</label>
                <div className="relative">
                  <Building2 className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    required
                    placeholder="e.g., Google Inc."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-secondary border border-border focus:border-primary focus:outline-none transition-colors text-sm text-foreground"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Billing Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    type="email"
                    required
                    placeholder="e.g., billing@google.com"
                    value={billingEmail}
                    onChange={(e) => setBillingEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-secondary border border-border focus:border-primary focus:outline-none transition-colors text-sm text-foreground font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Timezone Support</label>
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

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-1/2 py-3 rounded-xl text-xs font-bold bg-secondary hover:bg-muted border border-border transition-all text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-1/2 py-3 rounded-xl text-xs font-bold bg-primary text-white hover:opacity-90 shadow-xl shadow-primary/20 transition-all text-center disabled:opacity-50"
                >
                  {isSubmitting ? 'Onboarding...' : 'Register client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-border/40 py-8 text-center text-xs text-muted-foreground bg-secondary/5 mt-auto">
        LuxeCater Platform SuperAdmin Console. Secure session active.
      </footer>
    </div>
  );
}
