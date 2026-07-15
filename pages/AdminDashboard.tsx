
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../components/LanguageContext';
import { getAllUsers, toggleUserRestriction, deleteUser, mapRole, getArchivedUsers } from '../services/authService';
import { getAdminAuditLogs, getAllUserUsage, getUserUsageLogs, getPlatformReports, getUserUsageByRange } from '../services/coachService';
import { getGlobalStats } from '../services/courseService';
import { UserRole, PackageType, CourseFeedback, FeedbackAuditLog } from '../types';
import { useAppStore } from '../store/useAppStore';
import { clearAllRecordings } from '../utils/recordingStore';
import { getSystemConfig, updateSystemConfig, SystemConfig } from '../services/systemConfigService';
import { VisualContentAdmin } from '../components/VisualContentAdmin';
import { DiscountManagementAdmin } from '../components/DiscountManagementAdmin';
import { getAllAccessRequests, approveAccessRequest, rejectAccessRequest, disableAccessRequest, issueSnehiRefund } from '../services/snehiAccessService';
import { supabase } from '../lib/supabase';

interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

const Spin = ({ c = 'border-white' }: { c?: string }) => <div className={`w-5 h-5 border-2 ${c} border-t-transparent rounded-full animate-spin`} />;

const AdminDashboard: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'stats' | 'audit' | 'content' | 'ai' | 'mods' | 'usage_history' | 'reports' | 'config' | 'custom_scenarios' | 'snehi_access' | 'feedback' | 'attribution' | 'discounts'>('users');
  const [attributionStats, setAttributionStats] = useState<any>(null);
  const [loadingAttribution, setLoadingAttribution] = useState(false);
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [usageData, setUsageData] = useState<any[]>([]);
  const [reportsData, setReportsData] = useState<any[]>([]);
  const [filteredUsageData, setFilteredUsageData] = useState<any[]>([]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [filterRole, setFilterRole] = useState<string>('ALL');
  const [filterPackage, setFilterPackage] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ACTIVE');

  const [selectedAuditUser, setSelectedAuditUser] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [selectedUsageUser, setSelectedUsageUser] = useState<string | null>(null);
  const [usageLogs, setUsageLogs] = useState<any[]>([]);
  const [customScenarios, setCustomScenarios] = useState<any[]>([]);

  // Course Feedback States
  const [feedbacks, setFeedbacks] = useState<CourseFeedback[]>([]);
  const [feedbackAuditLogs, setFeedbackAuditLogs] = useState<FeedbackAuditLog[]>([]);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [showFeedbackAudit, setShowFeedbackAudit] = useState(false);
  const [editingFeedback, setEditingFeedback] = useState<CourseFeedback | null>(null);
  const [editText, setEditText] = useState('');
  const [editSuccessStory, setEditSuccessStory] = useState('');

  // Course Feedback Filters
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [feedbackStatusFilter, setFeedbackStatusFilter] = useState<string>('all');
  const [consentFilter, setConsentFilter] = useState<string>('all');

  // Notification Modal States
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [notificationTargetUserId, setNotificationTargetUserId] = useState('');
  const [notificationTargetUserName, setNotificationTargetUserName] = useState('');
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState<'info' | 'success' | 'warning' | 'error'>('info');
  const [isSendingNotification, setIsSendingNotification] = useState(false);

  // Platform Stats State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [globalStats, setGlobalStats] = useState({
    totalUsers: 0,
    activeLearners: 0,
    totalModules: 0,
    totalLessons: 0,
    totalRevenue: 0,
    talksCount: 0,
    snehiCount: 0,
    topupRevenue: 0,
    customScenariosCount: 0
  });


  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };


  const handleOpenNotificationModal = (userId: string, userName: string) => {
    setNotificationTargetUserId(userId);
    setNotificationTargetUserName(userName);
    setNotificationTitle('');
    setNotificationMessage('');
    setNotificationType('info');
    setIsNotificationModalOpen(true);
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notificationTargetUserId || !notificationTitle || !notificationMessage) return;
    setIsSendingNotification(true);
    try {
      const { createNotification } = await import('../services/notificationService');
      const data = await createNotification(
        notificationTargetUserId,
        notificationTitle,
        notificationMessage,
        notificationType
      );
      if (data) {
        showNotification("Notification sent successfully", "success");
        setIsNotificationModalOpen(false);
      } else {
        showNotification("Failed to send notification", "error");
      }
    } catch (err: any) {
      console.error("Failed to send notification:", err);
      showNotification("Error sending notification", "error");
    } finally {
      setIsSendingNotification(false);
    }
  };

  const [accessRequests, setAccessRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const fetchAccessRequests = async () => {
    setLoadingRequests(true);
    try {
      const reqs = await getAllAccessRequests();
      setAccessRequests(reqs);
    } catch (err: any) {
      console.error("Error fetching access requests:", err);
      showNotification("Failed to fetch requests", "error");
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleApproveRequest = async (requestId: string, userId: string) => {
    if (!currentUser?.id) return;
    const success = await approveAccessRequest(requestId, userId, currentUser.id);
    if (success) {
      showNotification("Access approved successfully", "success");
      fetchAccessRequests();
      fetchData();
    } else {
      showNotification("Failed to approve access", "error");
    }
  };

  const handleRejectRequest = async (requestId: string, userId: string) => {
    if (!currentUser?.id) return;
    const success = await rejectAccessRequest(requestId, userId, currentUser.id);
    if (success) {
      showNotification("Access request rejected", "info");
      fetchAccessRequests();
      fetchData();
    } else {
      showNotification("Failed to reject access", "error");
    }
  };

  const handleDisableRequest = async (requestId: string, userId: string) => {
    if (!currentUser?.id) return;
    const success = await disableAccessRequest(requestId, userId, currentUser.id);
    if (success) {
      showNotification("Access disabled successfully", "info");
      fetchAccessRequests();
      fetchData();
    } else {
      showNotification("Failed to disable access", "error");
    }
  };

  const handleRefundRequest = async (requestId: string, userId: string) => {
    if (!currentUser?.id) return;
    if (!window.confirm("Are you sure you want to refund this SNEHI subscription? Access will be revoked.")) return;
    const success = await issueSnehiRefund(requestId, userId, currentUser.id);
    if (success) {
      showNotification("SNEHI access refunded successfully", "success");
      fetchAccessRequests();
      fetchData();
    } else {
      showNotification("Failed to refund access", "error");
    }
  };

  const fetchFeedbackData = async () => {
    setLoadingFeedback(true);
    try {
      const { adminGetAllFeedback, adminGetFeedbackAuditLogs } = await import('../services/feedbackService');
      const [fbList, logList] = await Promise.all([
        adminGetAllFeedback(),
        adminGetFeedbackAuditLogs()
      ]);
      setFeedbacks(fbList);
      setFeedbackAuditLogs(logList);
    } catch (e) {
      console.error("Failed to load feedback data:", e);
      showNotification("Failed to load feedback list", "error");
    } finally {
      setLoadingFeedback(false);
    }
  };

  const handleUpdateFeedbackStatus = async (feedbackId: string, status: 'pending' | 'approved' | 'rejected' | 'hidden') => {
    if (!currentUser?.id) return;
    try {
      const { adminUpdateFeedbackStatus } = await import('../services/feedbackService');
      const ok = await adminUpdateFeedbackStatus(feedbackId, status, currentUser.id);
      if (ok) {
        showNotification(`Feedback status updated to ${status}`, "success");
        fetchFeedbackData();
      } else {
        showNotification("Failed to update status", "error");
      }
    } catch (e) {
      console.error("Update feedback status error:", e);
      showNotification("Error updating status", "error");
    }
  };

  const handleTogglePinFeedback = async (feedbackId: string, currentPinStatus: boolean) => {
    try {
      const { adminTogglePinFeedback } = await import('../services/feedbackService');
      const ok = await adminTogglePinFeedback(feedbackId, !currentPinStatus);
      if (ok) {
        showNotification(currentPinStatus ? "Feedback unfeatured" : "Feedback featured/pinned", "success");
        fetchFeedbackData();
      } else {
        showNotification("Failed to toggle feature status", "error");
      }
    } catch (e) {
      console.error("Pin toggle error:", e);
    }
  };

  const handleOpenEditFeedbackModal = (fb: CourseFeedback) => {
    setEditingFeedback(fb);
    setEditText(fb.review_text);
    setEditSuccessStory(fb.success_story || '');
  };

  const handleSaveFeedbackEdit = async () => {
    if (!editingFeedback) return;
    try {
      const { adminEditFeedbackText } = await import('../services/feedbackService');
      const ok = await adminEditFeedbackText(editingFeedback.id, editText, editSuccessStory);
      if (ok) {
        showNotification("Feedback edited successfully", "success");
        setEditingFeedback(null);
        fetchFeedbackData();
      } else {
        showNotification("Failed to save changes", "error");
      }
    } catch (e) {
      console.error("Edit save error:", e);
      showNotification("Error saving feedback text", "error");
    }
  };

  const handleBulkApproveFeedbacks = async () => {
    if (!currentUser?.id) return;
    const pending = feedbacks.filter(f => f.status === 'pending');
    if (pending.length === 0) {
      showNotification("No pending feedbacks to approve", "info");
      return;
    }
    try {
      const { adminUpdateFeedbackStatus } = await import('../services/feedbackService');
      let count = 0;
      for (const fb of pending) {
        const ok = await adminUpdateFeedbackStatus(fb.id, 'approved', currentUser.id);
        if (ok) count++;
      }
      showNotification(`Bulk approved ${count} reviews`, "success");
      fetchFeedbackData();
    } catch (e) {
      console.error("Bulk approve error:", e);
      showNotification("Error during bulk approval", "error");
    }
  };

  const handleBulkExportFeedbackCSV = () => {
    if (feedbacks.length === 0) return;
    const headers = ['User Name', 'Phone', 'Overall Rating', 'Content Rating', 'Mentor Rating', 'Learning Rating', 'NPS', 'Consent', 'Status', 'Review Text', 'Success Story', 'Date'];
    const rows = feedbacks.map(f => [
      `"${(f.profiles?.full_name || 'Anonymous').replace(/"/g, '""')}"`,
      `"${f.profiles?.phone || 'Private'}"`,
      f.overall_rating,
      f.content_rating,
      f.mentor_rating,
      f.learning_rating,
      f.recommendation_score,
      f.testimonial_permission ? 'Yes' : 'No',
      f.status,
      `"${f.review_text.replace(/"/g, '""')}"`,
      `"${(f.success_story || '').replace(/"/g, '""')}"`,
      new Date(f.completion_date).toLocaleDateString()
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Simplish_Feedback_Export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkExportFeedbackJSON = () => {
    if (feedbacks.length === 0) return;
    const blob = new Blob([JSON.stringify(feedbacks, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Simplish_Feedback_Export_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchAttributionData = async () => {
    setLoadingAttribution(true);
    try {
      // 1. Fetch analytics events
      const { data: events, error: eventsError } = await supabase
        .from('analytics_events')
        .select('*');

      if (eventsError && !eventsError.message.includes('relation "analytics_events" does not exist')) {
        throw eventsError;
      }

      // 2. Fetch profiles with attribution details
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, utm_source, utm_medium, utm_campaign, package_type, package_status, created_at');

      if (profilesError) throw profilesError;

      // 3. Compute counts
      const totalVisits = (events || []).filter(e => e.event_name === 'web_page_viewed').length;
      const totalClicks = (events || []).filter(e => e.event_name === 'web_download_button_clicked').length;
      const totalInstalls = (events || []).filter(e => e.event_name === 'app_first_open').length;
      
      const totalRegistered = profiles?.length || 0;
      const totalSubscribed = profiles?.filter(p => p.package_status === 'ACTIVE' || p.package_status === 'ACTIVE_Snehi').length || 0;

      // UTM breakdowns
      const utmSources: Record<string, any> = {};
      profiles?.forEach(p => {
        const src = p.utm_source || 'organic';
        if (!utmSources[src]) {
          utmSources[src] = { source: src, clicks: 0, installs: 0, signups: 0, subscribers: 0 };
        }
        utmSources[src].signups++;
        if (p.package_status === 'ACTIVE' || p.package_status === 'ACTIVE_Snehi') {
          utmSources[src].subscribers++;
        }
      });

      // Map clicks and installs from events per source
      (events || []).forEach(e => {
        const src = e.properties?.utm_source || 'organic';
        if (!utmSources[src]) {
          utmSources[src] = { source: src, clicks: 0, installs: 0, signups: 0, subscribers: 0 };
        }
        if (e.event_name === 'web_download_button_clicked') {
          utmSources[src].clicks++;
        } else if (e.event_name === 'app_first_open') {
          utmSources[src].installs++;
        }
      });

      setAttributionStats({
        totalVisits: totalVisits || 1, // Avoid divide by zero
        totalClicks: totalClicks || 1,
        totalInstalls: totalInstalls || 0,
        totalRegistered: totalRegistered || 0,
        totalSubscribed: totalSubscribed || 0,
        utmBreakdown: Object.values(utmSources)
      });
    } catch (err) {
      console.error('Error fetching attribution data:', err);
    } finally {
      setLoadingAttribution(false);
    }
  };

  useEffect(() => {
    fetchAccessRequests();
    if (activeTab === 'feedback') {
      fetchFeedbackData();
    } else if (activeTab === 'attribution') {
      fetchAttributionData();
    }
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    // ── PRIORITY: Resolve current user role FIRST, independently ──────────────
    // This runs before any data fetch that could throw. Keeps role-gated tabs
    // visible even if downstream fetches (refunds, reports, etc.) fail.
    try {
      const { data: { session: earlySession } } = await supabase.auth.getSession();
      if (earlySession) {
        // Use maybeSingle() — .single() throws if RLS returns 0 rows (even when row exists)
        const { data: earlyProfile } = await supabase.from('profiles').select('role').eq('id', earlySession.user.id).maybeSingle();
        const earlyRole = mapRole(earlyProfile?.role || earlySession.user.user_metadata?.role);
        console.log("📊 AdminDashboard Early Role (pre-fetch):", earlyRole);
        setCurrentUser({ ...earlySession.user, role: earlyRole });
      }
    } catch (roleErr) {
      console.warn("📊 AdminDashboard: Early role fetch failed, tabs may be restricted:", roleErr);
    }
    // ──────────────────────────────────────────────────────────────────────────

    try {
      const profiles = await getAllUsers();
      const archived = await getArchivedUsers();
      
      const allUsers = [...profiles, ...archived].sort((a, b) => {
        // Use archived_at if available (for deleted users), otherwise created_at
        const dateA = new Date(a.archived_at || a.created_at).getTime();
        const dateB = new Date(b.archived_at || b.created_at).getTime();
        return dateB - dateA;
      });
      setUsers(allUsers);

      const config = await getSystemConfig();
      setSystemConfig(config);

      // Re-verify session after data load (keeps the role label accurate)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Use maybeSingle() — .single() throws if RLS returns 0 rows
        const { data: profile, error: pError } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
        console.log("📊 AdminDashboard Current Session User:", session.user);
        console.log("📊 AdminDashboard Current Profile Fetch:", profile, pError);
        const mappedRole = mapRole(profile?.role || session.user.user_metadata?.role);
        console.log("📊 AdminDashboard Final Mapped Role:", mappedRole);
        setCurrentUser({ ...session.user, role: mappedRole });
      }

      const stats = await getGlobalStats();

      // Fetch total refunded amount — wrapped to prevent crashing the whole load
      let refunds: any[] = [];
      try {
        const { data } = await supabase.from('refunds').select('refund_amount, status');
        if (data) refunds = data;
      } catch (err) {
        console.warn("Failed to fetch refunds:", err);
      }
      const totalRefunded = (refunds || [])
        .filter((r: any) => r.status === 'completed')
        .reduce((sum: number, r: any) => sum + Number(r.refund_amount || 0), 0);

      // Calculate Revenue and Package Counts from all users list (including deleted for historical tallying)
      const priceTalks = config?.price_talks || 299;
      const priceSnehi = config?.price_snehi || 499;

      let totalRevenue = 0;
      let talksCount = 0;
      let snehiCount = 0;

      allUsers.forEach(u => {
        if (u.package_type === PackageType.TALKS) {
          totalRevenue += priceTalks;
          talksCount++;
        } else if (u.package_type === PackageType.SNEHI) {
          totalRevenue += priceSnehi;
          snehiCount++;
        } else if (u.package_type === PackageType.BOTH) {
          totalRevenue += (priceTalks + priceSnehi);
          talksCount++;
          snehiCount++;
        }
        totalRevenue += (u.topup_amount || 0);
      });

      // Deduct refunded amounts from the total revenue
      totalRevenue = Math.max(0, totalRevenue - totalRefunded);

      const topupRevenue = allUsers.reduce((sum, u) => sum + (u.topup_amount || 0), 0);

      setGlobalStats({
        ...stats,
        totalRevenue,
        talksCount,
        snehiCount,
        topupRevenue
      });

      const usage = await getAllUserUsage();
      setUsageData(usage);

      const reports = await getPlatformReports();
      setReportsData(reports);
      
      const scenarios = await import('../services/courseService').then(m => m.getAllCustomScenarios());
      setCustomScenarios(scenarios);

      // Reset filtered usage on initial load
      setFilteredUsageData([]);
      
      // If dates are already set (on manual refresh), fetch range data
      if (startDate || endDate) {
        const rangeUsage = await getUserUsageByRange(startDate, endDate);
        setFilteredUsageData(rangeUsage);
      }
    } catch (err: any) {
      setError(err.message || "Could not connect to the database.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!systemConfig || !currentUser?.id) return;
    setIsUpdatingConfig(true);
    const { success, error } = await updateSystemConfig(systemConfig, currentUser.id);
    setIsUpdatingConfig(false);
    if (success) {
      showNotification('Global settings updated successfully', 'success');
    } else {
      showNotification(`Update failed: ${error}`, 'error');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAudit = async (userId: string) => {
    setProcessingId(userId);
    setSelectedAuditUser(userId);
    const logs = await getAdminAuditLogs(userId);
    setAuditLogs(logs);
    setActiveTab('audit');
    setProcessingId(null);
  };

  const handleUsageLogs = async (userId: string) => {
    setProcessingId(userId);
    setSelectedUsageUser(userId);
    const logs = await getUserUsageLogs(userId);
    setUsageLogs(logs);
    setActiveTab('usage_history');
    setProcessingId(null);
  };

  const handleRestrict = async (userId: string, currentStatus: boolean) => {
    setProcessingId(userId);
    const result = await toggleUserRestriction(userId, !currentStatus);
    if (result.success) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_restricted: !currentStatus } : u));
      showNotification(`User ${!currentStatus ? 'restricted' : 'unrestricted'} successfully`, "success");
    } else {
      showNotification(result.error || "Failed to update user restriction", "error");
    }
    setProcessingId(null);
  };

  const handleDelete = async (userId: string) => {
    if (!window.confirm("Are you sure?")) return;
    setProcessingId(userId);
    const result = await deleteUser(userId);
    if (result.success) setUsers(prev => prev.filter(u => u.id !== userId));
    setProcessingId(null);
  };

  const handleUpdateRole = async (userId: string, newRole: UserRole) => {
    setProcessingId(userId);
    const { updateProfile } = await import('../services/authService');
    const result = await updateProfile(userId, { role: newRole });
    if (result.success) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      showNotification(`User role updated to ${newRole}`, "success");
    } else {
      showNotification(result.error || "Failed to update role", "error");
    }
    setProcessingId(null);
  };

  // --- Reports & Users Filtering and Download ---
  const filterByDate = (dateStr: string) => {
    if (!startDate && !endDate) return true;
    if (!dateStr) return false;
    
    // Extract YYYY-MM-DD to match SQL DATE() behavior and avoid timezone shifting
    const isoDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;

    if (startDate && isoDate < startDate) return false;
    if (endDate && isoDate > endDate) return false;

    return true;
  };

  const filteredReports = reportsData.filter(r => filterByDate(r.report_date));
  
  // Update filteredUsers to include users who registered in the range OR had usage in the range
  // AND intersect with Role, Package, and Status filters
  const filteredUsers = users.filter(u => {
    // 1. Date Filter (Range vs Registration)
    const isRegisteredInRange = filterByDate(u.created_at);
    const hasUsageInRange = filteredUsageData.some(usage => usage.user_id === u.id);
    const dateMatch = (!startDate && !endDate) || isRegisteredInRange || hasUsageInRange;
    
    // 2. Role Filter
    const roleMatch = filterRole === 'ALL' || u.role === filterRole;
    
    // 3. Package Filter
    const packageMatch = filterPackage === 'ALL' || u.package_type === filterPackage;
    
    // 4. Status Filter
    const statusMatch = filterStatus === 'ALL' || 
                        (filterStatus === 'ACTIVE' && u.status !== 'DELETED') ||
                        (filterStatus === 'DELETED' && u.status === 'DELETED');

    return dateMatch && roleMatch && packageMatch && statusMatch;
  });

  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
    setFilterRole('ALL');
    setFilterPackage('ALL');
    setFilterStatus('ALL');
    setFilteredUsageData([]);
    // Reload regular data
    fetchData();
  };

  const handleDownloadCSV = () => {
    if (filteredReports.length === 0) {
      showNotification("No data available to download.", "info");
      return;
    }

    const isSuperAdmin = currentUser?.role === UserRole.SUPER_ADMIN;

    // Define headers based on role
    const headers = [
      "Date",
      "Reg. Users",
      "Active Users",
      "Talks Sold",
      "Snehi Sold",
      "Voice Usage (secs)",
      "Chat Usage (msgs)",
      "Custom Scenarios",
      ...(isSuperAdmin ? ["Revenue (INR)"] : []),
      "Deleted Users"
    ];

    // Build CSV content
    let csvContent = headers.map(h => `"${h}"`).join(",") + "\n";

    filteredReports.forEach(r => {
      const row = [
        `"${new Date(r.report_date).toISOString().split('T')[0]}"`,
        `"${r.registered_count || 0}"`,
        `"${r.active_count || 0}"`,
        `"${r.talks_sold || 0}"`,
        `"${r.snehi_sold || 0}"`,
        `"${r.total_voice_seconds || 0}"`,
        `"${r.total_messages || 0}"`,
        `"${r.custom_scenarios_created || 0}"`,
        ...(isSuperAdmin ? [`"${r.daily_revenue || 0}"`] : []),
        `"${r.deleted_count || 0}"`
      ];
      csvContent += row.join(",") + "\n";
    });

    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `platform_reports_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadUsersCSV = () => {
    if (filteredUsers.length === 0) {
      showNotification("No users found to download.", "info");
      return;
    }

    const isFiltering = startDate || endDate;
    const usageSource = isFiltering ? filteredUsageData : usageData;

    const headers = ['Full Name', 'Phone', 'Place', 'Role', 'Package', 'Status', 'Join Date', 'Voice (Min)', 'Chat (Msg)', 'Topup (₹)'];
    const rows = filteredUsers.map(u => {
      const usage = filteredUsageData.find(d => d.user_id === u.id);
      return [
        u.full_name,
        u.phone,
        u.place || '',
        u.role,
        u.package_type || 'NONE',
        u.package_status || (u.deleted_at ? 'DELETED' : 'ACTIVE'),
        new Date(u.created_at).toLocaleDateString(),
        Math.floor((usage?.voice_seconds_total || 0) / 60), // Convert seconds to minutes
        usage?.chat_messages_total || 0,
        u.topup_amount || 0
      ].map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',');
    });

    let csvContent = "data:text/csv;charset=utf-8," + headers.map(h => `"${h}"`).join(",") + "\n" + rows.join("\n");

    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `user_management_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-900">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 bg-white dark:bg-slate-900 min-h-full transition-all duration-300 relative">
      {/* Toast Notifications */}
      <div className="fixed top-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none">
        {notifications.map(n => (
          <div
            key={n.id}
            className={`
              pointer-events-auto px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-right-full duration-300
              ${n.type === 'success' ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-800' : ''}
              ${n.type === 'error' ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-800' : ''}
              ${n.type === 'info' ? 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-800' : ''}
            `}
          >
            <span className="text-xl">
              {n.type === 'success' ? '✅' : n.type === 'error' ? '❌' : 'ℹ️'}
            </span>
            <span className="font-black text-xs uppercase tracking-wider">{n.message}</span>
            <button
              onClick={() => setNotifications(prev => prev.filter(notif => notif.id !== n.id))}
              className="ml-auto text-current opacity-50 hover:opacity-100 transition-opacity"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-4xl font-black text-blue-900 dark:text-slate-100 tracking-tighter uppercase">{t({ en: 'Admin Dashboard', kn: 'ಅಡ್ಮಿನ್ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್' })}</h2>
          {currentUser && (
            <p className="text-[10px] text-slate-400 font-mono mt-2">
              Role: <span className={currentUser.role === UserRole.SUPER_ADMIN ? 'text-green-600 font-bold' : 'text-red-500 font-bold'}>{currentUser.role || 'NONE'}</span>
            </p>
          )}
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => navigate('/admin/course')}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2"
          >
            <span>📚</span> {t({ en: 'Course Content', kn: 'ಕೋರ್ಸ್ ವಿಷಯ' })}
          </button>
          {currentUser?.role === UserRole.SUPER_ADMIN && (
            <button
              onClick={() => navigate('/admin/ai-instructions')}
              className="px-6 py-2.5 bg-purple-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-purple-700 transition-all flex items-center gap-2"
            >
              <span>🤖</span> {t({ en: 'AI Instructions', kn: 'AI ಸೂಚನೆಗಳು' })}
            </button>
          )}
        </div>
      </div>

      <div className="w-full mb-10">
        <div className="flex flex-wrap bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl shadow-inner gap-1.5 w-full">
          {currentUser?.role === UserRole.SUPER_ADMIN && (
            <button key="users" onClick={() => setActiveTab('users')} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap ${activeTab === 'users' ? 'bg-white shadow text-blue-800' : 'text-slate-400'}`}>{t({ en: 'Users', kn: 'ಬಳಕೆದಾರರು' })}</button>
          )}
          {(currentUser?.role === UserRole.SUPER_ADMIN || currentUser?.role === UserRole.MODERATOR) && (
            <button 
              key="snehi_access" 
              onClick={() => setActiveTab('snehi_access')} 
              className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'snehi_access' ? 'bg-white shadow text-blue-800' : 'text-slate-400'
              }`}
            >
              <span>{t({ en: 'SNEHI Access', kn: 'ಸ್ನೇಹಿ ಪ್ರವೇಶ' })}</span>
              {accessRequests.filter(r => r.status === 'Pending').length > 0 && (
                <span className="px-1.5 py-0.5 bg-red-500 text-white text-[8px] font-black rounded-full animate-pulse">
                  {accessRequests.filter(r => r.status === 'Pending').length}
                </span>
              )}
            </button>
          )}
          <button key="stats" onClick={() => setActiveTab('stats')} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap ${activeTab === 'stats' ? 'bg-white shadow text-blue-800' : 'text-slate-400'}`}>{t({ en: 'General Stats', kn: 'ಅಂಕಿಅಂಶಗಳು' })}</button>
          <button key="reports" onClick={() => setActiveTab('reports')} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap ${activeTab === 'reports' ? 'bg-white shadow text-blue-800' : 'text-slate-400'}`}>{t({ en: 'Reports', kn: 'ವರದಿಗಳು' })}</button>
          <button key="attribution" onClick={() => setActiveTab('attribution')} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap ${activeTab === 'attribution' ? 'bg-white shadow text-blue-800' : 'text-slate-400'}`}>{t({ en: 'App Tracking', kn: 'ಆಪ್ ಟ್ರ್ಯಾಕಿಂಗ್' })}</button>
          <button 
            key="feedback" 
            onClick={() => setActiveTab('feedback')} 
            className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'feedback' ? 'bg-white shadow text-blue-800' : 'text-slate-400'
            }`}
          >
            <span>{t({ en: 'Course Feedback', kn: 'ಕೋರ್ಸ್ ಪ್ರತಿಕ್ರಿಯೆ' })}</span>
            {feedbacks.filter(f => f.status === 'pending').length > 0 && (
              <span className="px-1.5 py-0.5 bg-red-500 text-white text-[8px] font-black rounded-full animate-pulse">
                {feedbacks.filter(f => f.status === 'pending').length}
              </span>
            )}
          </button>
          <button key="content" onClick={() => setActiveTab('content')} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap ${activeTab === 'content' ? 'bg-white shadow text-blue-800' : 'text-slate-400'}`}>{t({ en: 'Visual Content', kn: 'ದೃಶ್ಯ ವಿಷಯ' })}</button>
          {(currentUser?.role === UserRole.SUPER_ADMIN || currentUser?.role === UserRole.MODERATOR) && (
            <button key="discounts" onClick={() => setActiveTab('discounts')} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap ${activeTab === 'discounts' ? 'bg-white shadow text-blue-800' : 'text-slate-400'}`}>{t({ en: 'Discounts', kn: 'ರಿಯಾಯಿತಿ ನಿರ್ವಹಣೆ' })}</button>
          )}

          {currentUser?.role === UserRole.SUPER_ADMIN && (
            <>
              <button key="mods" onClick={() => setActiveTab('mods')} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap ${activeTab === 'mods' ? 'bg-white shadow text-blue-800' : 'text-slate-400'}`}>{t({ en: 'Moderators', kn: 'ಮಾಡರೇಟರ್‌ಗಳು' })}</button>
              <button key="custom_scenarios" onClick={() => setActiveTab('custom_scenarios')} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap ${activeTab === 'custom_scenarios' ? 'bg-white shadow text-blue-800' : 'text-slate-400'}`}>{t({ en: 'Custom Scenarios', kn: 'ಕಸ್ಟಮ್ ಸನ್ನಿವೇಶಗಳು' })}</button>
              <button key="config" onClick={() => setActiveTab('config')} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap ${activeTab === 'config' ? 'bg-white shadow text-blue-800' : 'text-slate-400'}`}>{t({ en: 'Global Settings', kn: 'ಜಾಗತಿಕ ಸೆಟ್ಟಿಂಗ್‌ಗಳು' })}</button>
            </>
          )}
          {selectedAuditUser && <button key="audit" onClick={() => setActiveTab('audit')} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap ${activeTab === 'audit' ? 'bg-white shadow text-blue-800' : 'text-slate-400'}`}>{t({ en: 'Audit', kn: 'ತಪಾಸಣೆ' })}</button>}
        </div>
      </div>

      {activeTab === 'users' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Section Header & Main Actions */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-2">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-2 h-8 bg-blue-600 rounded-full"></div>
                <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none uppercase">
                  {t({ en: 'User Management', kn: 'ಬಳಕೆದಾರ ನಿರ್ವಹಣೆ' })}
                </h3>
              </div>
              <p className="text-sm text-slate-500 font-medium max-w-md">
                {t({ en: 'Monitor user activity, manage roles, and review AI usage metrics across the platform.', kn: 'ಬಳಕೆದಾರರ ಚಟುವಟಿಕೆಯನ್ನು ಮೇಲ್ವಿಚಾರಣೆ ಮಾಡಿ ಮತ್ತು ಪಾತ್ರಗಳನ್ನು ನಿರ್ವಹಿಸಿ.' })}
              </p>
            </div>

            <div className="flex items-center gap-3 w-full lg:w-auto">
              <button
                onClick={fetchData}
                className="flex-1 lg:flex-none px-6 py-3.5 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-200 dark:shadow-none hover:bg-blue-700 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 group"
              >
                <span className="group-hover:rotate-180 transition-transform duration-500">🔄</span> 
                {t({ en: 'Refresh', kn: 'ನವೀಕರಿಸಿ' })}
              </button>
              <button
                onClick={handleDownloadUsersCSV}
                className="flex-1 lg:flex-none px-6 py-3.5 bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border-2 border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-900 hover:bg-blue-50/50 dark:hover:bg-blue-900/20"
              >
                <span>📥</span> {t({ en: 'Export CSV', kn: 'ಎಕ್ಸ್‌ಪೋರ್ಟ್' })}
              </button>
            </div>
          </div>

          {/* Premium Filter Control Card */}
          <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Date Range Picker */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Activity Period</label>
                <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm focus-within:border-blue-500 transition-colors">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 outline-none w-full"
                  />
                  <span className="text-slate-300">→</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 outline-none w-full"
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Account Role</label>
                <div className="relative group">
                  <select
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 p-3.5 pl-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm text-xs font-bold text-slate-700 dark:text-slate-200 appearance-none outline-none focus:border-blue-500 transition-colors cursor-pointer"
                  >
                    <option value="ALL">All Roles</option>
                    <option value={UserRole.STUDENT}>Students Only</option>
                    <option value={UserRole.MODERATOR}>Moderators</option>
                    <option value={UserRole.SUPER_ADMIN}>Super Admins</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
                </div>
              </div>

              {/* Package Selection */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Service Tier</label>
                <div className="relative group">
                  <select
                    value={filterPackage}
                    onChange={(e) => setFilterPackage(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 p-3.5 pl-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm text-xs font-bold text-slate-700 dark:text-slate-200 appearance-none outline-none focus:border-blue-500 transition-colors cursor-pointer"
                  >
                    <option value="ALL">All Packages</option>
                    <option value={PackageType.TALKS}>Simplish Talks</option>
                    <option value={PackageType.SNEHI}>Simplish Snehi</option>
                    <option value={PackageType.BOTH}>Premium (Both)</option>
                    <option value="NONE">No Package</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
                </div>
              </div>

              {/* Status & Clear */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Lifecycle Status</label>
                <div className="flex gap-2">
                  <div className="relative flex-1 group">
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 p-3.5 pl-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm text-xs font-bold text-slate-700 dark:text-slate-200 appearance-none outline-none focus:border-blue-500 transition-colors cursor-pointer"
                    >
                      <option value="ALL">Any Status</option>
                      <option value="ACTIVE">Active Users</option>
                      <option value="DELETED">Archived (Deleted)</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
                  </div>
                  
                  {(startDate || endDate || filterRole !== 'ALL' || filterPackage !== 'ALL' || filterStatus !== 'ALL') && (
                    <button
                      onClick={handleClearFilters}
                      className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors border border-red-100 dark:border-red-900/30 shadow-sm"
                      title="Reset All Filters"
                    >
                      <span className="text-lg">✕</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/50 dark:bg-slate-800/50">
                  <tr>
                    <th className="p-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 dark:border-slate-800">{t({ en: 'User Profile', kn: 'ಬಳಕೆದಾರರು' })}</th>
                    <th className="p-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 dark:border-slate-800">{t({ en: 'Role', kn: 'ಪಾತ್ರ' })}</th>
                    <th className="p-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 dark:border-slate-800">{t({ en: 'Tier & Status', kn: 'ಪ್ಯಾಕೇಜ್' })}</th>
                    <th className="p-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 dark:border-slate-800">{t({ en: 'Voice Minutes', kn: 'ಧ್ವನಿ ಬಳಕೆ' })}</th>
                    <th className="p-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 dark:border-slate-800">{t({ en: 'Chat Messages', kn: 'ಚಾಟ್ ಬಳಕೆ' })}</th>
                    <th className="p-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 dark:border-slate-800 text-right">{t({ en: 'Topup', kn: 'ಟಾಪ್‌ಅಪ್' })}</th>
                    <th className="p-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 dark:border-slate-800 text-right">{t({ en: 'Manage', kn: 'ಕ್ರಮಗಳು' })}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <span className="text-4xl">🔍</span>
                          <h4 className="text-lg font-black text-slate-300 uppercase tracking-widest">{t({ en: 'No results found', kn: 'ಯಾವುದೇ ಫಲಿತಾಂಶಗಳಿಲ್ಲ' })}</h4>
                          <p className="text-xs text-slate-400">{t({ en: 'Try adjusting your filters or date range.', kn: 'ದಯವಿಟ್ಟು ಫಿಲ್ಟರ್‌ಗಳನ್ನು ಬದಲಾಯಿಸಿ.' })}</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user, idx) => (
                      <tr key={user.id || idx} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors group">
                        <td className="p-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center text-white font-black shadow-lg shadow-blue-200 dark:shadow-none shrink-0">
                              {(user.full_name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-black text-slate-900 dark:text-slate-100 tracking-tight text-sm">
                                  {user.full_name || (user.status === 'DELETED' ? 'Archived User' : 'Anonymous Member')}
                                </span>
                                {users.filter(u => u.phone === user.phone).length > 1 && (
                                  <span className="text-[8px] bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider">
                                    Re-Reg
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-slate-400 font-mono">
                                {user.phone || 'Private Number'}
                              </span>
                              <span className="text-[9px] text-slate-300 font-bold uppercase mt-1 tracking-wider">
                                Joined {user.created_at ? new Date(user.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Unknown'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="p-6">
                          <span className={`text-[10px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest ${
                            user.role === UserRole.SUPER_ADMIN ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' :
                            user.role === UserRole.MODERATOR ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                            'bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {user.role || 'STUDENT'}
                          </span>
                        </td>
                        <td className="p-6">
                          <div className="flex flex-col gap-1.5">
                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg w-fit transition-colors ${
                              user.package_type === PackageType.BOTH ? 'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 dark:from-purple-900/50 dark:to-pink-900/50 dark:text-purple-300' :
                              user.package_type === PackageType.SNEHI ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                              user.package_type === PackageType.TALKS ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300' :
                              'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                            }`}>
                              {user.package_type || 'FREE TRIAL'}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                user.status === 'DELETED' ? 'bg-red-500' :
                                user.package_status === 'ACTIVE' ? 'bg-green-500' : 
                                'bg-slate-300'
                              }`}></span>
                              <span className={`text-[9px] font-black uppercase tracking-widest ${
                                user.status === 'DELETED' ? 'text-red-500' :
                                user.package_status === 'ACTIVE' ? 'text-green-600' : 
                                'text-slate-400'
                              }`}>
                                {user.status === 'DELETED' ? 'ARCHIVED' : (user.package_status || 'IDLE')}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="p-6">
                          {(() => {
                            const isFiltering = startDate || endDate;
                            const source = isFiltering ? filteredUsageData : usageData;
                            const usage = source.find(u => u.user_id === user.id);
                            const seconds = usage?.voice_seconds_total || 0;
                            const mins = Math.floor(seconds / 60);
                            const secs = seconds % 60;
                            
                            // Universal Base (10m) + Package Credit (250m for SNEHI/BOTH) + All Topup Credits
                            const universalMins = 10;
                            const isSnehiOrBoth = user.package_type === PackageType.SNEHI || user.package_type === PackageType.BOTH;
                            const packageCredits = isSnehiOrBoth ? 250 : 0;
                            const agentCredits = user.agent_credits || 0;
                            
                            const maxTotalMins = universalMins + packageCredits + agentCredits;

                            const percent = Math.min(100, (mins / (maxTotalMins || 1)) * 100);
                            const isOver = mins >= maxTotalMins;
                            
                            return (
                              <div className="flex flex-col gap-2 min-w-[120px]">
                                <div className="flex justify-between items-end">
                                  <span className={`text-xs font-black ${isOver ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                                    {mins}:{secs.toString().padStart(2, '0')}
                                  </span>
                                  {!isFiltering && user.role === UserRole.STUDENT && <span className="text-[8px] font-bold text-slate-400">OF {maxTotalMins}m</span>}
                                </div>
                                {user.role === UserRole.STUDENT ? (
                                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden shadow-inner">
                                    <div 
                                      className={`h-full rounded-full transition-all duration-1000 ${isOver ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-blue-500'}`}
                                      style={{ width: `${percent}%` }}
                                    ></div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-md">∞ Staff</span>
                                  </div>
                                )}
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                                  {isFiltering ? 'Selected Range' : 'Total Airtime'}
                                </span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="p-6">
                          {(() => {
                            const isFiltering = startDate || endDate;
                            const source = isFiltering ? filteredUsageData : usageData;
                            const usage = source.find(u => u.user_id === user.id);
                            const msgs = usage?.chat_messages_total || 0;
                            const tokens = usage?.chat_tokens_total || 0;
                            
                            const percent = Math.min(100, (msgs / 50) * 100);
                            const isOver = msgs >= 50;
                            return (
                              <div className="flex flex-col gap-2 min-w-[120px]">
                                <div className="flex justify-between items-end">
                                  <span className={`text-xs font-black ${isOver ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                                    {msgs} <span className="text-[9px]">msgs</span>
                                  </span>
                                  {!isFiltering && <span className="text-[8px] font-bold text-slate-400">OF 50</span>}
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden shadow-inner">
                                  <div 
                                    className={`h-full rounded-full transition-all duration-1000 ${isOver ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-purple-500'}`}
                                    style={{ width: `${percent}%` }}
                                  ></div>
                                </div>
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                                  {tokens.toLocaleString()} Tokens
                                </span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="p-6 text-right">
                          <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">₹{user.topup_amount || 0}</span>
                        </td>
                        <td className="p-6">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Detailed Info Actions */}
                            <button 
                                onClick={() => handleOpenNotificationModal(user.id, user.full_name || (user.status === 'DELETED' ? 'Archived User' : 'Anonymous Member'))} 
                                className="w-9 h-9 flex items-center justify-center bg-sky-50 text-sky-600 rounded-xl hover:bg-sky-600 hover:text-white transition-all shadow-sm"
                                title="Send Notification"
                            >
                                🔔
                            </button>
                            <button 
                                onClick={() => handleAudit(user.id)} 
                                className="w-9 h-9 flex items-center justify-center bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                title="Review Chat Audit"
                            >
                                💬
                            </button>
                            <button 
                                onClick={() => handleUsageLogs(user.id)} 
                                className="w-9 h-9 flex items-center justify-center bg-purple-50 text-purple-600 rounded-xl hover:bg-purple-600 hover:text-white transition-all shadow-sm"
                                title="View Usage History"
                            >
                                📊
                            </button>

                            {user.status !== 'DELETED' && (
                              <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-slate-100 dark:border-slate-800">
                                {/* Restriction Toggle */}
                                <button 
                                    onClick={() => handleRestrict(user.id, user.is_restricted)} 
                                    className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all shadow-sm ${
                                        user.is_restricted 
                                        ? 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white' 
                                        : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white'
                                    }`}
                                    title={user.is_restricted ? 'Unrestrict User' : 'Restrict User'}
                                >
                                    {user.is_restricted ? '🔓' : '🚫'}
                                </button>

                                {/* Quick Role Adjust (Super Admin Only) */}
                                {currentUser?.role === UserRole.SUPER_ADMIN && (
                                  <div className="relative group/role">
                                    <button className="w-9 h-9 flex items-center justify-center bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-200 transition-all shadow-sm">
                                        👤
                                    </button>
                                    <div className="absolute right-0 bottom-full mb-2 hidden group-hover/role:block bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl p-2 shadow-2xl z-50 min-w-[140px] animate-in fade-in zoom-in-95">
                                        <div className="text-[9px] font-black text-slate-400 uppercase p-2 border-b border-slate-50 mb-1">Set Account Role</div>
                                        {[UserRole.STUDENT, UserRole.MODERATOR, UserRole.SUPER_ADMIN].map(role => (
                                            <button
                                                key={role}
                                                onClick={() => handleUpdateRole(user.id, role)}
                                                className={`w-full text-left px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-colors ${
                                                    user.role === role ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-50 text-slate-500'
                                                }`}
                                            >
                                                {role}
                                            </button>
                                        ))}
                                    </div>
                                  </div>
                                )}

                                {/* Delete User */}
                                <button 
                                    onClick={() => handleDelete(user.id)} 
                                    className="w-9 h-9 flex items-center justify-center bg-slate-50 text-slate-400 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm"
                                    title="Archive User"
                                >
                                    🗑️
                                </button>
                              </div>
                            )}
                          </div>
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



      {activeTab === 'mods' && (
        <div className="space-y-8 animate-in fade-in">
          <div className="flex justify-between items-center">
            <h3 className="text-2xl font-black text-blue-900 dark:text-blue-300">{t({ en: 'Moderator List', kn: 'ಮಾಡರೇಟರ್ ಪಟ್ಟಿ' })}</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase">{t({ en: 'Curators of SIMPLISH - Talks', kn: 'ಸಿಂಪ್ಲಿಷ್ ಟಾಕ್ಸ್ ಸಂಯೋಜಕರು' })}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {users.filter(u => u.role === UserRole.MODERATOR).map(mod => (
              <div key={mod.id} className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border-2 border-blue-50 dark:border-slate-700 shadow-sm relative group overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleUpdateRole(mod.id, UserRole.STUDENT)} className="text-xs font-black text-red-500 hover:underline">Revoke</button>
                </div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center font-black text-blue-600">
                    {mod.full_name?.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800 dark:text-slate-100">{mod.full_name}</h4>
                    <p className="text-[10px] text-slate-400">{mod.phone}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
                    <span>Lessons Managed</span>
                    <span className="text-blue-600">--</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1">
                    <div className="bg-blue-600 h-1 rounded-full w-3/4"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="space-y-8 animate-in fade-in">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-black text-blue-900 dark:text-blue-300">{t({ en: 'Platform Analytics', kn: 'ಪ್ಲಾಟ್‌ಫಾರ್ಮ್ ವಿಶ್ಲೇಷಣೆ' })}</h3>
            <button onClick={fetchData} className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-black uppercase hover:bg-blue-100 transition-colors">
              {t({ en: 'Refresh Data', kn: 'ಡೇಟಾ ನವೀಕರಿಸಿ' })}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Revenue Card (New) - SUPER ADMIN ONLY */}
            {currentUser?.role === UserRole.SUPER_ADMIN && (
              <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border-2 border-green-100 dark:border-green-900 shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-2xl flex items-center justify-center text-2xl">
                    💰
                  </div>
                  <span className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-lg uppercase tracking-wider">{t({ en: 'Revenue', kn: 'ಆದಾಯ' })}</span>
                </div>
                <div>
                  <h4 className="text-4xl font-black text-slate-800 dark:text-slate-100 mb-1">₹{globalStats.totalRevenue.toLocaleString()}</h4>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t({ en: 'Total Account Received', kn: 'ಒಟ್ಟು ಸ್ವೀಕರಿಸಿದ ಮೊತ್ತ' })}</p>
                </div>
              </div>
            )}

            {/* Stat Card 1 */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border-2 border-slate-100 dark:border-slate-700 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-2xl flex items-center justify-center text-2xl">
                  👥
                </div>
              </div>
              <div>
                <h4 className="text-4xl font-black text-slate-800 dark:text-slate-100 mb-1">{globalStats.totalUsers}</h4>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t({ en: 'Total Registered', kn: 'ಒಟ್ಟು ನೋಂದಾಯಿತರು' })}</p>
              </div>
            </div>

            {/* Stat Card 2 */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border-2 border-slate-100 dark:border-slate-700 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-2xl flex items-center justify-center text-2xl">
                  📈
                </div>
              </div>
              <div>
                <h4 className="text-4xl font-black text-slate-800 dark:text-slate-100 mb-1">{globalStats.activeLearners}</h4>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t({ en: 'Active Learners', kn: 'ಸಕ್ರಿಯ ವಿದ್ಯಾರ್ಥಿಗಳು' })}</p>
              </div>
            </div>

            {/* Stat Card 3 */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border-2 border-slate-100 dark:border-slate-700 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-2xl flex items-center justify-center text-2xl">
                  📚
                </div>
              </div>
              <div>
                <h4 className="text-4xl font-black text-slate-800 dark:text-slate-100 mb-1">{globalStats.totalModules}</h4>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t({ en: 'Course Modules', kn: 'ಕೋರ್ಸ್ ಮಾಡ್ಯೂಲ್‌ಗಳು' })}</p>
              </div>
            </div>

            {/* Stat Card 4 */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border-2 border-slate-100 dark:border-slate-700 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-2xl flex items-center justify-center text-2xl">
                  🎓
                </div>
              </div>
              <div>
                <h4 className="text-4xl font-black text-slate-800 dark:text-slate-100 mb-1">{globalStats.totalLessons}</h4>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t({ en: 'Total Lessons', kn: 'ಒಟ್ಟು ಪಾಠಗಳು' })}</p>
              </div>
            </div>

            {/* Stat Card 5 (Custom Scenarios) */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border-2 border-slate-100 dark:border-slate-700 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-2xl flex items-center justify-center text-2xl">
                  🎙️
                </div>
              </div>
              <div>
                <h4 className="text-4xl font-black text-slate-800 dark:text-slate-100 mb-1">{globalStats.customScenariosCount}</h4>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t({ en: 'Custom Scenarios', kn: 'ಕಸ್ಟಮ್ ಸನ್ನಿವೇಶಗಳು' })}</p>
              </div>
            </div>
            
            {/* New KPI Card: Voice & Chat Usage */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border-2 border-slate-100 dark:border-slate-700 shadow-sm flex flex-col justify-between col-span-1 md:col-span-2 lg:col-span-1">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-pink-100 dark:bg-pink-900/30 text-pink-600 rounded-2xl flex items-center justify-center text-2xl">
                  📊
                </div>
                <span className="text-[10px] font-black text-pink-600 bg-pink-50 px-2 py-1 rounded-lg uppercase tracking-wider">AI API</span>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 px-3 py-2 rounded-xl">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">🎙️ {t({ en: 'Voice Usage', kn: 'ಧ್ವನಿ ಬಳಕೆ' })}</span>
                  <span className="text-sm font-black text-slate-800 dark:text-slate-200">
                    {(() => {
                      const totalSecs = usageData.reduce((acc, curr) => acc + (curr.voice_seconds_total || 0), 0);
                      return `${Math.floor(totalSecs / 60)}m ${totalSecs % 60}s`;
                    })()}
                  </span>
                </div>
                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 px-3 py-2 rounded-xl">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">💬 {t({ en: 'Chat Usage', kn: 'ಚಾಟ್ ಬಳಕೆ' })}</span>
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-black text-slate-800 dark:text-slate-200">
                      {usageData.reduce((acc, curr) => acc + (curr.chat_messages_total || 0), 0)} {t({ en: 'msgs', kn: 'ಸಂದೇಶಗಳು' })}
                    </span>
                    <span className="text-[8px] text-slate-400">
                      {usageData.reduce((acc, curr) => acc + (curr.chat_tokens_total || 0), 0).toLocaleString()} {t({ en: 'tokens', kn: 'ಟೋಕನ್ಗಳು' })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 bg-blue-50 dark:bg-slate-800/50 rounded-[2rem] p-8 border border-blue-100 dark:border-slate-700">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-3xl shadow-lg">
                🎯
              </div>
              <div>
                <h4 className="text-xl font-black text-blue-900 dark:text-blue-100">Engagement Score</h4>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {globalStats.totalUsers > 0
                    ? Math.round((globalStats.activeLearners / globalStats.totalUsers) * 100)
                    : 0}% of registered users have completed the Placement Test (ಪ್ರವೇಶ ಪರೀಕ್ಷೆ) and started learning.
                </p>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="mt-6 w-full bg-white dark:bg-slate-900 h-4 rounded-full overflow-hidden shadow-inner flex">
              <div
                className="bg-blue-600 h-full transition-all duration-1000 ease-out"
                style={{ width: `${globalStats.totalUsers > 0 ? (globalStats.activeLearners / globalStats.totalUsers) * 100 : 0}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border-2 border-slate-100 dark:border-slate-700 shadow-xl">
            <h4 className="text-xl font-black text-blue-900 dark:text-blue-400 mb-6 uppercase tracking-tighter">Package Distribution</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Talks Active</p>
                <p className="text-3xl font-black text-blue-800 dark:text-blue-300">{globalStats.talksCount}</p>
              </div>
              <div className="p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl">
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Snehi Active</p>
                <p className="text-3xl font-black text-indigo-800 dark:text-indigo-300">{globalStats.snehiCount}</p>
              </div>
              <div className="p-6 bg-purple-50 dark:bg-purple-900/20 rounded-2xl">
                <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-1">💬 Total Chat Tokens</p>
                <p className="text-3xl font-black text-purple-800 dark:text-purple-300">
                  {usageData.reduce((acc, curr) => acc + (curr.chat_tokens_total || 0), 0).toLocaleString()}
                </p>
                <p className="text-[8px] text-slate-400 mt-1">{usageData.reduce((acc, curr) => acc + (curr.chat_messages_total || 0), 0).toLocaleString()} messages</p>
              </div>
              <div className="p-6 bg-sky-50 dark:bg-sky-900/20 rounded-2xl">
                <p className="text-[10px] font-black text-sky-400 uppercase tracking-widest mb-1">🎙️ Total Voice Time</p>
                <p className="text-3xl font-black text-sky-800 dark:text-sky-300">
                  {(() => {
                    const totalSecs = usageData.reduce((acc, curr) => acc + (curr.voice_seconds_total || 0), 0);
                    const m = Math.floor(totalSecs / 60);
                    const s = totalSecs % 60;
                    return `${m}m ${s}s`;
                  })()}
                </p>
                <p className="text-[8px] text-slate-400 mt-1">Live Talk across all users</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
            <div>
              <h3 className="text-2xl font-black text-blue-900 dark:text-blue-300">
                User Conversation Audit
              </h3>
              {selectedAuditUser && users.find(u => u.id === selectedAuditUser) && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    {users.find(u => u.id === selectedAuditUser)?.full_name}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    ({users.find(u => u.id === selectedAuditUser)?.phone})
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={() => {
                setActiveTab('users');
                setSelectedAuditUser(null);
                setAuditLogs([]);
              }}
              className="px-4 py-2 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 rounded-xl text-xs font-black uppercase hover:bg-slate-200 transition-colors"
            >
              Back to Users
            </button>
          </div>

          {!selectedAuditUser ? (
            <div className="p-8 text-center text-slate-400 font-bold bg-white dark:bg-slate-800 rounded-3xl border-2 border-slate-100 dark:border-slate-700">
              Please select a user from the Users tab to view their audit logs.
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 font-bold bg-white dark:bg-slate-800 rounded-3xl border-2 border-slate-100 dark:border-slate-700">
              No chat logs found for this user.
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 px-2">
                Showing last {auditLogs.length} messages
              </p>
              {auditLogs.map((log: any, idx: number) => (
                <div
                  key={log.id || idx}
                  className={`p-6 rounded-3xl border shadow-sm ${log.role === 'user'
                    ? 'bg-blue-50/50 border-blue-100 dark:bg-slate-800/80 dark:border-slate-700 ml-0 md:mr-12'
                    : 'bg-white border-slate-100 dark:bg-slate-900 dark:border-slate-800 ml-0 md:ml-12'
                    }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${log.role === 'user' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                      {log.role === 'user' ? 'STUDENT' : 'AI COACH'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-slate-800 dark:text-slate-200 font-medium whitespace-pre-wrap">
                    {log.content}
                  </p>

                  {(log.correction || log.kannada_guide || log.pronunciation_tip) && (
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                      {log.correction && (
                        <div className="text-sm">
                          <strong className="text-red-500 font-black uppercase text-[10px] tracking-wider block mb-1">Correction</strong>
                          <span className="text-red-700 dark:text-red-400 font-medium">{log.correction}</span>
                        </div>
                      )}
                      {log.kannada_guide && (
                        <div className="text-sm">
                          <strong className="text-blue-500 font-black uppercase text-[10px] tracking-wider block mb-1">Guide</strong>
                          <span className="text-blue-700 dark:text-blue-400">{log.kannada_guide}</span>
                        </div>
                      )}
                      {log.pronunciation_tip && (
                        <div className="text-sm">
                          <strong className="text-amber-500 font-black uppercase text-[10px] tracking-wider block mb-1">Pronunciation</strong>
                          <span className="text-amber-700 dark:text-amber-400">{log.pronunciation_tip}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'usage_history' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
            <div>
              <h3 className="text-2xl font-black text-purple-900 dark:text-purple-300">
                Detailed Usage History
              </h3>
              {selectedUsageUser && users.find(u => u.id === selectedUsageUser) && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    {users.find(u => u.id === selectedUsageUser)?.full_name}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    ({users.find(u => u.id === selectedUsageUser)?.phone})
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={() => {
                setActiveTab('users');
                setSelectedUsageUser(null);
                setUsageLogs([]);
              }}
              className="px-4 py-2 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 rounded-xl text-xs font-black uppercase hover:bg-slate-200 transition-colors"
            >
              Back to Users
            </button>
          </div>

          {!selectedUsageUser ? (
            <div className="p-8 text-center text-slate-400 font-bold bg-white dark:bg-slate-800 rounded-3xl border-2 border-slate-100 dark:border-slate-700">
              Please select a user from the Users tab to view their usage history.
            </div>
          ) : usageLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 font-bold bg-white dark:bg-slate-800 rounded-3xl border-2 border-slate-100 dark:border-slate-700">
              No usage logs found for this user.
            </div>
          ) : (
            <div className="overflow-hidden bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 shadow-xl">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Date & Time</th>
                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Activity Type</th>
                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Amount / Duration</th>
                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Tokens</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {usageLogs.map((log: any, idx: number) => (
                    <tr key={log.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="p-6 font-mono text-xs text-slate-500">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="p-6">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          (log.event_type || '').toLowerCase().includes('voice')
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                          }`}>
                          {(log.event_type || 'N/A').replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-6 font-bold text-slate-700 dark:text-slate-300">
                        {(log.event_type || '').toLowerCase().includes('voice')
                          ? `${Math.floor((log.amount || 0) / 60)}m ${(log.amount || 0) % 60}s`
                          : `${log.amount || 0} messages`}
                      </td>
                      <td className="p-6 text-slate-400 text-xs text-right whitespace-nowrap">
                        {log.tokens ? `${log.tokens.toLocaleString()} tokens` : '---'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
            <div>
              <h3 className="text-2xl font-black text-orange-900 dark:text-orange-300">{t({ en: 'Platform Reports', kn: 'ವೇದಿಕೆ ವರದಿಗಳು' })}</h3>
              <p className="text-sm text-slate-500">{t({ en: 'Daily performance metrics and user activity trends.', kn: 'ದೈನಂದಿನ ಕಾರ್ಯಕ್ಷಮತೆ ಮತ್ತು ಬಳಕೆದಾರರ ಚಟುವಟಿಕೆಗಳು.' })}</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-end sm:items-center">
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex flex-col">
                  <label className="text-[8px] font-black uppercase text-slate-400 px-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                  />
                </div>
                <span className="text-slate-300 font-bold">-</span>
                <div className="flex flex-col">
                  <label className="text-[8px] font-black uppercase text-slate-400 px-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                  />
                </div>
                {(startDate || endDate) && (
                  <button
                    onClick={() => { setStartDate(''); setEndDate(''); }}
                    className="ml-2 w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 flex items-center justify-center text-xs text-slate-500"
                    title="Clear Filters"
                  >
                    ✕
                  </button>
                )}
              </div>
              <button
                onClick={fetchData}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2 border-b-4 border-blue-800 active:border-b-0 active:translate-y-1"
              >
                <span>🔍</span> {t({ en: 'View', kn: 'ನೋಡಿ' })}
              </button>
              <button
                onClick={handleDownloadCSV}
                className="px-4 py-3 bg-orange-100 hover:bg-orange-200 text-orange-700 dark:bg-orange-900/30 dark:hover:bg-orange-900/50 dark:text-orange-400 rounded-xl text-xs font-black uppercase transition-colors flex items-center gap-2 border border-orange-200 dark:border-orange-800 shadow-sm"
              >
                <span>📥</span> {t({ en: 'Download CSV', kn: 'CSV ಡೌನ್‌ಲೋಡ್' })}
              </button>
            </div>
          </div>

          <div className="overflow-hidden bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 shadow-xl">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">{t({ en: 'Date', kn: 'ದಿನಾಂಕ' })}</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">{t({ en: 'Reg. Users', kn: 'ನೋಂದಾಯಿತರು' })}</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">{t({ en: 'Active', kn: 'ಸಕ್ರಿಯ' })}</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">{t({ en: 'Talks/Snehi', kn: 'ಟಾಕ್ಸ್/ಸ್ನೇಹಿ' })}</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">{t({ en: 'Voice Usage', kn: 'ಧ್ವನಿ ಬಳಕೆ' })}</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">{t({ en: 'Chat Usage', kn: 'ಚಾಟ್ ಬಳಕೆ' })}</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">{t({ en: 'Custom Scenarios', kn: 'ಕಸ್ಟಮ್ ಸನ್ನಿವೇಶ' })}</th>
                  {currentUser?.role === UserRole.SUPER_ADMIN && (
                    <>
                      <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">{t({ en: 'Top-up Rev', kn: 'ಟಾಪ್-ಅಪ್ ಆದಾಯ' })}</th>
                      <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">{t({ en: 'Total Revenue', kn: 'ಒಟ್ಟು ಆದಾಯ' })}</th>
                    </>
                  )}
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">{t({ en: 'Deleted', kn: 'ಅಳಿಸಲಾಗಿದೆ' })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredReports.length === 0 ? (
                  <tr>
                    <td colSpan={currentUser?.role === UserRole.SUPER_ADMIN ? 8 : 7} className="p-8 text-center text-slate-400 font-bold">
                      {t({ en: 'No reports found for the selected date range.', kn: 'ಆಯ್ದ ಅವಧಿಯಲ್ಲಿ ಯಾವುದೇ ವರದಿಗಳು ಕಂಡುಬಂದಿಲ್ಲ.' })}
                    </td>
                  </tr>
                ) : (
                  filteredReports.map((report: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="p-6 font-bold text-slate-700 dark:text-slate-300">
                        {new Date(report.report_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="p-6 text-blue-600 font-black">
                        +{report.registered_count}
                      </td>
                      <td className="p-6 text-slate-600">
                        {report.active_count} users
                      </td>
                      <td className="p-6 text-slate-600 font-black">
                        <span className="text-blue-500">T: {report.talks_sold}</span> / <span className="text-indigo-500">S: {report.snehi_sold}</span>
                      </td>
                      <td className="p-6 text-slate-600 font-bold">
                        {report.total_voice_seconds ? `${Math.floor(report.total_voice_seconds / 60)}m ${report.total_voice_seconds % 60}s` : '0m 0s'}
                      </td>
                      <td className="p-6 text-slate-600 font-bold">
                        {report.total_messages ? `${report.total_messages} msgs` : '0 msgs'}
                      </td>
                      <td className="p-6 text-indigo-600 font-black">
                        {report.custom_scenarios_created || 0}
                      </td>
                      {currentUser?.role === UserRole.SUPER_ADMIN && (
                        <>
                          <td className="p-6 text-amber-600 font-bold">
                            ₹{report.topup_revenue?.toLocaleString()}
                          </td>
                          <td className="p-6 text-green-600 font-black">
                            ₹{report.daily_revenue?.toLocaleString()}
                          </td>
                        </>
                      )}
                      <td className="p-6 text-red-500 font-bold">
                        {report.deleted_count > 0 ? `-${report.deleted_count}` : '0'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'attribution' && (
        <div className="space-y-8 animate-in fade-in">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-black text-blue-900 dark:text-blue-300">{t({ en: 'Web-to-App Tracking & Funnel Analytics', kn: 'ವೆಬ್-ಟು-ಆಪ್ ಟ್ರ್ಯಾಕಿಂಗ್ ಮತ್ತು ಫನಲ್ ವಿಶ್ಲೇಷಣೆ' })}</h3>
            <button onClick={fetchAttributionData} disabled={loadingAttribution} className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-black uppercase hover:bg-blue-100 transition-colors disabled:opacity-50 flex items-center gap-1.5">
              {loadingAttribution && <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>}
              {t({ en: 'Refresh Data', kn: 'ಡೇಟಾ ನವೀಕರಿಸಿ' })}
            </button>
          </div>

          {loadingAttribution || !attributionStats ? (
            <div className="flex items-center justify-center p-20">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              {/* Funnel KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border-2 border-slate-100 dark:border-slate-700 shadow-sm">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t({ en: '1. Web Page Views', kn: '೧. ವೆಬ್ ಪುಟ ವೀಕ್ಷಣೆಗಳು' })}</span>
                  <h4 className="text-3xl font-black text-slate-850 dark:text-slate-100 mt-2">{attributionStats.totalVisits.toLocaleString()}</h4>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border-2 border-slate-100 dark:border-slate-700 shadow-sm">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t({ en: '2. Download Clicks', kn: '೨. ಡೌನ್‌ಲೋಡ್ ಕ್ಲಿಕ್‌ಗಳು' })}</span>
                  <h4 className="text-3xl font-black text-slate-850 dark:text-slate-100 mt-2">{attributionStats.totalClicks.toLocaleString()}</h4>
                  <p className="text-xs font-bold text-blue-500 mt-1">CTR: {((attributionStats.totalClicks / attributionStats.totalVisits) * 100).toFixed(1)}%</p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border-2 border-slate-100 dark:border-slate-700 shadow-sm">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t({ en: '3. App Installs (Opens)', kn: '೩. ಆಪ್ ಇನ್‌ಸ್ಟಾಲ್‌ಗಳು' })}</span>
                  <h4 className="text-3xl font-black text-slate-850 dark:text-slate-100 mt-2">{attributionStats.totalInstalls.toLocaleString()}</h4>
                  <p className="text-xs font-bold text-green-500 mt-1">CTI: {((attributionStats.totalInstalls / Math.max(1, attributionStats.totalClicks)) * 100).toFixed(1)}%</p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border-2 border-slate-100 dark:border-slate-700 shadow-sm">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t({ en: '4. Registered Users', kn: '೪. ನೋಂದಾಯಿತ ಬಳಕೆದಾರರು' })}</span>
                  <h4 className="text-3xl font-black text-slate-850 dark:text-slate-100 mt-2">{attributionStats.totalRegistered.toLocaleString()}</h4>
                  <p className="text-xs font-bold text-purple-500 mt-1">Match Rate: {((attributionStats.totalRegistered / Math.max(1, attributionStats.totalInstalls)) * 100).toFixed(1)}%</p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border-2 border-slate-100 dark:border-slate-700 shadow-sm">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t({ en: '5. Paid Subscribers', kn: '೫. ಚಂದಾದಾರರು' })}</span>
                  <h4 className="text-3xl font-black text-slate-850 dark:text-slate-100 mt-2">{attributionStats.totalSubscribed.toLocaleString()}</h4>
                  <p className="text-xs font-bold text-amber-500 mt-1">Conv Rate: {((attributionStats.totalSubscribed / Math.max(1, attributionStats.totalRegistered)) * 100).toFixed(1)}%</p>
                </div>
              </div>

              {/* Custom Web-to-App Funnel Visualization */}
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 p-8 shadow-xl animate-in fade-in duration-300">
                <h4 className="text-lg font-black text-slate-900 dark:text-white mb-6 uppercase tracking-tight">{t({ en: 'Web-to-App Conversion Funnel Progress', kn: 'ವೆಬ್-ಟು-ಆಪ್ ಪರಿವರ್ತನೆ ಹಂತಗಳು' })}</h4>
                <div className="space-y-6">
                  {/* Step 1 */}
                  <div>
                    <div className="flex justify-between text-xs font-black uppercase mb-1">
                      <span className="text-slate-600 dark:text-slate-400">1. Web Visits (Baseline)</span>
                      <span className="text-slate-900 dark:text-white">100%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-6 rounded-full overflow-hidden">
                      <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full flex items-center justify-end px-3 text-[10px] font-black text-white" style={{ width: '100%' }}>
                        {attributionStats.totalVisits} Views
                      </div>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div>
                    <div className="flex justify-between text-xs font-black uppercase mb-1">
                      <span className="text-slate-600 dark:text-slate-400">2. Download Click CTR</span>
                      <span className="text-blue-600 dark:text-blue-400">{((attributionStats.totalClicks / attributionStats.totalVisits) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-6 rounded-full overflow-hidden">
                      <div className="bg-gradient-to-r from-blue-600 to-cyan-500 h-full flex items-center justify-end px-3 text-[10px] font-black text-white" style={{ width: `${Math.min(100, (attributionStats.totalClicks / attributionStats.totalVisits) * 100)}%` }}>
                        {attributionStats.totalClicks} Clicks
                      </div>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div>
                    <div className="flex justify-between text-xs font-black uppercase mb-1">
                      <span className="text-slate-600 dark:text-slate-400">3. Click-to-Install (CTI)</span>
                      <span className="text-green-600 dark:text-green-400">{((attributionStats.totalInstalls / Math.max(1, attributionStats.totalClicks)) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-6 rounded-full overflow-hidden">
                      <div className="bg-gradient-to-r from-green-500 to-teal-500 h-full flex items-center justify-end px-3 text-[10px] font-black text-white" style={{ width: `${Math.min(100, (attributionStats.totalInstalls / Math.max(1, attributionStats.totalVisits)) * 100)}%` }}>
                        {attributionStats.totalInstalls} Installs
                      </div>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div>
                    <div className="flex justify-between text-xs font-black uppercase mb-1">
                      <span className="text-slate-600 dark:text-slate-400">4. Signup Conversion</span>
                      <span className="text-purple-600 dark:text-purple-400">{((attributionStats.totalRegistered / Math.max(1, attributionStats.totalInstalls)) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-6 rounded-full overflow-hidden">
                      <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-full flex items-center justify-end px-3 text-[10px] font-black text-white" style={{ width: `${Math.min(100, (attributionStats.totalRegistered / Math.max(1, attributionStats.totalVisits)) * 100)}%` }}>
                        {attributionStats.totalRegistered} Signups
                      </div>
                    </div>
                  </div>

                  {/* Step 5 */}
                  <div>
                    <div className="flex justify-between text-xs font-black uppercase mb-1">
                      <span className="text-slate-600 dark:text-slate-400">5. Overall Subscriber Conversion</span>
                      <span className="text-amber-600 dark:text-amber-400">{((attributionStats.totalSubscribed / Math.max(1, attributionStats.totalRegistered)) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-6 rounded-full overflow-hidden">
                      <div className="bg-gradient-to-r from-amber-500 to-orange-500 h-full flex items-center justify-end px-3 text-[10px] font-black text-white" style={{ width: `${Math.min(100, (attributionStats.totalSubscribed / Math.max(1, attributionStats.totalVisits)) * 100)}%` }}>
                        {attributionStats.totalSubscribed} Subs
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Attribution Source Performance Table */}
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 p-8 shadow-xl overflow-hidden">
                <h4 className="text-lg font-black text-slate-900 dark:text-white mb-6 uppercase tracking-tight">{t({ en: 'Campaign Tracking Performance', kn: 'ಅಭಿಯಾನ ಮತ್ತು ಟ್ರ್ಯಾಕಿಂಗ್ ಪ್ರಗತಿ' })}</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b-2 border-slate-100 dark:border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="p-6">{t({ en: 'Campaign Source', kn: 'ಅಭಿಯಾನ ಮೂಲ' })}</th>
                        <th className="p-6">{t({ en: 'Clicks', kn: 'ಕ್ಲಿಕ್‌ಗಳು' })}</th>
                        <th className="p-6">{t({ en: 'Installs', kn: 'ಇನ್‌ಸ್ಟಾಲ್‌ಗಳು' })}</th>
                        <th className="p-6">CTI %</th>
                        <th className="p-6">{t({ en: 'Signups', kn: 'ನೋಂದಣಿಗಳು' })}</th>
                        <th className="p-6">{t({ en: 'Subscribers', kn: 'ಚಂದಾದಾರರು' })}</th>
                        <th className="p-6">LTV Conv %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attributionStats.utmBreakdown.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-slate-400 font-bold">
                            No campaign tracking data logged yet.
                          </td>
                        </tr>
                      ) : (
                        attributionStats.utmBreakdown.map((row: any) => (
                          <tr key={row.source} className="border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="p-6 font-bold text-slate-900 dark:text-white">{row.source}</td>
                            <td className="p-6">{row.clicks || 0}</td>
                            <td className="p-6">{row.installs || 0}</td>
                            <td className="p-6 font-bold text-green-600 dark:text-green-400">
                              {row.clicks > 0 ? `${((row.installs / row.clicks) * 100).toFixed(1)}%` : '0%'}
                            </td>
                            <td className="p-6">{row.signups || 0}</td>
                            <td className="p-6">{row.subscribers || 0}</td>
                            <td className="p-6 font-black text-blue-600 dark:text-blue-400">
                              {row.signups > 0 ? `${((row.subscribers / row.signups) * 100).toFixed(1)}%` : '0%'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'config' && currentUser?.role === UserRole.SUPER_ADMIN && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             {systemConfig ? (
               <form onSubmit={handleUpdateConfig} className="space-y-8">
                 {/* Card 1: General System Settings */}
                 <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 p-8 shadow-xl">
                   <div className="flex justify-between items-start mb-10">
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">{t({ en: 'Global System Settings', kn: 'ಜಾಗತಿಕ ಸಿಸ್ಟಮ್ ಸೆಟ್ಟಿಂಗ್‌ಗಳು' })}</h3>
                      <p className="text-sm text-slate-500 font-bold uppercase tracking-widest text-[10px]">{t({ en: 'Configure universal free limits and pricing defaults.', kn: 'ಯೂನಿವರ್ಸಲ್ ಉಚಿತ ಮಿತಿಗಳು ಮತ್ತು ಬೆಲೆಗಳನ್ನು ಕಾನ್ಫಿಗರ್ ಮಾಡಿ.' })}</p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-2xl">
                      <span className="text-2xl">⚙️</span>
                    </div>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t({ en: 'Universal Free Seconds', kn: 'ಯೂನಿವರ್ಸಲ್ ಉಚಿತ ಸಮಯ (ಸೆಕೆಂಡ್‌ಗಳು)' })}</label>
                        <input 
                          type="number"
                          value={systemConfig.universal_free_seconds}
                          onChange={e => setSystemConfig({...systemConfig, universal_free_seconds: parseInt(e.target.value)})}
                          className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 p-4 rounded-2xl font-black text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-all"
                        />
                        <p className="text-[9px] text-slate-400 font-bold uppercase italic mt-1">Free time given to every user (e.g. 180 = 3 mins).</p>
                     </div>

                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t({ en: 'Cost Per Minute (₹)', kn: 'ನಿಮಿಷಕ್ಕೆ ಬೆಲೆ (₹)' })}</label>
                        <input 
                          type="number" step="0.1"
                          value={systemConfig.cost_per_minute}
                          onChange={e => setSystemConfig({...systemConfig, cost_per_minute: parseFloat(e.target.value)})}
                          className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 p-4 rounded-2xl font-black text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-all"
                        />
                        <p className="text-[9px] text-slate-400 font-bold uppercase italic mt-1">Basis for credit calculation (Price / Cost = Minutes).</p>
                     </div>

                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t({ en: 'Snehi Package Price (₹)', kn: 'ಸ್ನೇಹಿ ಪ್ಯಾಕೇಜ್ ಬೆಲೆ (₹)' })}</label>
                        <input 
                          type="number"
                          value={systemConfig.price_snehi}
                          onChange={e => setSystemConfig({...systemConfig, price_snehi: parseFloat(e.target.value)})}
                          className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 p-4 rounded-2xl font-black text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-all"
                        />
                     </div>

                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t({ en: 'Talks Package Price (₹)', kn: 'ಟಾಕ್ಸ್ ಪ್ಯಾಕೇಜ್ ಬೆಲೆ (₹)' })}</label>
                        <input 
                          type="number"
                          value={systemConfig.price_talks}
                          onChange={e => setSystemConfig({...systemConfig, price_talks: parseFloat(e.target.value)})}
                          className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 p-4 rounded-2xl font-black text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-all"
                        />
                     </div>
                   </div>
                 </div>

                 {/* Card 2: SIMPLISH Talks - Topup */}
                 <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 p-8 shadow-xl animate-in fade-in duration-500">
                   <div className="flex justify-between items-start mb-8">
                     <div>
                       <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1">{t({ en: 'SIMPLISH Talks - Topup', kn: 'ಸಿಂಪ್ಲಿಷ್ ಟಾಕ್ಸ್ - ಟಾಪ್-ಅಪ್' })}</h3>
                       <p className="text-sm text-slate-500 font-bold uppercase tracking-widest text-[9px]">{t({ en: 'Configure Talks top-up price and duration limits.', kn: 'ಟಾಕ್ಸ್ ಟಾಪ್-ಅಪ್ ಬೆಲೆ ಮತ್ತು ಅವಧಿಯನ್ನು ಕಾನ್ಫಿಗರ್ ಮಾಡಿ.' })}</p>
                     </div>
                     <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-2xl">
                       <span className="text-xl">⚡</span>
                     </div>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t({ en: 'Subscription Price (₹)', kn: 'ಚಂದಾದಾರಿಕೆ ಬೆಲೆ (₹)' })}</label>
                        <input 
                          type="number"
                          value={systemConfig.subscription_price || 0}
                          onChange={e => setSystemConfig({...systemConfig, subscription_price: parseFloat(e.target.value)})}
                          className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 p-4 rounded-2xl font-black text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-all"
                        />
                        <p className="text-[9px] text-slate-400 font-bold uppercase italic mt-1">Price charged for Talks top-up.</p>
                     </div>

                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t({ en: 'Topup Duration (Days)', kn: 'ಟಾಪ್‌ಅಪ್ ಅವಧಿ (ದಿನಗಳು)' })}</label>
                        <input 
                          type="number"
                          value={systemConfig.topup_duration_days || 0}
                          onChange={e => setSystemConfig({...systemConfig, topup_duration_days: parseInt(e.target.value)})}
                          className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 p-4 rounded-2xl font-black text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-all"
                        />
                        <p className="text-[9px] text-slate-400 font-bold uppercase italic mt-1">Number of days extended per Talks top-up.</p>
                     </div>
                   </div>
                 </div>

                 {/* Card 3: SIMPLISH SNEHI - Topup */}
                 <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 p-8 shadow-xl animate-in fade-in duration-500">
                   <div className="flex justify-between items-start mb-8">
                     <div>
                       <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1">{t({ en: 'SIMPLISH SNEHI - Topup', kn: 'ಸಿಂಪ್ಲಿಷ್ ಸ್ನೇಹಿ - ಟಾಪ್-ಅಪ್' })}</h3>
                       <p className="text-sm text-slate-500 font-bold uppercase tracking-widest text-[9px]">{t({ en: 'Configure Snehi top-up price and minutes allocated.', kn: 'ಸ್ನೇಹಿ ಟಾಪ್-ಅಪ್ ಬೆಲೆ ಮತ್ತು ನಿಮಿಷಗಳನ್ನು ಕಾನ್ಫಿಗರ್ ಮಾಡಿ.' })}</p>
                     </div>
                     <div className="bg-orange-50 dark:bg-orange-900/30 p-3 rounded-2xl">
                       <span className="text-xl">🎙️</span>
                     </div>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t({ en: 'Subscription Price (₹)', kn: 'ಚಂದಾದಾರಿಕೆ ಬೆಲೆ (₹)' })}</label>
                        <input 
                          type="number"
                          value={systemConfig.snehi_subscription_price !== undefined ? systemConfig.snehi_subscription_price : 99}
                          onChange={e => setSystemConfig({...systemConfig, snehi_subscription_price: parseFloat(e.target.value)})}
                          className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 p-4 rounded-2xl font-black text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-all"
                        />
                        <p className="text-[9px] text-slate-400 font-bold uppercase italic mt-1">Price charged for Snehi top-up.</p>
                     </div>

                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t({ en: 'Topup Duration (Mins)', kn: 'ಟಾಪ್‌ಅಪ್ ಅವಧಿ (ನಿಮಿಷಗಳು)' })}</label>
                        <input 
                          type="number"
                          value={systemConfig.snehi_topup_duration_mins !== undefined ? systemConfig.snehi_topup_duration_mins : 60}
                          onChange={e => setSystemConfig({...systemConfig, snehi_topup_duration_mins: parseInt(e.target.value)})}
                          className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 p-4 rounded-2xl font-black text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-all"
                        />
                        <p className="text-[9px] text-slate-400 font-bold uppercase italic mt-1">Number of voice practice minutes added per Snehi top-up.</p>
                     </div>
                   </div>
                 </div>

                  {/* Card 4: Taxes & Coupons */}
                  <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 p-8 shadow-xl mt-8">
                    <div className="flex justify-between items-start mb-8">
                      <div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1">{t({ en: 'Taxes & Coupon Codes', kn: 'ತೆರಿಗೆಗಳು ಮತ್ತು ಕೂಪನ್ ಕೋಡ್‌ಗಳು' })}</h3>
                        <p className="text-sm text-slate-500 font-bold uppercase tracking-widest text-[9px]">{t({ en: 'Configure SNEHI checkout GST rate and active promo coupon discounts.', kn: 'ಸ್ನೇಹಿ ಪಾವತಿ ಜಿಎಸ್‌ಟಿ ದರ ಮತ್ತು ಪ್ರಚಾರ ಕೂಪನ್ ರಿಯಾಯಿತಿಗಳನ್ನು ಕಾನ್ಫಿಗರ್ ಮಾಡಿ.' })}</p>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-2xl">
                        <span className="text-xl">🎟️</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t({ en: 'GST Rate (%)', kn: 'ಜಿಎಸ್‌ಟಿ ದರ (%)' })}</label>
                        <input 
                          type="number" step="0.1"
                          value={systemConfig.gst_percentage !== undefined ? systemConfig.gst_percentage : 18.0}
                          onChange={e => setSystemConfig({...systemConfig, gst_percentage: parseFloat(e.target.value)})}
                          className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 p-4 rounded-2xl font-black text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-all"
                        />
                        <p className="text-[9px] text-slate-400 font-bold uppercase italic mt-1">Tax rate applied during SNEHI activation checkout.</p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t({ en: 'Promo Coupon Codes (JSON)', kn: 'ಕೂಪನ್ ಕೋಡ್‌ಗಳು (JSON)' })}</label>
                        <textarea 
                          rows={3}
                          value={JSON.stringify(systemConfig.coupons || [], null, 2)}
                          onChange={e => {
                            try {
                              const parsed = JSON.parse(e.target.value);
                              if (Array.isArray(parsed)) {
                                setSystemConfig({...systemConfig, coupons: parsed});
                              }
                            } catch (err) {
                              // Let user type until it becomes valid JSON
                            }
                          }}
                          className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 p-4 rounded-2xl font-bold text-xs text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-all font-mono"
                          placeholder='[{"code": "SIMPLISH_PRO_2026", "discount_percent": 20}]'
                        />
                        <p className="text-[9px] text-slate-400 font-bold uppercase italic mt-1">Array of coupon codes. E.g. {"[{\"code\": \"SIMPLISH_PRO_2026\", \"discount_percent\": 20}]"}</p>
                      </div>
                    </div>
                  </div>

                 {/* Submit Button */}
                 <div className="pt-6">
                    <button 
                      type="submit"
                      disabled={isUpdatingConfig}
                      className="w-full py-5 bg-blue-600 dark:bg-blue-500 text-white rounded-3xl font-black text-sm uppercase tracking-widest shadow-xl hover:bg-blue-700 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                      {isUpdatingConfig ? <Spin /> : '💾'} {t({ en: 'Save Configuration', kn: 'ಕಾನ್ಫಿಗರೇಶನ್ ಉಳಿಸಿ' })}
                    </button>
                 </div>
               </form>
             ) : (
               <div className="flex flex-col items-center justify-center py-20 opacity-50">
                 <Spin c="border-slate-400" />
                 <p className="text-[10px] font-black uppercase tracking-widest mt-4">Loading system config...</p>
               </div>
             )}

             {/* Calculated Examples for verification */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-[2rem] border-2 border-white dark:border-slate-800 shadow-sm">
                   <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Example Calculation</span>
                   <div className="font-black text-slate-900 dark:text-white text-xl">
                     ₹{systemConfig?.price_snehi} / ₹{systemConfig?.cost_per_minute}/min
                   </div>
                   <div className="text-blue-600 font-black text-2xl mt-1">
                     = {systemConfig ? Math.floor(systemConfig.price_snehi / systemConfig.cost_per_minute) : 0} Minutes
                   </div>
                </div>
             </div>
        </div>
      )}
      {activeTab === 'custom_scenarios' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-2xl font-black text-blue-900 dark:text-blue-300">
                {t({ en: 'User Custom Scenarios', kn: 'ಬಳಕೆದಾರ ಕಸ್ಟಮ್ ಸನ್ನಿವೇಶಗಳು' })}
              </h3>
              <p className="text-sm text-slate-500 font-medium">
                {t({ en: 'Review voice scenarios created by SNEHI users.', kn: 'ಬಳಕೆದಾರರು ರಚಿಸಿದ ಕಸ್ಟಮ್ ಸನ್ನಿವೇಶಗಳನ್ನು ಪರಿಶೀಲಿಸಿ.' })}
              </p>
            </div>
            <span className="px-4 py-2 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-xl text-xs font-black uppercase">
              Total: {customScenarios.length}
            </span>
          </div>

          <div className="overflow-hidden bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 shadow-xl">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Date</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Creator</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Category</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Title</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Prompt Length</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {customScenarios.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400 font-bold">
                      No custom scenarios found.
                    </td>
                  </tr>
                ) : (
                  customScenarios.map((scenario) => (
                    <tr key={scenario.id} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors">
                      <td className="p-6 whitespace-nowrap text-xs font-medium text-slate-500">
                        {new Date(scenario.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-6">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-800 dark:text-slate-200">
                            {scenario.creator?.full_name || 'Anonymous User'}
                          </span>
                          <span className="text-[9px] font-mono text-slate-400">
                            {scenario.creator?.phone || 'No phone'}
                          </span>
                        </div>
                      </td>
                      <td className="p-6">
                        <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-[9px] font-black uppercase tracking-widest">
                          {scenario.category?.en || 'CUSTOM'}
                        </span>
                      </td>
                      <td className="p-6">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                          {scenario.title?.en}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {scenario.title?.kn}
                        </p>
                      </td>
                      <td className="p-6 text-right">
                        <span className="text-xs font-bold text-slate-400 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-full">
                          {scenario.user_prompt?.length || 0} chars
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {activeTab === 'content' && (currentUser?.role === UserRole.SUPER_ADMIN || currentUser?.role === UserRole.MODERATOR) && (
        <div className="space-y-6 animate-in fade-in">
          <VisualContentAdmin />
        </div>
      )}
      {activeTab === 'discounts' && (currentUser?.role === UserRole.SUPER_ADMIN || currentUser?.role === UserRole.MODERATOR) && (
        <div className="space-y-6 animate-in fade-in">
          <DiscountManagementAdmin currentUser={currentUser} />
        </div>
      )}

      {activeTab === 'snehi_access' && (currentUser?.role === UserRole.SUPER_ADMIN || currentUser?.role === UserRole.MODERATOR) && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
                {t({ en: 'SNEHI Access Requests', kn: 'ಸ್ನೇಹಿ ಪ್ರವೇಶ ವಿನಂತಿಗಳು' })}
              </h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                {t({ en: 'Manage premium access approvals and revocations', kn: 'ಪ್ರೀಮಿಯಂ ಪ್ರವೇಶ ಅನುಮೋದನೆಗಳು ಮತ್ತು ರದ್ದತಿಗಳನ್ನು ನಿರ್ವಹಿಸಿ' })}
              </p>
            </div>
            <button
              onClick={fetchAccessRequests}
              disabled={loadingRequests}
              className="px-4 py-2.5 bg-blue-50 text-blue-600 dark:bg-slate-800 dark:text-blue-400 rounded-xl text-xs font-black uppercase hover:bg-blue-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              {loadingRequests ? <Spin c="border-blue-600" /> : t({ en: 'Refresh', kn: 'ನವೀಕರಿಸಿ' })}
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-850 border-b-2 border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">{t({ en: 'User Details', kn: 'ಬಳಕೆದಾರರ ವಿವರಗಳು' })}</th>
                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">{t({ en: 'Request Date', kn: 'ವಿನಂತಿ ದಿನಾಂಕ' })}</th>
                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">{t({ en: 'Status', kn: 'ಸ್ಥಿತಿ' })}</th>
                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">{t({ en: 'Actions', kn: 'ಕ್ರಮಗಳು' })}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loadingRequests ? (
                    <tr>
                      <td colSpan={4} className="p-12 text-center text-slate-400 font-black uppercase tracking-widest">
                        <div className="flex flex-col items-center gap-3">
                          <Spin c="border-blue-500" />
                          <span>Loading requests...</span>
                        </div>
                      </td>
                    </tr>
                  ) : accessRequests.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-12 text-center text-slate-400 font-bold">
                        {t({ en: 'No requests found', kn: 'ಯಾವುದೇ ವಿನಂತಿಗಳು ಕಂಡುಬಂದಿಲ್ಲ' })}
                      </td>
                    </tr>
                  ) : (
                    accessRequests.map((req) => {
                      const name = req.profiles?.full_name || 'Anonymous Member';
                      const phone = req.profiles?.phone || 'Private Number';
                      const status = req.status;
                      
                      return (
                        <tr key={req.id} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors group">
                          <td className="p-6">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-700 rounded-2xl flex items-center justify-center text-white font-black shadow-lg shadow-orange-200 dark:shadow-none shrink-0">
                                {name.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-black text-slate-900 dark:text-slate-100 tracking-tight text-sm">
                                  {name}
                                </span>
                                <span className="text-xs text-slate-400 font-mono">
                                  {phone}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="p-6 text-slate-600 dark:text-slate-300 text-xs font-bold font-mono">
                            {new Date(req.request_date).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className="p-6">
                            <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider ${
                              status === 'Approved' || status === 'ACTIVE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                              status === 'Pending' || status === 'PENDING' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                              status === 'AWAITING_PMT' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                              status === 'Rejected' || status === 'REJECTED' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                              'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                            }`}>
                              {status}
                            </span>
                            {(() => {
                              const pmt = req.payments?.[0];
                              if (pmt) {
                                return (
                                  <div className="text-[10px] text-slate-400 font-mono mt-1.5 leading-none">
                                    ₹{pmt.final_payable_amount / 100} via {pmt.payment_gateway}
                                    <br />
                                    Ref: {pmt.transaction_id}
                                    {pmt.payment_status === 'REFUNDED' && (
                                      <span className="text-red-500 font-bold block mt-0.5">(REFUNDED)</span>
                                    )}
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </td>
                          <td className="p-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleOpenNotificationModal(req.user_id, name)}
                                className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow cursor-pointer flex items-center gap-1"
                                title="Send Notification"
                              >
                                <span>🔔</span> Notify
                              </button>
                              {(status === 'Pending' || status === 'PENDING') && (
                                <>
                                  <button
                                    onClick={() => handleApproveRequest(req.id, req.user_id)}
                                    className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow cursor-pointer"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleRejectRequest(req.id, req.user_id)}
                                    className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow cursor-pointer"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                              {status === 'AWAITING_PMT' && (
                                <button
                                  onClick={() => handleRejectRequest(req.id, req.user_id)}
                                  className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow cursor-pointer"
                                >
                                  Reject
                                </button>
                              )}
                              {(status === 'Approved' || status === 'ACTIVE') && (
                                <>
                                  <button
                                    onClick={() => handleDisableRequest(req.id, req.user_id)}
                                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow cursor-pointer"
                                  >
                                    Disable
                                  </button>
                                  {req.payments?.length > 0 && req.payments[0].payment_status !== 'REFUNDED' && (
                                    <button
                                      onClick={() => handleRefundRequest(req.id, req.user_id)}
                                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow cursor-pointer"
                                    >
                                      Refund
                                    </button>
                                  )}
                                </>
                              )}
                              {(status === 'Rejected' || status === 'REJECTED' || status === 'Disabled' || status === 'DISABLED') && (
                                <button
                                  onClick={() => handleApproveRequest(req.id, req.user_id)}
                                  className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow cursor-pointer"
                                >
                                  Approve
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'feedback' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          {/* Section Header & Main Actions */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-2">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-2 h-8 bg-blue-600 rounded-full"></div>
                <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none uppercase">
                  Course Feedback & Reviews
                </h3>
              </div>
              <p className="text-sm text-slate-500 font-medium max-w-md">
                Monitor graduate reviews, moderate testimonials, and track Net Promoter Scores (NPS) across the platform.
              </p>
            </div>

            <div className="flex items-center gap-3 w-full lg:w-auto">
              <button
                onClick={fetchFeedbackData}
                className="flex-1 lg:flex-none px-6 py-3.5 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-200 dark:shadow-none hover:bg-blue-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>🔄</span> Refresh
              </button>
              <button
                onClick={handleBulkApproveFeedbacks}
                className="flex-1 lg:flex-none px-6 py-3.5 bg-green-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-green-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>✓</span> Bulk Approve
              </button>
              <button
                onClick={handleBulkExportFeedbackCSV}
                className="flex-1 lg:flex-none px-6 py-3.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>📥</span> CSV
              </button>
              <button
                onClick={handleBulkExportFeedbackJSON}
                className="flex-1 lg:flex-none px-6 py-3.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>📥</span> JSON
              </button>
            </div>
          </div>

          {/* High-Level Analytics Widgets */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Average Rating</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-4xl font-black text-slate-900 dark:text-white">
                  {feedbacks.length > 0 ? (feedbacks.reduce((acc, f) => acc + f.overall_rating, 0) / feedbacks.length).toFixed(1) : '0.0'}
                </span>
                <span className="text-yellow-400 text-xl">★</span>
              </div>
              <p className="text-[10px] text-slate-400 font-bold mt-2">Based on {feedbacks.length} reviews</p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Reviews</span>
              <span className="text-4xl font-black text-blue-600 dark:text-blue-400 mt-2">{feedbacks.length}</span>
              <p className="text-[10px] text-slate-400 font-bold mt-2">Submitted by graduates</p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Response Rate</span>
              <span className="text-4xl font-black text-purple-600 dark:text-purple-400 mt-2">
                {feedbacks.length > 0 ? Math.round((feedbacks.length / Math.max(1, globalStats.totalUsers)) * 100) : 0}%
              </span>
              <p className="text-[10px] text-slate-400 font-bold mt-2">Of total enrolled members</p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Net Promoter Score (NPS)</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className={`text-4xl font-black ${
                  (() => {
                    const total = feedbacks.length;
                    const prom = feedbacks.filter(f => f.recommendation_score >= 9).length;
                    const detr = feedbacks.filter(f => f.recommendation_score <= 6).length;
                    const score = total > 0 ? Math.round(((prom - detr) / total) * 100) : 0;
                    return score > 50 ? 'text-green-600' : score > 0 ? 'text-yellow-600' : 'text-red-500';
                  })()
                }`}>
                  {(() => {
                    const total = feedbacks.length;
                    const prom = feedbacks.filter(f => f.recommendation_score >= 9).length;
                    const detr = feedbacks.filter(f => f.recommendation_score <= 6).length;
                    const score = total > 0 ? Math.round(((prom - detr) / total) * 100) : 0;
                    return score > 0 ? `+${score}` : score;
                  })()}
                </span>
                <span className="text-xs font-bold text-slate-400">/ 100</span>
              </div>
              <p className="text-[10px] text-slate-400 font-bold mt-2">
                {feedbacks.filter(f => f.recommendation_score >= 9).length} Promoters • {feedbacks.filter(f => f.recommendation_score <= 6).length} Detractors
              </p>
            </div>
          </div>

          {/* Breakdown Insights & Star Graph */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Star Distribution */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Star Rating Breakdown</h4>
              <div className="space-y-4">
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = feedbacks.filter(f => f.overall_rating === stars).length;
                  const pct = feedbacks.length > 0 ? Math.round((count / feedbacks.length) * 100) : 0;
                  return (
                    <div key={stars} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400 w-8">{stars} Star</span>
                      <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${pct}%` }}></div>
                      </div>
                      <span className="text-xs font-bold text-slate-500 w-10 text-right">{count} ({pct}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Segmented Satisfaction Breakdown */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-6">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Segmented Satisfaction Scores</h4>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    <span>Course Content Efficacy</span>
                    <span>{feedbacks.length > 0 ? (feedbacks.reduce((acc, f) => acc + f.content_rating, 0) / feedbacks.length).toFixed(1) : '0.0'} / 5.0</span>
                  </div>
                  <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${((feedbacks.length > 0 ? feedbacks.reduce((acc, f) => acc + f.content_rating, 0) / feedbacks.length : 0)/5)*100}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    <span>Mentor Guidance Quality</span>
                    <span>{feedbacks.length > 0 ? (feedbacks.reduce((acc, f) => acc + f.mentor_rating, 0) / feedbacks.length).toFixed(1) : '0.0'} / 5.0</span>
                  </div>
                  <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${((feedbacks.length > 0 ? feedbacks.reduce((acc, f) => acc + f.mentor_rating, 0) / feedbacks.length : 0)/5)*100}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    <span>Localization Accessibility (Kannada to English)</span>
                    <span>{feedbacks.length > 0 ? (feedbacks.reduce((acc, f) => acc + f.learning_rating, 0) / feedbacks.length).toFixed(1) : '0.0'} / 5.0</span>
                  </div>
                  <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${((feedbacks.length > 0 ? feedbacks.reduce((acc, f) => acc + f.learning_rating, 0) / feedbacks.length : 0)/5)*100}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Filters & Audit Toggle */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-4 w-full md:w-auto">
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Filter by Rating</label>
                <select
                  value={ratingFilter}
                  onChange={e => setRatingFilter(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-white focus:outline-none"
                >
                  <option value="all">All Ratings</option>
                  <option value="5">5 Star</option>
                  <option value="4">4 Star</option>
                  <option value="3">3 Star</option>
                  <option value="2">2 Star</option>
                  <option value="1">1 Star</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Filter by Status</label>
                <select
                  value={feedbackStatusFilter}
                  onChange={e => setFeedbackStatusFilter(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-white focus:outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="hidden">Hidden</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Marketing Consent</label>
                <select
                  value={consentFilter}
                  onChange={e => setConsentFilter(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-white focus:outline-none"
                >
                  <option value="all">All Consents</option>
                  <option value="yes">Yes, Consented</option>
                  <option value="no">No Consent</option>
                </select>
              </div>
            </div>

            <button
              onClick={() => setShowFeedbackAudit(!showFeedbackAudit)}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
            >
              {showFeedbackAudit ? "Hide Audit Logs" : "View Feedback Audit Logs"}
            </button>
          </div>

          {/* Audit Logs List view */}
          {showFeedbackAudit && (
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-6 shadow-sm animate-in fade-in duration-300">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Feedback Moderation Audit Logs</h4>
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {feedbackAuditLogs.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No audit records found.</p>
                ) : (
                  feedbackAuditLogs.map(log => (
                    <div key={log.id} className="text-xs border-b border-slate-100 dark:border-slate-700/50 pb-2 flex justify-between items-center">
                      <div>
                        <span className="font-black text-blue-600 uppercase tracking-wider">{log.profiles?.full_name || 'Admin'}</span>
                        <span className="text-slate-500 font-bold mx-2">performed</span>
                        <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded font-mono text-[10px]">{log.action}</span>
                        {log.original_status && (
                          <span className="text-slate-400 ml-2">
                            ({log.original_status} ➔ {log.new_status})
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-bold">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Moderation Table */}
          <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700">
                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Student</th>
                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Ratings (O/C/M/L)</th>
                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">NPS</th>
                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Review Text</th>
                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Consent</th>
                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {loadingFeedback ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                      </td>
                    </tr>
                  ) : feedbacks.filter(fb => {
                      const matchesRating = ratingFilter === 'all' ? true : fb.overall_rating.toString() === ratingFilter;
                      const matchesStatus = feedbackStatusFilter === 'all' ? true : fb.status === feedbackStatusFilter;
                      const matchesConsent = consentFilter === 'all' ? true : (consentFilter === 'yes' ? fb.testimonial_permission : !fb.testimonial_permission);
                      return matchesRating && matchesStatus && matchesConsent;
                    }).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-xs text-slate-400 italic">No feedback entries matching filters.</td>
                    </tr>
                  ) : (
                    feedbacks.filter(fb => {
                      const matchesRating = ratingFilter === 'all' ? true : fb.overall_rating.toString() === ratingFilter;
                      const matchesStatus = feedbackStatusFilter === 'all' ? true : fb.status === feedbackStatusFilter;
                      const matchesConsent = consentFilter === 'all' ? true : (consentFilter === 'yes' ? fb.testimonial_permission : !fb.testimonial_permission);
                      return matchesRating && matchesStatus && matchesConsent;
                    }).map((fb) => (
                      <tr key={fb.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-black text-xs text-slate-800 dark:text-slate-100">{fb.profiles?.full_name || 'Anonymous'}</div>
                          <div className="text-[10px] text-slate-400 font-bold mt-0.5">{fb.profiles?.phone || 'Private'}</div>
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-600 dark:text-slate-400">
                          <span className="text-yellow-500">★</span> {fb.overall_rating} / {fb.content_rating} / {fb.mentor_rating} / {fb.learning_rating}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-xl text-[10px] font-black ${fb.recommendation_score >= 9 ? 'bg-green-50 text-green-700' : fb.recommendation_score >= 7 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'}`}>
                            NPS {fb.recommendation_score}
                          </span>
                        </td>
                        <td className="px-6 py-4 max-w-xs">
                          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium line-clamp-2" title={fb.review_text}>
                            {fb.review_text}
                          </p>
                          {fb.success_story && (
                            <span className="inline-block mt-1 text-[8px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 px-1.5 py-0.5 rounded font-black uppercase">Has Success Story</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-[10px] font-black uppercase ${fb.testimonial_permission ? 'text-green-600' : 'text-slate-400'}`}>
                            {fb.testimonial_permission ? 'Consented' : 'Private'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                            fb.status === 'pending' ? 'bg-amber-100 text-amber-800 animate-pulse' :
                            fb.status === 'approved' ? 'bg-green-100 text-green-800' :
                            fb.status === 'rejected' ? 'bg-red-100 text-red-800' :
                            'bg-slate-100 text-slate-800'
                          }`}>
                            {fb.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            {fb.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleUpdateFeedbackStatus(fb.id, 'approved')}
                                  className="p-1 bg-green-500 text-white rounded hover:bg-green-600 cursor-pointer"
                                  title="Approve"
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={() => handleUpdateFeedbackStatus(fb.id, 'rejected')}
                                  className="p-1 bg-red-500 text-white rounded hover:bg-red-600 cursor-pointer"
                                  title="Reject"
                                >
                                  ✕
                                </button>
                              </>
                            )}

                            {fb.status === 'approved' && (
                              <>
                                <button
                                  onClick={() => handleTogglePinFeedback(fb.id, fb.is_pinned)}
                                  className={`p-1 rounded cursor-pointer ${fb.is_pinned ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-700'}`}
                                  title={fb.is_pinned ? "Unfeature" : "Feature/Pin"}
                                >
                                  📌
                                </button>
                                <button
                                  onClick={() => handleUpdateFeedbackStatus(fb.id, 'hidden')}
                                  className="p-1 bg-slate-500 text-white rounded hover:bg-slate-600 cursor-pointer"
                                  title="Hide/Archive"
                                >
                                  👁️‍🗨️
                                </button>
                              </>
                            )}

                            {fb.status === 'hidden' && (
                              <button
                                onClick={() => handleUpdateFeedbackStatus(fb.id, 'approved')}
                                className="p-1 bg-green-500 text-white rounded hover:bg-green-600 cursor-pointer"
                                title="Restore/Approve"
                              >
                                ✓
                              </button>
                            )}

                            <button
                              onClick={() => handleOpenEditFeedbackModal(fb)}
                              className="p-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 rounded hover:bg-slate-200 cursor-pointer"
                              title="Edit Review Text"
                            >
                              ✏️
                            </button>
                          </div>
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

      {/* Inline Feedback Edit Modal */}
      {editingFeedback && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-[2.5rem] p-8 shadow-2xl max-w-xl w-full animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h4 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Edit Review Content
                </h4>
                <p className="text-xs text-slate-400 font-bold uppercase mt-1">
                  Author: {editingFeedback.profiles?.full_name || 'Anonymous'}
                </p>
              </div>
              <button
                onClick={() => setEditingFeedback(null)}
                className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center font-bold text-slate-500 hover:bg-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Review Text
                </label>
                <textarea
                  rows={4}
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 p-4 rounded-2xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-all resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Success Story
                </label>
                <textarea
                  rows={3}
                  value={editSuccessStory}
                  onChange={e => setEditSuccessStory(e.target.value)}
                  placeholder="No success story shared."
                  className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 p-4 rounded-2xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-all resize-none"
                />
              </div>

              <button
                onClick={handleSaveFeedbackEdit}
                className="w-full py-4 bg-blue-600 dark:bg-blue-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-blue-700 transition-all active:scale-[0.99] cursor-pointer"
              >
                Save Typo Edits
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Notification Modal */}
      {isNotificationModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-[2.5rem] p-8 shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h4 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Send Notification
                </h4>
                <p className="text-xs text-slate-400 font-bold uppercase mt-1">
                  To: {notificationTargetUserName}
                </p>
              </div>
              <button
                onClick={() => setIsNotificationModalOpen(false)}
                className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center font-bold text-slate-500 hover:bg-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendNotification} className="space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Notification Type
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['info', 'success', 'warning', 'error'] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setNotificationType(type)}
                      className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer border ${
                        notificationType === type
                          ? type === 'success' ? 'bg-green-500 text-white border-green-500' :
                            type === 'error' ? 'bg-red-500 text-white border-red-500' :
                            type === 'warning' ? 'bg-amber-500 text-white border-amber-500' :
                            'bg-blue-500 text-white border-blue-500'
                          : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Title (English | Kannada)
                </label>
                <input
                  type="text"
                  required
                  value={notificationTitle}
                  onChange={e => setNotificationTitle(e.target.value)}
                  placeholder="e.g. Update | ಅಪ್‌ಡೇಟ್"
                  className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 p-4 rounded-2xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Message (English | Kannada)
                </label>
                <textarea
                  required
                  rows={4}
                  value={notificationMessage}
                  onChange={e => setNotificationMessage(e.target.value)}
                  placeholder="Type message here..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 p-4 rounded-2xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-all resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSendingNotification || !notificationTitle || !notificationMessage}
                className="w-full py-4 bg-blue-600 dark:bg-blue-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-blue-700 transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSendingNotification && <Spin />}
                Send Notification
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Audit views remain similar... */}
    </div>
  );
};

// Internal helper for Admin Panel splitting
function splitBilingual(input: string): { en: string, kn: string } {
  if (!input.includes('|')) return { en: input.trim(), kn: input.trim() };
  const parts = input.split('|');
  return { en: parts[0].trim(), kn: parts[1].trim() };
}

export default AdminDashboard;
