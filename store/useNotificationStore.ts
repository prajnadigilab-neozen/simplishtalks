import { create } from 'zustand';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  details?: string;
  duration?: number;
}

interface NotificationState {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  showSuccess: (message: string, details?: string) => void;
  showError: (message: string, details?: string) => void;
  showInfo: (message: string, details?: string) => void;
  showWarning: (message: string, details?: string) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  addNotification: (notification) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newNotification = { ...notification, id };
    set((state) => ({
      notifications: [...state.notifications, newNotification],
    }));

    if (notification.duration !== 0) {
      setTimeout(() => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
      }, notification.duration || 5000);
    }
  },
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
  showSuccess: (message, details) => 
    useNotificationStore.getState().addNotification({ type: 'success', message, details }),
  showError: (message, details) => 
    useNotificationStore.getState().addNotification({ type: 'error', message, details }),
  showInfo: (message, details) => 
    useNotificationStore.getState().addNotification({ type: 'info', message, details }),
  showWarning: (message, details) => 
    useNotificationStore.getState().addNotification({ type: 'warning', message, details }),
}));
