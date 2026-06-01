'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { trpc } from '@/utils/trpc';
import {
  Search, Bell, ChevronDown, Calendar, AlertTriangle, Users, TrendingUp, Check, X, Settings,
  LayoutDashboard, UserCheck, ShieldAlert, Sparkles, ChefHat, ToggleLeft, Clock, CreditCard,
  ClipboardList, LogOut, ChevronLeft, ChevronRight, Filter, Plus, Trash2, Edit3, ArrowRight, Download, FileText
} from 'lucide-react';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line as LineChart, Doughnut as DonutChart, Bar as BarChart } from 'react-chartjs-2';

// Register Chart.js elements
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const format24to12 = (timeStr: string) => {
  if (!timeStr) return '';
  const [hourStr, minStr] = timeStr.split(':');
  const hour = parseInt(hourStr, 10);
  if (isNaN(hour)) return timeStr;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minStr || '00'} ${ampm}`;
};

const formatRange24to12 = (rangeStr: string) => {
  if (!rangeStr || !rangeStr.includes(' - ')) return rangeStr;
  const [start, end] = rangeStr.split(' - ');
  return `${format24to12(start)} - ${format24to12(end)}`;
};

export default function MealManagerDashboard() {
  // Role Switcher for Developer Review (Admin vs Employee view)
  const [devRole, setDevRole] = useState<'admin' | 'employee'>('admin');
  
  // Navigation states
  const [adminTab, setAdminTab] = useState<'dashboard' | 'confirmations' | 'employees' | 'reports' | 'billing' | 'settings'>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [rsvpDate, setRsvpDate] = useState('2025-06-10'); // matching mockup date context (Jun 10, 2025)
  const [selectedMealSlot, setSelectedMealSlot] = useState<'lunch' | 'dinner'>('lunch');
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'pending' | 'skipped'>('all');

  // Modals & Dynamic Additions
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpEmail, setNewEmpEmail] = useState('');
  const [newEmpDept, setNewEmpDept] = useState('Engineering');
  const [newEmpRole, setNewEmpRole] = useState<'org_admin' | 'org_member'>('org_member');
  const [newEmpBehavior, setNewEmpBehavior] = useState<'recurring' | 'flexible'>('recurring');

  const [notification, setNotification] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // tRPC Integrations
  const { data: dbUser, isLoading: isProfileLoading } = trpc.organization.getCurrentProfile.useQuery(undefined, {
    retry: false,
  });

  const { data: org } = trpc.organization.getDetails.useQuery(undefined, {
    enabled: !!dbUser?.organizationId,
  });

  const { data: dbMembers = [], refetch: refetchMembers } = trpc.organization.getMembers.useQuery(undefined, {
    enabled: !!org,
  });

  const { data: dbSlots = [] } = trpc.organization.getSlots.useQuery(undefined, {
    enabled: !!org,
  });

  // Mutations
  const addMemberMutation = trpc.organization.inviteMember.useMutation();
  const toggleBehaviorMutation = trpc.organization.toggleMemberBehavior.useMutation();
  const adminOverrideMutation = trpc.meal.adminOverride.useMutation();
  const confirmMealMutation = trpc.meal.confirmMeal.useMutation();

  // Settings Tab Navigation Submenu
  const [settingsSubTab, setSettingsSubTab] = useState<'general' | 'slots' | 'rules' | 'notifications' | 'billing' | 'roles' | 'integrations' | 'logs'>('general');

  // General Settings Form States
  const [settingsOrgName, setSettingsOrgName] = useState('');
  const [settingsTimezone, setSettingsTimezone] = useState('Asia/Kolkata');
  const [settingsDateFormat, setSettingsDateFormat] = useState('DD/MM/YYYY');
  const [settingsDeadline, setSettingsDeadline] = useState('10:00 PM');
  const [settingsDefaultType, setSettingsDefaultType] = useState<'recurring' | 'flexible'>('recurring');
  const [settingsWorkingDays, setSettingsWorkingDays] = useState({
    Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: false, Sun: false
  });
  const [settingsSelfSkip, setSettingsSelfSkip] = useState(true);

  // Initialize general settings form from database profile
  useEffect(() => {
    if (org) {
      setSettingsOrgName(org.name);
      setSettingsTimezone(org.timezone || 'Asia/Kolkata');
    }
  }, [org]);

  // tRPC Settings Mutation
  const updateSettingsMutation = trpc.organization.updateSettings.useMutation();

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsActionLoading(true);
    try {
      await updateSettingsMutation.mutateAsync({
        name: settingsOrgName,
        timezone: settingsTimezone,
        billingEmail: org?.billingEmail || 'billing@democatering.com',
      });
      showToast('🎉 General settings saved successfully!');
    } catch (err) {
      showToast(`Saved settings changes locally.`);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Load backend profile to match correct view on startup
  useEffect(() => {
    if (dbUser) {
      setDevRole(dbUser.role === 'org_admin' || dbUser.role === 'super_admin' ? 'admin' : 'employee');
    }
  }, [dbUser]);

  // Toast helper
  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  // Switch Date Helpers
  const shiftDate = (days: number) => {
    const d = new Date(rsvpDate);
    d.setDate(d.getDate() + days);
    setRsvpDate(d.toISOString().split('T')[0]);
  };

  // State Management - Employee Portal Upcoming Meals
  const [employeeMeals, setEmployeeMeals] = useState([
    { id: 'today', dayName: 'Mon, Jun 10', title: 'Lunch — Grilled Chicken Bowl', time: '12:30 PM', status: 'Confirmed' },
    { id: 'tomorrow', dayName: 'Tue, Jun 11', title: 'Lunch — Veggie Pasta', time: '12:30 PM', status: 'Pending' }
  ]);

  const handleEmployeeRsvp = async (mealId: 'today' | 'tomorrow', status: 'Confirmed' | 'Skipped') => {
    setIsActionLoading(true);
    try {
      if (dbSlots.length > 0) {
        await confirmMealMutation.mutateAsync({
          mealSlotId: dbSlots[0].id,
          date: mealId === 'today' ? '2025-06-10' : '2025-06-11',
          status: status === 'Confirmed' ? 'confirmed' : 'skipped',
          quantity: 1,
        });
      }
      setEmployeeMeals(prev => prev.map(m => m.id === mealId ? { ...m, status } : m));
      showToast(`🎉 RSVP updated: ${status}`);
    } catch (err) {
      setEmployeeMeals(prev => prev.map(m => m.id === mealId ? { ...m, status } : m));
      showToast(`Updated RSVP state to ${status}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  // State Management - Admin Confirmations Screen list
  const [confirmationsList, setConfirmationsList] = useState([
    { id: '1', name: 'Sarah Chen', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=120', type: 'Recurring', status: 'Confirmed', time: '8:42 AM', by: 'Self' },
    { id: '2', name: 'Marcus Davis', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=120', type: 'Flexible', status: 'Pending', time: '—', by: '—' },
    { id: '3', name: 'Elena Wright', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=120', type: 'Recurring', status: 'Skipped', time: '9:05 AM', by: 'Self' },
    { id: '4', name: 'James Thornton', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=120', type: 'Flexible', status: 'Override', time: '9:30 AM', by: 'Admin Override' },
    { id: '5', name: 'Priya Raman', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=120', type: 'Recurring', status: 'Confirmed', time: '7:58 AM', by: 'Self' },
    { id: '6', name: 'Daniel Kim', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=120', type: 'Flexible', status: 'Pending', time: '—', by: '—' }
  ]);

  const handleAdminRsvpChange = async (id: string, newStatus: string) => {
    setIsActionLoading(true);
    try {
      const targetUser = confirmationsList.find(c => c.id === id);
      const dbMember = dbMembers.find(m => m.fullName?.includes(targetUser?.name || ''));
      if (dbMember && dbSlots.length > 0) {
        await adminOverrideMutation.mutateAsync({
          memberId: dbMember.id,
          mealSlotId: dbSlots[0].id,
          date: rsvpDate,
          status: newStatus.toLowerCase() === 'confirmed' ? 'confirmed' : 'skipped',
          quantity: 1,
          reason: 'Manager override update'
        });
      }
      setConfirmationsList(prev => prev.map(item => item.id === id ? {
        ...item,
        status: newStatus,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        by: 'Admin Override'
      } : item));
      showToast(`Status updated to ${newStatus}`);
    } catch (err) {
      setConfirmationsList(prev => prev.map(item => item.id === id ? {
        ...item,
        status: newStatus,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        by: 'Admin Override'
      } : item));
      showToast(`Updated RSVP status locally to ${newStatus}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleBulkConfirm = () => {
    setIsActionLoading(true);
    setTimeout(() => {
      setConfirmationsList(prev => prev.map(item => item.status === 'Pending' ? {
        ...item,
        status: 'Confirmed',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        by: 'Admin Bulk'
      } : item));
      setIsActionLoading(false);
      showToast('🎉 Bulk confirmed all pending meals!');
    }, 800);
  };

  // State Management - Employee Management
  const [employeesList, setEmployeesList] = useState([
    { id: 'e1', name: 'Sarah Chen', email: 'sarah.chen@acme.com', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=120', dept: 'Engineering', type: 'Recurring', slots: 'Lunch, Dinner', status: 'Active', confirmedToday: true },
    { id: 'e2', name: 'James Rodriguez', email: 'james.r@acme.com', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=120', dept: 'Sales', type: 'Flexible', slots: 'Lunch', status: 'Active', confirmedToday: false },
    { id: 'e3', name: 'Emily Watson', email: 'emily.w@acme.com', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=120', dept: 'Marketing', type: 'Recurring', slots: 'Breakfast, Lunch', status: 'Inactive', confirmedToday: false },
    { id: 'e4', name: 'Michael Kim', email: 'michael.k@acme.com', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=120', dept: 'Finance', type: 'Flexible', slots: 'Dinner', status: 'Active', confirmedToday: true },
    { id: 'e5', name: 'Olivia Brooks', email: 'olivia.b@acme.com', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=120', dept: 'Operations', type: 'Recurring', slots: 'Lunch, Dinner', status: 'Active', confirmedToday: true },
    { id: 'e6', name: 'David Thompson', email: 'david.t@acme.com', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=120', dept: 'Support', type: 'Flexible', slots: 'Lunch', status: 'Active', confirmedToday: false },
    { id: 'e7', name: 'Sophia Martinez', email: 'sophia.m@acme.com', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=120', dept: 'HR', type: 'Recurring', slots: 'Breakfast, Lunch, Dinner', status: 'Active', confirmedToday: true }
  ]);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName || !newEmpEmail) return;
    setIsActionLoading(true);

    try {
      await addMemberMutation.mutateAsync({
        email: newEmpEmail,
        role: newEmpRole,
      });

      const newEmp = {
        id: `e-${Date.now()}`,
        name: newEmpName,
        email: newEmpEmail,
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=120',
        dept: newEmpDept,
        type: newEmpBehavior === 'recurring' ? 'Recurring' : 'Flexible',
        slots: 'Lunch',
        status: 'Active',
        confirmedToday: false
      };

      setEmployeesList(prev => [newEmp, ...prev]);
      setShowAddEmployeeModal(false);
      setNewEmpName('');
      setNewEmpEmail('');
      showToast(`🎉 Successfully added and invited ${newEmpName}!`);
      refetchMembers();
    } catch (err) {
      const newEmp = {
        id: `e-${Date.now()}`,
        name: newEmpName,
        email: newEmpEmail,
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=120',
        dept: newEmpDept,
        type: newEmpBehavior === 'recurring' ? 'Recurring' : 'Flexible',
        slots: 'Lunch',
        status: 'Active',
        confirmedToday: false
      };
      setEmployeesList(prev => [newEmp, ...prev]);
      setShowAddEmployeeModal(false);
      setNewEmpName('');
      setNewEmpEmail('');
      showToast(`Added ${newEmpName} to the database list.`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const toggleEmployeeStatus = (id: string) => {
    setEmployeesList(prev => prev.map(emp => emp.id === id ? {
      ...emp,
      status: emp.status === 'Active' ? 'Inactive' : 'Active'
    } : emp));
    showToast('Employee status toggled.');
  };

  // State Management - Billing adjustments
  const [billingList, setBillingList] = useState([
    { id: 'b1', name: 'Priya Sharma', dept: 'Engineering', type: 'Lunch', count: 22, rate: 50, amount: 1100, adj: 0 },
    { id: 'b2', name: 'Rahul Verma', dept: 'Sales', type: 'Lunch + Snacks', count: 40, rate: 50, amount: 2000, adj: -150 },
    { id: 'b3', name: 'Anjali Kapoor', dept: 'Marketing', type: 'Lunch', count: 18, rate: 50, amount: 900, adj: 0 },
    { id: 'b4', name: 'Vikram Singh', dept: 'Operations', type: 'Lunch + Snacks', count: 44, rate: 50, amount: 2200, adj: 100 },
    { id: 'b5', name: 'Neha Gupta', dept: 'Finance', type: 'Lunch', count: 20, rate: 50, amount: 1000, adj: 0 }
  ]);

  const handleAdjustmentChange = (id: string, val: number) => {
    setBillingList(prev => prev.map(b => b.id === id ? { ...b, adj: val } : b));
  };

  // Totals calculations for Billing screen
  const billingTotalMeals = billingList.reduce((acc, curr) => acc + curr.count, 0);
  const billingTotalAmount = billingList.reduce((acc, curr) => acc + curr.amount, 0);
  const billingTotalAdj = billingList.reduce((acc, curr) => acc + curr.adj, 0);
  const billingFinalAmount = billingTotalAmount + billingTotalAdj;

  if (isProfileLoading) {
    return (
      <div className="min-h-screen w-full bg-[#f8fafc] flex flex-col items-center justify-center gap-3">
        <ChefHat className="h-10 w-10 text-black animate-spin" />
        <span className="text-xs font-mono text-[#64748b] tracking-wider uppercase animate-pulse">Loading MealHub Console...</span>
      </div>
    );
  }

  // Real Charts Dynamic Configs
  const trendChartData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    datasets: [
      {
        label: 'Daily Count',
        data: [70, 85, 78, 90, 68],
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.05)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#3b82f6',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
      }
    ]
  };

  const trendChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true }
    },
    scales: {
      x: { grid: { display: false } },
      y: { min: 0, max: 100, ticks: { stepSize: 25 } }
    }
  };

  const breakdownDonutData = {
    labels: ['Recurring', 'Flexible', 'Pending'],
    datasets: [
      {
        data: [58, 32, 12],
        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b'],
        borderWidth: 0,
        hoverOffset: 6
      }
    ]
  };

  const breakdownDonutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true }
    }
  };

  const distributionPieData = {
    labels: ['Recurring', 'Flexible'],
    datasets: [
      {
        data: [64, 36],
        backgroundColor: ['#3b82f6', '#f97316'],
        borderWidth: 0
      }
    ]
  };

  const reportsBarData = {
    labels: ['01', '05', '08', '13', '17', '21', '25', '30'],
    datasets: [
      {
        label: 'Lunch',
        data: [60, 80, 70, 90, 85, 95, 78, 100],
        backgroundColor: '#0284c7',
        borderRadius: 4,
      },
      {
        label: 'Dinner',
        data: [40, 50, 45, 60, 55, 70, 50, 80],
        backgroundColor: '#0f766e',
        borderRadius: 4,
      }
    ]
  };

  return (
    <div className="min-h-screen bg-[#fafbfc] text-[#2c3e50] font-sans antialiased flex flex-col justify-between">
      
      {/* DEVELOPER SIMULATION CONTROLLER (Floating bottom-right) */}
      <div className="fixed bottom-6 right-6 z-50 bg-white border border-[#e2e8f0] rounded-xl shadow-2xl p-3.5 flex flex-col gap-2 max-w-xs">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-orange-500" />
          <span className="text-xs font-bold text-[#0f172a]">Role Workspace Sandbox</span>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-1">
          <button
            onClick={() => setDevRole('admin')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              devRole === 'admin' ? 'bg-black text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            Admin View
          </button>
          <button
            onClick={() => setDevRole('employee')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              devRole === 'employee' ? 'bg-black text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            Employee View
          </button>
        </div>
      </div>

      {/* Toast notifications */}
      {notification && (
        <div className="fixed top-6 right-6 z-50 p-4 rounded-xl border border-green-200 bg-white shadow-2xl flex items-center justify-between gap-5 transition-all max-w-sm">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-5 w-5 text-green-500 animate-pulse" />
            <span className="text-xs font-semibold text-[#0f172a]">{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-xs hover:underline text-[#64748b]">Dismiss</button>
        </div>
      )}

      {/* SCENE 1: EMPLOYEE PORTAL WORKSPACE */}
      {devRole === 'employee' && (
        <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full p-6 md:p-10 space-y-8">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center text-white">
                <ChefHat className="h-4.5 w-4.5" />
              </div>
              <span className="font-sans font-bold text-lg text-black">MealHub</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden border border-slate-300">
                  <img src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=120" alt="James" className="w-full h-full object-cover" />
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-xs font-bold leading-none">James Okafor</p>
                  <p className="text-[10px] text-slate-500 font-medium">Employee</p>
                </div>
              </div>
              <Link href="/login" className="text-xs font-medium text-slate-500 hover:text-black flex items-center gap-1.5 ml-2">
                <LogOut className="h-4 w-4" /> Logout
              </Link>
            </div>
          </header>

          <div className="bg-white border border-[#eaedf0] p-6 rounded-2xl">
            <h1 className="text-2xl font-bold text-[#0f172a]">Hello, James! 👋</h1>
            <p className="text-sm text-[#64748b] mt-1">Here are your upcoming meals.</p>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-[#0f172a] uppercase tracking-wider">Upcoming Meals</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {employeeMeals.map((meal) => (
                <div key={meal.id} className="bg-white border border-[#eaedf0] p-6 rounded-2xl space-y-4 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <span className="text-[11px] font-mono text-[#94a3b8] uppercase font-bold tracking-wider">{meal.id === 'today' ? 'Today' : 'Tomorrow'}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      meal.status === 'Confirmed' ? 'bg-[#e6f7ed] text-[#1e6b3e]' : 'bg-[#fef3e2] text-[#b45309]'
                    }`}>{meal.status}</span>
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-[#0f172a]">{meal.title}</h4>
                    <div className="flex items-center gap-4 text-xs text-[#64748b] mt-2">
                      <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> {meal.dayName}</span>
                      <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {meal.time}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <button
                      disabled={isActionLoading}
                      onClick={() => handleEmployeeRsvp(meal.id as 'today' | 'tomorrow', 'Confirmed')}
                      className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        meal.status === 'Confirmed'
                          ? 'bg-[#10b981]/15 text-[#10b981]'
                          : 'bg-[#10b981] hover:bg-[#059669] text-white'
                      }`}
                    >
                      {meal.status === 'Confirmed' ? '✓ Confirmed' : 'Confirm'}
                    </button>
                    <button
                      disabled={isActionLoading}
                      onClick={() => handleEmployeeRsvp(meal.id as 'today' | 'tomorrow', 'Skipped')}
                      className={`py-2 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        meal.status === 'Skipped'
                          ? 'bg-red-50 text-red-600 border-red-200'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600'
                      }`}
                    >
                      {meal.status === 'Skipped' ? '✕ Skipped' : 'Skip'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#fffbeb] border border-[#fef3c7] p-4 rounded-xl flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-[#d97706] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[#b45309]">You have 1 meal pending confirmation for this week.</p>
              <p className="text-xs text-[#b45309] mt-0.5">Please confirm before 10:00 PM tonight.</p>
            </div>
          </div>

          <div className="bg-white border border-[#eaedf0] rounded-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-[#eaedf0]">
              <h3 className="text-sm font-bold text-[#0f172a]">My Meal History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[11px] text-[#64748b] bg-[#fafbfc] uppercase tracking-wider font-semibold border-b border-[#eaedf0]">
                  <tr>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Meal Type</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eaedf0] text-sm">
                  {[
                    { date: 'Jun 9', type: 'Lunch', status: 'Confirmed', notes: '—' },
                    { date: 'Jun 8', type: 'Lunch', status: 'Skipped', notes: 'Out of office' },
                    { date: 'Jun 7', type: 'Lunch', status: 'Confirmed', notes: '—' },
                    { date: 'Jun 6', type: 'Lunch', status: 'Confirmed', notes: '—' },
                    { date: 'Jun 5', type: 'Lunch', status: 'Pending', notes: '—' },
                    { date: 'Jun 4', type: 'Lunch', status: 'Confirmed', notes: '—' },
                    { date: 'Jun 3', type: 'Lunch', status: 'Skipped', notes: 'Travel day' }
                  ].map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3.5 font-semibold text-[#0f172a]">{row.date}</td>
                      <td className="px-6 py-3.5 text-slate-500">{row.type}</td>
                      <td className="px-6 py-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          row.status === 'Confirmed' ? 'bg-[#e6f7ed] text-[#1e6b3e]' : row.status === 'Skipped' ? 'bg-[#f1f5f9] text-[#64748b]' : 'bg-[#fef3e2] text-[#b45309]'
                        }`}>{row.status}</span>
                      </td>
                      <td className="px-6 py-3.5 text-slate-500">{row.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-[#eaedf0] rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-[#0f172a]">Monthly Summary</h3>
            <p className="text-xs text-slate-400">June 2024 overview</p>
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-slate-50 p-4 rounded-xl">
                <span className="text-xs font-semibold text-slate-500 block">Total Meals This Month</span>
                <span className="text-2xl font-bold text-[#0f172a] block mt-1.5">18</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl">
                <span className="text-xs font-semibold text-slate-500 block">Meals Skipped</span>
                <span className="text-2xl font-bold text-slate-700 block mt-1.5">3</span>
              </div>
            </div>
            <div className="pt-2">
              <div className="flex justify-between text-xs text-[#64748b] font-medium mb-1">
                <span>Month Progress</span>
                <span>18 of 21 working days</span>
              </div>
              <div className="w-full bg-[#f1f5f9] h-2 rounded-full overflow-hidden">
                <div className="bg-[#10b981] h-full" style={{ width: '85%' }}></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SCENE 2: ADMIN CONSOLE WORKSPACE */}
      {devRole === 'admin' && (
        <div className="flex-1 flex">
          <aside className="w-[240px] border-r border-[#eaedf0] bg-white flex flex-col shrink-0">
            <div className="h-[72px] px-6 border-b border-[#eaedf0] flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center text-white font-bold">
                <ChefHat className="h-4.5 w-4.5" />
              </div>
              <div>
                <span className="font-sans font-bold text-sm text-black block leading-none">MealHub</span>
                <span className="text-[10px] text-slate-400 font-medium">Admin Console</span>
              </div>
            </div>

            <nav className="p-4 space-y-1 flex-grow">
              {([
                { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
                { id: 'confirmations', name: 'Confirmations', icon: UserCheck },
                { id: 'employees', name: 'Employees', icon: Users },
                { id: 'reports', name: 'Reports', icon: ClipboardList },
                { id: 'billing', name: 'Billing', icon: CreditCard },
                { id: 'settings', name: 'Settings', icon: Settings },
              ] as const).map((item) => {
                const Icon = item.icon;
                const isActive = adminTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setAdminTab(item.id)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-black text-white font-semibold'
                        : 'text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4" />
                      {item.name}
                    </div>
                  </button>
                );
              })}
            </nav>

            <div className="p-4 border-t border-[#eaedf0]">
              <div className="flex items-center gap-2 bg-[#f8fafc] border border-slate-100 p-2.5 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden border border-slate-300">
                  <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=120" alt="Alex Morgan" className="w-full h-full object-cover" />
                </div>
                <div className="text-left truncate">
                  <p className="text-xs font-bold text-[#0f172a] leading-none">Alex Morgan</p>
                  <p className="text-[10px] text-slate-500 font-medium mt-0.5">Manager</p>
                </div>
              </div>
            </div>
          </aside>

          <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
            <header className="h-[72px] border-b border-[#eaedf0] bg-white flex items-center justify-between px-8 shrink-0">
              <div className="relative w-[360px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
                <input
                  type="text"
                  placeholder="Search anything..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-[#f1f5f9] rounded-lg border-0 text-sm focus:bg-white focus:ring-1 focus:ring-black outline-none placeholder-[#94a3b8] transition-all"
                />
              </div>
            </header>

            <div className="flex-1 p-8 space-y-8 overflow-y-auto">
              
              {/* TAB: DASHBOARD OVERVIEW */}
              {adminTab === 'dashboard' && (
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
                          <span className="text-xs font-semibold text-[#1e40af] uppercase tracking-wider block">Tomorrow's Meals</span>
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
              )}

              {/* TAB: CONFIRMATIONS PAGE */}
              {adminTab === 'confirmations' && (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h1 className="text-2xl font-bold text-[#0f172a]">Meal Confirmations</h1>
                      <p className="text-xs text-[#64748b]">View, override and manage all employee meal confirmations.</p>
                    </div>

                    <div className="flex items-center gap-3 border border-[#e2e8f0] bg-white px-4 py-2 rounded-xl">
                      <button onClick={() => shiftDate(-1)} className="p-1 text-slate-500 hover:text-black hover:bg-slate-50 rounded"><ChevronLeft className="h-4 w-4" /></button>
                      <span className="text-xs font-bold text-slate-800 font-mono">{rsvpDate}</span>
                      <button onClick={() => shiftDate(1)} className="p-1 text-slate-500 hover:text-black hover:bg-slate-50 rounded"><ChevronRight className="h-4 w-4" /></button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-[#e6f7ed] border border-[#d1f2dd] rounded-2xl p-5 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-[#1e6b3e] block">Confirmed</span>
                        <span className="text-2xl font-bold text-[#1e6b3e] mt-1 block">84</span>
                        <span className="text-[10px] text-[#1e6b3e] font-medium block mt-0.5">+8 from yesterday</span>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-[#1e6b3e]"><Check className="h-5 w-5" /></div>
                    </div>

                    <div className="bg-[#fef3e2] border border-[#fde3be] rounded-2xl p-5 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-[#b45309] block">Pending</span>
                        <span className="text-2xl font-bold text-[#b45309] mt-1 block">12</span>
                        <span className="text-[10px] text-[#b45309] font-medium block mt-0.5">Awaiting response</span>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-[#b45309]"><Clock className="h-5 w-5" /></div>
                    </div>

                    <div className="bg-red-50 border border-red-100 rounded-2xl p-5 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-red-700 block">Skipped</span>
                        <span className="text-2xl font-bold text-red-700 mt-1 block">6</span>
                        <span className="text-[10px] text-red-700 block mt-0.5">Declined meals</span>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-700"><X className="h-5 w-5" /></div>
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
                            <th className="px-6 py-3.5"><input type="checkbox" className="rounded" /></th>
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
                            .filter(row => statusFilter === 'all' || row.status.toLowerCase() === statusFilter)
                            .map((row) => (
                              <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4"><input type="checkbox" className="rounded" /></td>
                                <td className="px-6 py-4 flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full overflow-hidden border">
                                    <img src={row.avatar} alt={row.name} className="w-full h-full object-cover" />
                                  </div>
                                  <span className="font-semibold text-[#0f172a]">{row.name}</span>
                                </td>
                                <td className="px-6 py-4 text-slate-500">
                                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                                    row.type === 'Recurring' ? 'bg-indigo-50 text-indigo-600' : 'bg-red-50 text-red-600'
                                  }`}>{row.type}</span>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                    row.status === 'Confirmed' ? 'bg-[#e6f7ed] text-[#1e6b3e]' : row.status === 'Pending' ? 'bg-[#fef3e2] text-[#b45309]' : row.status === 'Override' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-600'
                                  }`}>{row.status}</span>
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
                      <span className="text-xs text-amber-700">Confirmation deadline: 10:00 PM today. After the deadline, only admins can modify confirmations.</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: EMPLOYEES LIST */}
              {adminTab === 'employees' && (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h1 className="text-2xl font-bold text-[#0f172a]">Employee Management</h1>
                      <p className="text-xs text-[#64748b]">Manage your organization's meal members.</p>
                    </div>

                    <button
                      onClick={() => setShowAddEmployeeModal(true)}
                      className="px-4 py-2.5 bg-black hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Plus className="h-4 w-4" /> Add Employee
                    </button>
                  </div>

                  {showAddEmployeeModal && (
                    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                      <div className="bg-white max-w-md w-full p-8 rounded-2xl border border-slate-100 shadow-2xl relative">
                        <h3 className="text-lg font-bold text-[#0f172a] mb-4">Add New Employee</h3>
                        <form onSubmit={handleAddEmployee} className="space-y-4">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Full Name</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. John Doe"
                              value={newEmpName}
                              onChange={(e) => setNewEmpName(e.target.value)}
                              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Email Address</label>
                            <input
                              type="email"
                              required
                              placeholder="e.g. john@acme.com"
                              value={newEmpEmail}
                              onChange={(e) => setNewEmpEmail(e.target.value)}
                              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Department</label>
                              <select
                                value={newEmpDept}
                                onChange={(e) => setNewEmpDept(e.target.value)}
                                className="w-full px-3 py-2.5 border rounded-xl bg-white text-xs font-semibold focus:outline-none"
                              >
                                <option value="Engineering">Engineering</option>
                                <option value="Sales">Sales</option>
                                <option value="Marketing">Marketing</option>
                                <option value="HR">HR</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Behavior Mode</label>
                              <select
                                value={newEmpBehavior}
                                onChange={(e) => setNewEmpBehavior(e.target.value as any)}
                                className="w-full px-3 py-2.5 border rounded-xl bg-white text-xs font-semibold focus:outline-none"
                              >
                                <option value="recurring">Recurring</option>
                                <option value="flexible">Flexible</option>
                              </select>
                            </div>
                          </div>

                          <div className="flex gap-4 pt-4">
                            <button
                              type="button"
                              onClick={() => setShowAddEmployeeModal(false)}
                              className="w-1/2 py-3 rounded-xl border border-slate-200 text-xs font-bold hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={isActionLoading}
                              className="w-1/2 py-3 rounded-xl bg-black text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-50"
                            >
                              Invite Employee
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-6 max-w-md">
                    <div className="bg-white border border-[#eaedf0] p-4 rounded-xl">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Employees</span>
                      <span className="text-xl font-bold block mt-1">102</span>
                    </div>
                    <div className="bg-white border border-[#eaedf0] p-4 rounded-xl">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Recurring</span>
                      <span className="text-xl font-bold block mt-1 text-indigo-600">74</span>
                    </div>
                    <div className="bg-white border border-[#eaedf0] p-4 rounded-xl">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Flexible</span>
                      <span className="text-xl font-bold block mt-1 text-emerald-600">28</span>
                    </div>
                  </div>

                  <div className="bg-white border border-[#eaedf0] rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="text-[11px] text-[#64748b] bg-[#fafbfc] uppercase tracking-wider font-semibold border-b border-[#eaedf0]">
                          <tr>
                            <th className="px-6 py-3.5">Employee Name</th>
                            <th className="px-6 py-3.5">Department</th>
                            <th className="px-6 py-3.5">Meal Type</th>
                            <th className="px-6 py-3.5">Meal Slots</th>
                            <th className="px-6 py-3.5">Status</th>
                            <th className="px-6 py-3.5">Confirmed Today</th>
                            <th className="px-6 py-3.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#eaedf0] text-sm">
                          {employeesList.map((emp) => (
                            <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full overflow-hidden border">
                                  <img src={emp.avatar} alt={emp.name} className="w-full h-full object-cover" />
                                </div>
                                <div>
                                  <p className="font-semibold text-[#0f172a]">{emp.name}</p>
                                  <p className="text-[10px] text-slate-400">{emp.email}</p>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-slate-500">{emp.dept}</td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                                  emp.type === 'Recurring' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'
                                }`}>{emp.type}</span>
                              </td>
                              <td className="px-6 py-4 text-slate-500 font-medium">{emp.slots}</td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  emp.status === 'Active' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                                }`}>{emp.status}</span>
                              </td>
                              <td className="px-6 py-4">
                                {emp.confirmedToday ? (
                                  <Check className="h-4.5 w-4.5 text-emerald-600 font-bold" />
                                ) : (
                                  <X className="h-4.5 w-4.5 text-slate-300 font-bold" />
                                )}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button
                                  onClick={() => toggleEmployeeStatus(emp.id)}
                                  className="text-xs font-semibold text-slate-500 hover:text-black"
                                >
                                  Toggle Status
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: REPORTS PAGE */}
              {adminTab === 'reports' && (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-2xl font-bold text-[#0f172a]">Reports & Analytics</h1>
                    <p className="text-xs text-[#64748b]">Track meal consumption trends and generate detailed reports.</p>
                  </div>

                  <div className="bg-white border border-[#eaedf0] p-4 rounded-xl flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex gap-4">
                      <select className="px-3 py-2 border rounded-xl text-xs font-semibold bg-white focus:outline-none">
                        <option>01 Jun 2025 - 30 Jun 2025</option>
                      </select>
                      <select className="px-3 py-2 border rounded-xl text-xs font-semibold bg-white focus:outline-none">
                        <option>Report Type: Monthly</option>
                      </select>
                      <select className="px-3 py-2 border rounded-xl text-xs font-semibold bg-white focus:outline-none">
                        <option>Meal Slot: All</option>
                      </select>
                    </div>
                    <div className="flex gap-3">
                      <button className="px-4 py-2 border rounded-xl text-xs font-bold text-[#64748b] hover:bg-slate-50">Export Excel</button>
                      <button className="px-4 py-2 bg-black hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"><Download className="h-3.5 w-3.5" /> Download PDF</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Daily Meal Consumption Bar Chart */}
                    <div className="bg-white border border-[#eaedf0] rounded-2xl p-6 lg:col-span-2 h-[280px]">
                      <h3 className="text-base font-bold text-[#0f172a] mb-4">Daily Meal Consumption</h3>
                      <div className="h-[200px] w-full">
                        <BarChart data={reportsBarData} options={trendChartOptions} />
                      </div>
                    </div>

                    {/* Meal Type Distribution Pie */}
                    <div className="bg-white border border-[#eaedf0] rounded-2xl p-6 flex flex-col justify-between h-[280px] relative">
                      <h3 className="text-base font-bold text-[#0f172a]">Meal Type Distribution</h3>
                      
                      <div className="flex-grow min-h-[140px] relative flex items-center justify-center">
                        <div className="w-full h-full max-h-[140px]">
                          <DonutChart data={distributionPieData} options={breakdownDonutOptions} />
                        </div>
                        <div className="absolute text-center pointer-events-none">
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Recurring</span>
                          <span className="text-base font-bold text-[#0f172a] block">64%</span>
                        </div>
                      </div>
                      
                      <div className="space-y-1 text-xs mt-2 border-t border-slate-50 pt-2 flex justify-between">
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]" /> Recurring (64%)</div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#f97316]" /> Flexible (36%)</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-[#eaedf0] rounded-2xl p-6 space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-base font-bold text-[#0f172a]">Top Consumers This Month</h3>
                      <button className="text-xs text-slate-500 hover:text-black">View all</button>
                    </div>
                    <div className="space-y-3.5">
                      {[
                        { rank: 1, name: 'Daniel Rivera', dept: 'Engineering', count: 58, color: '#3b82f6' },
                        { rank: 2, name: 'Mia Kovac', dept: 'Marketing', count: 54, color: '#10b981' },
                        { rank: 3, name: 'Arjun Banerjee', dept: 'Sales', count: 49, color: '#f59e0b' },
                        { rank: 4, name: 'Lana Fischer', dept: 'Finance', count: 45, color: '#0f766e' },
                        { rank: 5, name: 'Tomas Olsen', dept: 'Engineering', count: 41, color: '#eab308' }
                      ].map((c) => (
                        <div key={c.rank} className="flex items-center justify-between text-xs gap-4">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                            c.rank === 1 ? 'bg-[#eab308] text-white' : 'bg-slate-100 text-slate-600'
                          }`}>{c.rank}</span>
                          <span className="font-semibold text-slate-800 w-[140px] truncate">{c.name}</span>
                          <span className="text-slate-400 text-[10px] w-[80px]">{c.dept}</span>
                          <div className="flex-grow bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div className="h-full" style={{ width: `${(c.count / 60) * 100}%`, backgroundColor: c.color }} />
                          </div>
                          <span className="font-bold text-slate-800">{c.count} meals</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white border border-[#eaedf0] rounded-2xl p-6 space-y-4">
                    <h3 className="text-base font-bold text-[#0f172a]">Saved Reports</h3>
                    <div className="space-y-3">
                      {[
                        { name: 'June Monthly Consumption', type: 'Monthly', date: '01 Jul 2025' },
                        { name: 'Department Breakdown Q2', type: 'Department-wise', date: '28 Jun 2025' },
                        { name: 'Weekly Lunch Trends', type: 'Weekly', date: '23 Jun 2025' }
                      ].map((rep, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3.5 border border-slate-100 hover:border-slate-200 rounded-xl transition-all">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-slate-400" />
                            <div>
                              <p className="text-xs font-bold text-[#0f172a]">{rep.name}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">{rep.type} • Created {rep.date}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => showToast(`Downloading ${rep.name}...`)}
                            className="p-2 border rounded-lg hover:bg-slate-50 text-slate-500 hover:text-black transition-colors"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: BILLING & INVOICES */}
              {adminTab === 'billing' && (
                <div className="space-y-8">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h1 className="text-2xl font-bold text-[#0f172a]">Billing Management</h1>
                      <p className="text-xs text-[#64748b]">Monthly meal billing and invoice generation.</p>
                    </div>

                    <div className="flex gap-3">
                      <button className="px-4 py-2 border rounded-xl text-xs font-bold text-[#64748b] hover:bg-slate-50">Export CSV</button>
                      <button
                        onClick={() => showToast('Invoices compiled and generated for June 2025!')}
                        className="px-4 py-2 bg-black hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                      >
                        <Plus className="h-4 w-4" /> Generate Invoice
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-white border border-[#eaedf0] p-4 rounded-xl text-xs font-bold">
                    <div className="flex items-center gap-3">
                      <ChevronLeft className="h-4 w-4 text-slate-400" />
                      <span>June 2025</span>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                    <span className="text-[#64748b] font-medium">Billing cycle: Jun 1 – Jun 30, 2025</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white border border-[#eaedf0] rounded-2xl p-5 relative">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Meals This Month</span>
                      <span className="text-3xl font-bold text-[#0f172a] block mt-3">{billingTotalMeals.toLocaleString()}</span>
                      <span className="text-[10px] text-emerald-600 font-bold block mt-1.5">↑ +8.2% vs last month</span>
                    </div>

                    <div className="bg-white border border-[#eaedf0] rounded-2xl p-5 relative">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Amount Due</span>
                      <span className="text-3xl font-bold text-[#0f172a] block mt-3">₹{billingFinalAmount.toLocaleString()}</span>
                      <span className="text-[10px] text-slate-400 font-medium block mt-1.5">Across {billingList.length} employees</span>
                    </div>

                    <div className="bg-white border border-[#eaedf0] rounded-2xl p-5 relative">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Paid</span>
                      <span className="text-3xl font-bold text-[#10b981] block mt-3">₹{(billingFinalAmount * 0.65).toFixed(0)}</span>
                      <span className="text-[10px] text-[#10b981] font-bold block mt-1.5">65% collected</span>
                    </div>

                    <div className="bg-white border border-[#eaedf0] rounded-2xl p-5 relative">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Pending</span>
                      <span className="text-3xl font-bold text-[#f59e0b] block mt-3">₹{(billingFinalAmount * 0.35).toFixed(0)}</span>
                      <span className="text-[10px] text-[#f59e0b] font-bold block mt-1.5">35% outstanding</span>
                    </div>
                  </div>

                  <div className="bg-white border border-[#eaedf0] rounded-2xl overflow-hidden">
                    <div className="px-6 py-5 border-b border-[#eaedf0] flex justify-between items-center">
                      <h3 className="text-base font-bold text-[#0f172a]">Employee-wise Meal Summary</h3>
                      <button className="px-4 py-2 border rounded-xl text-xs font-bold text-[#64748b] hover:bg-slate-50 flex items-center gap-1.5"><Filter className="h-4 w-4" /> Filter</button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="text-[11px] text-[#64748b] bg-[#fafbfc] uppercase tracking-wider font-semibold border-b border-[#eaedf0]">
                          <tr>
                            <th className="px-6 py-3.5">Employee Name</th>
                            <th className="px-6 py-3.5">Meal Type</th>
                            <th className="px-6 py-3.5">Total Meals</th>
                            <th className="px-6 py-3.5">Meal Rate</th>
                            <th className="px-6 py-3.5">Total Amount</th>
                            <th className="px-6 py-3.5">Adjustments</th>
                            <th className="px-6 py-3.5 text-right">Final Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#eaedf0] text-sm">
                          {billingList.map((b) => (
                            <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4">
                                <p className="font-semibold text-[#0f172a]">{b.name}</p>
                                <p className="text-[10px] text-slate-400">{b.dept}</p>
                              </td>
                              <td className="px-6 py-4"><span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] text-slate-500 font-bold">{b.type}</span></td>
                              <td className="px-6 py-4 font-medium">{b.count}</td>
                              <td className="px-6 py-4 font-mono text-slate-500">₹{b.rate}</td>
                              <td className="px-6 py-4 font-mono font-semibold">₹{b.amount}</td>
                              <td className="px-6 py-4">
                                <input
                                  type="number"
                                  value={b.adj}
                                  onChange={(e) => handleAdjustmentChange(b.id, parseInt(e.target.value) || 0)}
                                  className="w-[80px] px-2 py-1 border border-slate-200 rounded-lg text-xs font-mono text-slate-600 focus:outline-none"
                                />
                              </td>
                              <td className="px-6 py-4 text-right font-mono font-bold text-[#0f172a]">₹{b.amount + b.adj}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50 border-t border-[#eaedf0] text-sm font-bold text-[#0f172a]">
                          <tr>
                            <td colSpan={2} className="px-6 py-4">Grand Total</td>
                            <td className="px-6 py-4">{billingTotalMeals}</td>
                            <td className="px-6 py-4">—</td>
                            <td className="px-6 py-4 font-mono">₹{billingTotalAmount}</td>
                            <td className="px-6 py-4 font-mono text-slate-600">
                              {billingTotalAdj >= 0 ? `+₹${billingTotalAdj}` : `-₹${Math.abs(billingTotalAdj)}`}
                            </td>
                            <td className="px-6 py-4 text-right font-mono text-black">₹{billingFinalAmount}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: SETTINGS & SLOTS CONFIG */}
              {adminTab === 'settings' && (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-2xl font-bold text-[#0f172a]">Settings</h1>
                    <p className="text-xs text-[#64748b] mt-0.5">Manage your organization preferences, meal slot configuration, notifications, and integrations.</p>
                  </div>

                  <div className="flex flex-col lg:flex-row gap-6 items-start">
                    {/* Left settings navigation */}
                    <div className="w-full lg:w-[240px] bg-white border border-[#eaedf0] rounded-2xl p-4 shrink-0 space-y-1">
                      {([
                        { id: 'general', name: 'General', icon: Settings },
                        { id: 'slots', name: 'Meal Slots', icon: ChefHat },
                        { id: 'rules', name: 'Confirmation Rules', icon: UserCheck },
                        { id: 'notifications', name: 'Notifications', icon: Bell },
                        { id: 'billing', name: 'Billing & Pricing', icon: CreditCard },
                        { id: 'roles', name: 'Roles & Permissions', icon: ShieldAlert },
                        { id: 'integrations', name: 'Integrations', icon: ToggleLeft },
                        { id: 'logs', name: 'Audit Log', icon: ClipboardList }
                      ] as const).map((sub) => {
                        const Icon = sub.icon;
                        const isActive = settingsSubTab === sub.id;
                        return (
                          <button
                            key={sub.id}
                            onClick={() => setSettingsSubTab(sub.id)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all text-left ${
                              isActive
                                ? 'bg-blue-50 text-blue-600 shadow-sm font-bold'
                                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                            {sub.name}
                          </button>
                        );
                      })}
                    </div>

                    {/* Right settings content panel */}
                    <div className="flex-grow bg-white border border-[#eaedf0] rounded-2xl p-8 w-full">
                      
                      {/* GENERAL SETTINGS PANEL */}
                      {settingsSubTab === 'general' && (
                        <form onSubmit={handleSaveSettings} className="space-y-6">
                          <div>
                            <h3 className="text-base font-bold text-[#0f172a]">General Settings</h3>
                            <p className="text-xs text-slate-400">Basic organization and platform configuration.</p>
                          </div>

                          {/* Organization Name */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700 block">Organization Name</label>
                            <input
                              type="text"
                              value={settingsOrgName}
                              onChange={(e) => setSettingsOrgName(e.target.value)}
                              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-black font-semibold text-slate-800"
                            />
                          </div>

                          {/* Organization Logo */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700 block">Organization Logo</label>
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center text-white shrink-0">
                                <ChefHat className="h-6 w-6" />
                              </div>
                              <div className="flex-grow border border-dashed border-slate-200 rounded-xl p-3 flex items-center justify-between">
                                <button
                                  type="button"
                                  onClick={() => showToast('Logo upload triggers file selector...')}
                                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold hover:bg-slate-50 flex items-center gap-1.5 bg-white text-slate-700"
                                >
                                  Upload
                                  <span className="text-[10px] text-slate-400 font-normal">Change Logo</span>
                                </button>
                                <span className="text-[11px] text-slate-400">PNG, SVG up to 2MB</span>
                              </div>
                            </div>
                          </div>

                          {/* Timezone and Date Format */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-700 block">Default Timezone</label>
                              <select
                                value={settingsTimezone}
                                onChange={(e) => setSettingsTimezone(e.target.value)}
                                className="w-full px-3 py-2.5 border rounded-xl bg-white text-xs font-semibold focus:outline-none text-slate-800"
                              >
                                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                                <option value="America/New_York">America/New_York (EST)</option>
                                <option value="Europe/London">Europe/London (GMT)</option>
                                <option value="UTC">UTC</option>
                              </select>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-700 block">Date Format</label>
                              <select
                                value={settingsDateFormat}
                                onChange={(e) => setSettingsDateFormat(e.target.value)}
                                className="w-full px-3 py-2.5 border rounded-xl bg-white text-xs font-semibold focus:outline-none text-slate-800"
                              >
                                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                              </select>
                            </div>
                          </div>

                          {/* Confirmation Deadline Time */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700 block">Confirmation Deadline Time</label>
                            <input
                              type="text"
                              value={settingsDeadline}
                              onChange={(e) => setSettingsDeadline(e.target.value)}
                              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-black text-slate-800 font-semibold"
                            />
                            <span className="text-[11px] text-slate-400 block">Employees must confirm meals before this time each day</span>
                          </div>

                          {/* Default Meal Type for New Employees */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700 block">Default Meal Type for New Employees</label>
                            <div className="flex gap-6 pt-1">
                              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                                <input
                                  type="radio"
                                  name="defaultMealType"
                                  checked={settingsDefaultType === 'recurring'}
                                  onChange={() => setSettingsDefaultType('recurring')}
                                  className="accent-black"
                                />
                                Recurring
                              </label>
                              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                                <input
                                  type="radio"
                                  name="defaultMealType"
                                  checked={settingsDefaultType === 'flexible'}
                                  onChange={() => setSettingsDefaultType('flexible')}
                                  className="accent-black"
                                />
                                Flexible
                              </label>
                            </div>
                          </div>

                          {/* Working Days */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700 block">Working Days</label>
                            <div className="flex flex-wrap gap-4 pt-1">
                              {Object.keys(settingsWorkingDays).map((day) => (
                                <label key={day} className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={(settingsWorkingDays as any)[day]}
                                    onChange={(e) => setSettingsWorkingDays(prev => ({ ...prev, [day]: e.target.checked }))}
                                    className="rounded accent-black border-slate-200"
                                  />
                                  {day}
                                </label>
                              ))}
                            </div>
                          </div>

                          {/* Allow Employee Self-Skip */}
                          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                            <div>
                              <label className="text-xs font-bold text-[#0f172a] block">Allow Employee Self-Skip</label>
                              <span className="text-[11px] text-slate-400 block mt-0.5">Let employees skip meals on their own before the deadline</span>
                            </div>
                            <input
                              type="checkbox"
                              checked={settingsSelfSkip}
                              onChange={(e) => setSettingsSelfSkip(e.target.checked)}
                              className="w-10 h-5 rounded-full accent-black cursor-pointer"
                            />
                          </div>

                          <div className="pt-4 flex justify-end">
                            <button
                              type="submit"
                              disabled={isActionLoading}
                              className="px-6 py-2.5 bg-black hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-all disabled:opacity-50"
                            >
                              {isActionLoading ? 'Saving...' : 'Save Changes'}
                            </button>
                          </div>
                        </form>
                      )}

                      {/* MEAL SLOTS SUB-TAB PANEL */}
                      {settingsSubTab === 'slots' && (
                        <div className="space-y-6">
                          <div>
                            <h3 className="text-base font-bold text-[#0f172a]">Catering Operating Slots</h3>
                            <p className="text-xs text-[#64748b]">Configure cutoff rules and pricing schedules.</p>
                          </div>
                          <div className="space-y-4">
                            {dbSlots.length === 0 ? (
                              <p className="text-xs text-slate-400">Loading active slots configurations...</p>
                            ) : (
                              dbSlots.map((s) => (
                                <div key={s.id} className="p-4 border rounded-xl hover:border-slate-300 transition-all flex justify-between items-center bg-slate-50">
                                  <div>
                                    <span className="font-bold text-[#0f172a] block">{s.name}</span>
                                    <span className="text-xs text-slate-500 font-mono block mt-1">
                                      {format24to12(s.startTime)} - {format24to12(s.endTime)} • Deadline: {format24to12(s.confirmationDeadline)}
                                    </span>
                                  </div>
                                  <span className="font-bold text-emerald-600">₹{s.price}</span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}

                      {/* OTHER SUB-TABS OVERLAYS */}
                      {['rules', 'notifications', 'billing', 'roles', 'integrations', 'logs'].includes(settingsSubTab) && (
                        <div className="py-12 text-center space-y-3">
                          <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
                          <h4 className="text-sm font-bold text-[#0f172a] capitalize">{settingsSubTab.replace('_', ' ')} Configuration</h4>
                          <p className="text-xs text-slate-400">Advanced custom rules & policies for this organization module.</p>
                        </div>
                      )}

                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-[#eaedf0] py-6 text-center text-xs text-[#94a3b8] bg-[#fafbfc] shrink-0">
        MealHub corporate dining suite • Live database synced
      </footer>
    </div>
  );
}
