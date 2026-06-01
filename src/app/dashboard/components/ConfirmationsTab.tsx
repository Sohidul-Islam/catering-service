'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, Check, Clock, X, AlertTriangle } from 'lucide-react';

interface ConfirmationItem {
  id: string;
  name: string;
  avatar: string;
  type: string;
  status: string;
  time: string;
  by: string;
}

interface ConfirmationsTabProps {
  rsvpDate: string;
  shiftDate: (days: number) => void;
  selectedMealSlot: 'lunch' | 'dinner';
  setSelectedMealSlot: (slot: 'lunch' | 'dinner') => void;
  statusFilter: 'all' | 'confirmed' | 'pending' | 'skipped';
  setStatusFilter: (filter: 'all' | 'confirmed' | 'pending' | 'skipped') => void;
  confirmationsList: ConfirmationItem[];
  handleAdminRsvpChange: (id: string, newStatus: string) => void;
  handleBulkConfirm: () => void;
}

export default function ConfirmationsTab({
  rsvpDate,
  shiftDate,
  selectedMealSlot,
  setSelectedMealSlot,
  statusFilter,
  setStatusFilter,
  confirmationsList,
  handleAdminRsvpChange,
  handleBulkConfirm,
}: ConfirmationsTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0f172a]">Meal Confirmations</h1>
          <p className="text-xs text-[#64748b]">View, override and manage all employee meal confirmations.</p>
        </div>

        <div className="flex items-center gap-3 border border-[#e2e8f0] bg-white px-4 py-2 rounded-xl">
          <button onClick={() => shiftDate(-1)} className="p-1 text-slate-500 hover:text-black hover:bg-slate-50 rounded">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs font-bold text-slate-800 font-mono">{rsvpDate}</span>
          <button onClick={() => shiftDate(1)} className="p-1 text-slate-500 hover:text-black hover:bg-slate-50 rounded">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#e6f7ed] border border-[#d1f2dd] rounded-2xl p-5 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-[#1e6b3e] block">Confirmed</span>
            <span className="text-2xl font-bold text-[#1e6b3e] mt-1 block">84</span>
            <span className="text-[10px] text-[#1e6b3e] font-medium block mt-0.5">+8 from yesterday</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-[#1e6b3e]">
            <Check className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-[#fef3e2] border border-[#fde3be] rounded-2xl p-5 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-[#b45309] block">Pending</span>
            <span className="text-2xl font-bold text-[#b45309] mt-1 block">12</span>
            <span className="text-[10px] text-[#b45309] font-medium block mt-0.5">Awaiting response</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-[#b45309]">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-red-50 border border-red-100 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-red-700 block">Skipped</span>
            <span className="text-2xl font-bold text-red-700 mt-1 block">6</span>
            <span className="text-[10px] text-red-700 block mt-0.5">Declined meals</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-700">
            <X className="h-5 w-5" />
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#eaedf0] p-4 rounded-xl flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-1 bg-[#f1f5f9] p-1 rounded-lg">
          <button
            onClick={() => setSelectedMealSlot('lunch')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
              selectedMealSlot === 'lunch' ? 'bg-white text-black shadow-sm' : 'text-slate-500'
            }`}
          >
            ☀️ Lunch
          </button>
          <button
            onClick={() => setSelectedMealSlot('dinner')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
              selectedMealSlot === 'dinner' ? 'bg-white text-black shadow-sm' : 'text-slate-500'
            }`}
          >
            🌙 Dinner
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 border border-[#e2e8f0] rounded-xl text-xs bg-white font-medium focus:outline-none"
          >
            <option value="all">Filter by Status</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="skipped">Skipped</option>
          </select>

          <button
            onClick={handleBulkConfirm}
            className="px-4 py-2 bg-[#f97316] hover:bg-[#ea580c] text-white text-xs font-bold rounded-xl transition-all ml-auto md:ml-0"
          >
            ⚡ Bulk Confirm All Pending
          </button>
        </div>
      </div>

      <div className="bg-white border border-[#eaedf0] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] text-[#64748b] bg-[#fafbfc] uppercase tracking-wider font-semibold border-b border-[#eaedf0]">
              <tr>
                <th className="px-6 py-3.5">
                  <input type="checkbox" className="rounded" />
                </th>
                <th className="px-6 py-3.5">Employee Name</th>
                <th className="px-6 py-3.5">Meal Type</th>
                <th className="px-6 py-3.5">Confirmation Status</th>
                <th className="px-6 py-3.5">Confirmed At</th>
                <th className="px-6 py-3.5">Confirmed By</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eaedf0] text-sm">
              {confirmationsList
                .filter((row) => statusFilter === 'all' || row.status.toLowerCase() === statusFilter)
                .map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <input type="checkbox" className="rounded" />
                    </td>
                    <td className="px-6 py-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full overflow-hidden border">
                        <img src={row.avatar} alt={row.name} className="w-full h-full object-cover" />
                      </div>
                      <span className="font-semibold text-[#0f172a]">{row.name}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                          row.type === 'Recurring' ? 'bg-indigo-50 text-indigo-600' : 'bg-red-50 text-red-600'
                        }`}
                      >
                        {row.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          row.status === 'Confirmed'
                            ? 'bg-[#e6f7ed] text-[#1e6b3e]'
                            : row.status === 'Pending'
                            ? 'bg-[#fef3e2] text-[#b45309]'
                            : row.status === 'Override'
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-mono">{row.time}</td>
                    <td className="px-6 py-4 text-slate-500">{row.by}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleAdminRsvpChange(row.id, 'Confirmed')}
                        className="px-2.5 py-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg text-xs font-bold"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => handleAdminRsvpChange(row.id, 'Skipped')}
                        className="px-2.5 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-bold"
                      >
                        Skip
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-[#eaedf0] bg-slate-50 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <span className="text-xs text-amber-700">
            Confirmation deadline: 10:00 PM today. After the deadline, only admins can modify confirmations.
          </span>
        </div>
      </div>
    </div>
  );
}
