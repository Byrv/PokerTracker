import type { DbBoundary, SessionRow } from './boundary';
import { getServerSupabase } from './server';

export async function createRealBoundary(): Promise<DbBoundary> {
  const supabase = await getServerSupabase();

  // Single in-flight user-lookup promise per boundary instance. The boundary
  // itself is per-request (getModules is React.cache'd), so this collapses
  // every layout/page/server-component auth check into ONE supabase.auth.getUser
  // network call. Two parallel calls would each potentially trigger a refresh
  // near token expiry, the first refresh rotates the refresh_token, and the
  // second call's refresh fails — yielding spurious not_authenticated errors.
  let currentUserPromise: Promise<{ id: string; email: string } | null> | null = null;
  const getCurrentUserOnce = () => {
    if (!currentUserPromise) {
      currentUserPromise = supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return null;
        return { id: user.id, email: user.email ?? '' };
      });
    }
    return currentUserPromise;
  };

  return {
    auth: {
      getCurrentUser: getCurrentUserOnce,
      signInWithMagicLink: async (email, redirectTo) => {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirectTo },
        });
        if (error) throw error;
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
      joinSessionWithToken: async (token) => {
        const { data, error } = await supabase.rpc('join_session_with_token', { token });
        if (error) throw error;
        return data as unknown as SessionRow;
      },
    },

    profiles: {
      get: async (userId) => {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();
        return data;
      },
      list: async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('nickname', { ascending: true });
        if (error) throw error;
        return data ?? [];
      },
      update: async (userId, patch) => {
        const { data, error } = await supabase
          .from('profiles')
          .update(patch)
          .eq('user_id', userId)
          .select()
          .single();
        if (error) throw error;
        return data;
      },
    },

    appSettings: {
      get: async () => {
        const { data, error } = await supabase
          .from('app_settings')
          .select('*')
          .eq('id', 1)
          .single();
        if (error) throw error;
        return data;
      },
      update: async (patch) => {
        const { data, error } = await supabase
          .from('app_settings')
          .update(patch)
          .eq('id', 1)
          .select()
          .single();
        if (error) throw error;
        return data;
      },
    },

    sessions: {
      create: async (input) => {
        const { data, error } = await supabase.from('sessions').insert(input).select().single();
        if (error) throw error;
        return data;
      },
      get: async (id) => {
        const { data } = await supabase.from('sessions').select('*').eq('id', id).maybeSingle();
        return data;
      },
      list: async (filter) => {
        let q = supabase.from('sessions').select('*').order('played_on', { ascending: false });
        if (filter?.status) q = q.eq('status', filter.status);
        const { data, error } = await q;
        if (error) throw error;
        return data ?? [];
      },
      update: async (id, patch) => {
        const { data, error } = await supabase
          .from('sessions')
          .update(patch)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data;
      },
      listParticipants: async (sessionId) => {
        const { data, error } = await supabase
          .from('session_participants')
          .select('*')
          .eq('session_id', sessionId);
        if (error) throw error;
        return data ?? [];
      },
      addParticipant: async (sessionId, userId) => {
        const { error } = await supabase.rpc('house_add_participant', {
          s: sessionId,
          u: userId,
        });
        if (error) throw error;
      },
      removeParticipant: async (sessionId, userId) => {
        const { error } = await supabase
          .from('session_participants')
          .delete()
          .eq('session_id', sessionId)
          .eq('user_id', userId);
        if (error) throw error;
      },
    },

    buyins: {
      create: async (input) => {
        const { data, error } = await supabase.from('buyins').insert(input).select().single();
        if (error) throw error;
        return data;
      },
      update: async (id, patch) => {
        const { data, error } = await supabase
          .from('buyins')
          .update(patch)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data;
      },
      delete: async (id) => {
        const { error } = await supabase.from('buyins').delete().eq('id', id);
        if (error) throw error;
      },
      listForSession: async (sessionId) => {
        const { data, error } = await supabase
          .from('buyins')
          .select('*')
          .eq('session_id', sessionId)
          .order('recorded_at');
        if (error) throw error;
        return data ?? [];
      },
    },

    cashouts: {
      upsert: async (input) => {
        const { data, error } = await supabase
          .from('cashouts')
          .upsert(input, { onConflict: 'session_id,user_id' })
          .select()
          .single();
        if (error) throw error;
        return data;
      },
      confirm: async (id, by) => {
        const { data, error } = await supabase
          .from('cashouts')
          .update({
            status: 'confirmed',
            confirmed_by: by,
            confirmed_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data;
      },
      listForSession: async (sessionId) => {
        const { data, error } = await supabase
          .from('cashouts')
          .select('*')
          .eq('session_id', sessionId);
        if (error) throw error;
        return data ?? [];
      },
    },

    audit: {
      listForSession: async (sessionId) => {
        const { data, error } = await supabase
          .from('audit_log')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data ?? [];
      },
    },

    notes: {
      create: async (input) => {
        const { data, error } = await supabase.from('notes').insert(input).select().single();
        if (error) throw error;
        return data;
      },
      update: async (id, body) => {
        const { data, error } = await supabase
          .from('notes')
          .update({ body })
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data;
      },
      delete: async (id) => {
        const { error } = await supabase.from('notes').delete().eq('id', id);
        if (error) throw error;
      },
      listForSession: async (sessionId) => {
        const { data, error } = await supabase
          .from('notes')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data ?? [];
      },
    },

    photos: {
      create: async (input) => {
        const { data, error } = await supabase.from('photos').insert(input).select().single();
        if (error) throw error;
        return data;
      },
      delete: async (id) => {
        const { error } = await supabase.from('photos').delete().eq('id', id);
        if (error) throw error;
      },
      listForSession: async (sessionId) => {
        const { data, error } = await supabase
          .from('photos')
          .select('*')
          .eq('session_id', sessionId);
        if (error) throw error;
        return data ?? [];
      },
    },

    badges: {
      create: async (input) => {
        const { data, error } = await supabase.from('badges').insert(input).select().single();
        if (error) throw error;
        return data;
      },
      listForUser: async (userId) => {
        const { data, error } = await supabase.from('badges').select('*').eq('user_id', userId);
        if (error) throw error;
        return data ?? [];
      },
      existsForUserSession: async (userId, badgeKey, sessionId) => {
        let q = supabase
          .from('badges')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('badge_key', badgeKey);
        q = sessionId ? q.eq('session_id', sessionId) : q.is('session_id', null);
        const { count } = await q;
        return (count ?? 0) > 0;
      },
    },

    storage: {
      upload: async (path, file, contentType) => {
        const { error } = await supabase.storage
          .from('session-media')
          .upload(path, file, { contentType });
        if (error) throw error;
        return { path };
      },
      getSignedUrl: async (path, expiresIn) => {
        const { data, error } = await supabase.storage
          .from('session-media')
          .createSignedUrl(path, expiresIn);
        if (error) throw error;
        return data.signedUrl;
      },
      remove: async (path) => {
        const { error } = await supabase.storage.from('session-media').remove([path]);
        if (error) throw error;
      },
    },
  };
}
