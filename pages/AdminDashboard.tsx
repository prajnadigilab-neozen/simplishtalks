
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../components/LanguageContext';
import { getAllUsers, toggleUserRestriction, deleteUser, mapRole, getArchivedUsers } from '../services/authService';
import { getAdminAuditLogs, getAllUserUsage, getUserUsageLogs, getPlatformReports, getUserUsageByRange } from '../services/coachService';
import { getGlobalStats } from '../services/courseService';
import { UserRole, PackageType } from '../types';
import { useAppStore } from '../store/useAppStore';
import { clearAllRecordings } from '../utils/recordingStore';
import { getSystemConfig, updateSystemConfig, SystemConfig } from '../services/systemConfigService';

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
  const [activeTab, setActiveTab] = useState<'users' | 'stats' | 'audit' | 'content' | 'ai' | 'mods' | 'usage_history' | 'reports' | 'config' | 'custom_scenarios'>('users');
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


  const fetchData = async () => {
    setLoading(true);
    setError(null);
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

      // Get current user session for debugging/RLS verification
      const { data: { session } } = await import('../lib/supabase').then(m => m.supabase.auth.getSession());
      if (session) {
        const { data: profile, error: pError } = await import('../lib/supabase').then(m => m.supabase.from('profiles').select('role').eq('id', session.user.id).single());
        console.log("📊 AdminDashboard Current Session User:", session.user);
        console.log("📊 AdminDashboard Current Profile Fetch:", profile, pError);
        const mappedRole = mapRole(profile?.role || session.user.user_metadata?.role);
        console.log("📊 AdminDashboard Final Mapped Role:", mappedRole);
        setCurrentUser({ ...session.user, role: mappedRole });
      }

      const stats = await getGlobalStats();

      // Calculate Revenue and Package Counts from all users list (including deleted for historical tallying)
      let totalRevenue = 0;
      let talksCount = 0;
      let snehiCount = 0;

      allUsers.forEach(u => {
        if (u.package_type === PackageType.TALKS) {
          totalRevenue += 299;
          talksCount++;
        } else if (u.package_type === PackageType.SNEHI) {
          totalRevenue += 499;
          snehiCount++;
        } else if (u.package_type === PackageType.BOTH) {
          totalRevenue += (299 + 499);
          talksCount++;
          snehiCount++;
        }
        totalRevenue += (u.topup_amount || 0);
      });

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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
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

        <div className="w-full overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl shadow-inner w-max min-w-full">
            {currentUser?.role === UserRole.SUPER_ADMIN && (
              <button key="users" onClick={() => setActiveTab('users')} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap ${activeTab === 'users' ? 'bg-white shadow text-blue-800' : 'text-slate-400'}`}>{t({ en: 'Users', kn: 'ಬಳಕೆದಾರರು' })}</button>
            )}
            <button key="stats" onClick={() => setActiveTab('stats')} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap ${activeTab === 'stats' ? 'bg-white shadow text-blue-800' : 'text-slate-400'}`}>{t({ en: 'General Stats', kn: 'ಅಂಕಿಅಂಶಗಳು' })}</button>
            <button key="reports" onClick={() => setActiveTab('reports')} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap ${activeTab === 'reports' ? 'bg-white shadow text-blue-800' : 'text-slate-400'}`}>{t({ en: 'Reports', kn: 'ವರದಿಗಳು' })}</button>
 
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

      {activeTab === 'config' && currentUser?.role === UserRole.SUPER_ADMIN && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
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

             {systemConfig ? (
               <form onSubmit={handleUpdateConfig} className="grid grid-cols-1 md:grid-cols-2 gap-8">
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

                 <div className="md:col-span-2 pt-6">
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
          </div>

          {/* Calculated Examples for verification */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
