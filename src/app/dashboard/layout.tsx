'use client';

import React from 'react';
import Link from 'next/link';
import { ChefHat, Calendar, ClipboardList, CreditCard, LogOut, LayoutDashboard } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border/40 bg-card/25 backdrop-blur-xl flex flex-col p-6">
        <Link href="/" className="flex items-center gap-3 mb-10 group">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-primary to-accent text-white shadow-lg">
            <ChefHat className="h-5 w-5" />
          </div>
          <span className="font-serif text-lg font-bold tracking-wide">LuxeCater</span>
        </Link>

        <nav className="space-y-1.5 flex-grow">
          <Link 
            href="/dashboard" 
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 text-primary text-sm font-medium transition-all"
          >
            <LayoutDashboard className="h-4 w-4" /> Panel Overview
          </Link>
          <Link 
            href="/dashboard" 
            className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground text-sm font-medium transition-all"
          >
            <Calendar className="h-4 w-4" /> My Bookings
          </Link>
          <a 
            href="#" 
            className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground text-sm font-medium transition-all"
          >
            <ClipboardList className="h-4 w-4" /> Menu Choices
          </a>
          <a 
            href="#" 
            className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground text-sm font-medium transition-all"
          >
            <CreditCard className="h-4 w-4" /> Invoices
          </a>
        </nav>

        <div className="mt-auto border-t border-border/40 pt-4">
          <Link 
            href="/login" 
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/5 text-sm font-medium transition-all"
          >
            <LogOut className="h-4 w-4" /> Logout
          </Link>
        </div>
      </aside>

      {/* Main Panel Area */}
      <main className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="h-20 border-b border-border/40 flex items-center justify-between px-10 glassmorphism z-10">
          <h2 className="text-xl font-serif font-bold text-foreground">Client Portal</h2>
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-accent to-primary text-white flex items-center justify-center font-bold text-xs uppercase shadow-md">
              JD
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold">John Doe</p>
              <p className="text-[10px] text-muted-foreground">Premium Client</p>
            </div>
          </div>
        </header>

        {/* Content Wrapper */}
        <div className="flex-1 p-10 overflow-y-auto relative z-0">
          {children}
        </div>
      </main>
    </div>
  );
}
