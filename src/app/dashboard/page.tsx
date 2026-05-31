'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { trpc } from '@/utils/trpc';
import { 
  ChefHat, Calendar, Plus, Mail, Clock, Sparkles, ToggleLeft, UserCheck, Check, X, CreditCard, ClipboardList, LogOut
} from 'lucide-react';

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

export default function UnifiedDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'slots' | 'billing' | 'logs'>('overview');
  
  // Member Specific States
  const [memberTab, setMemberTab] = useState<'rsvp' | 'recurring' | 'history'>('rsvp');
  const [rsvpDate, setRsvpDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedPrefSlots, setSelectedPrefSlots] = useState<{ slotId: string; day: number; qty: number }[]>([]);

  // Admin Specific States (Invites)
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'org_admin' | 'org_member'>('org_member');
  const [showInviteModal, setShowInviteModal] = useState(false);

  // New Slot States
  const [slotName, setSlotName] = useState('');
  const [slotStartTime, setSlotStartTime] = useState('08:00');
  const [slotEndTime, setSlotEndTime] = useState('09:00');
  const [slotDeadline, setSlotDeadline] = useState('22:00');
  const [slotDaysAhead, setSlotDaysAhead] = useState(1);
  const [slotPrice, setSlotPrice] = useState('10.00');
  const [showSlotModal, setShowSlotModal] = useState(false);

  // Billing period state
  const [billStart, setBillStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [billEnd, setBillEnd] = useState(() => new Date().toISOString().split('T')[0]);

  // Alert toast
  const [notification, setNotification] = useState<string | null>(null);

  // Fetch current database user profile details
  const { data: dbUser, isLoading: isProfileLoading, refetch: refetchUser } = trpc.organization.getCurrentProfile.useQuery(undefined, {
    retry: false,
  });

  // Fetch organization details
  const { data: org, isLoading: isOrgLoading, refetch: refetchOrg } = trpc.organization.getDetails.useQuery(undefined, {
    retry: false,
    enabled: !!dbUser?.organizationId,
  });

  const userRole = dbUser?.role || 'org_member';
  const mockOrg = { name: org?.name || 'Loading organization...', timezone: org?.timezone || 'UTC' };

  // Fetch joined organizations and invitations
  const { data: myOrgs = [], refetch: refetchMyOrgs } = trpc.organization.getMyOrganizations.useQuery();
  const { data: pendingInvites = [], refetch: refetchPendingInvites } = trpc.organization.getPendingInvitations.useQuery();
  const { data: sentInvites = [], refetch: refetchSentInvites } = trpc.organization.getSentInvitations.useQuery(undefined, {
    enabled: !!org && userRole === 'org_admin',
  });

  // tRPC Queries and Mutations
  const { data: members = [], refetch: refetchMembers } = trpc.organization.getMembers.useQuery(undefined, {
    enabled: !!org && userRole === 'org_admin',
  });

  const { data: slots = [], refetch: refetchSlots } = trpc.organization.getSlots.useQuery(undefined, {
    enabled: !!org,
  });

  const { data: dailyStats = [], refetch: refetchStats } = trpc.meal.getDailyStats.useQuery({ date: rsvpDate }, {
    enabled: !!org && userRole === 'org_admin',
  });

  const { data: userConfirmations = [], refetch: refetchConfirmations } = trpc.meal.getConfirmations.useQuery({
    startDate: rsvpDate,
    endDate: rsvpDate,
  }, {
    enabled: !!org && userRole === 'org_member',
  });

  const { data: userPrefs = [], refetch: refetchUserPrefs } = trpc.meal.getRecurringPreferences.useQuery(undefined, {
    enabled: !!org && userRole === 'org_member',
  });

  const { data: invoicesList = [], refetch: refetchInvoices } = trpc.billing.getInvoices.useQuery(undefined, {
    enabled: !!org && userRole === 'org_admin',
  });

  const { data: adjustmentLogs = [] } = trpc.analytics.getAdjustmentLogs.useQuery(undefined, {
    enabled: !!org && userRole === 'org_admin',
  });

  // Mutations
  const toggleBehaviorMutation = trpc.organization.toggleMemberBehavior.useMutation();
  const createSlotMutation = trpc.organization.createSlot.useMutation();
  const confirmMealMutation = trpc.meal.confirmMeal.useMutation();
  const adminOverrideMutation = trpc.meal.adminOverride.useMutation();
  const savePrefsMutation = trpc.meal.saveRecurringPreferences.useMutation();
  const generateInvoiceMutation = trpc.billing.generateInvoice.useMutation();
  const sendInvoiceEmailMutation = trpc.billing.sendInvoiceEmail.useMutation();
  
  const switchOrgMutation = trpc.organization.switchOrganization.useMutation();
  const inviteMemberMutation = trpc.organization.inviteMember.useMutation();
  const acceptInviteMutation = trpc.organization.acceptInvitation.useMutation();
  const declineInviteMutation = trpc.organization.declineInvitation.useMutation();


  // Populate user preferences checklist on load
  useEffect(() => {
    if (userPrefs.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedPrefSlots(
        userPrefs.map(p => ({ slotId: p.mealSlotId, day: p.dayOfWeek, qty: p.quantity }))
      );
    }
  }, [userPrefs]);

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await inviteMemberMutation.mutateAsync({
        email: inviteEmail,
        role: inviteRole,
      });
      setInviteEmail('');
      setShowInviteModal(false);
      setNotification(`🎉 Invitation sent to ${inviteEmail}!`);
      refetchSentInvites();
    } catch (err) {
      const error = err as Error;
      setNotification(`❌ Error: ${error.message}`);
    }
  };

  const handleSwitchOrg = async (orgId: string) => {
    try {
      await switchOrgMutation.mutateAsync({ organizationId: orgId });
      setNotification(`Switched organization workspace.`);
      refetchUser();
      refetchOrg();
      refetchMembers();
      refetchSlots();
      refetchStats();
      refetchConfirmations();
      refetchUserPrefs();
      refetchInvoices();
    } catch (err) {
      const error = err as Error;
      setNotification(`❌ Error: ${error.message}`);
    }
  };

  const handleAcceptInvite = async (inviteId: string) => {
    try {
      await acceptInviteMutation.mutateAsync({ invitationId: inviteId });
      setNotification(`Joined organization!`);
      refetchPendingInvites();
      refetchMyOrgs();
      refetchUser();
      refetchOrg();
    } catch (err) {
      const error = err as Error;
      setNotification(`❌ Error: ${error.message}`);
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    try {
      await declineInviteMutation.mutateAsync({ invitationId: inviteId });
      setNotification(`Declined invitation.`);
      refetchPendingInvites();
    } catch (err) {
      const error = err as Error;
      setNotification(`❌ Error: ${error.message}`);
    }
  };


  const handleToggleBehavior = async (memberId: string, currentBehavior: 'recurring' | 'flexible') => {
    try {
      const nextBehavior = currentBehavior === 'recurring' ? 'flexible' : 'recurring';
      await toggleBehaviorMutation.mutateAsync({
        memberId,
        mealBehaviorType: nextBehavior,
      });
      setNotification(`Updated member configuration.`);
      refetchMembers();
    } catch (err) {
      const error = err as Error;
      setNotification(`❌ Error: ${error.message}`);
    }
  };

  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createSlotMutation.mutateAsync({
        name: slotName,
        startTime: slotStartTime,
        endTime: slotEndTime,
        confirmationDeadline: slotDeadline,
        deadlineDaysAhead: slotDaysAhead,
        price: slotPrice,
      });
      setSlotName('');
      setShowSlotModal(false);
      setNotification(`🎉 Meal slot ${slotName} created!`);
      refetchSlots();
    } catch (err) {
      const error = err as Error;
      setNotification(`❌ Error: ${error.message}`);
    }
  };

  const handleMemberConfirm = async (slotId: string, status: 'confirmed' | 'skipped') => {
    try {
      await confirmMealMutation.mutateAsync({
        mealSlotId: slotId,
        date: rsvpDate,
        status,
        quantity: 1,
      });
      setNotification(`Meal RSVP updated to ${status}.`);
      refetchConfirmations();
    } catch (err) {
      const error = err as Error;
      setNotification(`❌ Cutoff Alert: ${error.message}`);
    }
  };

  const handleAdminOverride = async (memberId: string, slotId: string, status: 'confirmed' | 'skipped') => {
    try {
      await adminOverrideMutation.mutateAsync({
        memberId,
        mealSlotId: slotId,
        date: rsvpDate,
        status,
        quantity: 1,
        reason: 'Administrative override adjustment',
      });
      setNotification(`RSVP status overridden by Admin.`);
      refetchStats();
    } catch (err) {
      const error = err as Error;
      setNotification(`❌ Error: ${error.message}`);
    }
  };

  const handleSavePreferences = async () => {
    try {
      await savePrefsMutation.mutateAsync(
        selectedPrefSlots.map(p => ({ mealSlotId: p.slotId, dayOfWeek: p.day, quantity: p.qty }))
      );
      setNotification(`🎉 Recurring meal template saved successfully.`);
      refetchUserPrefs();
    } catch (err) {
      const error = err as Error;
      setNotification(`❌ Error: ${error.message}`);
    }
  };

  const handleGenerateInvoice = async () => {
    try {
      await generateInvoiceMutation.mutateAsync({
        startDate: billStart,
        endDate: billEnd,
      });
      setNotification(`🎉 Invoice draft compiled!`);
      refetchInvoices();
    } catch (err) {
      const error = err as Error;
      setNotification(`❌ Error: ${error.message}`);
    }
  };

  const handleSendInvoiceEmail = async (invId: string) => {
    try {
      await sendInvoiceEmailMutation.mutateAsync({ invoiceId: invId });
      setNotification(`📩 Invoice sent to organization billing email!`);
      refetchInvoices();
    } catch (err) {
      const error = err as Error;
      setNotification(`❌ Error: ${error.message}`);
    }
  };

  const togglePrefSlot = (slotId: string, day: number) => {
    const existingIndex = selectedPrefSlots.findIndex(p => p.slotId === slotId && p.day === day);
    if (existingIndex > -1) {
      setSelectedPrefSlots(selectedPrefSlots.filter((_, idx) => idx !== existingIndex));
    } else {
      setSelectedPrefSlots([...selectedPrefSlots, { slotId, day, qty: 1 }]);
    }
  };

  // MOCK DATA FOR LOCAL SANDBOX WORKTHROUGHS
  const sandboxStats = [
    { label: 'Active Slots Configured', val: slots.length },
    { label: 'Registered Catering Members', val: members.length },
    { label: 'Daily Meals Confirmed', val: dailyStats.reduce((acc, s) => acc + s.confirmedCount, 0) },
    { label: 'Invoice Subtotals', val: `$${invoicesList.reduce((acc, inv) => acc + parseFloat(inv.totalAmount), 0).toFixed(2)}` },
  ];

  if (isProfileLoading || (dbUser?.organizationId && isOrgLoading)) {
    return (
      <div className="min-h-screen w-full bg-background flex flex-col items-center justify-center gap-4">
        <div className="p-4 rounded-2xl bg-gradient-to-tr from-primary to-accent text-white shadow-xl animate-pulse">
          <ChefHat className="h-10 w-10 animate-spin" />
        </div>
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest animate-pulse">Loading LuxeCater Workspace...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-screen flex bg-background font-sans">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl border border-accent/20 bg-card shadow-2xl flex items-center justify-between gap-5 transition-all max-w-sm">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-5 w-5 text-accent animate-spin" />
            <span className="text-xs font-semibold text-foreground">{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-xs hover:underline text-muted-foreground">Dismiss</button>
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-border/40 bg-card/25 backdrop-blur-xl flex flex-col p-6 shrink-0">
        <Link href="/" className="flex items-center gap-3 mb-10 group">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-primary to-accent text-white shadow-lg">
            <ChefHat className="h-5 w-5" />
          </div>
          <span className="font-serif text-lg font-bold tracking-wide">LuxeCater</span>
        </Link>

        <nav className="space-y-1.5 flex-grow">
          {userRole === 'org_admin' ? (
            <>
              {([
                { id: 'overview', name: 'Meal RSVP Board', icon: Calendar },
                { id: 'members', name: 'Catering Members & Invites', icon: UserCheck },
                { id: 'slots', name: 'Meal Slots Timeline', icon: Clock },
                { id: 'billing', name: 'Monthly Invoices', icon: CreditCard },
                { id: 'logs', name: 'Audit Logs', icon: ClipboardList },
              ] as const).map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-medium transition-all ${
                      activeTab === t.id
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                    }`}
                  >
                    <Icon className="h-4 w-4" /> {t.name}
                  </button>
                );
              })}
            </>
          ) : (
            <>
              {([
                { id: 'rsvp', name: 'Daily RSVP Calendar', icon: Calendar },
                { id: 'recurring', name: 'Weekly Templates', icon: UserCheck },
              ] as const).map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setMemberTab(t.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-medium transition-all ${
                      memberTab === t.id
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                    }`}
                  >
                    <Icon className="h-4 w-4" /> {t.name}
                  </button>
                );
              })}
            </>
          )}
        </nav>

        <div className="mt-auto border-t border-border/40 pt-4">
          <Link 
            href="/login" 
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/5 text-xs font-medium transition-all"
          >
            <LogOut className="h-4 w-4" /> Logout
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col min-h-screen overflow-hidden">
        {/* Header */}
        <header className="h-20 border-b border-border/40 flex items-center justify-between px-10 glassmorphism shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="font-serif text-lg font-bold text-foreground block">
                {mockOrg.name}
              </span>
              {myOrgs.length > 1 && (
                <select
                  value={dbUser?.organizationId || ''}
                  onChange={(e) => handleSwitchOrg(e.target.value)}
                  className="px-2.5 py-1 bg-secondary border border-border text-foreground rounded-lg text-xs font-semibold focus:outline-none transition-all"
                >
                  {myOrgs.map((myOrg) => (
                    <option key={myOrg.id} value={myOrg.id}>
                      {myOrg.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">
              ({mockOrg.timezone} timezone)
            </span>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-accent to-primary text-white flex items-center justify-center font-bold text-xs uppercase shadow-md">
                {dbUser?.fullName?.slice(0, 2).toUpperCase() || 'U'}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold">{dbUser?.fullName || dbUser?.email || 'Logged In User'}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">{userRole}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Content Wrapper */}
        <div className="flex-1 p-10 overflow-y-auto relative space-y-8">
          {/* Pending Invitations Banner */}
          {pendingInvites.length > 0 && (
            <div className="space-y-4 animate-fade-in">
              {pendingInvites.map((invite) => (
                <div key={invite.id} className="p-5 rounded-2xl bg-gradient-to-r from-primary/10 via-accent/15 to-primary/10 border border-accent/20 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl shadow-accent/5">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-accent/20 text-accent rounded-xl">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-accent block">Organization Invitation</span>
                      <p className="text-sm font-semibold text-foreground">
                        You have been invited to join <strong className="text-primary">{invite.organizationName}</strong> as an <strong className="capitalize">{invite.role === 'org_admin' ? 'Admin' : 'Member'}</strong>.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleAcceptInvite(invite.id)}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:opacity-90 shadow-lg shadow-primary/20 transition-all cursor-pointer"
                    >
                      Accept Invite
                    </button>
                    <button
                      onClick={() => handleDeclineInvite(invite.id)}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-secondary hover:bg-muted border border-border text-foreground transition-all cursor-pointer"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {userRole === 'org_admin' && (
          <>
            {/* Quick Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {sandboxStats.map((stat, i) => (
                <div key={i} className="glassmorphism p-6 rounded-2xl">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    {stat.label}
                  </span>
                  <span className="text-2xl font-serif font-bold text-foreground">
                    {stat.val}
                  </span>
                </div>
              ))}
            </div>


            {/* TAB: Overrides & Stats */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="glassmorphism rounded-2xl p-6 border border-border/40 space-y-4">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-serif text-lg font-bold">Daily RSVP Board</h3>
                      <p className="text-xs text-muted-foreground">Adjust RSVPs and monitor totals for operational counts.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-accent" />
                      <input
                        type="date"
                        value={rsvpDate}
                        onChange={(e) => setRsvpDate(e.target.value)}
                        className="px-3 py-1.5 rounded-lg bg-secondary border border-border focus:border-primary focus:outline-none text-xs text-foreground font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {dailyStats.map((stat) => (
                      <div key={stat.slotId} className="p-4 rounded-xl bg-secondary/10 border border-border/30 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-accent uppercase tracking-wider">{stat.slotName}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">{formatRange24to12(stat.time)}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-emerald-500/10 p-2 rounded">
                            <span className="text-[10px] text-emerald-400 block font-semibold">Confirmed</span>
                            <span className="text-sm font-bold">{stat.confirmedCount}</span>
                          </div>
                          <div className="bg-rose-500/10 p-2 rounded">
                            <span className="text-[10px] text-rose-400 block font-semibold">Skipped</span>
                            <span className="text-sm font-bold">{stat.skippedCount}</span>
                          </div>
                          <div className="bg-zinc-500/10 p-2 rounded">
                            <span className="text-[10px] text-zinc-400 block font-semibold">Pending</span>
                            <span className="text-sm font-bold">{stat.pendingCount}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Overrides Table */}
                <div className="glassmorphism rounded-2xl border border-border/40 overflow-hidden">
                  <div className="px-8 py-5 border-b border-border/40 bg-card/10 flex items-center justify-between">
                    <span className="font-serif text-sm font-bold">Override Member Statuses ({rsvpDate})</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-xs text-muted-foreground uppercase bg-secondary/20">
                        <tr>
                          <th className="px-8 py-4">Catering Member</th>
                          <th className="px-6 py-4">Behavior</th>
                          {slots.map((s) => (
                            <th key={s.id} className="px-6 py-4">{s.name} RSVP</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {members.length === 0 ? (
                          <tr>
                            <td colSpan={2 + slots.length} className="py-10 text-center text-muted-foreground">
                              No catering members added to override confirmations.
                            </td>
                          </tr>
                        ) : (
                          members.map((m) => (
                            <tr key={m.id} className="hover:bg-secondary/5 transition-colors">
                              <td className="px-8 py-4 font-semibold">{m.fullName || m.email}</td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  m.mealBehaviorType === 'recurring' ? 'bg-indigo-500/15 text-indigo-400' : 'bg-amber-500/15 text-amber-400'
                                }`}>
                                  {m.mealBehaviorType}
                                </span>
                              </td>
                              {slots.map((s) => (
                                <td key={s.id} className="px-6 py-4">
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleAdminOverride(m.id, s.id, 'confirmed')}
                                      className="p-1.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 cursor-pointer"
                                      title="Override Confirm"
                                    >
                                      <Check className="h-3 w-3" />
                                    </button>
                                    <button
                                      onClick={() => handleAdminOverride(m.id, s.id, 'skipped')}
                                      className="p-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                                      title="Override Skip"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                </td>
                              ))}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: Members */}
            {activeTab === 'members' && (
              <div className="space-y-6 animate-fade-in">
                {/* Active Members Table */}
                <div className="glassmorphism rounded-2xl border border-border/40 overflow-hidden">
                  <div className="px-8 py-5 border-b border-border/40 bg-card/10 flex items-center justify-between">
                    <div>
                      <h3 className="font-serif text-sm font-bold">Active Members</h3>
                      <p className="text-[10px] text-muted-foreground">Registered organization users and their configurations.</p>
                    </div>
                    <button
                      onClick={() => setShowInviteModal(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:opacity-90 shadow-lg shadow-primary/20 transition-all cursor-pointer"
                    >
                      <Plus className="h-4 w-4" /> Invite Member
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-xs text-muted-foreground uppercase bg-secondary/20">
                        <tr>
                          <th className="px-8 py-4">Full Name / Email</th>
                          <th className="px-6 py-4">RSVP Mode (Behavior)</th>
                          <th className="px-6 py-4">Access Role</th>
                          <th className="px-8 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {members.map((m) => (
                          <tr key={m.id} className="hover:bg-secondary/5 transition-colors">
                            <td className="px-8 py-4">
                              <p className="font-bold">{m.fullName || 'No Name Provided'}</p>
                              <p className="text-muted-foreground text-[10px]">{m.email}</p>
                            </td>
                            <td className="px-6 py-4 text-[10px]">
                              <span className={`font-mono font-bold block ${m.mealBehaviorType === 'recurring' ? 'text-indigo-400' : 'text-amber-400'}`}>
                                {m.mealBehaviorType.toUpperCase()}
                              </span>
                              <span className="text-[9px] text-muted-foreground block font-sans">
                                {m.mealBehaviorType === 'recurring' 
                                  ? 'Auto-RSVP via template' 
                                  : 'Manual RSVP required'}
                              </span>
                            </td>
                            <td className="px-6 py-4 uppercase font-bold text-[10px]">{m.role}</td>
                            <td className="px-8 py-4 text-right">
                              <button
                                onClick={() => handleToggleBehavior(m.id, m.mealBehaviorType)}
                                className="text-xs font-bold text-accent hover:underline flex items-center gap-1 ml-auto cursor-pointer"
                              >
                                <ToggleLeft className="h-3.5 w-3.5" /> Toggle Behavior
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Sent Invitations List */}
                <div className="glassmorphism rounded-2xl border border-border/40 overflow-hidden">
                  <div className="px-8 py-5 border-b border-border/40 bg-card/10">
                    <h3 className="font-serif text-sm font-bold">Sent Invitations</h3>
                    <p className="text-[10px] text-muted-foreground">Status of pending invites sent to workspace users.</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-xs text-muted-foreground uppercase bg-secondary/20">
                        <tr>
                          <th className="px-8 py-4">Invited Email</th>
                          <th className="px-6 py-4">Assigned Role</th>
                          <th className="px-6 py-4">Sent Date</th>
                          <th className="px-8 py-4 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {sentInvites.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-muted-foreground">
                              No active invitations sent yet.
                            </td>
                          </tr>
                        ) : (
                          sentInvites.map((invite) => (
                            <tr key={invite.id} className="hover:bg-secondary/5 transition-colors">
                              <td className="px-8 py-4 font-mono font-semibold">{invite.email}</td>
                              <td className="px-6 py-4 uppercase text-[10px] font-bold">{invite.role}</td>
                              <td className="px-6 py-4 text-muted-foreground">
                                {new Date(invite.createdAt).toLocaleDateString()}
                              </td>
                              <td className="px-8 py-4 text-right">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  invite.status === 'accepted' ? 'bg-emerald-500/10 text-emerald-400' : invite.status === 'pending' ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'
                                }`}>
                                  {invite.status.toUpperCase()}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: Slots configuration */}
            {activeTab === 'slots' && (
              <div className="glassmorphism rounded-2xl border border-border/40 overflow-hidden">
                <div className="px-8 py-5 border-b border-border/40 bg-card/10 flex items-center justify-between">
                  <div>
                    <h3 className="font-serif text-sm font-bold">Operating Meal Slots</h3>
                    <p className="text-[10px] text-muted-foreground">Operational windows, prices, and confirmations cutoff guidelines.</p>
                  </div>
                  <button
                    onClick={() => setShowSlotModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:opacity-90 shadow-lg shadow-primary/20 transition-all cursor-pointer"
                  >
                    <Plus className="h-4 w-4" /> Add Slot
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-xs text-muted-foreground uppercase bg-secondary/20">
                      <tr>
                        <th className="px-8 py-4">Slot Name</th>
                        <th className="px-6 py-4">Timeframe</th>
                        <th className="px-6 py-4">Cutoff Rule</th>
                        <th className="px-6 py-4">Unit Price</th>
                        <th className="px-8 py-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {slots.map((s) => (
                        <tr key={s.id} className="hover:bg-secondary/5 transition-colors">
                          <td className="px-8 py-4 font-bold text-foreground">{s.name}</td>
                          <td className="px-6 py-4 text-muted-foreground font-mono">{format24to12(s.startTime)} - {format24to12(s.endTime)}</td>
                          <td className="px-6 py-4">
                            {format24to12(s.confirmationDeadline)} ({s.deadlineDaysAhead === 0 ? 'Same Day' : `${s.deadlineDaysAhead} Day Before`})
                          </td>
                          <td className="px-6 py-4 font-bold text-accent">${s.price}</td>
                          <td className="px-8 py-4 text-right">
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold uppercase">
                              Active
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB: Billing & Invoicing */}
            {activeTab === 'billing' && (
              <div className="space-y-6">
                <div className="glassmorphism p-6 rounded-2xl border border-border/40 space-y-4">
                  <h3 className="font-serif text-sm font-bold">Compile Monthly Invoices</h3>
                  <div className="flex flex-col md:flex-row items-end gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Billing Period Start</label>
                      <input
                        type="date"
                        value={billStart}
                        onChange={(e) => setBillStart(e.target.value)}
                        className="px-3 py-2 rounded-xl bg-secondary border border-border text-xs text-foreground font-mono focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Billing Period End</label>
                      <input
                        type="date"
                        value={billEnd}
                        onChange={(e) => setBillEnd(e.target.value)}
                        className="px-3 py-2 rounded-xl bg-secondary border border-border text-xs text-foreground font-mono focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={handleGenerateInvoice}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold bg-primary text-white hover:opacity-90 shadow-lg shadow-primary/20 transition-all cursor-pointer"
                    >
                      Generate Monthly Bill
                    </button>
                  </div>
                </div>

                <div className="glassmorphism rounded-2xl border border-border/40 overflow-hidden">
                  <div className="px-8 py-5 border-b border-border/40 bg-card/10">
                    <span className="font-serif text-sm font-bold">Billing Records</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-xs text-muted-foreground uppercase bg-secondary/20">
                        <tr>
                          <th className="px-8 py-4">Billing Range</th>
                          <th className="px-6 py-4">Total Meals</th>
                          <th className="px-6 py-4">Billing Amount</th>
                          <th className="px-6 py-4">Invoice Status</th>
                          <th className="px-8 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {invoicesList.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-10 text-center text-muted-foreground">
                              No invoice records compiled yet. Adjust ranges above.
                            </td>
                          </tr>
                        ) : (
                          invoicesList.map((inv) => (
                            <tr key={inv.id} className="hover:bg-secondary/5 transition-colors">
                              <td className="px-8 py-4 font-mono font-semibold">
                                {inv.billingPeriodStart} to {inv.billingPeriodEnd}
                              </td>
                              <td className="px-6 py-4">{inv.totalMealsCount} meals</td>
                              <td className="px-6 py-4 font-bold text-accent">${inv.totalAmount}</td>
                              <td className="px-6 py-4 uppercase">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  inv.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                                }`}>
                                  {inv.status}
                                </span>
                              </td>
                              <td className="px-8 py-4 text-right">
                                <button
                                  onClick={() => handleSendInvoiceEmail(inv.id)}
                                  className="text-xs font-bold text-accent hover:underline flex items-center gap-1 ml-auto cursor-pointer"
                                >
                                  <Mail className="h-3.5 w-3.5" /> Email Invoice
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: Logs */}
            {activeTab === 'logs' && (
              <div className="glassmorphism rounded-2xl border border-border/40 overflow-hidden">
                <div className="px-8 py-5 border-b border-border/40 bg-card/10">
                  <h3 className="font-serif text-sm font-bold">Audit Override Logs</h3>
                  <p className="text-[10px] text-muted-foreground">Compliance audit tracking of manual overrides completed by organization admins.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-xs text-muted-foreground uppercase bg-secondary/20">
                      <tr>
                        <th className="px-8 py-4">Logged At</th>
                        <th className="px-6 py-4">Target Date</th>
                        <th className="px-6 py-4">Action Done</th>
                        <th className="px-8 py-4">Audit Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {adjustmentLogs.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-10 text-center text-muted-foreground">
                            No manual override events logged.
                          </td>
                        </tr>
                      ) : (
                        adjustmentLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-secondary/5 transition-colors">
                            <td className="px-8 py-4 text-muted-foreground font-mono">
                              {new Date(log.createdAt).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 font-mono font-semibold">{log.date}</td>
                            <td className="px-6 py-4 font-bold uppercase text-[10px] text-accent">
                              {log.actionType.replace('_', ' ')}
                            </td>
                            <td className="px-8 py-4 text-muted-foreground">{log.details}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ======================================================== */}
        {/* 2. ORGANIZATION MEMBER SPACE */}
        {/* ======================================================== */}
        {userRole === 'org_member' && (
          <div className="space-y-6 animate-fade-in">
              
              {/* TAB: RSVP */}
              {memberTab === 'rsvp' && (
                <div className="glassmorphism p-8 rounded-2xl border border-border/40 space-y-6">
                  <div className="flex justify-between items-center pb-4 border-b border-border/40">
                    <div>
                      <h3 className="font-serif text-lg font-bold flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary" /> Daily Meal RSVP
                      </h3>
                      <p className="text-xs text-muted-foreground">Select your participation status below. Cutoff rules apply.</p>
                    </div>
                    <input
                      type="date"
                      value={rsvpDate}
                      onChange={(e) => setRsvpDate(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-secondary border border-border focus:outline-none text-xs text-foreground font-mono"
                    />
                  </div>

                  <div className="space-y-4">
                    {userConfirmations.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No active meal slots configured for today.</p>
                    ) : (
                      userConfirmations.map((conf) => (
                        <div key={conf.slot.id} className="p-5 rounded-xl bg-secondary/10 border border-border/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-accent uppercase tracking-wider">{conf.slot.name}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">{format24to12(conf.slot.startTime)} - {format24to12(conf.slot.endTime)}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground block mt-1">
                              * Cutoff: {format24to12(conf.slot.confirmationDeadline)} ({conf.slot.deadlineDaysAhead === 0 ? 'Same Day' : `${conf.slot.deadlineDaysAhead} Day Before`})
                            </span>
                            <div className="mt-3">
                              <span className="text-xs text-muted-foreground">Status: </span>
                              <span className={`text-xs font-bold capitalize ${
                                conf.status === 'confirmed' ? 'text-emerald-400' : conf.status === 'skipped' ? 'text-rose-400' : 'text-zinc-400'
                              }`}>
                                {conf.status}
                              </span>
                              {conf.isOverridden && (
                                <span className="text-[9px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded ml-2 font-bold uppercase">
                                  Overridden by Admin
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              disabled={conf.isDeadlinePassed}
                              onClick={() => handleMemberConfirm(conf.slot.id, 'confirmed')}
                              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 disabled:opacity-40 transition-all cursor-pointer"
                            >
                              Confirm
                            </button>
                            <button
                              disabled={conf.isDeadlinePassed}
                              onClick={() => handleMemberConfirm(conf.slot.id, 'skipped')}
                              className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 disabled:opacity-40 transition-all cursor-pointer"
                            >
                              Skip
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB: Recurring preferences */}
              {memberTab === 'recurring' && (
                <div className="glassmorphism p-8 rounded-2xl border border-border/40 space-y-6">
                  <div>
                    <h3 className="font-serif text-lg font-bold flex items-center gap-2">
                      <UserCheck className="h-5 w-5 text-accent" /> Weekly Recurring Meal Preferences
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Configure your weekly schedule. Recurring members are automatically confirmed for selected slots.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {slots.map((slot) => (
                      <div key={slot.id} className="p-4 rounded-xl bg-secondary/15 border border-border/20 space-y-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-accent">{slot.name} Preferences</p>
                        <div className="grid grid-cols-5 gap-2">
                          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((dayName, idx) => {
                            const dayNum = idx + 1; // 1 = Monday, etc.
                            const isChecked = selectedPrefSlots.some(p => p.slotId === slot.id && p.day === dayNum);
                            return (
                              <button
                                key={dayNum}
                                onClick={() => togglePrefSlot(slot.id, dayNum)}
                                className={`p-2.5 rounded-lg border text-xs font-semibold text-center transition-all cursor-pointer ${
                                  isChecked
                                    ? 'bg-primary/20 border-primary text-foreground'
                                    : 'border-border/40 bg-secondary/30 text-muted-foreground hover:bg-secondary'
                                }`}
                              >
                                {dayName}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleSavePreferences}
                    className="px-6 py-3 rounded-xl text-xs font-bold bg-primary text-white hover:opacity-90 shadow-xl shadow-primary/25 transition-all cursor-pointer"
                  >
                    Save Preferences Template
                  </button>
                </div>
              )}
          </div>
        )}

        {/* Footer */}
        <footer className="border-t border-border/40 py-8 text-center text-xs text-muted-foreground bg-secondary/5 mt-12">
          LuxeCater Corporate Management Suite. Live connection active.
        </footer>
      </div>
    </main>

      {/* Invite Member Dialog Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glassmorphism max-w-md w-full p-8 rounded-2xl border border-accent/20 relative shadow-2xl">
            <h3 className="font-serif text-xl font-bold mb-4">Invite Organization Member</h3>
            <form onSubmit={handleInviteMember} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="member@corporate.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Portal Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'org_admin' | 'org_member')}
                  className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground focus:outline-none"
                >
                  <option value="org_member">Catering Member (Meal Taker)</option>
                  <option value="org_admin">Admin (Catering Manager)</option>
                </select>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="w-1/2 py-3 rounded-xl text-xs font-bold bg-secondary hover:bg-muted border border-border transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteMemberMutation.isPending}
                  className="w-1/2 py-3 rounded-xl text-xs font-bold bg-primary text-white hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {inviteMemberMutation.isPending ? 'Sending...' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Slot Creation Dialog Modal */}
      {showSlotModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glassmorphism max-w-md w-full p-8 rounded-2xl border border-accent/20 relative shadow-2xl">
            <h3 className="font-serif text-xl font-bold mb-4">Create Operating Meal Slot</h3>
            <form onSubmit={handleCreateSlot} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Slot Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Breakfast, Dinner"
                  value={slotName}
                  onChange={(e) => setSlotName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Start Time</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., 08:00"
                    value={slotStartTime}
                    onChange={(e) => setSlotStartTime(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">End Time</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., 09:30"
                    value={slotEndTime}
                    onChange={(e) => setSlotEndTime(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">RSVP Cutoff Time (HH:MM)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., 22:00"
                    value={slotDeadline}
                    onChange={(e) => setSlotDeadline(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">RSVP Deadline Day</label>
                  <select
                    value={slotDaysAhead}
                    onChange={(e) => setSlotDaysAhead(parseInt(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground focus:outline-none"
                  >
                    <option value="0">Same Day of Meal</option>
                    <option value="1">1 Day Before Meal</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Meal Slot Price ($)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., 12.50"
                  value={slotPrice}
                  onChange={(e) => setSlotPrice(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground font-mono focus:outline-none"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSlotModal(false)}
                  className="w-1/2 py-3 rounded-xl text-xs font-bold bg-secondary hover:bg-muted border border-border transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSlotMutation.isPending}
                  className="w-1/2 py-3 rounded-xl text-xs font-bold bg-primary text-white hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {createSlotMutation.isPending ? 'Creating...' : 'Create Slot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
