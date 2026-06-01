'use client';

import React from 'react';
import { TrendingUp, AlertTriangle, Calendar, Users, Clock } from 'lucide-react';
import { Line as LineChart, Doughnut as DonutChart } from 'react-chartjs-2';

interface DashboardOverviewProps {
  trendChartData: any;
  trendChartOptions: any;
  breakdownDonutData: any;
  breakdownDonutOptions: any;
}

export default function DashboardOverview({
  trendChartData,
  trendChartOptions,
  breakdownDonutData,
  breakdownDonutOptions,
}: DashboardOverviewProps) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#0f172a]">Operations Board</h1>
        <p className="text-xs text-[#64748b] mt-0.5">Overview of active meal confirmations, stats, and trends.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Meals Confirmed Today */}
        <div className="bg-[#e6f7ed] border border-[#d1f2dd] rounded-2xl p-5 flex flex-col justify-between h-[130px]">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-[#1e6b3e] uppercase tracking-wider block">Meals Confirmed Today</span>
              <span className="text-[34px] font-bold text-black block mt-1">84</span>
            </div>
            <div className="w-9 h-9 rounded-lg bg-[#3baf72] flex items-center justify-center text-white shrink-0 shadow-sm">
              <TrendingUp className="h-4.5 w-4.5" />
            </div>
          </div>
          <span className="text-xs font-semibold text-[#1e6b3e] flex items-center gap-1">
            ↑ +8% vs yesterday
          </span>
        </div>

        {/* Pending Confirmations */}
        <div className="bg-[#fef3e2] border border-[#fde3be] rounded-2xl p-5 flex flex-col justify-between h-[130px]">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-[#b45309] uppercase tracking-wider block">Pending Confirmations</span>
              <span className="text-[34px] font-bold text-black block mt-1">12</span>
            </div>
            <div className="w-9 h-9 rounded-lg bg-[#f59e0b] flex items-center justify-center text-white shrink-0 shadow-sm">
              <AlertTriangle className="h-4.5 w-4.5" />
            </div>
          </div>
          <span className="text-xs font-semibold text-[#b45309] flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-[#b45309]" /> Awaiting response
          </span>
        </div>

        {/* Tomorrow's Meals */}
        <div className="bg-[#eef4ff] border border-[#dbebff] rounded-2xl p-5 flex flex-col justify-between h-[130px]">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-[#1e40af] uppercase tracking-wider block">Tomorrow&apos;s Meals</span>
              <span className="text-[34px] font-bold text-black block mt-1">78</span>
            </div>
            <div className="w-9 h-9 rounded-lg bg-[#3b82f6] flex items-center justify-center text-white shrink-0 shadow-sm">
              <Calendar className="h-4.5 w-4.5" />
            </div>
          </div>
          <span className="text-xs font-semibold text-[#1e40af] flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-[#1e40af]" /> Scheduled
          </span>
        </div>

        {/* Total Active Members */}
        <div className="bg-[#f3e8ff] border border-[#e9d5ff] rounded-2xl p-5 flex flex-col justify-between h-[130px]">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-[#6b21a8] uppercase tracking-wider block">Total Active Members</span>
              <span className="text-[34px] font-bold text-black block mt-1">102</span>
            </div>
            <div className="w-9 h-9 rounded-lg bg-[#a855f7] flex items-center justify-center text-white shrink-0 shadow-sm">
              <Users className="h-4.5 w-4.5" />
            </div>
          </div>
          <span className="text-xs font-semibold text-[#6b21a8] flex items-center gap-1">
            <Users className="h-3.5 w-3.5 text-[#6b21a8]" /> +4 this month
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Line Chart Card */}
        <div className="bg-white border border-[#eaedf0] rounded-2xl p-6 lg:col-span-2 h-[280px]">
          <div className="mb-4">
            <h3 className="text-base font-bold text-[#0f172a]">Meal Trend (This Week)</h3>
            <p className="text-xs text-[#64748b]">Daily confirmed meal counts, Monday to Friday</p>
          </div>
          <div className="h-[180px] w-full">
            <LineChart data={trendChartData} options={trendChartOptions} />
          </div>
        </div>

        {/* Donut Chart Card */}
        <div className="bg-white border border-[#eaedf0] rounded-2xl p-6 flex flex-col justify-between h-[280px] relative">
          <div>
            <h3 className="text-base font-bold text-[#0f172a]">Confirmation Breakdown</h3>
            <p className="text-xs text-[#64748b]">Recurring vs Flexible vs Pending</p>
          </div>

          <div className="flex-1 relative min-h-[120px] flex items-center justify-center py-2">
            <div className="w-full h-full max-h-[140px]">
              <DonutChart data={breakdownDonutData} options={breakdownDonutOptions} />
            </div>
            <div className="absolute text-center pointer-events-none">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Total</span>
              <span className="text-xl font-bold text-[#0f172a] block">102</span>
            </div>
          </div>

          <div className="space-y-1 text-xs mt-2 border-t border-slate-50 pt-2 flex justify-between">
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]" /> Recurring (58)</div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#10b981]" /> Flexible (32)</div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" /> Pending (12)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
