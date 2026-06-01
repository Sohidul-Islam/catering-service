'use client';

import React, { Suspense } from 'react';
import { ChefHat } from 'lucide-react';
import DashboardContent from './components/DashboardClient';

export default function MealManagerDashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen w-full bg-[#f8fafc] flex flex-col items-center justify-center gap-3">
        <ChefHat className="h-10 w-10 text-black animate-spin" />
        <span className="text-xs font-mono text-[#64748b] tracking-wider uppercase animate-pulse">
          Loading MealHub Console...
        </span>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
