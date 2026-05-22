'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChefHat, Users, DollarSign, ArrowRight, Star, Clock } from 'lucide-react';

const MEAL_SLOT_PRICES = [
  { id: 'breakfast', name: 'Breakfast Slot', price: 8.50, defaultChecked: true },
  { id: 'lunch', name: 'Lunch Slot', price: 12.00, defaultChecked: true },
  { id: 'dinner', name: 'Dinner Slot', price: 15.00, defaultChecked: false },
  { id: 'snacks', name: 'Snacks Slot', price: 4.50, defaultChecked: false },
];

export default function LandingPage() {
  const [employeesCount, setEmployeesCount] = useState(150);
  const [recurringRatio, setRecurringRatio] = useState(70); // 70% recurring, 30% flexible
  const [activeSlots, setActiveSlots] = useState<string[]>(['breakfast', 'lunch']);

  const toggleSlot = (slotId: string) => {
    if (activeSlots.includes(slotId)) {
      setActiveSlots(activeSlots.filter((id) => id !== slotId));
    } else {
      setActiveSlots([...activeSlots, slotId]);
    }
  };

  // Pricing math:
  // Recurring members eat 20 days/month (Mon-Fri) always.
  // Flexible members eat average of 8 days/month.
  // Monthly cost = [ (Recurring Qty * 20) + (Flexible Qty * 8) ] * Price per active slot
  const recurringQty = Math.round((employeesCount * recurringRatio) / 100);
  const flexibleQty = employeesCount - recurringQty;

  const totalMonthlyMealsPerSlot = (recurringQty * 20) + (flexibleQty * 8);
  const pricePerMeal = activeSlots.reduce((acc, slotId) => {
    const slot = MEAL_SLOT_PRICES.find((s) => s.id === slotId);
    return acc + (slot ? slot.price : 0);
  }, 0);

  const monthlyEstimatedTotal = totalMonthlyMealsPerSlot * pricePerMeal;

  return (
    <div className="flex-1 flex flex-col bg-background selection:bg-primary selection:text-white">
      {/* Navigation */}
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
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="transition-colors hover:text-accent">Features</a>
            <a href="#calculator" className="transition-colors hover:text-accent">Cost Estimator</a>
            <Link href="/dashboard" className="transition-colors hover:text-accent">Client Panel</Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link 
              href="/login" 
              className="px-5 py-2.5 rounded-xl text-sm font-medium border border-border bg-secondary hover:bg-muted transition-all duration-200"
            >
              Sign In
            </Link>
            <Link 
              href="/dashboard" 
              className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-primary text-white hover:opacity-90 shadow-lg shadow-primary/20 transition-all"
            >
              Request Demo <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-24 md:py-32 px-6 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glassmorphism-gold text-xs font-semibold tracking-wider uppercase text-accent mb-6">
            <Star className="h-3 w-3 fill-accent" /> Premium Enterprise Meal Management
          </div>
          <h1 className="font-serif text-5xl md:text-7xl font-bold tracking-tight max-w-5xl mx-auto leading-[1.1] mb-8">
            Simplify Corporate Catering, <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-accent via-primary to-accent">
              Optimize Employee Meals
            </span>
          </h1>
          <p className="text-muted-foreground text-lg md:text-xl max-w-3xl mx-auto mb-10 leading-relaxed font-light">
            An enterprise-level SaaS platform for organizations and catering providers to manage daily food operations, meal RSVPs, cutoff rules, adjustments, and monthly aggregated invoicing.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a 
              href="#calculator" 
              className="w-full sm:w-auto px-8 py-4 rounded-xl font-medium bg-primary text-white hover:opacity-90 shadow-xl shadow-primary/25 transition-all text-center"
            >
              Estimate Monthly Savings
            </a>
            <Link 
              href="/login" 
              className="w-full sm:w-auto px-8 py-4 rounded-xl font-medium border border-border hover:bg-secondary transition-all text-center"
            >
              Explore Sandbox Portal
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 border-t border-border/40 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold font-serif mb-4">Enterprise Meal Operations Simplified</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Empower your teams with self-service RSVPs, while administrators monitor budgets and kitchen operations in real-time.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="rounded-2xl glassmorphism p-8 hover:border-accent/40 transition-all duration-300">
              <div className="p-3.5 rounded-xl bg-primary/15 text-primary w-fit mb-6">
                <Clock className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold font-serif mb-3">Custom Cutoff Rules</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Set strict deadlines per slot (e.g., lunch must be confirmed by 10:00 PM previous night) to optimize kitchen prep and minimize waste.
              </p>
            </div>

            <div className="rounded-2xl glassmorphism p-8 hover:border-accent/40 transition-all duration-300">
              <div className="p-3.5 rounded-xl bg-accent/15 text-accent w-fit mb-6">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold font-serif mb-3">Flexible vs. Recurring Members</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Support calendar RSVPs for hybrid staff (flexible members) and automated opt-ins (recurring members) with customizable weekly templates.
              </p>
            </div>

            <div className="rounded-2xl glassmorphism p-8 hover:border-accent/40 transition-all duration-300">
              <div className="p-3.5 rounded-xl bg-emerald-500/15 text-emerald-400 w-fit mb-6">
                <DollarSign className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold font-serif mb-3">Aggregated Corporate Billing</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Automatically compile monthly bills based on actual meal consumption, adjustments, overrides, and discounts, directly emailing invoices.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Dynamic Estimator Section */}
      <section id="calculator" className="py-24 px-6 border-t border-border/40 bg-secondary/20 relative">
        <div className="max-w-5xl mx-auto glassmorphism-gold rounded-3xl p-8 md:p-12">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold font-serif mb-4">Organizational Budget Estimator</h2>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Simulate monthly catering costs based on your corporate headcount, active shifts, and hybrid behavior ratio.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            {/* Controls */}
            <div className="space-y-6">
              {/* Employee Count */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    1. Total Members / Employees
                  </label>
                  <span className="text-lg font-serif font-bold text-accent">{employeesCount} Staff</span>
                </div>
                <input 
                  type="range" 
                  min="10" 
                  max="1000" 
                  step="10"
                  value={employeesCount} 
                  onChange={(e) => setEmployeesCount(parseInt(e.target.value))}
                  className="w-full h-1.5 rounded-lg bg-secondary accent-accent appearance-none cursor-pointer"
                />
              </div>

              {/* Recurring Ratio */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    2. Recurring Meal Ratio (Hybrid Balance)
                  </label>
                  <span className="text-lg font-serif font-bold text-accent">{recurringRatio}% Recurring</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  step="5"
                  value={recurringRatio} 
                  onChange={(e) => setRecurringRatio(parseInt(e.target.value))}
                  className="w-full h-1.5 rounded-lg bg-secondary accent-accent appearance-none cursor-pointer"
                />
                <span className="text-[10px] text-muted-foreground block mt-1">
                  * {recurringQty} recurring (eat daily) & {flexibleQty} flexible (RSVP on-demand).
                </span>
              </div>

              {/* Slots Checkboxes */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-3">
                  3. Active Daily Meal Slots
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {MEAL_SLOT_PRICES.map((slot) => {
                    const isChecked = activeSlots.includes(slot.id);
                    return (
                      <button
                        key={slot.id}
                        onClick={() => toggleSlot(slot.id)}
                        className={`p-3.5 rounded-xl border text-left transition-all ${
                          isChecked 
                            ? 'border-primary bg-primary/5 text-foreground' 
                            : 'border-border hover:bg-secondary text-muted-foreground'
                        }`}
                      >
                        <div className="text-xs font-bold flex justify-between">
                          <span>{slot.name}</span>
                          <span className={isChecked ? 'text-accent' : ''}>${slot.price.toFixed(2)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Calculations Result */}
            <div className="glassmorphism p-8 rounded-2xl border-accent/20 text-center flex flex-col items-center justify-center min-h-[300px] relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-tr from-accent/5 to-transparent pointer-events-none" />
              <Users className="h-8 w-8 text-accent mb-3" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Estimated Monthly Budget
              </h4>
              <div className="text-5xl font-serif font-bold tracking-tight text-foreground mb-2">
                ${monthlyEstimatedTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground mb-6 leading-relaxed max-w-sm">
                Based on active slots sum of ${pricePerMeal.toFixed(2)} per meal. Estimates average 20 days/month for full-timers and 8 days/month for hybrid staff.
              </p>
              <Link 
                href="/login"
                className="w-full py-3.5 rounded-xl text-center text-sm font-semibold bg-primary text-white hover:opacity-90 shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
              >
                Sign In to Platform Portal <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-border/40 py-12 px-6 bg-secondary/10 text-center text-sm text-muted-foreground">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary text-accent">
              <ChefHat className="h-5 w-5" />
            </div>
            <span className="font-serif font-semibold text-lg text-foreground">LuxeCater Corporate</span>
          </div>
          <p>© {new Date().getFullYear()} LuxeCater Inc. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-accent transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-accent transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
