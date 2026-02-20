
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

const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET || "SIMPLISH_PRO_2026";

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
    const role = data.adminCode === ADMIN_SECRET ? UserRole.ADMIN : UserRole.USER;
    const formattedPhone = data.phone.startsWith('+') ? data.phone : `+91${data.phone}`;

    const { data: authData, error: authError } = await supabase.auth.signUp({
      phone: formattedPhone,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
          place: data.place,
          role: role
        }
      }
    });

    if (authError) throw authError;

    if (authData.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([
          {
            id: authData.user.id,
            full_name: data.fullName,
            phone: formattedPhone,
            place: data.place,
            role: role
          }
        ]);

      if (profileError) return { success: false, error: `Profile Creation Failed: ${profileError.message}` };
      await supabase.from('user_progress').insert([{ user_id: authData.user.id }]);
    }

    return { success: true };
  } catch (error: any) {
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
    const formattedPhone = data.phone.startsWith('+') ? data.phone : `+91${data.phone}`;
    console.log("🔐 Attempting login for:", formattedPhone);
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      phone: formattedPhone,
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

export async function getAllUsers(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, phone, place, role, created_at, avatar_url, is_restricted')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (e: any) {
    console.error("getAllUsers error:", e);
    return [];
  }
}

export async function getUserSession() {
  const now = Date.now();
  if (cachedProfile && (now - lastCacheTime < CACHE_TTL)) return cachedProfile;

  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session || !session.user?.id) {
      cachedProfile = null;
      return null;
    }

    // Standardized: Fetching full profile in one clean query
    const profileQuery = Promise.resolve(
      supabase
        .from('profiles')
        .select('full_name, place, role, is_restricted, avatar_url')
        .eq('id', session.user.id)
        .single()
    );

    const { data: profile, error } = await withTimeout(profileQuery, 15000).catch(e => {
      console.warn('Profile fetch timed out or failed:', e.message);
      return { data: null, error: e };
    });

    if (!error && profile) {
      cachedProfile = {
        id: session.user.id,
        name: profile.full_name || session.user.user_metadata?.full_name || 'User',
        place: profile.place || session.user.user_metadata?.place || '',
        phone: session.user.phone,
        role: profile.role || session.user.user_metadata?.role || UserRole.USER,
        isRestricted: profile.is_restricted || false,
        avatar_url: profile.avatar_url,
        isLoggedIn: true
      };
    } else {
      // Fallback if profile fetch fails but session exists
      cachedProfile = {
        id: session.user.id,
        name: session.user.user_metadata?.full_name || 'User',
        place: session.user.user_metadata?.place || '',
        avatar_url: session.user.user_metadata?.avatar_url || '',
        role: session.user.user_metadata?.role || UserRole.USER,
        phone: session.user.phone,
        isLoggedIn: true,
        isRestricted: false
      };
    }

    lastCacheTime = Date.now();
    return cachedProfile;
  } catch (err) {
    console.error("getUserSession error:", err);
    return null;
  }
}
