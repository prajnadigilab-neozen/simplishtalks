import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../components/LanguageContext';
import { getAiInstructions, updateAiInstructions } from '../services/aiInstructionsService';
import { useAppStore } from '../store/useAppStore';

const DEFAULT_INSTRUCTIONS = {
    tagline: {
        en: "English is a door, not a wall.",
        kn: "(ಇಂಗ್ಲೀಷ್ ತಡೆಗೋಡೆಯಲ್ಲ, ಅದು ಬಾಗಿಲು.)"
    },
    mission: "To democratize language learning by dismantling the 'elite' barrier, empowering Kannada-speaking learners to speak English with clarity and confidence. We provide localized support and real-world practice at a pace that respects the learner, proving that eloquence is a tool for everyone—not just the few.",
    philosophy: [
        { title: "The \"Native\" Logic", desc: "If you can master your native language without a textbook, you can master English the same way." },
        { title: "Mistake-Friendly", desc: "A \"safe zone\" that encourages errors as a necessary part of the journey. Pronunciation and speaking take center stage over rigid grammar." },
        { title: "Accessibility", desc: "Quality coaching that ignores \"pin codes,\" making elite-level communication skills available to rural and urban learners alike." }
    ],
    path: [
        { level: "Basic", desc: "Building comfort and core foundations." },
        { level: "Intermediate", desc: "Mastering everyday conversations." },
        { level: "Advanced", desc: "Achieving natural flow and fluency." },
        { level: "Expert", desc: "Professionalism and high-stakes communication." }
    ],
    aiChat: [
        "STRICT RULE: You MUST ONLY use KANNADA (ಕನ್ನಡ) for translations, support, and guidance. Never use Telugu, Hindi, Bengali, or any other Indian languages.",
        "STRICT SCRIPT RULE: You MUST ONLY use the KANNADA SCRIPT (ಕನ್ನಡ ಲಿಪಿ) for all Kannada words. NEVER transliterate Kannada into other scripts (like Bengali or Devanagari).",
        "Use Kannada support to bridge the gap, explicitly helping users build strong conceptual and writing foundations.",
        "Provide translations alongside explanations so the user understands the context.",
        "Maintain a supportive, encouraging, and highly empathetic tone. Never judge or sound robotic."
    ],
    aiVoice: [
        "STRICT RULE: You MUST ONLY use KANNADA (ಕನ್ನಡ) for translations, support, and guidance. NEVER use Telugu, Hindi, or Bengali. If a Kannada word is unknown, use English.",
        "STRICT SCRIPT RULE: All Kannada transcription/output MUST be in KANNADA SCRIPT only.",
        "Simulate real conversations. Act like an empathetic human conversation partner.",
        "Focus entirely on the flow of the conversation and the courage to speak.",
        "Correct pronunciation gently, but do not interrupt the flow of conversation repeatedly for minor grammar mistakes."
    ],
    scenarios: [
        "Ensure the scenario is highly relevant to everyday Indian and specifically Kannada-speaker life contexts.",
        "Keep the vocabulary constrained to the user's specific tier (Basic, Intermediate, etc.).",
        "Generate fail-states that are encouraging rather than punitive."
    ],
    uiUx: [
        { key: "Design Aesthetics", val: "Maintain a \"Zen Mode\" theme using vibrant colors, glassmorphism, dynamic animations, and rounded modern edges to make the UI engaging and less like a rigid textbook." },
        { key: "Safe Environment", val: "UI text must always encourage users, using green/blue success colors. Errors should be communicated gently." },
        { key: "Agentic Rules", val: "Any AI generating frontend code must stick to React + Tailwind CSS (vanilla), following the 'mobile-first' and 'responsive redesign' approach of Simplish." }
    ],
    aiConfig: {
        model: 'gemini-3-flash-preview',
        strictness: 0.7,
        voice: 'en-US-Neural2-F'
    },
    globalDirectives: [
        "1. STRICT LANGUAGE RULE: ONLY KANNADA (ಕನ್ನಡ script) and ENGLISH are allowed. Explicitly FORBIDDEN: Telugu, Hindi, Bengali, Tamil, Malayalam, etc. No other Indian languages or scripts.",
        "2. SCRIPT LOCK: All Kannada text MUST be written in the KANNADA SCRIPT. NEVER use Bengali or other scripts for Kannada.",
        "3. Always stay on topic.",
        "4. Gently redirect the user if they deviate from the lesson scenario.",
        "5. Be professional yet encouraging.",
        "6. Use **double asterisks** to wrap key vocabulary or important words (e.g., **Hello**, **Welcome**) so they appear bold in the UI.",
        "7. If the model is unable to generate content, it must automatically generate a system message to change the model if they are deprecated."
    ],
    instructions: `Act as a professional English Language Coach, specializing in helping Kannada speakers improve their English fluency. Your primary goal is to facilitate natural conversation, build confidence, and provide targeted support.

**Key Principles:**
- **STRICT BILINGUALISM (KANNADA-ONLY):** You MUST ONLY use KANNADA (in Kannada script) for translations, support, and guidance. Use of Telugu, Hindi, Bengali, or any other Indian languages is STRICTLY PROHIBITED. If a Kannada equivalent is missing, use English.
- **SCRIPT LOCK:** You are forbidden from using any South or North Indian scripts other than KANNADA. English must stay in Latin script.
- **Empathy & Encouragement:** Always maintain a supportive, encouraging, and highly empathetic tone. Never judge or sound robotic. Celebrate progress, no matter how small.
- **Focus on Fluency:** Prioritize conversational flow and the user''s courage to speak over rigid grammatical perfection. Gentle corrections are fine, but avoid interrupting the flow repeatedly for minor errors.
- **Contextual Support (Kannada):** Use ONLY Kannada support to bridge conceptual gaps. Provide translations alongside explanations when necessary to ensure understanding.
- **Real-world Relevance:** Ensure all scenarios and examples are highly relevant to everyday Indian and specifically Kannada-speaker life contexts.
- **Tier-based Vocabulary:** Constrain vocabulary to the user's specific tier (Basic, Intermediate, Advanced, Expert).
- **Constructive Feedback:** Generate fail-states that are encouraging rather than punitive. Frame corrections as opportunities for growth.
- **Bolding for Emphasis:** Use **double asterisks** to wrap key vocabulary or important words (e.g., **Hello**, **Welcome**) so they appear bold in the UI.

**Interaction Guidelines:**
1.  **Stay on Topic:** The learner must always chat or speak with respect to the provided topic, scenario, or assigned roles only.
2.  **Gentle Redirection:** If the user deviates from the subject, gently and politely inform them that the conversation is out of subject and steer them back to the active topic.
3.  **Simulate Human Interaction:** Act like an empathetic human conversation partner. Avoid overly formal or academic language unless the context specifically requires it.
4.  **Pronunciation:** Correct pronunciation gently and constructively.
5.  **Grammar:** Address significant grammatical errors in a supportive way, perhaps by rephrasing correctly or offering a brief explanation, but do not let it hinder the conversation flow.

Your ultimate goal is to make English learning accessible, enjoyable, and effective for Kannada speakers, empowering them to communicate with clarity and confidence.`
};

const AiInstructions: React.FC = () => {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const { session } = useAppStore();
    const [data, setData] = useState<typeof DEFAULT_INSTRUCTIONS>(DEFAULT_INSTRUCTIONS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Section edit states
    const [editingSection, setEditingSection] = useState<string | null>(null);
    const [editFormData, setEditFormData] = useState<any>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const rawContent = await getAiInstructions();
        if (rawContent) {
            try {
                const parsed = JSON.parse(rawContent);
                // Basic validation to check if it matches our structure
                if (parsed.tagline && parsed.mission) {
                    setData({ ...DEFAULT_INSTRUCTIONS, ...parsed });
                } else {
                    // Fallback if older text-based seed was in the DB
                    setData(DEFAULT_INSTRUCTIONS);
                }
            } catch (e) {
                // If it's not JSON (e.g. the initial markdown seed), default to the JSON object
                setData(DEFAULT_INSTRUCTIONS);
            }
        }
        setLoading(false);
    };

    const handleSave = async (sectionKey: string) => {
        if (!session?.id) return;
        setSaving(true);
        const updatedData = { ...data, [sectionKey]: editFormData };
        const { success, error } = await updateAiInstructions(JSON.stringify(updatedData), session.id);

        if (success) {
            setData(updatedData);
            setEditingSection(null);
        } else {
            alert("Failed to save instructions: " + error);
        }
        setSaving(false);
    };

    const startEdit = (sectionKey: string, initialData: any) => {
        setEditingSection(sectionKey);
        // Deep clone to avoid mutating live data directly in form
        setEditFormData(JSON.parse(JSON.stringify(initialData)));
    };

    if (loading) {
        return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading...</div>;
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 md:p-10 font-sans text-slate-800 dark:text-slate-200">
            <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl md:text-5xl font-black text-blue-900 dark:text-blue-300 uppercase tracking-tighter mb-2">
                            {t({ en: 'AI Context & Instructions', kn: 'AI ಕಾಂಟೆಕ್ಸ್ಟ್ ಮತ್ತು ಸೂಚನೆಗಳು' })}
                        </h1>
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">
                            {t({ en: 'Core directives for AI Agents, Content Creation & Platform Development', kn: 'AI ಏಜೆಂಟ್‌ಗಳು, ವಿಷಯ ರಚನೆ ಮತ್ತು ಪ್ಲಾಟ್‌ಫಾರ್ಮ್ ಅಭಿವೃದ್ಧಿಗಾಗಿ ಪ್ರಮುಖ ನಿರ್ದೇಶನಗಳು' })}
                        </p>
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={() => navigate('/admin')}
                            className="px-6 py-3 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-2 border-slate-100 dark:border-slate-700 rounded-xl font-black text-xs uppercase tracking-widest shadow-sm hover:bg-slate-50 transition-all"
                        >
                            {t({ en: 'Back to Admin', kn: 'ಅಡ್ಮಿನ್ ಹಿಂದಕ್ಕೆ' })}
                        </button>
                        <button
                            onClick={() => fetchData()}
                            className="px-6 py-3 bg-blue-50 text-blue-600 rounded-xl font-black text-xs uppercase tracking-widest shadow-sm hover:bg-blue-100 transition-all"
                        >
                            {t({ en: 'Refresh', kn: 'ರಿಫ್ರೆಶ್' })}
                        </button>
                    </div>
                </div>

                {/* AI Engine Configuration - NEW SECTION */}
                <section className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border-2 border-blue-100 dark:border-slate-700 mb-8 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none text-6xl">⚙️</div>
                    <div className="flex justify-between items-center mb-8 border-b-2 border-slate-50 dark:border-slate-700 pb-4">
                        <h2 className="text-2xl font-black text-blue-900 dark:text-blue-300 uppercase tracking-tighter">
                            {t({ en: 'Active AI Engine Configuration', kn: 'ಸಕ್ರಿಯ AI ಇಂಜಿನ್ ಕಾನ್ಫಿಗರೇಶನ್' })}
                        </h2>
                        {editingSection !== 'aiConfig' ? (
                            <button onClick={() => startEdit('aiConfig', data.aiConfig)} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-blue-700 transition-all">
                                {t({ en: 'Change Settings', kn: 'ಸೆಟ್ಟಿಂಗ್‌ಗಳನ್ನು ಬದಲಾಯಿಸಿ' })}
                            </button>
                        ) : (
                            <div className="flex gap-2">
                                <button onClick={() => setEditingSection(null)} className="px-4 py-2 bg-slate-200 rounded-xl text-[10px] font-black uppercase text-slate-600">
                                    {t({ en: 'Cancel', kn: 'ರದ್ದುಮಾಡಿ' })}
                                </button>
                                <button onClick={() => handleSave('aiConfig')} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg disabled:opacity-50">
                                    {saving ? t({ en: 'Updating...', kn: 'ಅಪ್‌ಡೇಟ್ ಆಗುತ್ತಿದೆ...' }) : t({ en: 'Save Changes', kn: 'ಬದಲಾವಣೆಗಳನ್ನು ಉಳಿಸಿ' })}
                                </button>
                            </div>
                        )}
                    </div>

                    {editingSection === 'aiConfig' ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Model</label>
                                <select
                                    className="w-full p-4 border rounded-2xl bg-slate-50 dark:bg-slate-900 font-bold text-sm"
                                    value={editFormData.model}
                                    onChange={e => setEditFormData({ ...editFormData, model: e.target.value })}
                                >
                                    <option value="gemini-3-flash-preview">Gemini 3 Flash Preview</option>
                                    <option value="gemini-flash-latest">Gemini Flash Latest</option>
                                </select>
                            </div>
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Strictness</label>
                                <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl gap-2">
                                    {['low', 'medium', 'high'].map(level => (
                                        <button
                                            key={level}
                                            onClick={() => setEditFormData({ ...editFormData, strictness: level })}
                                            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${editFormData.strictness === level ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}
                                        >
                                            {level}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Coach Voice</label>
                                <select
                                    className="w-full p-4 border rounded-2xl bg-slate-50 dark:bg-slate-900 font-bold text-sm"
                                    value={editFormData.voice}
                                    onChange={e => setEditFormData({ ...editFormData, voice: e.target.value })}
                                >
                                    <option value="Aoede">Aoede</option>
                                    <option value="Charon">Charon</option>
                                    <option value="Fenrir">Fenrir</option>
                                </select>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">{t({ en: 'Active Logic', kn: 'ಸಕ್ರಿಯ ತರ್ಕ' })}</span>
                                <span className="text-sm font-black text-blue-900 dark:text-blue-100">{data.aiConfig?.model || 'Gemini 3 Flash Preview'}</span>
                            </div>
                            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">{t({ en: 'Correction Strictness', kn: 'ತಿದ್ದುಪಡಿ ಕಟ್ಟುನಿಟ್ಟು' })}</span>
                                <span className="text-sm font-black text-blue-900 dark:text-blue-100 uppercase">{data.aiConfig?.strictness || 'High'}</span>
                            </div>
                            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">{t({ en: 'Fluency Voice', kn: 'ಸರಾಗತೆ ಧ್ವನಿ' })}</span>
                                <span className="text-sm font-black text-blue-900 dark:text-blue-100">{data.aiConfig?.voice || 'Aoede'}</span>
                            </div>
                        </div>
                    )}
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* Column 1 */}
                    <div className="space-y-8">

                        {/* Theme & Product Identity */}
                        <section className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-xl border-t-8 border-amber-400 relative">
                            <div className="flex justify-between items-center mb-6 border-b-2 border-slate-100 dark:border-slate-700 pb-2">
                                <h2 className="text-xl font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">
                                    1. {t({ en: 'Theme & Identity', kn: 'ಥೀಮ್ ಮತ್ತು ಗುರುತು' })}
                                </h2>
                                {editingSection !== 'theme' && (
                                    <button onClick={() => startEdit('theme', { tagline: data.tagline, mission: data.mission })} className="text-xs font-bold bg-amber-100 text-amber-700 px-3 py-1 rounded-lg">Edit</button>
                                )}
                            </div>

                            {editingSection === 'theme' ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase">Tagline (EN)</label>
                                        <input className="w-full p-2 border rounded-lg bg-slate-50 text-slate-800" value={editFormData.tagline.en} onChange={e => setEditFormData({ ...editFormData, tagline: { ...editFormData.tagline, en: e.target.value } })} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase">Tagline (KN)</label>
                                        <input className="w-full p-2 border rounded-lg bg-slate-50 text-slate-800" value={editFormData.tagline.kn} onChange={e => setEditFormData({ ...editFormData, tagline: { ...editFormData.tagline, kn: e.target.value } })} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase">Mission Statement</label>
                                        <textarea className="w-full p-2 border rounded-lg h-32 bg-slate-50 text-slate-800" value={editFormData.mission} onChange={e => setEditFormData({ ...editFormData, mission: e.target.value })} />
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                        <button onClick={() => setEditingSection(null)} className="px-4 py-2 bg-slate-200 rounded-lg text-sm font-bold text-slate-600">Cancel</button>
                                        <button onClick={() => {
                                            const newData = { ...data, tagline: editFormData.tagline, mission: editFormData.mission };
                                            updateAiInstructions(JSON.stringify(newData), session?.id!).then(() => {
                                                setData(newData); setEditingSection(null);
                                            });
                                        }} className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-bold">Save changes</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="font-bold text-slate-400 text-xs uppercase">Tagline</h3>
                                        <p className="text-xl font-black italic">"{data.tagline.en}"</p>
                                        <p className="text-sm font-bold text-amber-500">{data.tagline.kn}</p>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-400 text-xs uppercase mt-4">Mission Statement</h3>
                                        <p className="leading-relaxed font-medium">{data.mission}</p>
                                    </div>
                                </div>
                            )}
                        </section>

                        {/* Core Philosophy */}
                        <section className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-xl border-t-8 border-blue-500 relative">
                            <div className="flex justify-between items-center mb-6 border-b-2 border-slate-100 dark:border-slate-700 pb-2">
                                <h2 className="text-xl font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                                    2. {t({ en: 'Core Philosophy', kn: 'ಮೂಲ ತತ್ವಜ್ಞಾನ' })}
                                </h2>
                                {editingSection !== 'philosophy' && (
                                    <button onClick={() => startEdit('philosophy', data.philosophy)} className="text-xs font-bold bg-blue-100 text-blue-700 px-3 py-1 rounded-lg">Edit</button>
                                )}
                            </div>

                            {editingSection === 'philosophy' ? (
                                <div className="space-y-4">
                                    {editFormData.map((p: any, idx: number) => (
                                        <div key={idx} className="bg-slate-50 p-4 rounded-xl border relative">
                                            <button onClick={() => setEditFormData(editFormData.filter((_: any, i: number) => i !== idx))} className="absolute top-2 right-2 text-red-500 text-sm">✕</button>
                                            <input className="w-full p-2 border rounded-lg font-bold mb-2" value={p.title} onChange={e => {
                                                const n = [...editFormData]; n[idx].title = e.target.value; setEditFormData(n);
                                            }} />
                                            <textarea className="w-full p-2 border rounded-lg h-20" value={p.desc} onChange={e => {
                                                const n = [...editFormData]; n[idx].desc = e.target.value; setEditFormData(n);
                                            }} />
                                        </div>
                                    ))}
                                    <button onClick={() => setEditFormData([...editFormData, { title: 'New', desc: 'Desc' }])} className="text-blue-600 font-bold text-sm">+ Add Pillar</button>
                                    <div className="flex gap-2 justify-end mt-4">
                                        <button onClick={() => setEditingSection(null)} className="px-4 py-2 bg-slate-200 rounded-lg text-sm font-bold text-slate-600">Cancel</button>
                                        <button onClick={() => handleSave('philosophy')} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-bold">Save changes</button>
                                    </div>
                                </div>
                            ) : (
                                <ul className="space-y-4">
                                    {data.philosophy.map((p, idx) => (
                                        <li key={idx} className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl">
                                            <strong className="block text-blue-900 dark:text-blue-300">{p.title}:</strong>
                                            {p.desc}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        {/* Learning Path */}
                        <section className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-xl border-2 border-slate-100 dark:border-slate-700 relative">
                            <div className="flex justify-between items-center mb-6 border-b-2 border-slate-100 dark:border-slate-700 pb-2">
                                <h2 className="text-xl font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">
                                    3. {t({ en: 'Tiered Path', kn: 'ಶ್ರೇಣೀಕೃತ ಮಾರ್ಗ' })}
                                </h2>
                                {editingSection !== 'path' && (
                                    <button onClick={() => startEdit('path', data.path)} className="text-xs font-bold bg-slate-200 text-slate-700 px-3 py-1 rounded-lg">Edit</button>
                                )}
                            </div>

                            {editingSection === 'path' ? (
                                <div className="space-y-4">
                                    {editFormData.map((p: any, idx: number) => (
                                        <div key={idx} className="bg-slate-50 p-4 rounded-xl border relative">
                                            <button onClick={() => setEditFormData(editFormData.filter((_: any, i: number) => i !== idx))} className="absolute top-2 right-2 text-red-500 text-sm">✕</button>
                                            <input className="w-full p-2 border rounded-lg font-bold mb-2" value={p.level} onChange={e => {
                                                const n = [...editFormData]; n[idx].level = e.target.value; setEditFormData(n);
                                            }} />
                                            <input className="w-full p-2 border rounded-lg" value={p.desc} onChange={e => {
                                                const n = [...editFormData]; n[idx].desc = e.target.value; setEditFormData(n);
                                            }} />
                                        </div>
                                    ))}
                                    <button onClick={() => setEditFormData([...editFormData, { level: 'New Tier', desc: 'Desc' }])} className="text-slate-600 font-bold text-sm">+ Add Tier</button>
                                    <div className="flex gap-2 justify-end mt-4">
                                        <button onClick={() => setEditingSection(null)} className="px-4 py-2 bg-slate-200 rounded-lg text-sm font-bold text-slate-600">Cancel</button>
                                        <button onClick={() => handleSave('path')} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold">Save changes</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {data.path.map((p, idx) => (
                                        <div key={idx} className="flex items-center gap-3"><span className="w-8 h-8 shrink-0 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-black">{idx + 1}</span> <p className="font-bold"><strong>{p.level}:</strong> {p.desc}</p></div>
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>

                    {/* Column 2 */}
                    <div className="space-y-8">

                        {/* AI Interaction Instructions */}
                        <section className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-xl border-t-8 border-purple-500 relative">
                            <div className="flex justify-between items-center mb-6 border-b-2 border-slate-100 dark:border-slate-700 pb-2">
                                <h2 className="text-xl font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest">
                                    4. {t({ en: 'AI Chat/Voice Rules', kn: 'AI ಚಾಟ್/ಧ್ವನಿ ನಿಯಮಗಳು' })}
                                </h2>
                                {editingSection !== 'aiRules' && (
                                    <button onClick={() => startEdit('aiRules', { aiChat: data.aiChat, aiVoice: data.aiVoice })} className="text-xs font-bold bg-purple-100 text-purple-700 px-3 py-1 rounded-lg">Edit</button>
                                )}
                            </div>

                            {editingSection === 'aiRules' ? (
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="font-bold text-slate-800 mb-2">Bilingual Chat Rules</h3>
                                        <textarea value={editFormData.aiChat.join('\n')} onChange={e => setEditFormData({ ...editFormData, aiChat: e.target.value.split('\n') })} className="w-full h-32 p-2 border rounded-lg text-sm bg-slate-50 leading-relaxed" />
                                        <p className="text-[10px] text-slate-400 mt-1">One rule per line.</p>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800 mb-2">Voice Coach Rules</h3>
                                        <textarea value={editFormData.aiVoice.join('\n')} onChange={e => setEditFormData({ ...editFormData, aiVoice: e.target.value.split('\n') })} className="w-full h-32 p-2 border rounded-lg text-sm bg-slate-50 leading-relaxed" />
                                    </div>
                                    <div className="flex gap-2 justify-end mt-4">
                                        <button onClick={() => setEditingSection(null)} className="px-4 py-2 bg-slate-200 rounded-lg text-sm font-bold text-slate-600">Cancel</button>
                                        <button onClick={() => {
                                            const newData = { ...data, aiChat: editFormData.aiChat, aiVoice: editFormData.aiVoice };
                                            updateAiInstructions(JSON.stringify(newData), session?.id!).then(() => {
                                                setData(newData); setEditingSection(null);
                                            });
                                        }} className="px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-bold">Save changes</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4 font-medium">
                                    <h3 className="font-bold text-slate-800 dark:text-slate-200">For Bilingual AI Coaching (Chat):</h3>
                                    <ul className="list-disc pl-5 space-y-2 text-slate-600 dark:text-slate-400">
                                        {data.aiChat.map((r, i) => <li key={i}>{r}</li>)}
                                    </ul>

                                    <h3 className="font-bold text-slate-800 dark:text-slate-200 mt-6">For AI Fluency Coach ("Speak with AI"):</h3>
                                    <ul className="list-disc pl-5 space-y-2 text-slate-600 dark:text-slate-400">
                                        {data.aiVoice.map((r, i) => <li key={i}>{r}</li>)}
                                    </ul>
                                </div>
                            )}
                        </section>

                        {/* Scenario Creation Tools  */}
                        <section className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-xl border-t-8 border-green-500 relative">
                            <div className="flex justify-between items-center mb-6 border-b-2 border-slate-100 dark:border-slate-700 pb-2">
                                <h2 className="text-xl font-black text-green-600 dark:text-green-400 uppercase tracking-widest">
                                    5. {t({ en: 'Course Scenarios', kn: 'ಕೋರ್ಸ್ ಸನ್ನಿವೇಶಗಳು' })}
                                </h2>
                                {editingSection !== 'scenarios' && (
                                    <button onClick={() => startEdit('scenarios', data.scenarios)} className="text-xs font-bold bg-green-100 text-green-700 px-3 py-1 rounded-lg">Edit</button>
                                )}
                            </div>

                            {editingSection === 'scenarios' ? (
                                <div className="space-y-4">
                                    <textarea value={editFormData.join('\n')} onChange={e => setEditFormData(e.target.value.split('\n'))} className="w-full h-40 p-2 border rounded-lg text-sm bg-slate-50 leading-relaxed" />
                                    <p className="text-[10px] text-slate-400 mt-1">One scenario rule per line.</p>
                                    <div className="flex gap-2 justify-end mt-4">
                                        <button onClick={() => setEditingSection(null)} className="px-4 py-2 bg-slate-200 rounded-lg text-sm font-bold text-slate-600">Cancel</button>
                                        <button onClick={() => handleSave('scenarios')} className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-bold">Save changes</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl font-mono text-sm text-slate-700 dark:text-slate-300">
                                    <p className="mb-2"><strong>When generating new lessons or voice chat scenarios:</strong></p>
                                    {data.scenarios.map((r, i) => (
                                        <p key={i} className="mt-1">{i + 1}. {r}</p>
                                    ))}
                                </div>
                            )}
                        </section>

                        {/* UI UX rules */}
                        <section className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-xl border-t-8 border-rose-500 relative">
                            <div className="flex justify-between items-center mb-6 border-b-2 border-slate-100 dark:border-slate-700 pb-2">
                                <h2 className="text-xl font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest">
                                    6. {t({ en: 'Dev / UX Directives', kn: 'ಡೆವ್ / UX ನಿರ್ದೇಶನಗಳು' })}
                                </h2>
                                {editingSection !== 'uiUx' && (
                                    <button onClick={() => startEdit('uiUx', data.uiUx)} className="text-xs font-bold bg-rose-100 text-rose-700 px-3 py-1 rounded-lg">Edit</button>
                                )}
                            </div>

                            {editingSection === 'uiUx' ? (
                                <div className="space-y-4">
                                    {editFormData.map((p: any, idx: number) => (
                                        <div key={idx} className="bg-slate-50 p-4 rounded-xl border relative">
                                            <button onClick={() => setEditFormData(editFormData.filter((_: any, i: number) => i !== idx))} className="absolute top-2 right-2 text-red-500 text-sm">✕</button>
                                            <input className="w-full p-2 border rounded-lg font-bold mb-2 text-sm" value={p.key} onChange={e => {
                                                const n = [...editFormData]; n[idx].key = e.target.value; setEditFormData(n);
                                            }} />
                                            <textarea className="w-full p-2 border rounded-lg text-sm h-20" value={p.val} onChange={e => {
                                                const n = [...editFormData]; n[idx].val = e.target.value; setEditFormData(n);
                                            }} />
                                        </div>
                                    ))}
                                    <button onClick={() => setEditFormData([...editFormData, { key: 'New Directive', val: 'Description...' }])} className="text-rose-600 font-bold text-sm">+ Add Directive</button>
                                    <div className="flex gap-2 justify-end mt-4">
                                        <button onClick={() => setEditingSection(null)} className="px-4 py-2 bg-slate-200 rounded-lg text-sm font-bold text-slate-600">Cancel</button>
                                        <button onClick={() => handleSave('uiUx')} className="px-4 py-2 bg-rose-500 text-white rounded-lg text-sm font-bold">Save changes</button>
                                    </div>
                                </div>
                            ) : (
                                <ul className="space-y-3 text-slate-600 dark:text-slate-400 font-medium list-disc pl-4">
                                    {data.uiUx.map((p, i) => (
                                        <li key={i}><strong>{p.key}:</strong> {p.val}</li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        {/* Global Logic Section - NEW SECTION */}
                        <section className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-xl border-t-8 border-cyan-500 relative">
                            <div className="flex justify-between items-center mb-6 border-b-2 border-slate-100 dark:border-slate-700 pb-2">
                                <h2 className="text-xl font-black text-cyan-600 dark:text-cyan-400 uppercase tracking-widest">
                                    7. {t({ en: 'Global Constraints', kn: 'ಜಾಗತಿಕ ನಿರ್ಬಂಧಗಳು' })}
                                </h2>
                                {editingSection !== 'globalDirectives' && (
                                    <button onClick={() => startEdit('globalDirectives', data.globalDirectives)} className="text-xs font-bold bg-cyan-100 text-cyan-700 px-3 py-1 rounded-lg">Edit</button>
                                )}
                            </div>

                            {editingSection === 'globalDirectives' ? (
                                <div className="space-y-4">
                                    <textarea value={editFormData.join('\n')} onChange={e => setEditFormData(e.target.value.split('\n'))} className="w-full h-40 p-2 border rounded-lg text-sm bg-slate-50 leading-relaxed" />
                                    <p className="text-[10px] text-slate-400 mt-1">One directive per line. These apply to ALL AI agents.</p>
                                    <div className="flex gap-2 justify-end mt-4">
                                        <button onClick={() => setEditingSection(null)} className="px-4 py-2 bg-slate-200 rounded-lg text-sm font-bold text-slate-600">Cancel</button>
                                        <button onClick={() => handleSave('globalDirectives')} className="px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm font-bold">Save changes</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-cyan-50 dark:bg-cyan-900/20 p-6 rounded-2xl">
                                    <ul className="list-disc pl-5 space-y-3 text-slate-700 dark:text-slate-300 font-medium italic">
                                        {(data.globalDirectives || []).map((r, i) => (
                                            <li key={i}>{r}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </section>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default AiInstructions;
