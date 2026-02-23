
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../components/LanguageContext';
import { getAllUsers, toggleUserRestriction, deleteUser } from '../services/authService';
import { getAdminAuditLogs } from '../services/coachService';
import { fetchAllModules, saveModule, deleteModule, saveLesson, deleteLesson, uploadLessonMedia } from '../services/courseService';
import { UserRole, CourseLevel, Module, Lesson } from '../types';
import { useAppStore } from '../store/useAppStore';

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
  const [activeTab, setActiveTab] = useState<'users' | 'stats' | 'audit' | 'content'>('users');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [selectedAuditUser, setSelectedAuditUser] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Content Management State
  const [modules, setModules] = useState<Module[]>([]);
  const [editingModule, setEditingModule] = useState<any | null>(null);
  const [editingLesson, setEditingLesson] = useState<any | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'video' | 'audio' | 'pdf' | 'text' | 'speak_pdf' | 'speak_text') => {
    const file = e.target.files?.[0];
    if (!file || !editingLesson) return;

    setProcessingId(`uploading-${type}`);
    try {
      const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      const folderMap: Record<string, string> = {
        video: 'videos',
        audio: 'audios',
        pdf: 'pdfs',
        text: 'texts',
        speak_pdf: 'speak_pdfs',
        speak_text: 'speak_texts'
      };
      const path = `lessons/${folderMap[type]}/${fileName}`;
      const res = await uploadLessonMedia(file, path);

      if (res.error) {
        showNotification(`Upload failed: ${res.error.message}`, 'error');
      } else if (res.url) {
        const fieldMap: Record<string, string> = {
          video: 'video_url',
          audio: 'audio_url',
          pdf: 'pdf_url',
          text: 'text_url',
          speak_pdf: 'speak_pdf_url',
          speak_text: 'speak_text_url'
        };
        setEditingLesson({
          ...editingLesson,
          [fieldMap[type]]: res.url
        });
        showNotification("Upload successful!", "success");
      }
    } catch (err: any) {
      showNotification(`Error during upload: ${err.message}`, "error");
    } finally {
      setProcessingId(null);
    }
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
        const { data: profile } = await import('../lib/supabase').then(m => m.supabase.from('profiles').select('role').eq('id', session.user.id).single());
        setCurrentUser({ ...session.user, role: profile?.role });
      }

      const moduleData = await fetchAllModules();
      setModules(moduleData);
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
    const logs = await getAdminAuditLogs(userId);
    setAuditLogs(logs);
    setSelectedAuditUser(userId);
    setActiveTab('audit');
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

  // Module Handlers
  const handleSaveModule = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingId('saving-module');
    const res = await saveModule(editingModule);
    if (!res.error) {
      setEditingModule(null);
      await fetchData();
      const { refreshModules } = useAppStore.getState();
      await refreshModules();
      showNotification("Module saved successfully!", "success");
    } else {
      showNotification(res.error.message, "error");
    }
    setProcessingId(null);
  };

  const handleDeleteModule = async (id: string) => {
    if (!window.confirm("Delete module and all lessons?")) return;
    try {
      await deleteModule(id);
      showNotification("Module and its lessons deleted successfully", "success");
      fetchData();
    } catch (err: any) {
      showNotification(`Failed to delete module: ${err.message}`, "error");
    }
  };

  // Lesson Handlers
  const handleSaveLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("💾 Attempting to save lesson:", editingLesson);
    setProcessingId('saving-lesson');
    try {
      const res = await saveLesson(editingLesson) as any;
      if (!res.error) {
        console.log("✅ Lesson saved successfully!");
        setEditingLesson(null);
        await fetchData();
        // Force global store to refresh so the user sees changes immediately
        const { refreshModules } = useAppStore.getState();
        await refreshModules();
        showNotification("Lesson saved successfully!", "success");
      } else {
        console.error("❌ Save error details:", res.error);
        showNotification(`Failed to save: ${res.error.message || 'Unknown database error'}`, 'error');
      }
    } catch (err: any) {
      console.error("🔥 Unexpected save error:", err);
      showNotification(`An unexpected error occurred: ${err.message || 'Check your internet connection'}`, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteLesson = async (id: string) => {
    if (!window.confirm("Delete this lesson?")) return;
    try {
      await deleteLesson(id);
      showNotification("Lesson deleted successfully", "success");
      fetchData();
    } catch (err: any) {
      showNotification(`Failed to delete lesson: ${err.message}`, "error");
    }
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
          <h2 className="text-4xl font-black text-blue-900 dark:text-slate-100 tracking-tighter">Admin Panel</h2>
          {currentUser && (
            <p className="text-[10px] text-slate-400 font-mono mt-2">
              ID: {currentUser.id} <br />
              Role: <span className={currentUser.role === 'ADMIN' ? 'text-green-600 font-bold' : 'text-red-500 font-bold'}>{currentUser.role || 'NONE'}</span>
            </p>
          )}
        </div>

        <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl shadow-inner overflow-x-auto no-scrollbar">
          <button key="users" onClick={() => setActiveTab('users')} className={`px-4 py-2 rounded-xl text-xs font-black uppercase whitespace-nowrap ${activeTab === 'users' ? 'bg-white shadow text-blue-800' : 'text-slate-400'}`}>Users</button>
          <button key="content" onClick={() => setActiveTab('content')} className={`px-4 py-2 rounded-xl text-xs font-black uppercase whitespace-nowrap ${activeTab === 'content' ? 'bg-white shadow text-blue-800' : 'text-slate-400'}`}>Course Content</button>
          <button key="stats" onClick={() => setActiveTab('stats')} className={`px-4 py-2 rounded-xl text-xs font-black uppercase whitespace-nowrap ${activeTab === 'stats' ? 'bg-white shadow text-blue-800' : 'text-slate-400'}`}>Stats</button>
          {selectedAuditUser && <button key="audit" onClick={() => setActiveTab('audit')} className={`px-4 py-2 rounded-xl text-xs font-black uppercase whitespace-nowrap ${activeTab === 'audit' ? 'bg-white shadow text-blue-800' : 'text-slate-400'}`}>Audit</button>}
        </div>
      </div>

      {activeTab === 'users' && (
        <div className="bg-white dark:bg-slate-800 rounded-[2rem] border-2 border-slate-100 dark:border-slate-700 overflow-hidden shadow-xl">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">User</th>
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
                  <td className="p-6 flex gap-2">
                    <button onClick={() => handleAudit(user.id)} className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200" title="Review Chat Audit">👁️ Logs</button>
                    <button onClick={() => handleRestrict(user.id, user.is_restricted)} className="p-2 bg-amber-100 text-amber-600 rounded-lg hover:bg-amber-200">{user.is_restricted ? '🔓' : '🚫'}</button>
                    <button onClick={() => handleDelete(user.id)} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200">🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'content' && (
        <div className="space-y-8 animate-in fade-in">
          <div className="flex justify-between items-center">
            <h3 className="text-2xl font-black text-blue-900 dark:text-blue-300">Curriculum Editor</h3>
            <button
              onClick={() => setEditingModule({ level: CourseLevel.BASIC, titleStr: '', descStr: '', order_index: modules.length })}
              className="bg-blue-800 text-white px-6 py-2 rounded-xl text-xs font-black uppercase"
            >
              + Add Module
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {modules.map((mod: any, idx) => {
              return (
                <div key={mod.id || idx} className="bg-white dark:bg-slate-800 rounded-3xl border-2 border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm">
                  <div className="p-6 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
                    <div>
                      <h4 className="font-black text-lg text-blue-900 dark:text-blue-400">{mod.title.en} | {mod.title.kn}</h4>
                      <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">{mod.level}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingModule({
                          id: mod.id,
                          level: mod.level,
                          titleStr: `${mod.title.en} | ${mod.title.kn}`,
                          descStr: `${mod.description.en} | ${mod.description.kn}`,
                          order_index: mod.order_index
                        })}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        ✏️
                      </button>
                      <button onClick={() => handleDeleteModule(mod.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">🗑️</button>
                    </div>
                  </div>

                  <div className="p-6 space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                      <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Lessons</h5>
                      <button
                        onClick={() => {
                          setEditingLesson({ module_id: mod.id, titleStr: '', notesStr: '', order_index: mod.lessons.length });
                        }}
                        className="text-[10px] font-black text-blue-600 uppercase cursor-pointer hover:underline"
                      >
                        + Add Lesson
                      </button>
                    </div>
                    <div className="space-y-2">
                      {mod.lessons.map((lesson: any, lIdx: number) => (
                        <div key={lesson.id || lIdx} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                          <span className="text-xs font-bold">{lesson.title.en}</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingLesson({
                                id: lesson.id,
                                module_id: mod.id,
                                titleStr: `${lesson.title.en} | ${lesson.title.kn}`,
                                notesStr: `${lesson.notes.en} | ${lesson.notes.kn}`,
                                video_url: lesson.videoUrl,
                                audio_url: lesson.audioUrl,
                                pdf_url: lesson.pdfUrl,
                                text_url: lesson.textUrl,
                                text_content: lesson.textContent,
                                scenario: lesson.scenario,
                                order_index: lesson.order_index
                              })}
                              className="text-xs p-1 opacity-50 hover:opacity-100"
                            >
                              ✏️
                            </button>
                            <button onClick={() => handleDeleteLesson(lesson.id)} className="text-xs p-1 opacity-50 hover:opacity-100 text-red-500">🗑️</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Module Modal */}
          {editingModule && (
            <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <form onSubmit={handleSaveModule} className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] w-full max-w-lg space-y-6">
                <h3 className="text-xl font-black">{editingModule.id ? 'Edit Module' : 'Add Module'}</h3>

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Title (English | Kannada)</label>
                    <input placeholder="Ex: Greetings | ಶುಭಾಶಯಗಳು" required className="w-full p-4 border rounded-2xl bg-slate-50 dark:bg-slate-900" value={editingModule.titleStr} onChange={e => setEditingModule({ ...editingModule, titleStr: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Description (English | Kannada)</label>
                    <textarea placeholder="Ex: Learn to say hi | ಹಾಯ್ ಹೇಳಲು ಕಲಿಯಿರಿ" required className="w-full p-4 border rounded-2xl bg-slate-50 dark:bg-slate-900 h-24" value={editingModule.descStr} onChange={e => setEditingModule({ ...editingModule, descStr: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Difficulty Level</label>
                    <select className="w-full p-4 border rounded-2xl bg-slate-50 dark:bg-slate-900" value={editingModule.level} onChange={e => setEditingModule({ ...editingModule, level: e.target.value })}>
                      {Object.values(CourseLevel).map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditingModule(null)} className="flex-1 p-4 bg-slate-100 rounded-2xl font-bold">Cancel</button>
                  <button type="submit" className="flex-1 p-4 bg-blue-800 text-white rounded-2xl font-black">Save Module</button>
                </div>
              </form>
            </div>
          )}

          {/* Lesson Modal */}
          {editingLesson && (
            <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
              <form onSubmit={handleSaveLesson} className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] w-full max-w-3xl space-y-6 my-8 overflow-y-auto max-h-[90vh] custom-scrollbar">
                <h3 className="text-xl font-black">{editingLesson.id ? 'Edit Lesson' : 'Add Lesson'}</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Text Details */}
                  <div className="space-y-4">
                    <h5 className="font-black text-xs text-blue-800 uppercase tracking-widest">Bilingual Info</h5>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Title (English | Kannada)</label>
                      <input placeholder="Lesson Title | ಪಾಠದ ಶೀರ್ಷಿಕೆ" required className="w-full p-4 border rounded-2xl bg-slate-50 dark:bg-slate-900" value={editingLesson.titleStr} onChange={e => setEditingLesson({ ...editingLesson, titleStr: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Summary Notes (English | Kannada)</label>
                      <textarea placeholder="Brief notes | ಸಣ್ಣ ಮಾಹಿತಿ" required className="w-full p-4 border rounded-2xl bg-slate-50 dark:bg-slate-900 h-24" value={editingLesson.notesStr} onChange={e => setEditingLesson({ ...editingLesson, notesStr: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Long Reading Text (Optional)</label>
                      <textarea placeholder="Paste full article or text lesson here..." className="w-full p-4 border rounded-2xl bg-slate-50 dark:bg-slate-900 h-32" value={editingLesson.text_content || ''} onChange={e => setEditingLesson({ ...editingLesson, text_content: e.target.value })} />
                    </div>
                  </div>

                  {/* Multimedia URLs */}
                  <div className="space-y-4">
                    {/* === SECTION 1: WATCH/LISTEN === */}
                    <h5 className="font-black text-xs text-blue-600 uppercase tracking-widest border-b pb-2">📺 Watch/Listen : Upload Video/Audio</h5>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Video URL</label>
                      <div className="flex gap-2">
                        <input placeholder="https://..." className="flex-1 p-4 border rounded-2xl bg-slate-50 dark:bg-slate-900 text-xs" value={editingLesson.video_url || ''} onChange={e => setEditingLesson({ ...editingLesson, video_url: e.target.value })} />
                        <label className="cursor-pointer bg-blue-100 dark:bg-blue-900/30 text-blue-600 p-4 rounded-2xl hover:bg-blue-200 transition-colors">
                          <input type="file" className="hidden" accept="video/*" onChange={e => handleFileUpload(e, 'video')} />
                          {processingId === 'uploading-video' ? '⏳' : '📁'}
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Audio URL (fallback if no video)</label>
                      <div className="flex gap-2">
                        <input placeholder="https://..." className="flex-1 p-4 border rounded-2xl bg-slate-50 dark:bg-slate-900 text-xs" value={editingLesson.audio_url || ''} onChange={e => setEditingLesson({ ...editingLesson, audio_url: e.target.value })} />
                        <label className="cursor-pointer bg-orange-100 dark:bg-orange-900/30 text-orange-600 p-4 rounded-2xl hover:bg-orange-200 transition-colors">
                          <input type="file" className="hidden" accept="audio/wav,audio/mpeg,audio/mp4,audio/x-m4a,audio/*" onChange={e => handleFileUpload(e, 'audio')} />
                          {processingId === 'uploading-audio' ? '⏳' : '📁'}
                        </label>
                      </div>
                    </div>

                    {/* === SECTION 2: STUDY === */}
                    <h5 className="font-black text-xs text-green-600 uppercase tracking-widest border-b pb-2 mt-4">📖 Study : Upload PDF/Text Lessons</h5>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">PDF File</label>
                      <div className="flex gap-2">
                        <input placeholder="https://..." className="flex-1 p-4 border rounded-2xl bg-slate-50 dark:bg-slate-900 text-xs" value={editingLesson.pdf_url || ''} onChange={e => setEditingLesson({ ...editingLesson, pdf_url: e.target.value })} />
                        <label className="cursor-pointer bg-green-100 dark:bg-green-900/30 text-green-600 p-4 rounded-2xl hover:bg-green-200 transition-colors">
                          <input type="file" className="hidden" accept="application/pdf" onChange={e => handleFileUpload(e, 'pdf')} />
                          {processingId === 'uploading-pdf' ? '⏳' : '📁'}
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Text File</label>
                      <div className="flex gap-2">
                        <input placeholder="https://..." className="flex-1 p-4 border rounded-2xl bg-slate-50 dark:bg-slate-900 text-xs" value={editingLesson.text_url || ''} onChange={e => setEditingLesson({ ...editingLesson, text_url: e.target.value })} />
                        <label className="cursor-pointer bg-green-100 dark:bg-green-900/30 text-green-600 p-4 rounded-2xl hover:bg-green-200 transition-colors">
                          <input type="file" className="hidden" accept="text/plain" onChange={e => handleFileUpload(e, 'text')} />
                          {processingId === 'uploading-text' ? '⏳' : '📁'}
                        </label>
                      </div>
                    </div>

                    {/* === SECTION 3: SPEAK === */}
                    <h5 className="font-black text-xs text-purple-600 uppercase tracking-widest border-b pb-2 mt-4">🎤 Speak : Upload PDF/Text Lessons</h5>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">SPEAK PDF File</label>
                      <div className="flex gap-2">
                        <input placeholder="https://..." className="flex-1 p-4 border rounded-2xl bg-slate-50 dark:bg-slate-900 text-xs" value={editingLesson.speak_pdf_url || ''} onChange={e => setEditingLesson({ ...editingLesson, speak_pdf_url: e.target.value })} />
                        <label className="cursor-pointer bg-purple-100 dark:bg-purple-900/30 text-purple-600 p-4 rounded-2xl hover:bg-purple-200 transition-colors">
                          <input type="file" className="hidden" accept="application/pdf" onChange={e => handleFileUpload(e, 'speak_pdf')} />
                          {processingId === 'uploading-speak_pdf' ? '⏳' : '📁'}
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">SPEAK Text File</label>
                      <div className="flex gap-2">
                        <input placeholder="https://..." className="flex-1 p-4 border rounded-2xl bg-slate-50 dark:bg-slate-900 text-xs" value={editingLesson.speak_text_url || ''} onChange={e => setEditingLesson({ ...editingLesson, speak_text_url: e.target.value })} />
                        <label className="cursor-pointer bg-purple-100 dark:bg-purple-900/30 text-purple-600 p-4 rounded-2xl hover:bg-purple-200 transition-colors">
                          <input type="file" className="hidden" accept="text/plain" onChange={e => handleFileUpload(e, 'speak_text')} />
                          {processingId === 'uploading-speak_text' ? '⏳' : '📁'}
                        </label>
                      </div>
                    </div>
                  </div>

                </div>

                <div className="border-t pt-4 space-y-4">
                  <h5 className="font-black text-xs uppercase text-slate-400">AI Conversation Scenario (Optional)</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input placeholder="Character (Eng | Kan)" className="p-4 border rounded-2xl bg-slate-50 dark:bg-slate-900 text-sm" value={editingLesson.scenario?.characterStr || ''} onChange={e => {
                      const split = splitBilingual(e.target.value);
                      setEditingLesson({ ...editingLesson, scenario: { ...(editingLesson.scenario || {}), characterStr: e.target.value, character: split } });
                    }} />
                    <input placeholder="Objective (Eng | Kan)" className="p-4 border rounded-2xl bg-slate-50 dark:bg-slate-900 text-sm" value={editingLesson.scenario?.objectiveStr || ''} onChange={e => {
                      const split = splitBilingual(e.target.value);
                      setEditingLesson({ ...editingLesson, scenario: { ...(editingLesson.scenario || {}), objectiveStr: e.target.value, objective: split } });
                    }} />
                  </div>
                  <textarea placeholder="AI System Instruction..." className="p-4 border rounded-2xl bg-slate-50 dark:bg-slate-900 text-sm w-full h-20" value={editingLesson.scenario?.systemInstruction || ''} onChange={e => setEditingLesson({ ...editingLesson, scenario: { ...(editingLesson.scenario || {}), systemInstruction: e.target.value } })} />
                  <input placeholder="AI Starting Message..." className="p-4 border rounded-2xl bg-slate-50 dark:bg-slate-900 text-sm w-full" value={editingLesson.scenario?.initialMessage || ''} onChange={e => setEditingLesson({ ...editingLesson, scenario: { ...(editingLesson.scenario || {}), initialMessage: e.target.value } })} />
                </div>

                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditingLesson(null)} disabled={processingId === 'saving-lesson'} className="flex-1 p-4 bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-white rounded-2xl font-bold transition-colors hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50">Cancel</button>
                  <button type="submit" disabled={processingId === 'saving-lesson'} className="flex-1 p-4 bg-orange-600 text-white rounded-2xl font-black shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
                    {processingId === 'saving-lesson' ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Saving...
                      </>
                    ) : 'Save Multi-Modal Lesson'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Audit/Stats views remain similar... */}
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
