/** V 1.0 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '../components/LanguageContext';
import { fetchAllModules, saveLesson, uploadLessonMedia, splitBilingual } from '../services/courseService';
import { CourseLevel, Module } from '../types';
import { useAppStore } from '../store/useAppStore';

interface Notification {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
}

const LessonEditor: React.FC = () => {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const { moduleId, lessonId } = useParams<{ moduleId: string; lessonId: string }>();

    const [loading, setLoading] = useState(true);
    const [editingLesson, setEditingLesson] = useState<any>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [processingId, setProcessingId] = useState<string | null>(null);

    // AI Generation State
    const [aiPrompt, setAiPrompt] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState<boolean>(false);

    const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        const id = Math.random().toString(36).substr(2, 9);
        setNotifications(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 5000);
    };

    const fetchLesson = async () => {
        setLoading(true);
        try {
            const modules = await fetchAllModules();
            const module = modules.find(m => m.id === moduleId);

            if (!module) {
                showNotification("Module not found", "error");
                navigate('/admin/course');
                return;
            }

            if (lessonId) {
                const lesson = module.lessons.find(l => l.id === lessonId);
                if (lesson) {
                    setEditingLesson({
                        id: lesson.id,
                        module_id: moduleId,
                        titleStr: `${lesson.title.en} | ${lesson.title.kn}`,
                        notesStr: `${lesson.notes.en} | ${lesson.notes.kn}`,
                        video_url: lesson.videoUrl,
                        audio_url: lesson.audioUrl,
                        pdf_url: lesson.pdfUrl,
                        text_url: lesson.textUrl,
                        text_content: lesson.textContent,
                        study_text_content: lesson.studyTextContent,
                        speak_pdf_url: lesson.speakPdfUrl,
                        speak_text_url: lesson.speakTextUrl,
                        speak_text_content: lesson.speakTextContent,
                        scenario: lesson.scenario,
                        order_index: lesson.order_index
                    });
                } else {
                    showNotification("Lesson not found", "error");
                    navigate('/admin/course');
                }
            } else {
                // Add Mode
                setEditingLesson({
                    module_id: moduleId,
                    titleStr: '',
                    notesStr: '',
                    order_index: module.lessons.length
                });
            }
        } catch (err: any) {
            showNotification(err.message || "Could not fetch lesson data.", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLesson();
    }, [moduleId, lessonId]);

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

    const parseLessonJson = (json: any, currentLesson: any) => {
        // If it's the new nested schema
        if (json.content && json.module_metadata) {
            const metadata = json.module_metadata;
            const content = json.content;

            // Parse Script
            const scriptText = content.step_1_watch_listen?.script
                ?.map((s: any) => `${s.speaker}: ${s.english} | ${s.kannada}`)
                .join('\n') || '';

            // Parse Study Content
            const study = content.step_2_study;
            let studyText = '';
            if (study) {
                studyText = `🌟 BRIDGE:\n${study.kannada_bridge || ''}\n\n`;
                studyText += `📚 KEY PHRASES:\n`;
                study.key_phrases?.forEach((p: any) => {
                    studyText += `- ${p.phrase}: ${p.usage}\n  Example: "${p.example}"\n`;
                });
                studyText += `\n🗣️ PRONUNCIATION:\n`;
                study.pronunciation_corner?.forEach((p: any) => {
                    studyText += `- ${p.word} (${p.phonetic_kannada}): ${p.tip}\n`;
                });
            }

            // Parse Scenario
            const agent = content.step_4_practice_ai_agent;
            const scenarioObjective = agent?.mission_objective || '';
            const scenario = {
                character: splitBilingual(agent?.name || 'AI Coach'),
                objectiveStr: scenarioObjective,
                objective: splitBilingual(scenarioObjective),
                systemInstruction: `Mission: ${scenarioObjective}\n\nAnticipated Mistakes:\n${agent?.anticipated_mistakes?.map((m: any) => `- ${m.error} -> ${m.correction}`).join('\n') || ''}\n\nPronunciation Focus: ${agent?.pronunciation_trigger?.target_word || ''} (${agent?.pronunciation_trigger?.feedback_tip || ''})`,
                initialMessage: agent?.initial_greeting || "Hello! Let's practice our English."
            };

            const cleanTopic = (topic: string) => {
                if (topic.includes('(') && topic.includes(')')) {
                    return topic.replace('(', '|').replace(')', '').trim();
                }
                return topic;
            };

            return {
                ...currentLesson,
                titleStr: cleanTopic(metadata.topic || ''),
                notesStr: metadata.primary_goal || currentLesson.notesStr,
                text_content: scriptText || currentLesson.text_content,
                study_text_content: studyText || currentLesson.study_text_content,
                speak_text_content: content.step_3_speak?.transcription_to_read || currentLesson.speak_text_content,
                scenario
            };
        }

        // Fallback to legacy/flat schema
        return {
            ...currentLesson,
            titleStr: json.titleStr || json.title || currentLesson.titleStr,
            notesStr: json.notesStr || json.notes || currentLesson.notesStr,
            text_content: json.textContent || json.watch_text || json.text_content || currentLesson.text_content,
            study_text_content: json.studyTextContent || json.study_text || json.study_text_content || currentLesson.study_text_content,
            speak_text_content: json.speakTextContent || json.speak_text || json.speak_text_content || currentLesson.speak_text_content,
            scenario: {
                ...(currentLesson.scenario || {}),
                ...(json.scenario || {})
            }
        };
    };

    const handleSaveLesson = async (e: React.FormEvent) => {
        e.preventDefault();
        setProcessingId('saving-lesson');
        try {
            const res = await saveLesson(editingLesson) as any;
            if (!res.error) {
                const { refreshModules } = useAppStore.getState();
                await refreshModules();
                showNotification("Lesson saved successfully!", "success");
                setTimeout(() => navigate('/admin/course'), 1500);
            } else {
                showNotification(`Failed to save: ${res.error.message || 'Unknown database error'}`, 'error');
            }
        } catch (err: any) {
            showNotification(`An unexpected error occurred: ${err.message || 'Check your internet connection'}`, 'error');
        } finally {
            setProcessingId(null);
        }
    };

    const handleGenerateAI = async () => {
        if (!aiPrompt.trim()) {
            showNotification("Please provide AI Instructions or paste the desired JSON content.", "info");
            return;
        }

        setIsGenerating(true);
        try {
            const { generateLessonWithAI } = await import('../services/geminiService');
            const generatedData = await generateLessonWithAI(aiPrompt);

            if (generatedData) {
                const updated = parseLessonJson(generatedData, editingLesson);
                setEditingLesson(updated);
                showNotification("Lesson generated successfully! Values pre-filled.", "success");
            } else {
                showNotification("AI returned empty data. Please refine your prompt and try again.", "error");
            }
        } catch (err: any) {
            console.error("AI Generation Handler Error:", err);
            showNotification(err.message || "An unexpected error occurred during AI generation.", "error");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const jsonContent = JSON.parse(event.target?.result as string);
                const updated = parseLessonJson(jsonContent, editingLesson);
                setEditingLesson(updated);
                showNotification("JSON uploaded successfully! Form pre-filled.", "success");
            } catch (err) {
                showNotification("Invalid JSON file uploaded.", "error");
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
        <div className="p-6 md:p-10 bg-white dark:bg-slate-900 min-h-screen transition-all duration-300 relative pb-20">
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
                    <h2 className="text-4xl font-black text-blue-900 dark:text-slate-100 tracking-tighter uppercase">{lessonId ? 'Edit Lesson' : 'Add Lesson'}</h2>
                    <p className="text-[10px] text-slate-400 font-mono mt-2 tracking-widest uppercase">Lesson Configuration ✨</p>
                </div>
                <button
                    onClick={() => navigate('/admin/course')}
                    className="px-6 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all dark:text-slate-300"
                >
                    Back to Curriculum
                </button>
            </div>

            <form onSubmit={handleSaveLesson} className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-500">

                {/* AI & JSON Utility Card */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-slate-900 dark:to-slate-800 p-8 rounded-[2.5rem] border border-blue-100 dark:border-slate-700 shadow-xl">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
                        <div>
                            <h5 className="font-black text-lg text-indigo-900 dark:text-indigo-400 flex items-center gap-2">
                                <span>✨</span> AI Instructions & Auto-Fill
                            </h5>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">Generate lesson content instantly using Gemini 2.0</p>
                        </div>
                        <label className="cursor-pointer bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:shadow-xl transition-all active:scale-95">
                            Upload JSON File
                            <input type="file" accept=".json" className="hidden" onChange={handleJsonUpload} />
                        </label>
                    </div>
                    <div className="space-y-4">
                        <textarea
                            placeholder="Paste your AI instructions, scenario requirements, or JSON content here..."
                            className="w-full p-6 border-2 rounded-[2rem] bg-white dark:bg-slate-950 border-indigo-100 dark:border-slate-700 h-32 outline-none focus:border-indigo-400 transition-all font-mono text-sm dark:text-slate-300 shadow-inner"
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                        />
                        <button
                            type="button"
                            disabled={isGenerating}
                            onClick={handleGenerateAI}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 transition-all shadow-xl shadow-indigo-500/20 active:scale-[0.98] disabled:opacity-50"
                        >
                            {isGenerating ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Processing with Gemini AI...
                                </>
                            ) : 'Generate & Parse Lesson 🚀'}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column: Text Content */}
                    <div className="space-y-8">
                        <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border-2 border-slate-50 dark:border-slate-700 shadow-sm space-y-6">
                            <h5 className="font-black text-xs text-blue-800 dark:text-blue-400 uppercase tracking-[0.2em] border-l-4 border-blue-600 pl-3">Basic Information</h5>
                            <div className="space-y-5">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block ml-2 tracking-widest">Title (English | Kannada)</label>
                                    <input placeholder="Greetings | ಶುಭಾಶಯಗಳು" required className="w-full p-5 border-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 outline-none focus:border-blue-500 transition-all font-bold" value={editingLesson.titleStr} onChange={e => setEditingLesson({ ...editingLesson, titleStr: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block ml-2 tracking-widest">Summary Notes (English | Kannada)</label>
                                    <textarea placeholder="Learn to say hello... | ಹಲೋ ಹೇಳಲು ಕಲಿಯಿರಿ..." required className="w-full p-5 border-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 h-28 outline-none focus:border-blue-500 transition-all font-bold" value={editingLesson.notesStr} onChange={e => setEditingLesson({ ...editingLesson, notesStr: e.target.value })} />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border-2 border-slate-50 dark:border-slate-700 shadow-sm space-y-6">
                            <h5 className="font-black text-xs text-blue-800 dark:text-blue-400 uppercase tracking-[0.2em] border-l-4 border-blue-600 pl-3">Advanced Text Content</h5>
                            <div className="space-y-5">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block ml-2 tracking-widest">Watch Tab: script / Full Text</label>
                                    <textarea placeholder="Full script for the video or audio..." className="w-full p-5 border-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 h-40 outline-none focus:border-blue-500 transition-all font-medium text-sm" value={editingLesson.text_content || ''} onChange={e => setEditingLesson({ ...editingLesson, text_content: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block ml-2 tracking-widest">Study Tab: Content</label>
                                    <textarea placeholder="Key takeaways and grammar notes..." className="w-full p-5 border-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 h-40 outline-none focus:border-blue-500 transition-all font-medium text-sm" value={editingLesson.study_text_content || ''} onChange={e => setEditingLesson({ ...editingLesson, study_text_content: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block ml-2 tracking-widest">Speak Tab: Reading Text</label>
                                    <textarea placeholder="Text for pronunciation practice..." className="w-full p-5 border-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 h-40 outline-none focus:border-blue-500 transition-all font-medium text-sm" value={editingLesson.speak_text_content || ''} onChange={e => setEditingLesson({ ...editingLesson, speak_text_content: e.target.value })} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Media, Scenarios & Save */}
                    <div className="space-y-8">
                        <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border-2 border-slate-50 dark:border-slate-700 shadow-sm space-y-8">
                            <div>
                                <h5 className="font-black text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em] border-l-4 border-indigo-400 pl-3 mb-6">📺 Media : Video & Audio</h5>
                                <div className="space-y-4">
                                    <div className="bg-slate-50 dark:bg-slate-900 p-5 rounded-[2rem] border-2 border-slate-100 dark:border-slate-800">
                                        <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block ml-2">Video Resource</label>
                                        <div className="flex gap-3">
                                            <input placeholder="YouTube or direct URL..." className="flex-1 p-4 border rounded-xl bg-white dark:bg-slate-800 text-xs font-bold" value={editingLesson.video_url || ''} onChange={e => setEditingLesson({ ...editingLesson, video_url: e.target.value })} />
                                            <label className="cursor-pointer bg-blue-600 text-white p-4 rounded-xl hover:bg-blue-700 transition-all shadow hover:shadow-lg active:scale-95">
                                                <input type="file" className="hidden" accept="video/*" onChange={e => handleFileUpload(e, 'video')} />
                                                {processingId === 'uploading-video' ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : '📁'}
                                            </label>
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-900 p-5 rounded-[2rem] border-2 border-slate-100 dark:border-slate-800">
                                        <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block ml-2">Audio Resource</label>
                                        <div className="flex gap-3">
                                            <input placeholder="Audio file URL..." className="flex-1 p-4 border rounded-xl bg-white dark:bg-slate-800 text-xs font-bold" value={editingLesson.audio_url || ''} onChange={e => setEditingLesson({ ...editingLesson, audio_url: e.target.value })} />
                                            <label className="cursor-pointer bg-orange-500 text-white p-4 rounded-xl hover:bg-orange-600 transition-all shadow hover:shadow-lg active:scale-95">
                                                <input type="file" className="hidden" accept="audio/*" onChange={e => handleFileUpload(e, 'audio')} />
                                                {processingId === 'uploading-audio' ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : '📁'}
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h5 className="font-black text-xs text-green-600 dark:text-green-400 uppercase tracking-[0.2em] border-l-4 border-green-500 pl-3 mb-6">📖 Reference Files (PDF)</h5>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-50 dark:bg-slate-900 p-5 rounded-[2rem] border-2 border-slate-100 dark:border-slate-800">
                                        <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block ml-2 text-center">Study PDF</label>
                                        <label className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl cursor-pointer hover:bg-green-50 dark:hover:bg-green-900/10 transition-all">
                                            <input type="file" className="hidden" accept=".pdf" onChange={e => handleFileUpload(e, 'pdf')} />
                                            <span className="text-2xl mb-2">{editingLesson.pdf_url ? '✅' : '📄'}</span>
                                            <span className="text-[9px] font-black uppercase text-slate-500">{editingLesson.pdf_url ? 'Replace PDF' : 'Upload PDF'}</span>
                                        </label>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-900 p-5 rounded-[2rem] border-2 border-slate-100 dark:border-slate-800">
                                        <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block ml-2 text-center">Speak PDF</label>
                                        <label className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-all">
                                            <input type="file" className="hidden" accept=".pdf" onChange={e => handleFileUpload(e, 'speak_pdf')} />
                                            <span className="text-2xl mb-2">{editingLesson.speak_pdf_url ? '✅' : '📄'}</span>
                                            <span className="text-[9px] font-black uppercase text-slate-500">{editingLesson.speak_pdf_url ? 'Replace PDF' : 'Upload PDF'}</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border-2 border-slate-50 dark:border-slate-700 shadow-sm space-y-6">
                            <h5 className="font-black text-xs uppercase text-blue-900 dark:text-blue-300 tracking-[0.2em] border-l-4 border-blue-600 pl-3">🤖 AI Interaction Scenario</h5>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block ml-2">Character (Eng | Kan)</label>
                                        <input placeholder="Interviewer | ಸಂದರ್ಶಕ" className="w-full p-4 border-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 outline-none focus:border-blue-500 text-sm font-bold" value={editingLesson.scenario?.characterStr || ''} onChange={e => {
                                            const split = splitBilingual(e.target.value);
                                            setEditingLesson({ ...editingLesson, scenario: { ...(editingLesson.scenario || {}), characterStr: e.target.value, character: split } });
                                        }} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block ml-2">Topic (Eng | Kan)</label>
                                        <input placeholder="Coffee Shop | ಕಾಫಿ ಶಾಪ್" className="w-full p-4 border-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 outline-none focus:border-blue-500 text-sm font-bold" value={editingLesson.scenario?.objectiveStr || ''} onChange={e => {
                                            const split = splitBilingual(e.target.value);
                                            setEditingLesson({ ...editingLesson, scenario: { ...(editingLesson.scenario || {}), objectiveStr: e.target.value, objective: split } });
                                        }} />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block ml-2">System Instructions</label>
                                    <textarea placeholder="Act as a barista..." className="w-full p-4 border-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 h-24 outline-none focus:border-blue-500 text-sm font-medium" value={editingLesson.scenario?.systemInstruction || ''} onChange={e => setEditingLesson({ ...editingLesson, scenario: { ...(editingLesson.scenario || {}), systemInstruction: e.target.value } })} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block ml-2">Initial Greeting</label>
                                    <input placeholder="Welcome to our shop!..." className="w-full p-4 border-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 outline-none focus:border-blue-500 text-sm font-bold" value={editingLesson.scenario?.initialMessage || ''} onChange={e => setEditingLesson({ ...editingLesson, scenario: { ...(editingLesson.scenario || {}), initialMessage: e.target.value } })} />
                                </div>
                            </div>
                        </div>

                        {/* Sticky Save Bar */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border-2 border-orange-200 dark:border-slate-700 shadow-xl flex gap-4">
                            <button
                                type="button"
                                onClick={() => navigate('/admin/course')}
                                className="flex-1 py-4 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white rounded-2xl font-black uppercase text-xs tracking-widest transition-all hover:bg-slate-200"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={processingId === 'saving-lesson'}
                                className="flex-[2] py-4 bg-orange-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-orange-500/20 flex items-center justify-center gap-3 hover:bg-orange-700 active:scale-95 transition-all disabled:opacity-50"
                            >
                                {processingId === 'saving-lesson' ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Saving Changes...
                                    </>
                                ) : (
                                    <>Save Lesson Configuration ✨</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default LessonEditor;
