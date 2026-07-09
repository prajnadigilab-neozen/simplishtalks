import { supabase } from '../lib/supabase';
import { CourseFeedback, FeedbackAuditLog } from '../types';
import { createNotification } from './notificationService';

export const LOGICAL_COURSE_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Submits feedback for the curriculum.
 * Note: Database trigger automatically verifies 100% completion before insert.
 */
export async function submitFeedback(
  userId: string,
  data: {
    overallRating: number;
    contentRating: number;
    mentorRating: number;
    learningRating: number;
    confidenceImprovement: string;
    recommendationScore: number;
    reviewText: string;
    successStory?: string | null;
    testimonialPermission: boolean;
    photoUrl?: string | null;
    videoUrl?: string | null;
    audioUrl?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('course_feedback')
      .insert([{
        user_id: userId,
        course_id: LOGICAL_COURSE_ID,
        overall_rating: data.overallRating,
        content_rating: data.contentRating,
        mentor_rating: data.mentorRating,
        learning_rating: data.learningRating,
        confidence_improvement: data.confidenceImprovement,
        recommendation_score: data.recommendationScore,
        review_text: data.reviewText,
        success_story: data.successStory || null,
        testimonial_permission: data.testimonialPermission,
        photo_url: data.photoUrl || null,
        video_url: data.videoUrl || null,
        audio_url: data.audioUrl || null,
        status: 'pending'
      }]);

    if (error) {
      console.error("Error submitting feedback:", error.message);
      return { success: false, error: error.message };
    }

    // Create confirmation notifications
    await createNotification(
      userId,
      'Feedback Submitted Successfully / ಪ್ರತಿಕ್ರಿಯೆ ಯಶಸ್ವಿಯಾಗಿ ಸಲ್ಲಿಕೆಯಾಗಿದೆ',
      'Thank you! Your feedback has been recorded. Your graduation rewards have been unlocked. / ಧನ್ಯವಾದಗಳು! ನಿಮ್ಮ ಪ್ರತಿಕ್ರಿಯೆಯನ್ನು ದಾಖಲಿಸಲಾಗಿದೆ. ನಿಮ್ಮ ಪದವಿ ಬಹುಮಾನಗಳನ್ನು ಅನ್‌ಲಾಕ್ ಮಾಡಲಾಗಿದೆ.',
      'success'
    );

    return { success: true };
  } catch (e: any) {
    console.error("Failed to submit feedback:", e);
    return { success: false, error: e.message || 'Unknown error' };
  }
}

/**
 * Fetches feedback for the logged-in user.
 */
export async function getMyFeedback(userId: string): Promise<CourseFeedback | null> {
  try {
    const { data, error } = await supabase
      .from('course_feedback')
      .select('*')
      .eq('user_id', userId)
      .eq('course_id', LOGICAL_COURSE_ID)
      .maybeSingle();

    if (error) {
      console.error("Error fetching my feedback:", error.message);
      return null;
    }

    return data as CourseFeedback;
  } catch (e) {
    console.error("Failed to check feedback:", e);
    return null;
  }
}

/**
 * Fetches all feedback (Admins only).
 */
export async function adminGetAllFeedback(): Promise<CourseFeedback[]> {
  try {
    const { data, error } = await supabase
      .from('course_feedback')
      .select('*, profiles!user_id(full_name, phone)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching feedback list:", error.message);
      return [];
    }

    return (data || []) as CourseFeedback[];
  } catch (e) {
    console.error("Failed to load feedback for admin:", e);
    return [];
  }
}

/**
 * Updates status of feedback (Admins only).
 */
export async function adminUpdateFeedbackStatus(
  feedbackId: string,
  status: 'pending' | 'approved' | 'rejected' | 'hidden',
  adminId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('course_feedback')
      .update({
        status,
        approved_by: adminId,
        approved_date: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', feedbackId);

    if (error) {
      console.error("Error updating feedback status:", error.message);
      return false;
    }

    // Retrieve user_id to notify the user
    const { data: fb } = await supabase
      .from('course_feedback')
      .select('user_id')
      .eq('id', feedbackId)
      .single();

    if (fb?.user_id) {
      if (status === 'approved') {
        await createNotification(
          fb.user_id,
          'Testimonial Approved / ನಿಮ್ಮ ವಿಮರ್ಶೆ ಅನುಮೋದಿಸಲಾಗಿದೆ',
          'Congratulations! Your graduate review has been approved and featured on our website. / ಅಭಿನಂದನೆಗಳು! ನಿಮ್ಮ ಪದವಿ ವಿಮರ್ಶೆಯನ್ನು ಅನುಮೋದಿಸಲಾಗಿದೆ ಮತ್ತು ವೆಬ್‌ಸೈಟ್‌ನಲ್ಲಿ ತೋರಿಸಲಾಗಿದೆ.',
          'success'
        );
      }
    }

    return true;
  } catch (e) {
    console.error("Failed to moderate feedback:", e);
    return false;
  }
}

/**
 * Performs inline text edits for typo fixes (Admins only).
 */
export async function adminEditFeedbackText(
  feedbackId: string,
  reviewText: string,
  successStory: string | null
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('course_feedback')
      .update({
        review_text: reviewText,
        success_story: successStory || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', feedbackId);

    if (error) {
      console.error("Error editing feedback text:", error.message);
      return false;
    }

    return true;
  } catch (e) {
    console.error("Failed to edit feedback text:", e);
    return false;
  }
}

/**
 * Pins feedback to public landing page top (Admins only).
 */
export async function adminTogglePinFeedback(
  feedbackId: string,
  isPinned: boolean
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('course_feedback')
      .update({
        is_pinned: isPinned,
        updated_at: new Date().toISOString()
      })
      .eq('id', feedbackId);

    if (error) {
      console.error("Error pinning feedback:", error.message);
      return false;
    }

    return true;
  } catch (e) {
    console.error("Failed to pin feedback:", e);
    return false;
  }
}

/**
 * Gets all approved public testimonials.
 */
export async function getPublicTestimonials(): Promise<CourseFeedback[]> {
  try {
    const { data, error } = await supabase
      .from('course_feedback')
      .select('id, overall_rating, review_text, success_story, completion_date, user_id, is_pinned, profiles!user_id(full_name)')
      .eq('status', 'approved')
      .eq('testimonial_permission', true)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching testimonials:", error.message);
      return [];
    }

    return (data || []) as unknown as CourseFeedback[];
  } catch (e) {
    console.error("Failed to fetch public testimonials:", e);
    return [];
  }
}

/**
 * Fetches admin feedback audit logs.
 */
export async function adminGetFeedbackAuditLogs(): Promise<FeedbackAuditLog[]> {
  try {
    const { data, error } = await supabase
      .from('feedback_audit_logs')
      .select('*, profiles!admin_id(full_name)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching feedback audit logs:", error.message);
      return [];
    }

    return (data || []) as FeedbackAuditLog[];
  } catch (e) {
    console.error("Failed to fetch feedback audit logs:", e);
    return [];
  }
}
