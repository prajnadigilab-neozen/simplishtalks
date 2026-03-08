
import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from './LanguageContext';
import { TRANSLATIONS } from '../constants';
import {
  saveRecording,
  getAllRecordings,
  deleteRecording as deleteRecordingFromDB,
  pruneOldRecordings,
  SavedRecording
} from '../utils/recordingStore';

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  lessonId?: string;
  hideHistory?: boolean;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ onRecordingComplete, lessonId, hideHistory }) => {
  const { t } = useLanguage();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [savedPractices, setSavedPractices] = useState<SavedRecording[]>([]);
  const [playbackUrls, setPlaybackUrls] = useState<Map<string, string>>(new Map());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Load saved practices from IndexedDB on mount
  useEffect(() => {
    getAllRecordings(lessonId).then(recordings => {
      setSavedPractices(recordings);
      // Create object URLs for playback
      const urls = new Map<string, string>();
      recordings.forEach(rec => {
        urls.set(rec.id, URL.createObjectURL(rec.blob));
      });
      setPlaybackUrls(urls);
    });

    // Cleanup object URLs on unmount
    return () => {
      playbackUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [lessonId]);

  // Timer logic
  useEffect(() => {
    if (isRecording) {
      setRecordingSeconds(0);
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioURL(url);

        // Save to IndexedDB — native Blob, no base64 conversion
        const newRec: SavedRecording = {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          blob: audioBlob,
          lessonId,
        };

        await saveRecording(newRec);
        await pruneOldRecordings(20);

        // Refresh the list
        const all = await getAllRecordings(lessonId);
        setSavedPractices(all);
        const urls = new Map(playbackUrls);
        all.forEach(r => {
          if (!urls.has(r.id)) urls.set(r.id, URL.createObjectURL(r.blob));
        });
        setPlaybackUrls(urls);

        onRecordingComplete(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Enforce the 30-second limit shown in the UI
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          stopRecording();
        }
      }, 30_000);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone access is required.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleDelete = async (id: string) => {
    await deleteRecordingFromDB(id);
    // Revoke the object URL
    const url = playbackUrls.get(id);
    if (url) URL.revokeObjectURL(url);
    const urls = new Map(playbackUrls);
    urls.delete(id);
    setPlaybackUrls(urls);
    setSavedPractices(prev => prev.filter(rec => rec.id !== id));
  };

  return (
    <div className="flex flex-col items-center gap-6 p-6 bg-white dark:bg-slate-800 transition-colors rounded-[2rem]">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
        {isRecording ? (
          <>
            <span className="text-red-500 animate-pulse">●</span>
            <span>{t({ en: 'Recording...', kn: 'ರೆಕಾರ್ಡಿಂಗ್ ಆಗುತ್ತಿದೆ...' })}</span>
            <span className="ml-1 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full text-slate-600 dark:text-slate-300 font-mono">
              {formatTime(recordingSeconds)} / 0:30
            </span>
          </>
        ) : (
          t(TRANSLATIONS.voiceNote)
        )}
      </div>

      <div className="relative">
        {isRecording && (
          <div className="absolute inset-0 bg-red-500/20 rounded-full animate-ping scale-150"></div>
        )}
        {!isRecording ? (
          <button
            onClick={startRecording}
            className="w-20 h-20 bg-orange-500 rounded-full flex items-center justify-center text-white hover:bg-orange-600 transition-all shadow-xl shadow-orange-500/30 active:scale-95 z-10 relative"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
            </svg>
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="w-20 h-20 bg-slate-900 dark:bg-slate-700 rounded-full flex items-center justify-center text-white hover:bg-black dark:hover:bg-slate-600 transition-all shadow-xl active:scale-95 z-10 relative"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9Z" />
            </svg>
          </button>
        )}
      </div>

      {audioURL && (
        <div className="w-full max-w-xs animate-in zoom-in-95 duration-300">
          <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest text-center mb-2">
            {t({ en: 'Current Practice', kn: 'ಈಗಿನ ಅಭ್ಯಾಸ' })}
          </p>
          <audio src={audioURL} controls className="w-full h-10 rounded-full overflow-hidden shadow-sm" />
        </div>
      )}

      {!hideHistory && savedPractices.length > 0 && (
        <div className="w-full mt-4 space-y-3">
          <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-700 pb-2">
            {t({ en: 'Recent Practices', kn: 'ಹಿಂದಿನ ಅಭ್ಯಾಸಗಳು' })}
          </h4>
          <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {savedPractices.map((rec) => (
              <div key={rec.id} className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl flex items-center gap-3 border border-slate-100 dark:border-slate-800 group">
                <div className="flex-1">
                  <audio src={playbackUrls.get(rec.id)} controls className="w-full h-8 scale-90 origin-left" />
                  <div className="text-[8px] font-bold text-slate-400 mt-1 uppercase">
                    {new Date(rec.timestamp).toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(rec.id)}
                  className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioRecorder;
