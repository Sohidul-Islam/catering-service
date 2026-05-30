'use client';

import React from 'react';
import Link from 'next/link';
import { ChefHat, Building2, LogIn, Sparkles } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="flex-1 flex flex-col bg-background text-foreground selection:bg-primary selection:text-white relative min-h-screen">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Navigation Header */}
      <header className="sticky top-0 z-50 w-full glassmorphism">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-primary to-accent text-white shadow-lg transition-transform group-hover:scale-105">
              <ChefHat className="h-6 w-6" />
            </div>
            <span className="font-serif text-2xl font-bold tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-foreground to-accent">
              LuxeCater SaaS
            </span>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-grow flex flex-col items-center justify-center py-20 px-6 relative z-10 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glassmorphism-gold text-xs font-semibold tracking-wider uppercase text-accent mb-6 animate-fade-in">
          <Sparkles className="h-3 w-3 fill-accent" /> Premium Enterprise Meal Management
        </div>
        
        <h1 className="font-serif text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-8">
          Seamless Corporate Catering <br />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-accent via-primary to-accent">
            For Modern Workspaces
          </span>
        </h1>
        
        <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mb-12 font-light leading-relaxed">
          Manage daily meal schedules, flexible and recurring RSVPs, automated invoicing, and customized cutoff times in one single platform.
        </p>

        {/* CTA Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-6 w-full max-w-md justify-center">
          <Link 
            href="/login" 
            className="w-full sm:w-auto min-w-[200px] flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl font-medium bg-primary text-white hover:opacity-90 shadow-xl shadow-primary/20 transition-all text-center"
          >
            <LogIn className="h-5 w-5" /> Sign In
          </Link>
          <Link 
            href="/register" 
            className="w-full sm:w-auto min-w-[200px] flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl font-medium border border-border bg-secondary hover:bg-muted transition-all text-center"
          >
            <Building2 className="h-5 w-5" /> Register Organization
          </Link>
        </div>
      </main>

      {/* Simple Footer */}
      <footer className="border-t border-border/40 py-8 text-center text-xs text-muted-foreground bg-secondary/5 mt-auto">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} LuxeCater Corporate. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-accent transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-accent transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
