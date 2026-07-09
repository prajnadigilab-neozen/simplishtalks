import { supabase } from '../lib/supabase';
import { InAppNotification } from '../types';

/**
 * Creates a persistent in-app notification for a user.
 */
export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: 'info' | 'success' | 'warning' | 'error' = 'info'
): Promise<InAppNotification | null> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert([{
        user_id: userId,
        title,
        message,
        type,
        is_read: false
      }])
      .select()
      .single();

    if (error) {
      console.warn("Could not insert notification into DB:", error.message);
      return null;
    }

    return data as InAppNotification;
  } catch (e) {
    console.error("Failed to create notification:", e);
    return null;
  }
}

/**
 * Fetches all notifications for the given user, sorted by date (newest first).
 */
export async function getUserNotifications(userId: string): Promise<InAppNotification[]> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching notifications:", error.message);
      return [];
    }

    return (data || []) as InAppNotification[];
  } catch (e) {
    console.error("Failed to get user notifications:", e);
    return [];
  }
}

/**
 * Marks all unread notifications as read for the given user.
 */
export async function markNotificationsAsRead(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error("Error marking notifications as read:", error.message);
      return false;
    }

    return true;
  } catch (e) {
    console.error("Failed to mark notifications as read:", e);
    return false;
  }
}
