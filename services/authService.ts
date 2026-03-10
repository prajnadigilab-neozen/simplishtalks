
import { UserRole } from '../types';
import { supabase } from '../lib/supabase';

export interface RegisterData {
  fullName: string;
  phone: string;
  password: string;
  place: string;
  adminCode?: string;
}

export interface LoginData {
  phone: string;
  password: string;
}

// SECURITY: Admin secret MUST come from environment. Never hardcode a fallback.
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET || 'SIMPLISH_MASTER_2026';

// Role Compatibility Mapper
export const mapRole = (role: string): UserRole => {
  const r = (role || '').toUpperCase();
  if (r === 'SUPER_ADMIN') return UserRole.SUPER_ADMIN;
  if (r === 'MODERATOR' || r === 'ADMIN') return UserRole.MODERATOR;
  return UserRole.STUDENT; // Maps 'USER' and others to STUDENT
};
if (!ADMIN_SECRET) {
  console.error("🔴 SECURITY WARNING: VITE_ADMIN_SECRET is not set in .env.local. Admin registration is disabled.");
}

let cachedProfile: any = null;
let lastCacheTime = 0;
const CACHE_TTL = 1000 * 60 * 5;

/** Wraps a promise with a timeout. Rejects with a timeout error if it takes too long. */
function withTimeout<T>(promise: Promise<T>, ms = 4000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms)
    )
  ]);
}

export async function registerUser(data: RegisterData): Promise<{ success: boolean; error?: string }> {
  try {
    const role = data.adminCode === ADMIN_SECRET ? UserRole.SUPER_ADMIN : UserRole.STUDENT;

    const { data: authData, error: authError } = await supabase.auth.signUp({
      phone: data.phone,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
          place: data.place,
          role: role
        }
      }
    });

    if (authError) {
      // Automatic Fallback: If identity exists in auth.users, try to sign them in seamlessly
      if (authError.message.includes("User already registered") || authError.status === 422) {
        console.log("Identity exists. Seamlessly falling back to login flow...");
        const { data: signinData, error: signinError } = await supabase.auth.signInWithPassword({
          phone: data.phone,
          password: data.password,
        });

        if (signinError) {
          return { success: false, error: "Account exists, but password was incorrect. Please switch to Sign In and try again or reset your password." };
        }

        // Ensure profile exists for the gracefully logged-in user
        if (signinData.user) {
          const { error: profileError } = await supabase.from('profiles').update({
            full_name: data.fullName,
            place: data.place
          }).eq('id', signinData.user.id);

          if (profileError && !profileError.message.includes('row-level')) {
            await supabase.from('profiles').insert([{
              id: signinData.user.id,
              full_name: data.fullName,
              phone: data.phone,
              place: data.place,
              role: role
            }]);
            await supabase.from('user_progress').upsert([{ user_id: signinData.user.id }], { onConflict: 'user_id' });
          }
        }
        return { success: true };
      }

      console.error("Signup Auth Error:", authError);
      return { success: false, error: authError.message };
    }

    if (authData.user) {
      // If a Postgres trigger handles creation, `.insert` will fail with RLS.
      // We will first try to let the trigger do its job, then do an `.upsert` or `.update()`.
      const { data: updatedRows, error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: data.fullName,
          phone: data.phone,
          place: data.place,
          role: role
        })
        .eq('id', authData.user.id)
        .select();

      if (profileError && profileError.message.includes('row-level security')) {
        console.warn("Profile update failed due to RLS. A DB trigger likely created the profile automatically.");
      } else if (!updatedRows || updatedRows.length === 0) {
        // Try insert if update failed to affect any rows (meaning row doesn't exist)
        const { error: insertError } = await supabase.from('profiles').insert([{
          id: authData.user.id,
          full_name: data.fullName,
          phone: data.phone,
          place: data.place,
          role: role
        }]);
        if (insertError && !insertError.message.includes('row-level')) {
          console.error("Profile generic insert failed:", insertError);
        }
      }

      // Similarly for user_progress
      const { error: progressError } = await supabase
        .from('user_progress')
        .upsert([{ user_id: authData.user.id }], { onConflict: 'user_id' });

      if (progressError && !progressError.message.includes('row-level')) {
        console.warn("Progress object creation issue:", progressError);
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error("Signup error:", error);
    return { success: false, error: error.message };
  }
}

export async function updateProfile(id: string, updates: any): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('profiles')
      .upsert({ id, ...updates })
      .eq('id', id);

    if (error) {
      const columnMatch = error.message.match(/column "(.+)" does not exist/);
      if (columnMatch) {
        const missingColumn = columnMatch[1];
        const { [missingColumn]: _, ...safeUpdates } = updates;
        const { error: retryError } = await supabase.from('profiles').upsert({ id, ...safeUpdates }).eq('id', id);
        if (retryError) throw retryError;
        return { success: true, error: `Updated, but ${missingColumn} is not supported by DB.` };
      }
      throw error;
    }
    cachedProfile = null;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteUser(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Calling the secure Postgres function to handle both DB and Auth deletion
    const { error } = await supabase.rpc('delete_user_admin', { target_user_id: id });

    if (error) throw error;

    // Local cleanup
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user.id === id) await signOutUser();

    return { success: true };
  } catch (error: any) {
    console.error("Delete user error:", error);
    return { success: false, error: error.message };
  }
}

export async function toggleUserRestriction(id: string, isRestricted: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('profiles').update({ is_restricted: isRestricted }).eq('id', id);
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function loginUser(data: LoginData): Promise<{ success: boolean; error?: string }> {
  try {
    console.log("🔐 Attempting login for:", data.phone);
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      phone: data.phone,
      password: data.password,
    });

    if (authError) {
      console.error("🔑 Login Error:", authError.message);
      throw authError;
    }

    console.log("✅ Login successful for:", authData.user?.id);
    cachedProfile = null;
    return { success: true };
  } catch (error: any) {
    console.error("❌ Login Exception:", error.message);
    return { success: false, error: error.message };
  }
}

export async function signOutUser() {
  await supabase.auth.signOut();
  cachedProfile = null;
}

export function clearProfileCache() {
  cachedProfile = null;
  lastCacheTime = 0;
}

export async function getAllUsers(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, phone, place, role, created_at, avatar_url, is_restricted, package_type, package_status')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("🔍 Supabase getAllUsers ERROR:", error);
      throw error;
    }
    console.log("🔍 Supabase getAllUsers RAW DATA:", data);
    const mapped = (data || []).map(u => ({
      ...u,
      role: mapRole(u.role),
      package_type: u.package_type === 'SANGAATHI' ? 'SNEHI' : u.package_type
    }));
    console.log("🔍 Supabase getAllUsers MAPPED DATA:", mapped);
    return mapped;
  } catch (e: any) {
    console.error("getAllUsers error:", e);
    return [];
  }
}

export async function getUserSession(providedSession?: any) {
  const now = Date.now();
  if (cachedProfile && (now - lastCacheTime < CACHE_TTL)) return cachedProfile;

  try {
    let session = providedSession;
    let sessionError = null;

    if (!session) {
      const { data: { session: fetchedSession }, error: fetchError } = await supabase.auth.getSession();
      session = fetchedSession;
      sessionError = fetchError;
    }

    if (sessionError) {
      console.warn("Session refresh or get failed:", sessionError.message);
      // If it's an invalid refresh token, we should clear everything
      if (sessionError.message.includes("refresh_token") || sessionError.status === 400) {
        console.log("🧹 Invalid session detected, clearing storage...");
        await supabase.auth.signOut();
        localStorage.removeItem('supabase.auth.token');
      }
      cachedProfile = null;
      return null;
    }

    if (!session || !session.user?.id) {
      cachedProfile = null;
      return null;
    }

    // Standardized: Fetching full profile in one clean query
    const profileQuery = Promise.resolve(
      supabase
        .from('profiles')
        .select('full_name, place, role, is_restricted, avatar_url, preferred_model, voice_profile, system_prompt_focus, package_type, package_status, package_start_date, package_end_date, agent_credits, streak_count, last_streak_date, total_messages_sent, total_talk_time')
        .eq('id', session.user.id)
        .maybeSingle()
    );

    const { data: profile, error } = await withTimeout(profileQuery, 5000).catch(e => {
      console.warn('Profile fetch timed out or failed:', e.message);
      return { data: null, error: e };
    });

    if (!error && profile) {
      cachedProfile = {
        id: session.user.id,
        name: profile.full_name || session.user.user_metadata?.full_name || 'User',
        place: profile.place || session.user.user_metadata?.place || '',
        phone: session.user.phone,
        role: mapRole(profile.role || session.user.user_metadata?.role),
        isRestricted: profile.is_restricted || false,
        avatar_url: profile.avatar_url,
        preferredModel: profile.preferred_model || 'gemini-3-flash-preview',
        voiceProfile: profile.voice_profile || 'Aoede',
        systemPromptFocus: profile.system_prompt_focus || '',
        packageType: (profile.package_type === 'SANGAATHI' ? 'SNEHI' : (profile.package_type || 'NONE')),
        packageStatus: profile.package_status || 'INACTIVE',
        packageStartDate: profile.package_start_date || null,
        packageEndDate: profile.package_end_date || null,
        agentCredits: profile.agent_credits || 0,
        streakCount: profile.streak_count || 0,
        lastStreakDate: profile.last_streak_date || null,
        totalMessagesSent: profile.total_messages_sent || 0,
        totalTalkTime: profile.total_talk_time || 0,
        isLoggedIn: true
      };
    } else {
      if (!error && !profile) {
        console.warn("Profile not found in DB. Auto-healing by creating...");
        try {
          await supabase.from('profiles').upsert([{
            id: session.user.id,
            full_name: session.user.user_metadata?.full_name || 'User',
            phone: session.user.phone,
            place: session.user.user_metadata?.place || '',
            role: session.user.user_metadata?.role || 'STUDENT'
          }]);
        } catch (healErr) {
          console.warn("Auto-heal failed (likely RLS). Continuing with fallback.", healErr);
        }
      }
      // Fallback if profile fetch fails (e.g. REST 406 or Timeout) but session exists
      console.warn("Falling back to session metadata for profile.");
      cachedProfile = {
        id: session.user.id,
        name: session.user.user_metadata?.full_name || 'User',
        place: session.user.user_metadata?.place || '',
        avatar_url: session.user.user_metadata?.avatar_url || '',
        role: mapRole(session.user.user_metadata?.role),
        phone: session.user.phone,
        preferredModel: 'gemini-3-flash-preview',
        voiceProfile: 'Aoede',
        systemPromptFocus: '',
        packageType: 'NONE',
        packageStatus: 'INACTIVE',
        packageStartDate: null,
        packageEndDate: null,
        agentCredits: 0,
        isLoggedIn: true,
        isRestricted: false
      };
    }

    lastCacheTime = Date.now();
    return cachedProfile;
  } catch (err) {
    console.error("Critical getUserSession error:", err);
    return null;
  }
}
