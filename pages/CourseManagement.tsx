/** V 1.0 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../components/LanguageContext';
import { fetchAllModules, saveModule, deleteModule, saveLesson, deleteLesson, uploadLessonMedia, splitBilingual } from '../services/courseService';
import { UserRole, CourseLevel, Module, Lesson } from '../types';
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
    const [editingLesson, setEditingLesson] = useState<any | null>(null);
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

    const handleSaveLesson = async (e: React.FormEvent) => {
        e.preventDefault();
        setProcessingId('saving-lesson');
        try {
            const res = await saveLesson(editingLesson) as any;
            if (!res.error) {
                setEditingLesson(null);
                await fetchData();
                const { refreshModules } = useAppStore.getState();
                await refreshModules();
                showNotification("Lesson saved successfully!", "success");
            } else {
                showNotification(`Failed to save: ${res.error.message || 'Unknown database error'}`, 'error');
            }
        } catch (err: any) {
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
                    <h2 className="text-4xl font-black text-blue-900 dark:text-slate-100 tracking-tighter uppercase">Curriculum Management</h2>
                    <p className="text-[10px] text-slate-400 font-mono mt-2 tracking-widest">ADD MODULES & LESSONS</p>
                </div>
                <button
                    onClick={() => navigate('/admin')}
                    className="px-6 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all dark:text-slate-300"
                >
                    Back to Admin
                </button>
            </div>

            <div className="space-y-8 animate-in fade-in">
                <div className="flex justify-between items-center">
                    <h3 className="text-2xl font-black text-blue-900 dark:text-blue-300">Curriculum Editor</h3>
                    <button
                        onClick={() => setEditingModule({ level: CourseLevel.BASIC, titleStr: '', descStr: '', order_index: modules.length })}
                        className="bg-blue-800 text-white px-6 py-2 rounded-xl text-xs font-black uppercase shadow-lg hover:scale-105 transition-transform"
                    >
                        + Add Module
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
                                        <div key={lesson.id || lIdx} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900 rounded-xl transition-all hover:shadow-md">
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
                            <h3 className="text-2xl font-black text-blue-900 dark:text-blue-300 uppercase tracking-tight">{editingModule.id ? 'Edit Module' : 'Add Module'}</h3>

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
                                <button type="button" onClick={() => setEditingModule(null)} className="flex-1 p-4 bg-slate-100 dark:bg-slate-700 rounded-2xl font-black text-xs uppercase tracking-widest transition-all hover:bg-slate-200 dark:hover:bg-slate-600">Cancel</button>
                                <button type="submit" className="flex-1 p-4 bg-blue-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:scale-[1.02] transition-all">Save Module</button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Lesson Modal */}
                {editingLesson && (
                    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                        <form onSubmit={handleSaveLesson} className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] w-full max-w-4xl space-y-6 my-8 overflow-y-auto max-h-[90vh] custom-scrollbar shadow-2xl relative">
                            <button
                                type="button"
                                onClick={() => setEditingLesson(null)}
                                className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-slate-700 rounded-full text-xl hover:bg-slate-200 transition-all"
                            >✕</button>

                            <h3 className="text-2xl font-black text-blue-900 dark:text-blue-300 uppercase tracking-tight">{editingLesson.id ? 'Edit Lesson' : 'Add Lesson'}</h3>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Text Details */}
                                <div className="space-y-6">
                                    <h5 className="font-black text-xs text-blue-800 uppercase tracking-[0.2em] border-l-4 border-blue-600 pl-3">Bilingual Information</h5>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block ml-2 tracking-widest">Title (English | Kannada)</label>
                                            <input placeholder="Lesson Title | ಪಾಠದ ಶೀರ್ಷಿಕೆ" required className="w-full p-4 border-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 outline-none focus:border-blue-500 transition-all font-bold" value={editingLesson.titleStr} onChange={e => setEditingLesson({ ...editingLesson, titleStr: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block ml-2 tracking-widest">Summary Notes (English | Kannada)</label>
                                            <textarea placeholder="Brief notes | ಸಣ್ಣ ಮಾಹಿತಿ" required className="w-full p-4 border-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 h-24 outline-none focus:border-blue-500 transition-all font-bold" value={editingLesson.notesStr} onChange={e => setEditingLesson({ ...editingLesson, notesStr: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block ml-2 tracking-widest">Long Reading Text (Optional)</label>
                                            <textarea placeholder="Paste full article or text lesson here..." className="w-full p-4 border-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 h-40 outline-none focus:border-blue-500 transition-all font-medium text-sm" value={editingLesson.text_content || ''} onChange={e => setEditingLesson({ ...editingLesson, text_content: e.target.value })} />
                                        </div>
                                    </div>
                                </div>

                                {/* Multimedia URLs */}
                                <div className="space-y-6">
                                    {/* === SECTION 1: WATCH/LISTEN === */}
                                    <h5 className="font-black text-xs text-blue-600 uppercase tracking-[0.2em] border-l-4 border-blue-400 pl-3">📺 Media : Video & Audio</h5>
                                    <div className="space-y-4 bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-3xl">
                                        <div>
                                            <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block ml-2">Video URL</label>
                                            <div className="flex gap-2">
                                                <input placeholder="https://..." className="flex-1 p-4 border rounded-2xl bg-white dark:bg-slate-900 text-xs" value={editingLesson.video_url || ''} onChange={e => setEditingLesson({ ...editingLesson, video_url: e.target.value })} />
                                                <label className="cursor-pointer bg-blue-600 text-white p-4 rounded-2xl hover:bg-blue-700 transition-colors shadow-md">
                                                    <input type="file" className="hidden" accept="video/*" onChange={e => handleFileUpload(e, 'video')} />
                                                    {processingId === 'uploading-video' ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : '📁'}
                                                </label>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block ml-2">Audio URL</label>
                                            <div className="flex gap-2">
                                                <input placeholder="https://..." className="flex-1 p-4 border rounded-2xl bg-white dark:bg-slate-900 text-xs" value={editingLesson.audio_url || ''} onChange={e => setEditingLesson({ ...editingLesson, audio_url: e.target.value })} />
                                                <label className="cursor-pointer bg-orange-500 text-white p-4 rounded-2xl hover:bg-orange-600 transition-colors shadow-md">
                                                    <input type="file" className="hidden" accept="audio/*" onChange={e => handleFileUpload(e, 'audio')} />
                                                    {processingId === 'uploading-audio' ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : '📁'}
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    {/* === SECTION 2: STUDY & SPEAK === */}
                                    <h5 className="font-black text-xs text-green-600 uppercase tracking-[0.2em] border-l-4 border-green-500 pl-3">📖 Learn : PDF & Reading</h5>
                                    <div className="space-y-4 bg-green-50/50 dark:bg-green-900/10 p-4 rounded-3xl">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block ml-2">Study PDF</label>
                                                <label className="flex items-center justify-center p-4 bg-white dark:bg-slate-900 border dashed-2 border-slate-300 rounded-2xl cursor-pointer hover:bg-green-50 transition-all">
                                                    <input type="file" className="hidden" accept=".pdf" onChange={e => handleFileUpload(e, 'pdf')} />
                                                    <span className="text-[10px] font-bold text-slate-500">{editingLesson.pdf_url ? '✅ Uploaded' : 'Upload PDF'}</span>
                                                </label>
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block ml-2">Speak PDF</label>
                                                <label className="flex items-center justify-center p-4 bg-white dark:bg-slate-900 border dashed-2 border-slate-300 rounded-2xl cursor-pointer hover:bg-purple-50 transition-all">
                                                    <input type="file" className="hidden" accept=".pdf" onChange={e => handleFileUpload(e, 'speak_pdf')} />
                                                    <span className="text-[10px] font-bold text-slate-500">{editingLesson.speak_pdf_url ? '✅ Uploaded' : 'Upload PDF'}</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-slate-100 dark:border-slate-700 pt-6 space-y-4">
                                <h5 className="font-black text-xs uppercase text-blue-900 dark:text-blue-300 flex items-center gap-2">
                                    <span>🤖</span> AI Conversation Scenario (Optional)
                                </h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <input placeholder="Character (Eng | Kan) - e.g. Interviewer | ಸಂದರ್ಶಕ" className="p-4 border-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border-slate-100 outline-none focus:border-blue-500 text-sm font-bold" value={editingLesson.scenario?.characterStr || ''} onChange={e => {
                                        const split = splitBilingual(e.target.value);
                                        setEditingLesson({ ...editingLesson, scenario: { ...(editingLesson.scenario || {}), characterStr: e.target.value, character: split } });
                                    }} />
                                    <input placeholder="Objective (Eng | Kan) - e.g. Introduction | ಪರಿಚಯ" className="p-4 border-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border-slate-100 outline-none focus:border-blue-500 text-sm font-bold" value={editingLesson.scenario?.objectiveStr || ''} onChange={e => {
                                        const split = splitBilingual(e.target.value);
                                        setEditingLesson({ ...editingLesson, scenario: { ...(editingLesson.scenario || {}), objectiveStr: e.target.value, objective: split } });
                                    }} />
                                </div>
                                <textarea placeholder="AI System Instruction - How should the AI behave?" className="p-4 border-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border-slate-100 outline-none focus:border-blue-500 text-sm w-full h-24" value={editingLesson.scenario?.systemInstruction || ''} onChange={e => setEditingLesson({ ...editingLesson, scenario: { ...(editingLesson.scenario || {}), systemInstruction: e.target.value } })} />
                                <input placeholder="AI Starting Message - The first greeting from AI" className="p-4 border-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border-slate-100 outline-none focus:border-blue-500 text-sm w-full font-bold" value={editingLesson.scenario?.initialMessage || ''} onChange={e => setEditingLesson({ ...editingLesson, scenario: { ...(editingLesson.scenario || {}), initialMessage: e.target.value } })} />
                            </div>

                            <div className="flex gap-4 pt-6">
                                <button type="button" onClick={() => setEditingLesson(null)} disabled={processingId === 'saving-lesson'} className="flex-1 p-5 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white rounded-[2rem] font-black uppercase text-xs tracking-widest transition-all hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50">Cancel</button>
                                <button type="submit" disabled={processingId === 'saving-lesson'} className="flex-1 p-5 bg-orange-600 text-white rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-orange-700 transition-all hover:scale-[1.02]">
                                    {processingId === 'saving-lesson' ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Saving...
                                        </>
                                    ) : 'Save Curriculum Lesson ✨'}
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
