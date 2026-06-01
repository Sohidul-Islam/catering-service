'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

type Preset = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'custom';

interface DateRange {
  startDate: string;
  endDate: string;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  label?: string;
  className?: string;
}

function formatDisplay(date: string) {
  if (!date) return '';
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0];
}

function getPresetRange(preset: Preset): DateRange {
  const now = new Date();
  const today = toDateStr(now);

  if (preset === 'today') return { startDate: today, endDate: today };

  if (preset === 'yesterday') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const s = toDateStr(y);
    return { startDate: s, endDate: s };
  }

  if (preset === 'thisWeek') {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
    return { startDate: toDateStr(start), endDate: today };
  }

  if (preset === 'lastWeek') {
    const startOfThisWeek = new Date(now);
    startOfThisWeek.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
    const end = new Date(startOfThisWeek);
    end.setDate(end.getDate() - 1);
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    return { startDate: toDateStr(start), endDate: toDateStr(end) };
  }

  if (preset === 'thisMonth') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startDate: toDateStr(start), endDate: today };
  }

  if (preset === 'lastMonth') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { startDate: toDateStr(start), endDate: toDateStr(end) };
  }

  return { startDate: today, endDate: today };
}

const PRESETS: { label: string; value: Preset }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'This Week', value: 'thisWeek' },
  { label: 'Last Week', value: 'lastWeek' },
  { label: 'This Month', value: 'thisMonth' },
  { label: 'Last Month', value: 'lastMonth' },
  { label: 'Custom Range', value: 'custom' },
];

export default function DateRangePicker({ value, onChange, label, className = '' }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<Preset>('today');
  const [customStart, setCustomStart] = useState(value.startDate);
  const [customEnd, setCustomEnd] = useState(value.endDate);

  const applyPreset = useCallback((preset: Preset) => {
    setActivePreset(preset);
    if (preset !== 'custom') {
      const range = getPresetRange(preset);
      onChange(range);
      setCustomStart(range.startDate);
      setCustomEnd(range.endDate);
      setOpen(false);
    }
  }, [onChange]);

  const applyCustom = () => {
    if (customStart && customEnd && customStart <= customEnd) {
      onChange({ startDate: customStart, endDate: customEnd });
      setOpen(false);
    }
  };

  const isSameDay = value.startDate === value.endDate;
  const displayText = isSameDay
    ? formatDisplay(value.startDate)
    : `${formatDisplay(value.startDate)} – ${formatDisplay(value.endDate)}`;

  return (
    <div className={`relative ${className}`}>
      {label && (
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">{label}</span>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 bg-white border border-[#e2e8f0] hover:border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-700 transition-all shadow-sm min-w-[200px]"
      >
        <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        <span className="flex-1 text-left truncate">{displayText || 'Select date range'}</span>
        <ChevronRight className={`h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          {/* Dropdown */}
          <div className="absolute top-full mt-2 left-0 z-50 bg-white border border-[#e2e8f0] rounded-2xl shadow-2xl p-4 min-w-[280px]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Quick Select</p>
            <div className="grid grid-cols-2 gap-1.5 mb-4">
              {PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => applyPreset(p.value)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left ${
                    activePreset === p.value
                      ? 'bg-black text-white'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {activePreset === 'custom' && (
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Custom Range</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold block mb-1">From</label>
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-black"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold block mb-1">To</label>
                    <input
                      type="date"
                      value={customEnd}
                      min={customStart}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-black"
                    />
                  </div>
                </div>
                <button
                  onClick={applyCustom}
                  disabled={!customStart || !customEnd || customStart > customEnd}
                  className="w-full py-2 bg-black text-white rounded-lg text-xs font-bold disabled:opacity-40 hover:bg-slate-800 transition-all"
                >
                  Apply Range
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
