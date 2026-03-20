import React, { useEffect, useState } from 'react';
import { useNotificationStore, NotificationType } from '../store/useNotificationStore';

const NotificationToast: React.FC = () => {
  const { notifications, removeNotification } = useNotificationStore();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-24 right-6 z-[100] flex flex-col gap-3 pointer-events-none w-full max-w-sm">
      {notifications.map((n) => (
        <ToastItem key={n.id} notification={n} onRemove={() => removeNotification(n.id)} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ notification: any; onRemove: () => void }> = ({ notification, onRemove }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onRemove, 300);
  };

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'success': return '✨';
      case 'error': return '🚫';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
    }
  };

  const borderColors = {
    success: 'border-emerald-500/30 shadow-emerald-500/10',
    error: 'border-red-500/30 shadow-red-500/10',
    warning: 'border-amber-500/30 shadow-amber-500/10',
    info: 'border-blue-500/30 shadow-blue-500/10',
  };

  const bgGradients = {
    success: 'from-emerald-500/10 to-emerald-600/5',
    error: 'from-red-500/10 to-red-600/5',
    warning: 'from-amber-500/10 to-amber-600/5',
    info: 'from-blue-500/10 to-blue-600/5',
  };

  return (
    <div
      className={`pointer-events-auto transform transition-all duration-300 ease-out ${
        isVisible ? 'translate-x-0 opacity-100 scale-100' : 'translate-x-12 opacity-0 scale-95'
      } bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border ${borderColors[notification.type]} p-4 rounded-3xl shadow-2xl flex items-start gap-4 overflow-hidden relative group`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${bgGradients[notification.type]} opacity-50`} />
      
      <div className="relative z-10 flex-shrink-0 w-10 h-10 rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center text-xl shadow-sm border border-slate-100 dark:border-slate-800">
        {getIcon(notification.type)}
      </div>

      <div className="relative z-10 flex-1 min-w-0 pt-0.5">
        <h4 className="text-[13px] font-black text-slate-900 dark:text-white uppercase tracking-tight leading-tight">
          {notification.message}
        </h4>
        {notification.details && (
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-widest opacity-80">
            {notification.details}
          </p>
        )}
      </div>

      <button
        onClick={handleClose}
        className="relative z-10 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-600 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Progress Bar for Auto-dismiss */}
      {notification.duration !== 0 && (
        <div className="absolute bottom-0 left-0 h-1 bg-current opacity-20 transition-all duration-linear" style={{
          width: '100%',
          animation: `shrink ${notification.duration || 5000}ms linear forwards`,
          color: notification.type === 'success' ? '#10b981' : notification.type === 'error' ? '#ef4444' : notification.type === 'warning' ? '#f59e0b' : '#3b82f6'
        }} />
      )}

      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
};

export default NotificationToast;
