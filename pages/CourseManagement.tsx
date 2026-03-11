/** V 1.0 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../components/LanguageContext';
import { fetchAllModules, saveModule, deleteModule, deleteLesson } from '../services/courseService';
import { UserRole, CourseLevel, Module } from '../types';
import { useAppStore } from '../store/useAppStore';

interface Notification {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
}

const CourseManagement: React.FC = () => {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [modules, setModules] = useState<Module[]>([]);
    const [editingModule, setEditingModule] = useState<any | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        const id = Math.random().toString(36).substr(2, 9);
        setNotifications(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 5000);
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const moduleData = await fetchAllModules();
            setModules(moduleData);
        } catch (err: any) {
            showNotification(err.message || "Could not connect to the database.", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

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
                    <h2 className="text-4xl font-black text-blue-900 dark:text-slate-100 tracking-tighter uppercase">{t({ en: 'Curriculum Management', kn: 'ಪಠ್ಯಕ್ರಮ ನಿರ್ವಹಣೆ' })}</h2>
                    <p className="text-[10px] text-slate-400 font-mono mt-2 tracking-widest">{t({ en: 'ADD MODULES & LESSONS', kn: 'ಮಾಡ್ಯೂಲ್‌ಗಳು ಮತ್ತು ಪಾಠಗಳನ್ನು ಸೇರಿಸಿ' })}</p>
                </div>
                <button
                    onClick={() => navigate('/admin')}
                    className="px-6 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all dark:text-slate-300"
                >
                    {t({ en: 'Back to Admin', kn: 'ಅಡ್ಮಿನ್ ಹಿಂದಕ್ಕೆ' })}
                </button>
            </div>

            <div className="space-y-8 animate-in fade-in">
                <div className="flex justify-between items-center">
                    <h3 className="text-2xl font-black text-blue-900 dark:text-blue-300">{t({ en: 'Curriculum Editor', kn: 'ಪಠ್ಯಕ್ರಮ ಸಂಪಾದಕ' })}</h3>
                    <button
                        onClick={() => setEditingModule({ level: CourseLevel.BASIC, titleStr: '', descStr: '', order_index: modules.length })}
                        className="bg-blue-800 text-white px-6 py-2 rounded-xl text-xs font-black uppercase shadow-lg hover:scale-105 transition-transform"
                    >
                        {t({ en: '+ Add Module', kn: '+ ಮಾಡ್ಯೂಲ್ ಸೇರಿಸಿ' })}
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    {modules.map((mod: any, idx) => (
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
                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    >
                                        ✏️
                                    </button>
                                    <button onClick={() => handleDeleteModule(mod.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">🗑️</button>
                                </div>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-2">
                                    <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t({ en: 'Lessons', kn: 'ಪಾಠಗಳು' })}</h5>
                                    <button
                                        onClick={() => navigate(`/admin/course/lesson/${mod.id}`)}
                                        className="text-[10px] font-black text-blue-600 uppercase cursor-pointer hover:underline"
                                    >
                                        {t({ en: '+ Add Lesson', kn: '+ ಪಾಠ ಸೇರಿಸಿ' })}
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {mod.lessons.map((lesson: any, lIdx: number) => (
                                        <div key={lesson.id || lIdx} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900 rounded-xl transition-all hover:shadow-md">
                                            <span className="text-xs font-bold">{lesson.title.en}</span>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => navigate(`/admin/course/lesson/${mod.id}/${lesson.id}`)}
                                                    className="text-xs p-1 opacity-50 hover:opacity-100 transition-opacity"
                                                >
                                                    ✏️
                                                </button>
                                                <button onClick={() => handleDeleteLesson(lesson.id)} className="text-xs p-1 opacity-50 hover:opacity-100 text-red-500 transition-opacity">🗑️</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Module Modal */}
                {editingModule && (
                    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                        <form onSubmit={handleSaveModule} className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] w-full max-w-lg space-y-6 shadow-2xl shadow-blue-500/10">
                            <h3 className="text-2xl font-black text-blue-900 dark:text-blue-300 uppercase tracking-tight">
                                {editingModule.id ? t({ en: 'Edit Module', kn: 'ಮಾಡ್ಯೂಲ್ ಸಂಪಾದಿಸಿ' }) : t({ en: 'Add Module', kn: 'ಮಾಡ್ಯೂಲ್ ಸೇರಿಸಿ' })}
                            </h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-2">Title (English | Kannada)</label>
                                    <input placeholder="Ex: Greetings | ಶುಭಾಶಯಗಳು" required className="w-full p-4 border-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 outline-none focus:border-blue-500 transition-all font-bold" value={editingModule.titleStr} onChange={e => setEditingModule({ ...editingModule, titleStr: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-2">Description (English | Kannada)</label>
                                    <textarea placeholder="Ex: Learn to say hi | ಹಾಯ್ ಹೇಳಲು ಕಲಿಯಿರಿ" required className="w-full p-4 border-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 h-24 outline-none focus:border-blue-500 transition-all font-bold" value={editingModule.descStr} onChange={e => setEditingModule({ ...editingModule, descStr: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-2">Difficulty Level</label>
                                    <select className="w-full p-4 border-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 outline-none focus:border-blue-500 transition-all font-bold" value={editingModule.level} onChange={e => setEditingModule({ ...editingModule, level: e.target.value as CourseLevel })}>
                                        {Object.values(CourseLevel).map(l => <option key={l} value={l}>{l}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button type="button" onClick={() => setEditingModule(null)} className="flex-1 p-4 bg-slate-100 dark:bg-slate-700 rounded-2xl font-black text-xs uppercase tracking-widest transition-all hover:bg-slate-200 dark:hover:bg-slate-600">
                                    {t({ en: 'Cancel', kn: 'ರದ್ದುಗೊಳಿಸಿ' })}
                                </button>
                                <button type="submit" className="flex-1 p-4 bg-blue-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:scale-[1.02] transition-all">
                                    {t({ en: 'Save Module', kn: 'ಮಾಡ್ಯೂಲ್ ಉಳಿಸಿ' })}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CourseManagement;
