/** V 1.0 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../components/LanguageContext';
import { fetchAllModules, saveModule, deleteModule, deleteLesson } from '../services/courseService';
import { UserRole, CourseLevel, Module } from '../types';
import { useAppStore } from '../store/useAppStore';
import { supabase } from '../lib/supabase';

interface Notification {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
}

const CourseManagement: React.FC = () => {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'talks' | 'snehi'>('talks');
    const [modules, setModules] = useState<Module[]>([]);
    const [editingModule, setEditingModule] = useState<any | null>(null);
    const [scenarios, setScenarios] = useState<any[]>([]);
    const [editingScenario, setEditingScenario] = useState<any | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [filterLevel, setFilterLevel] = useState<string>('ALL');
    const [filterCategory, setFilterCategory] = useState<string>('ALL');

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
            if (activeTab === 'talks') {
                const moduleData = await fetchAllModules();
                setModules(moduleData);
            } else {
                const { data, error } = await supabase.from('snehi_scenarios').select('*').order('order_index');
                if (error) throw error;
                setScenarios(data || []);
            }
        } catch (err: any) {
            showNotification(err.message || "Could not connect to the database.", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [activeTab]);

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

    const handleDeleteScenario = async (id: string) => {
        if (!window.confirm("Delete this scenario?")) return;
        try {
            const { error } = await supabase.from('snehi_scenarios').delete().eq('id', id);
            if (error) throw error;
            showNotification("Scenario deleted successfully", "success");
            fetchData();
            const { fetchScenarios } = useAppStore.getState();
            await fetchScenarios();
        } catch (err: any) {
            showNotification(`Failed to delete scenario: ${err.message}`, "error");
        }
    };

    const handleSaveScenario = async (e: React.FormEvent) => {
        e.preventDefault();
        setProcessingId('saving-scenario');
        try {
            const payload = {
                title: editingScenario.title,
                category: editingScenario.category,
                level: editingScenario.level,
                system_instruction: editingScenario.system_instruction,
                initial_message: editingScenario.initial_message,
                order_index: editingScenario.order_index
            };

            let res;
            if (editingScenario.id) {
                res = await supabase.from('snehi_scenarios').update(payload).eq('id', editingScenario.id);
            } else {
                res = await supabase.from('snehi_scenarios').insert(payload);
            }

            if (res.error) throw res.error;

            setEditingScenario(null);
            await fetchData();
            const { fetchScenarios } = useAppStore.getState();
            await fetchScenarios();
            showNotification("Scenario saved successfully!", "success");
        } catch (err: any) {
            showNotification(err.message, "error");
        }
        setProcessingId(null);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                
                // Map fields to ensure compatibility with both JS types and DB columns
                const prefilledScenario = {
                    title: json.title || { en: '', kn: '' },
                    category: json.category || { en: '', kn: '' },
                    level: json.level || CourseLevel.BASIC,
                    system_instruction: json.system_instruction || json.systemInstruction || '',
                    initial_message: json.initial_message || json.initialMessage || '',
                    order_index: json.order_index ?? json.orderIndex ?? scenarios.length
                };

                setEditingScenario(prefilledScenario);
                showNotification("File uploaded and data pre-filled!", "success");
            } catch (err) {
                showNotification("Invalid JSON file format", "error");
            }
        };
        reader.readAsText(file);
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

            <div className="flex gap-4 mb-8 border-b dark:border-slate-800">
                <button
                    onClick={() => setActiveTab('talks')}
                    className={`pb-4 px-2 font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'talks' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}
                >
                    SIMPLISH-TALKS
                </button>
                <button
                    onClick={() => setActiveTab('snehi')}
                    className={`pb-4 px-2 font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'snehi' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}
                >
                    SIMPLISH-SNEHI
                </button>
            </div>

            <div className="space-y-8 animate-in fade-in">
                <div className="flex justify-between items-center">
                    <h3 className="text-2xl font-black text-blue-900 dark:text-blue-300">
                        {activeTab === 'talks' ? t({ en: 'Curriculum Editor', kn: 'ಪಠ್ಯಕ್ರಮ ಸಂಪಾದಕ' }) : t({ en: 'SNEHI Scenarios', kn: 'ಸ್ನೇಹಿ ಸನ್ನಿವೇಶಗಳು' })}
                    </h3>
                    <div className="flex flex-wrap gap-4 items-center">
                        {activeTab === 'snehi' && (
                            <>
                                <select 
                                    value={filterLevel}
                                    onChange={(e) => setFilterLevel(e.target.value)}
                                    className="px-4 py-2 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:border-blue-500"
                                >
                                    <option value="ALL">All Levels</option>
                                    {Object.values(CourseLevel).map(l => <option key={l} value={l}>{l}</option>)}
                                </select>
                                <select 
                                    value={filterCategory}
                                    onChange={(e) => setFilterCategory(e.target.value)}
                                    className="px-4 py-2 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:border-blue-500"
                                >
                                    <option value="ALL">All Categories</option>
                                    {Array.from(new Set(scenarios.map(s => s.category.en))).map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                                <label className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-6 py-2 rounded-xl text-[10px] font-black uppercase shadow-sm hover:bg-slate-200 cursor-pointer flex items-center transition-all">
                                    📁 {t({ en: 'Upload JSON', kn: 'JSON ಅಪ್‌ಲೋಡ್' })}
                                    <input type="file" accept=".json" className="hidden" onChange={handleFileUpload} />
                                </label>
                            </>
                        )}
                        <button
                            onClick={() => activeTab === 'talks' 
                                ? setEditingModule({ level: CourseLevel.BASIC, titleStr: '', descStr: '', order_index: modules.length })
                                : setEditingScenario({ 
                                    level: CourseLevel.BASIC, 
                                    title: { en: '', kn: '' }, 
                                    category: { en: '', kn: '' }, 
                                    system_instruction: '', 
                                    initial_message: '', 
                                    order_index: scenarios.length 
                                })
                            }
                            className="bg-blue-800 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg hover:scale-105 transition-transform"
                        >
                            {activeTab === 'talks' ? t({ en: '+ Add Module', kn: '+ ಮಾಡ್ಯೂಲ್ ಸೇರಿಸಿ' }) : t({ en: '+ Add Scenario', kn: '+ ಸನ್ನಿವೇಶ ಸೇರಿಸಿ' })}
                        </button>
                    </div>
                </div>

                {activeTab === 'talks' ? (
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
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {scenarios
                          .filter(s => (filterLevel === 'ALL' || s.level === filterLevel) && (filterCategory === 'ALL' || s.category.en === filterCategory))
                          .map((s, idx) => (
                            <div key={s.id || idx} className="bg-white dark:bg-slate-800 rounded-3xl border-2 border-slate-100 dark:border-slate-700 p-6 flex justify-between items-start shadow-sm hover:shadow-md transition-shadow animate-in zoom-in duration-300">
                                <div>
                                    <span className="text-[8px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-lg">{s.level}</span>
                                    <h4 className="font-black text-lg text-slate-800 dark:text-white mt-2">{s.title.en}</h4>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">{s.category.en}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setEditingScenario(s)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">✏️</button>
                                    <button onClick={() => handleDeleteScenario(s.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">🗑️</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

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

                {/* Scenario Modal */}
                {editingScenario && (
                    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                        <form onSubmit={handleSaveScenario} className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-6 shadow-2xl">
                            <h3 className="text-2xl font-black text-blue-900 dark:text-blue-300 uppercase tracking-tight">
                                {editingScenario.id ? 'Edit Scenario' : 'Add Scenario'}
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-2">Title (English)</label>
                                        <input required className="w-full p-4 border-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 outline-none focus:border-blue-500 transition-all font-bold" value={editingScenario.title.en} onChange={e => setEditingScenario({ ...editingScenario, title: { ...editingScenario.title, en: e.target.value } })} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-2">Title (Kannada)</label>
                                        <input required className="w-full p-4 border-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 outline-none focus:border-blue-500 transition-all font-bold" value={editingScenario.title.kn} onChange={e => setEditingScenario({ ...editingScenario, title: { ...editingScenario.title, kn: e.target.value } })} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-2">Category (English)</label>
                                        <input required className="w-full p-4 border-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 outline-none focus:border-blue-500 transition-all font-bold" value={editingScenario.category.en} onChange={e => setEditingScenario({ ...editingScenario, category: { ...editingScenario.category, en: e.target.value } })} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-2">Category (Kannada)</label>
                                        <input required className="w-full p-4 border-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 outline-none focus:border-blue-500 transition-all font-bold" value={editingScenario.category.kn} onChange={e => setEditingScenario({ ...editingScenario, category: { ...editingScenario.category, kn: e.target.value } })} />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-2">Difficulty Level</label>
                                        <select className="w-full p-4 border-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 outline-none focus:border-blue-500 transition-all font-bold" value={editingScenario.level} onChange={e => setEditingScenario({ ...editingScenario, level: e.target.value as CourseLevel })}>
                                            {Object.values(CourseLevel).map(l => <option key={l} value={l}>{l}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-2">Order Index</label>
                                        <input type="number" className="w-full p-4 border-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 outline-none focus:border-blue-500 transition-all font-bold" value={editingScenario.order_index} onChange={e => setEditingScenario({ ...editingScenario, order_index: parseInt(e.target.value) })} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-2">Initial Message</label>
                                        <input required className="w-full p-4 border-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 outline-none focus:border-blue-500 transition-all font-bold" value={editingScenario.initial_message} onChange={e => setEditingScenario({ ...editingScenario, initial_message: e.target.value })} />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-2">System Instruction (AI Prompt)</label>
                                <textarea required className="w-full p-4 border-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 h-32 outline-none focus:border-blue-500 transition-all font-bold" value={editingScenario.system_instruction} onChange={e => setEditingScenario({ ...editingScenario, system_instruction: e.target.value })} />
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button type="button" onClick={() => setEditingScenario(null)} className="flex-1 p-4 bg-slate-100 dark:bg-slate-700 rounded-2xl font-black text-xs uppercase tracking-widest transition-all hover:bg-slate-200 dark:hover:bg-slate-600">
                                    {t({ en: 'Cancel', kn: 'ರದ್ದುಗೊಳಿಸಿ' })}
                                </button>
                                <button type="submit" disabled={!!processingId} className="flex-1 p-4 bg-blue-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50">
                                    {processingId ? 'Saving...' : 'Save Scenario'}
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
