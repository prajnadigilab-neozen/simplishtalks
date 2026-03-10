
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../components/LanguageContext';
import { getAllUsers, toggleUserRestriction, deleteUser, mapRole } from '../services/authService';
import { getAdminAuditLogs, getAllUserUsage, getUserUsageLogs, getPlatformReports } from '../services/coachService';
import { getGlobalStats } from '../services/courseService';
import { UserRole, PackageType } from '../types';
import { useAppStore } from '../store/useAppStore';
import { clearAllRecordings } from '../utils/recordingStore';

interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

const AdminDashboard: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'stats' | 'audit' | 'content' | 'ai' | 'mods' | 'usage_history' | 'reports'>('users');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [usageData, setUsageData] = useState<any[]>([]);
  const [reportsData, setReportsData] = useState<any[]>([]);
  const [reportsStartDate, setReportsStartDate] = useState<string>('');
  const [reportsEndDate, setReportsEndDate] = useState<string>('');

  const [selectedAuditUser, setSelectedAuditUser] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [selectedUsageUser, setSelectedUsageUser] = useState<string | null>(null);
  const [usageLogs, setUsageLogs] = useState<any[]>([]);

  // Platform Stats State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [globalStats, setGlobalStats] = useState({
    totalUsers: 0,
    activeLearners: 0,
    totalModules: 0,
    totalLessons: 0,
    totalRevenue: 0,
    talksCount: 0,
    snehiCount: 0
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
      const userData = await getAllUsers();
      setUsers(userData);

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

      // Calculate Revenue and Package Counts from users list
      let totalRevenue = 0;
      let talksCount = 0;
      let snehiCount = 0;

      userData.forEach(u => {
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
      });

      setGlobalStats({
        ...stats,
        totalRevenue,
        talksCount,
        snehiCount
      });

      const usage = await getAllUserUsage();
      setUsageData(usage);

      const reports = await getPlatformReports();
      setReportsData(reports);
    } catch (err: any) {
      setError(err.message || "Could not connect to the database.");
    } finally {
      setLoading(false);
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

  // --- Reports Filtering and Download ---
  const filteredReports = reportsData.filter(report => {
    if (!reportsStartDate && !reportsEndDate) return true;

    // Create Date objects. Report dates are typically 'YYYY-MM-DD' or full ISO strings
    const rDate = new Date(report.report_date);
    rDate.setHours(0, 0, 0, 0);

    if (reportsStartDate) {
      const sDate = new Date(reportsStartDate);
      sDate.setHours(0, 0, 0, 0);
      if (rDate < sDate) return false;
    }

    if (reportsEndDate) {
      const eDate = new Date(reportsEndDate);
      eDate.setHours(0, 0, 0, 0);
      if (rDate > eDate) return false;
    }

    return true;
  });

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
        ...(isSuperAdmin ? [`"${r.daily_revenue || 0}"`] : []),
        `"${r.deleted_count || 0}"`
      ];
      csvContent += row.join(",") + "\n";
    });

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `platform_reports_${new Date().toISOString().split('T')[0]}.csv`);
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
          <h2 className="text-4xl font-black text-blue-900 dark:text-slate-100 tracking-tighter uppercase">Admin Dashboard</h2>
          {currentUser && (
            <p className="text-[10px] text-slate-400 font-mono mt-2">
              ID: {currentUser.id} <br />
              Role: <span className={currentUser.role === UserRole.SUPER_ADMIN ? 'text-green-600 font-bold' : 'text-red-500 font-bold'}>{currentUser.role || 'NONE'}</span>
            </p>
          )}
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => navigate('/admin/course')}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2"
          >
            <span>📚</span> Course Content
          </button>
          {currentUser?.role === UserRole.SUPER_ADMIN && (
            <button
              onClick={() => navigate('/admin/ai-instructions')}
              className="px-6 py-2.5 bg-purple-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-purple-700 transition-all flex items-center gap-2"
            >
              <span>🤖</span> AI Instructions
            </button>
          )}
        </div>

        <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl shadow-inner overflow-x-auto no-scrollbar">
          {currentUser?.role === UserRole.SUPER_ADMIN && (
            <button key="users" onClick={() => setActiveTab('users')} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap ${activeTab === 'users' ? 'bg-white shadow text-blue-800' : 'text-slate-400'}`}>Users</button>
          )}
          <button key="stats" onClick={() => setActiveTab('stats')} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap ${activeTab === 'stats' ? 'bg-white shadow text-blue-800' : 'text-slate-400'}`}>General Stats</button>
          <button key="reports" onClick={() => setActiveTab('reports')} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap ${activeTab === 'reports' ? 'bg-white shadow text-blue-800' : 'text-slate-400'}`}>Reports</button>

          {currentUser?.role === UserRole.SUPER_ADMIN && (
            <>
              <button key="mods" onClick={() => setActiveTab('mods')} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap ${activeTab === 'mods' ? 'bg-white shadow text-blue-800' : 'text-slate-400'}`}>Moderators</button>
            </>
          )}

          {selectedAuditUser && <button key="audit" onClick={() => setActiveTab('audit')} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap ${activeTab === 'audit' ? 'bg-white shadow text-blue-800' : 'text-slate-400'}`}>Audit</button>}
        </div>
      </div>

      {activeTab === 'users' && (
        <div className="bg-white dark:bg-slate-800 rounded-[2rem] border-2 border-slate-100 dark:border-slate-700 overflow-hidden shadow-xl">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">User</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Role</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Voice Usage</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Chat Usage</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {users.map((user, idx) => (
                <tr key={user.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                  <td className="p-6">
                    <div className="flex flex-col">
                      <span className="font-black text-slate-800 dark:text-slate-100">{user.full_name}</span>
                      <span className="text-[10px] text-slate-400">{user.phone}</span>
                    </div>
                  </td>
                  <td className="p-6">
                    <span className={`text-[10px] font-black px-2 py-1 rounded-full ${user.role === UserRole.SUPER_ADMIN ? 'bg-green-100 text-green-700' :
                      user.role === UserRole.MODERATOR ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                      {user.role || 'STUDENT'}
                    </span>
                  </td>
                  <td className="p-6">
                    {(() => {
                      const usage = usageData.find(u => u.user_id === user.id);
                      const seconds = usage?.voice_seconds_total || 0;
                      const mins = Math.floor(seconds / 60);
                      const secs = seconds % 60;
                      const isOver = seconds >= 180;
                      return (
                        <div className="flex flex-col">
                          <span className={`text-[10px] font-black ${isOver ? 'text-red-500' : 'text-blue-600'}`}>
                            🎙️ {mins}:{secs.toString().padStart(2, '0')} / 3:00
                          </span>
                          <span className="text-[8px] text-slate-400 uppercase tracking-tighter">
                            Live Talk Time
                          </span>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="p-6">
                    {(() => {
                      const usage = usageData.find(u => u.user_id === user.id);
                      const msgs = usage?.chat_messages_total || 0;
                      const tokens = usage?.chat_tokens_total || 0;
                      const isOver = msgs >= 50;
                      return (
                        <div className="flex flex-col">
                          <span className={`text-[10px] font-black ${isOver ? 'text-red-500' : 'text-purple-600'}`}>
                            💬 {msgs} / 50 msgs
                          </span>
                          <span className="text-[8px] text-slate-400 uppercase tracking-tighter">
                            {tokens.toLocaleString()} tokens
                          </span>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="p-6 flex gap-2">
                    <button onClick={() => handleAudit(user.id)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100" title="Review Chat Audit">👁️ Chat</button>
                    <button onClick={() => handleUsageLogs(user.id)} className="p-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100" title="View Usage History">📊 Usage</button>
                    <button onClick={() => handleRestrict(user.id, user.is_restricted)} className="p-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100">{user.is_restricted ? '🔓' : '🚫'}</button>
                    {currentUser?.role === UserRole.SUPER_ADMIN && (
                      <select
                        value={user.role}
                        onChange={(e) => handleUpdateRole(user.id, e.target.value as UserRole)}
                        className="text-[10px] font-black border-2 border-slate-100 rounded-lg px-2 bg-white"
                      >
                        <option value={UserRole.STUDENT}>STUDENT</option>
                        <option value={UserRole.MODERATOR}>MODERATOR</option>
                        <option value={UserRole.SUPER_ADMIN}>SUPER ADMIN</option>
                      </select>
                    )}
                    <button onClick={() => handleDelete(user.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100">🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}



      {activeTab === 'mods' && (
        <div className="space-y-8 animate-in fade-in">
          <div className="flex justify-between items-center">
            <h3 className="text-2xl font-black text-blue-900 dark:text-blue-300">Moderator List</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase">Curators of SIMPLISH - Talks</p>
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
            <h3 className="text-2xl font-black text-blue-900 dark:text-blue-300">Platform Analytics</h3>
            <button onClick={fetchData} className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-black uppercase hover:bg-blue-100 transition-colors">
              Refresh Data
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
                  <span className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-lg uppercase tracking-wider">Revenue</span>
                </div>
                <div>
                  <h4 className="text-4xl font-black text-slate-800 dark:text-slate-100 mb-1">₹{globalStats.totalRevenue.toLocaleString()}</h4>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Account Recieved</p>
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
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Registered</p>
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
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Active Learners</p>
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
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Course Modules</p>
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
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Lessons</p>
              </div>
            </div>
          </div>

          <div className="mt-8 bg-blue-50 dark:bg-slate-800/50 rounded-[2rem] p-8 border border-blue-100 dark:border-slate-700">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-3xl shadow-lg">
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
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${log.event_type === 'voice'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                          }`}>
                          {log.event_type}
                        </span>
                      </td>
                      <td className="p-6 font-bold text-slate-700 dark:text-slate-300">
                        {log.event_type === 'voice'
                          ? `${Math.floor(log.amount / 60)}m ${log.amount % 60}s`
                          : `${log.amount} messages`}
                      </td>
                      <td className="p-6 text-slate-400 text-xs text-right whitespace-nowrap">
                        {log.tokens?.toLocaleString()} tokens
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
              <h3 className="text-2xl font-black text-orange-900 dark:text-orange-300">Platform Reports</h3>
              <p className="text-sm text-slate-500">Daily performance metrics and user activity trends.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-end sm:items-center">
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex flex-col">
                  <label className="text-[8px] font-black uppercase text-slate-400 px-1">Start Date</label>
                  <input
                    type="date"
                    value={reportsStartDate}
                    onChange={(e) => setReportsStartDate(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                  />
                </div>
                <span className="text-slate-300 font-bold">-</span>
                <div className="flex flex-col">
                  <label className="text-[8px] font-black uppercase text-slate-400 px-1">End Date</label>
                  <input
                    type="date"
                    value={reportsEndDate}
                    onChange={(e) => setReportsEndDate(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                  />
                </div>
                {(reportsStartDate || reportsEndDate) && (
                  <button
                    onClick={() => { setReportsStartDate(''); setReportsEndDate(''); }}
                    className="ml-2 w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 flex items-center justify-center text-xs text-slate-500"
                    title="Clear Filters"
                  >
                    ✕
                  </button>
                )}
              </div>
              <button
                onClick={handleDownloadCSV}
                className="px-4 py-3 bg-orange-100 hover:bg-orange-200 text-orange-700 dark:bg-orange-900/30 dark:hover:bg-orange-900/50 dark:text-orange-400 rounded-xl text-xs font-black uppercase transition-colors flex items-center gap-2 border border-orange-200 dark:border-orange-800 shadow-sm"
              >
                <span>📥</span> Download CSV
              </button>
            </div>
          </div>

          <div className="overflow-hidden bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 shadow-xl">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Date</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Reg. Users</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Active</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Talks/Snehi</th>
                  {currentUser?.role === UserRole.SUPER_ADMIN && (
                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Revenue</th>
                  )}
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Deleted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredReports.length === 0 ? (
                  <tr>
                    <td colSpan={currentUser?.role === UserRole.SUPER_ADMIN ? 6 : 5} className="p-8 text-center text-slate-400 font-bold">
                      No reports found for the selected date range.
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
                      {currentUser?.role === UserRole.SUPER_ADMIN && (
                        <td className="p-6 text-green-600 font-bold">
                          ₹{report.daily_revenue?.toLocaleString()}
                        </td>
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
