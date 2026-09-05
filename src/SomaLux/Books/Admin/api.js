import { supabase } from '../supabaseClient';
import { API_URL } from '../../../config';

const API_BASE = API_URL;
const BOOKS_BUCKET = 'elib-books';
const signedBookUrlCache = new Map();

// Backend origin helper (mirrors patterns used elsewhere in the app)
export function getBackendOrigin() {
  if (typeof window === 'undefined') return API_URL;
  if (window.__API_ORIGIN__) return window.__API_ORIGIN__;
  const isNativeCapacitor = Boolean(
    window.Capacitor?.isNativePlatform?.() ||
    window.Capacitor?.getPlatform?.() === 'android' ||
    window.Capacitor?.getPlatform?.() === 'ios'
  );
  if (isNativeCapacitor) return API_URL;
  const { protocol, hostname } = window.location || {};
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}:5000`;
  }
  return API_URL;
}

export async function getBookSignedUrl(bookId) {
  if (!bookId) throw new Error('Book id is required');

  const cached = signedBookUrlCache.get(bookId);
  if (cached && cached.expiresAt > Date.now()) {
    console.log('[signed-url] Client cache hit', { bookId });
    return cached.url;
  }
  if (cached?.request) {
    console.log('[signed-url] Client request already in progress', { bookId });
    return cached.request;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');

  const requestStartedAt = Date.now();
  console.log('[signed-url] Client request started', { bookId });
  const request = fetch(`${getBackendOrigin()}/api/elib/books/${encodeURIComponent(bookId)}/signed-url`, {
    headers: { Authorization: `Bearer ${session.access_token}` }
  }).then(async response => {
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.signedUrl) {
      throw new Error(result.error || `Failed to get book URL (${response.status})`);
    }

    console.log('[signed-url] Client request completed', {
      bookId,
      durationMs: Date.now() - requestStartedAt,
      expiresIn: result.expiresIn || 600
    });
    signedBookUrlCache.set(bookId, {
      url: result.signedUrl,
      expiresAt: Date.now() + Math.max((result.expiresIn || 600) - 30, 30) * 1000
    });
    return result.signedUrl;
  }).catch(error => {
    signedBookUrlCache.delete(bookId);
    console.error('[signed-url] Client request failed', { bookId, error: error.message });
    throw error;
  });

  signedBookUrlCache.set(bookId, { request, expiresAt: 0 });
  return request;
}

// Admin-only: fetch per-user search history from search_events
export async function fetchUserSearchHistoryAdmin(userId, { limit = 200, days } = {}) {
  if (!userId) return [];
  try {
    let query = supabase
      .from('search_events')
      .select('*')
      .eq('user_id', userId);
    
    if (days) {
      const daysAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', daysAgo);
    }
    
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('Error fetching admin user search history:', e);
    return [];
  }
}

// Fetch all users (for PDF export)
export async function fetchAllUsers() {
  try {
    let allUsers = [];
    const pageSize = 1000;
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, email, role', { count: 'exact' })
        .order('role', { ascending: true })
        .order('display_name', { ascending: true })
        .range(from, to);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        allUsers = allUsers.concat(data);
      }
      
      hasMore = data && data.length === pageSize;
      page++;
    }
    
    console.log('[fetchAllUsers] Total users fetched:', allUsers.length);
    return allUsers;
  } catch (e) {
    console.error('Error fetching users for PDF:', e);
    return [];
  }
}

export async function fetchBooks({ page = 1, pageSize = 10, search = '', sort = { col: 'created_at', dir: 'desc' }, uploadedBy = null }) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  
  try {
    // Map frontend column names to database column names for sorting
    const sortColumnMap = {
      'downloads': 'downloads_count',
      'title': 'title',
      'author': 'author',
      'year': 'created_at',
      'created_at': 'created_at'
    };
    
    const dbSortCol = sortColumnMap[sort.col] || sort.col || 'created_at';
    
    let query = supabase
      .from('books')
      .select('id, title, author, description, cover_image_url, file_url, file_size, pages, uploaded_by, created_at, downloads_count', { count: 'exact' })
      .order(dbSortCol, { ascending: (sort.dir || 'desc') === 'asc' })
      .range(from, to);

    if (search) {
      query = query.ilike('title', `%${search}%`);
    }
    if (uploadedBy) {
      query = query.eq('uploaded_by', uploadedBy);
    }
    const { data, error, count } = await query;
    if (error) {
      console.error('Supabase error fetching books:', error);
      throw new Error(`Failed to fetch books: ${error.message || 'Unknown error'}. Make sure all required columns exist in the books table.`);
    }
    
    // Map column names to match expected format
    const mappedData = (data || []).map(book => ({
      ...book,
      cover_url: book.cover_image_url,
      file_path: book.file_url,
      downloads: book.downloads_count,
      year: null,
      language: 'English',
      isbn: null,
      publisher: null
    }));
    
    return { data: mappedData, count: count || 0 };
  } catch (err) {
    console.error('Error in fetchBooks:', err);
    throw err;
  }
}

export async function uploadFile(file) {
  try {
    // Get auth session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    // Convert file to base64
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        const base64String = result.split(',')[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    // Call backend endpoint
    const response = await fetch(`${getBackendOrigin()}/api/elib/books/upload-file`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        fileBase64: base64,
        fileName: file.name,
        contentType: file.type
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to upload file to bucket 'elib-books': ${error.error}`);
    }

    const result = await response.json();
    return { 
      path: result.path, 
      publicUrl: supabase.storage.from(BOOKS_BUCKET).getPublicUrl(result.path).data.publicUrl 
    };
  } catch (err) {
    console.error('File upload failed:', err);
    throw err;
  }
}

export async function uploadCover(file) {
  try {
    // Get auth session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    // Convert file to base64
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        const base64String = result.split(',')[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    // Call backend endpoint
    const response = await fetch(`${getBackendOrigin()}/api/elib/books/upload-cover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        fileBase64: base64,
        fileName: file.name
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to upload cover to bucket 'elib-covers': ${error.error}`);
    }

    const result = await response.json();
    return { path: result.path, publicUrl: result.publicUrl };
  } catch (err) {
    console.error('Cover upload failed:', err);
    throw err;
  }
}

export async function createBook({ metadata, pdfFile, coverFile }) {
  let file_url = null;
  let cover_image_url = null;
  if (pdfFile) {
    const uploaded = await uploadFile(pdfFile);
    file_url = uploaded.path;
  }
  if (coverFile) {
    const uploaded = await uploadCover(coverFile);
    cover_image_url = uploaded.publicUrl;
  }
  
  // Map metadata to database column names for books table
  const payload = {
    title: metadata.title || '',
    author: metadata.author || '',
    description: metadata.description || '',
    isbn: metadata.isbn || '',
    year: metadata.year ? parseInt(metadata.year) : null,
    language: metadata.language || '',
    pages: metadata.pages ? parseInt(metadata.pages) : null,
    publisher: metadata.publisher || '',
    file_url,
    cover_image_url,
    uploaded_by: metadata.uploaded_by || null,
    file_size: pdfFile?.size || null
  };
  
  const { data, error } = await supabase.from('books').insert(payload).select().maybeSingle();
  if (error) throw error;
  return data;
}

export async function createBookSubmission({ metadata, pdfFile, coverFile }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error('Not authenticated');

  let file_url = null;
  let cover_url = null;
  if (pdfFile) {
    const uploaded = await uploadFile(pdfFile);
    file_url = uploaded.path;
  }
  if (coverFile) {
    const uploaded = await uploadCover(coverFile);
    cover_url = uploaded.publicUrl;
  }
  
  // Map metadata to database column names for submissions table
  const payload = {
    title: metadata.title || '',
    author: metadata.author || '',
    description: metadata.description || '',
    isbn: metadata.isbn || '',
    year: metadata.year ? parseInt(metadata.year) : null,
    language: metadata.language || '',
    pages: metadata.pages ? parseInt(metadata.pages) : null,
    publisher: metadata.publisher || '',
    file_url,
    cover_url,
    uploaded_by: session.user.id,
    file_size: pdfFile?.size || null,
    status: 'pending'
  };
  
  const { data, error } = await supabase.from('book_submissions').insert(payload).select().maybeSingle();
  if (error) throw error;

  // Fire-and-forget admin notification; do not block user on email errors
  try {
    const notifyBody = {
      type: 'books',
      uploadedBy: payload.uploaded_by || null,
      itemTitle: payload.title || null,
    };
    console.log('📤 [SUBMISSION] Sending admin notification:', notifyBody);
    const notifyResponse = await fetch(`${API_BASE}/api/elib/submissions/notify-admins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notifyBody),
    });
    const notifyJson = await notifyResponse.json();
    console.log('📤 [SUBMISSION] Admin notification response:', notifyJson);
    if (!notifyResponse.ok) {
      console.warn('⚠️ [SUBMISSION] Admin notification failed:', notifyJson);
    }
  } catch (e) {
    console.error('❌ [SUBMISSION] Error sending admin notification:', e);
  }

  // Send submission confirmation email to uploader
  try {
    console.log('📬 [SUBMISSION] Fetching uploader profile for confirmation email...');
    // Get the uploader's profile to send confirmation email
    if (payload.uploaded_by) {
      const { data: uploaderProfile, error: profileError } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', payload.uploaded_by)
        .single();
      
      if (!profileError && uploaderProfile) {
        const uploaderNotifyBody = {
          type: 'books',
          uploaderEmail: uploaderProfile.email,
          uploaderName: uploaderProfile.full_name,
          itemTitle: payload.title,
        };
        console.log('📬 [SUBMISSION] Sending uploader confirmation:', uploaderNotifyBody);
        const uploaderResponse = await fetch(`${API_BASE}/api/elib/submissions/notify-uploader`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(uploaderNotifyBody),
        });
        const uploaderJson = await uploaderResponse.json();
        console.log('📬 [SUBMISSION] Uploader notification response:', uploaderJson);
        if (!uploaderResponse.ok) {
          console.warn('⚠️ [SUBMISSION] Uploader notification failed:', uploaderJson);
        }
      } else {
        console.warn('⚠️ [SUBMISSION] Could not fetch uploader profile for confirmation email');
      }
    }
  } catch (e) {
    console.error('❌ [SUBMISSION] Error sending uploader confirmation:', e);
  }

  return data;
}

export async function updateBook(id, { updates, newPdfFile, newCoverFile, oldFilePath }) {
  const patch = { ...updates };
  // Convert empty strings to null for integer/numeric fields
  if (patch.year === '') patch.year = null;
  if (patch.pages === '') patch.pages = null;
  
  if (newPdfFile) {
    const uploaded = await uploadFile(newPdfFile);
    patch.file_url = uploaded.path;
    if (oldFilePath) {
      // best effort delete old file
      await supabase.storage.from(BOOKS_BUCKET).remove([oldFilePath]).catch(() => {});
    }
  }
  if (newCoverFile) {
    const uploaded = await uploadCover(newCoverFile);
    patch.cover_image_url = uploaded.publicUrl;
  }
  const { data, error } = await supabase.from('books').update(patch).eq('id', id).select().maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteBook({ id, file_path }) {
  try {
    // First, fetch the book to get all file paths
    const { data: bookData, error: fetchError } = await supabase
      .from('books')
      .select('file_url, cover_image_url')
      .eq('id', id)
      .maybeSingle();
    
    if (fetchError && fetchError.code !== 'PGRST116') {
      console.warn('Could not fetch book details before deletion:', fetchError);
    }

    // Delete the book record from database
    const { error: deleteError } = await supabase
      .from('books')
      .delete()
      .eq('id', id);
    
    if (deleteError) throw deleteError;

    // Delete files from Supabase storage
    const filesToDelete = [];
    
    // Add main PDF file
    if (file_path) {
      filesToDelete.push(file_path);
    } else if (bookData?.file_url) {
      filesToDelete.push(bookData.file_url);
    }

    // Add cover image file
    if (bookData?.cover_image_url) {
      filesToDelete.push(bookData.cover_image_url);
    }

    // Delete all files from storage
    if (filesToDelete.length > 0) {
      await supabase.storage
        .from(BOOKS_BUCKET)
        .remove(filesToDelete)
        .catch((err) => {
          console.warn('Failed to delete some files from storage:', err);
          // Don't throw - record is already deleted from DB
        });
    }
  } catch (err) {
    console.error('Error in deleteBook:', err);
    throw err;
  }
}

export async function fetchStats() {
  try {
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleString(undefined, { month: 'short' }),
        uploads: 0,
      });
    }

    console.log('[fetchStats] Starting data fetch...');
    
    const [booksCountRes, usersDataRes, universitiesCountVal, pastPapersCountVal, apkDownloadsCountVal, recentRes, allBooksRes, allPastPapersRes] = await Promise.all([
      supabase.from('books').select('id', { count: 'exact', head: true }),
      (async () => {
        try {
          const authUsers = await fetchAuthenticatedUsers();
          console.log('[fetchStats] fetchAuthenticatedUsers returned:', authUsers?.length || 0, 'users');
          return authUsers || [];
        } catch (e) {
          console.warn('[fetchStats] fetchAuthenticatedUsers failed, falling back to profile pagination:', e?.message || e);
          // Fallback: Paginate through all profiles to get accurate count
          let allProfiles = [];
          let pageSize = 1000;
          let page = 0;
          let hasMore = true;
          
          while (hasMore) {
            const from = page * pageSize;
            const to = from + pageSize - 1;
            
            const { data, error } = await supabase
              .from('profiles')
              .select('id')
              .range(from, to);
            
            if (error) {
              console.error('[fetchStats] Error fetching profiles on page', page, ':', error);
              break;
            }
            
            if (data && data.length > 0) {
              allProfiles = allProfiles.concat(data);
            }
            
            hasMore = data && data.length === pageSize;
            page++;
          }
          
          console.log('[fetchStats] Fallback: fetched', allProfiles.length, 'total profiles via pagination');
          return allProfiles;
        }
      })(),
      (async () => { const { count } = await supabase.from('universities').select('id', { count: 'exact', head: true }); return count || 0; })(),
      (async () => { const { count } = await supabase.from('past_papers').select('id', { count: 'exact', head: true }); return count || 0; })(),
      (async () => {
        const { count, error } = await supabase.from('android_apk_downloads').select('id', { count: 'exact', head: true });
        if (error) {
          console.warn('[fetchStats] APK download metrics unavailable:', error.message);
          return 0;
        }
        return count || 0;
      })(),
      supabase.from('books').select('id, title, author, cover_image_url, created_at').order('created_at', { ascending: false }).limit(10),
      supabase.from('books').select('id, created_at'),
      supabase.from('past_papers').select('id, created_at'),
    ]);

    const booksCount = booksCountRes?.count || 0;
    const usersCount = Array.isArray(usersDataRes) ? usersDataRes.length : (usersDataRes?.count || 0);
    const universitiesCount = universitiesCountVal || 0;
    const pastPapersCount = pastPapersCountVal || 0;


    (allBooksRes.data || []).forEach(row => {
      if (row.created_at) {
        const d = new Date(row.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const bucket = months.find(m => m.key === key);
        if (bucket) bucket.uploads += 1;
      }
    });

    // Track monthly past papers uploads
    const monthsPastPapers = JSON.parse(JSON.stringify(months)); // Deep clone
    (allPastPapersRes.data || []).forEach(row => {
      if (row.created_at) {
        const d = new Date(row.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const bucket = monthsPastPapers.find(m => m.key === key);
        if (bucket) bucket.uploads += 1;
      }
    });

    return {
      counts: { 
        books: booksCount, 
        users: usersCount, 
        universities: universitiesCount, 
        pastPapers: pastPapersCount,
        androidApkDownloads: apkDownloadsCountVal || 0
      },
      recent: recentRes.data || [],
      monthly: months.map(m => ({ month: m.label, uploads: m.uploads })),
      monthlyPastPapers: monthsPastPapers.map(m => ({ month: m.label, uploads: m.uploads }))
    };
  } catch (error) {
    console.error('Error fetching stats:', error);
    return {
      counts: { books: 0, users: 0, universities: 0, pastPapers: 0 },
      recent: [],
      monthly: [],
      monthlyPastPapers: []
    };
  }
}

export async function fetchProfiles() {
  try {
    let allProfiles = [];
    const pageSize = 1000;
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, display_name, full_name, avatar_url, created_at, updated_at, last_active_at, subscription_tier, role')
        .order('created_at', { ascending: false })
        .range(from, to);
      
      if (error) {
        console.error('[fetchProfiles] Supabase error on page', page, ':', error);
        throw error;
      }
      
      if (data && data.length > 0) {
        allProfiles = allProfiles.concat(data);
      }
      
      hasMore = data && data.length === pageSize;
      page++;
    }
    
    console.log('[fetchProfiles] Total profiles fetched:', allProfiles.length);
    
    // Map full_name to display_name for compatibility with existing code
    return (allProfiles || []).map(p => ({
      ...p,
      display_name: p.full_name || p.display_name || p.email?.split('@')[0] || ''
    }));
  } catch (e) {
    console.error('[fetchProfiles] Error:', e?.message || e);
    throw e;
  }
}

// Helper function to get public avatar URL from storage path
export function getAvatarPublicUrl(avatarPath) {
  if (!avatarPath) return null;
  // If it's already a full URL, return as-is
  if (avatarPath.startsWith('http://') || avatarPath.startsWith('https://')) {
    return avatarPath;
  }
  // Otherwise, generate public URL from storage path
  try {
    const { data } = supabase.storage.from('user-avatars').getPublicUrl(avatarPath);
    return data?.publicUrl || null;
  } catch (e) {
    console.error('[getAvatarPublicUrl] Error getting public URL:', e);
    return null;
  }
}

// Fetch all authenticated users with their status and activity (direct Supabase)
// Fetch authenticated users via backend API endpoint
export async function fetchAuthenticatedUsers() {
  const origin = getBackendOrigin();
  console.log('[fetchAuthenticatedUsers] Fetching from:', origin + '/api/admin/authenticated-users');
  
  try {
    const res = await fetch(`${origin}/api/admin/authenticated-users`);
    console.log('[fetchAuthenticatedUsers] Response status:', res.status);
    
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[fetchAuthenticatedUsers] Response not OK:', text?.substring?.(0, 200));
      throw new Error(text || `Failed to fetch authenticated users (status ${res.status})`);
    }
    
    const payload = await res.json().catch(() => ({}));
    console.log('[fetchAuthenticatedUsers] Payload received:', { ok: payload?.ok, usersCount: payload?.users?.length || 0 });
    
    return payload?.users || [];
  } catch (e) {
    console.error('[fetchAuthenticatedUsers] Error:', e?.message || e);
    throw e;
  }
}

// Migrate avatars from storage bucket to profiles table
export async function migrateAvatarsToProfilesTable() {
  try {
    console.log('[migrateAvatarsToProfilesTable] Starting migration...');
    
    // List all files in user-avatars bucket
    const { data: avatarFiles, error: listError } = await supabase.storage
      .from('user-avatars')
      .list('', { limit: 10000 });
    
    if (listError) {
      console.error('[migrateAvatarsToProfilesTable] Error listing files:', listError);
      return { success: false, error: listError.message };
    }
    
    console.log('[migrateAvatarsToProfilesTable] Found', avatarFiles?.length || 0, 'avatar files');
    
    if (!avatarFiles || avatarFiles.length === 0) {
      return { success: true, migrated: 0, message: 'No avatar files found' };
    }
    
    // Get all profiles
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, avatar_url, avatar_path');
    
    if (profileError) {
      console.error('[migrateAvatarsToProfilesTable] Error fetching profiles:', profileError);
      return { success: false, error: profileError.message };
    }
    
    console.log('[migrateAvatarsToProfilesTable] Found', profiles?.length || 0, 'profiles');
    
    const migrateResults = {
      updated: [],
      skipped: [],
      errors: []
    };
    
    // Filter avatar files (exclude system files)
    const validAvatarFiles = (avatarFiles || [])
      .filter(f => !f.id.startsWith('.') && f.name.match(/\.(jpg|jpeg|png|gif|webp)$/i));
    
    console.log('[migrateAvatarsToProfilesTable] Valid avatar files:', validAvatarFiles.length);
    
    // For each profile without an avatar, assign next available avatar
    let fileIndex = 0;
    
    for (const profile of (profiles || [])) {
      // Skip profiles that already have avatars
      if (profile.avatar_url) {
        migrateResults.skipped.push(profile.id);
        console.log(`[migrateAvatarsToProfilesTable] Profile ${profile.id} already has avatar_url, skipping`);
        continue;
      }
      
      // If no more files, stop
      if (fileIndex >= validAvatarFiles.length) {
        console.log(`[migrateAvatarsToProfilesTable] No more avatar files for remaining profiles`);
        break;
      }
      
      const avatarFile = validAvatarFiles[fileIndex];
      
      try {
        // Generate public URL
        const { data } = supabase.storage.from('user-avatars').getPublicUrl(avatarFile.name);
        const publicUrl = data?.publicUrl;
        
        console.log(`[migrateAvatarsToProfilesTable] Generated URL for ${avatarFile.name}: ${publicUrl}`);
        
        if (!publicUrl) {
          console.warn(`[migrateAvatarsToProfilesTable] Failed to generate public URL for ${avatarFile.name}`);
          migrateResults.errors.push({ id: profile.id, error: 'Failed to generate public URL' });
          fileIndex++;
          continue;
        }
        
        // Update profile with avatar
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            avatar_url: publicUrl,
            avatar_path: avatarFile.name
          })
          .eq('id', profile.id);
        
        if (updateError) {
          console.warn(`[migrateAvatarsToProfilesTable] Error updating profile ${profile.id}:`, updateError);
          migrateResults.errors.push({ id: profile.id, error: updateError.message });
        } else {
          console.log(`[migrateAvatarsToProfilesTable] Updated profile ${profile.id} with ${avatarFile.name}`);
          migrateResults.updated.push({ 
            id: profile.id, 
            email: profile.email,
            file: avatarFile.name,
            url: publicUrl
          });
        }
        
        fileIndex++;
      } catch (e) {
        console.error(`[migrateAvatarsToProfilesTable] Exception for profile ${profile.id}:`, e);
        migrateResults.errors.push({ id: profile.id, error: e.message });
        fileIndex++;
      }
    }
    
    console.log('[migrateAvatarsToProfilesTable] Migration complete:', {
      updated: migrateResults.updated.length,
      skipped: migrateResults.skipped.length,
      errors: migrateResults.errors.length
    });
    
    return {
      success: true,
      migrated: migrateResults.updated.length,
      skipped: migrateResults.skipped.length,
      errors: migrateResults.errors.length,
      details: migrateResults
    };
  } catch (err) {
    console.error('[migrateAvatarsToProfilesTable] Unexpected error:', err);
    return { success: false, error: err.message };
  }
}

// Aggregate counts of approved contributions by user across books, past_papers, and universities
export async function fetchUploadCountsByUser() {
  try {
    const [booksRes, pastRes, uniRes] = await Promise.all([
      supabase.from('books').select('uploaded_by'),
      supabase.from('past_papers').select('uploaded_by'),
      supabase.from('universities').select('uploaded_by'),
    ]);

    const countsMap = {};

    const addRows = (rows, key) => {
      (rows || []).forEach((row) => {
        const uploader = row.uploaded_by ?? null;
        if (!uploader) return;
        const id = String(uploader);
        if (!countsMap[id]) {
          countsMap[id] = { uploaded_by: id, books: 0, past_papers: 0, universities: 0 };
        }
        countsMap[id][key] = (countsMap[id][key] || 0) + 1;
      });
    };

    if (!booksRes.error) addRows(booksRes.data, 'books');
    if (!pastRes.error) addRows(pastRes.data, 'past_papers');
    if (!uniRes.error) addRows(uniRes.data, 'universities');

    const result = Object.keys(countsMap).map((k) => {
      const entry = countsMap[k];
      const total = (entry.books || 0) + (entry.past_papers || 0) + (entry.universities || 0);
      return { ...entry, total };
    });

    return result;
  } catch (err) {
    console.error('Error fetching upload counts by user:', err);
    return [];
  }
}

export async function updateUserRole(id, role) {
  const origin = getBackendOrigin();
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${origin}/api/elib/users/${encodeURIComponent(id)}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(errText || `Failed to update role (status ${res.status})`);
    }
    const payload = await res.json().catch(() => ({}));
    return payload?.data || null;
  } catch (error) {
    console.error('[updateUserRole] Error:', error?.message || error);
    throw error;
  }
}

export async function getProfileByEmail(email) {
  const { data, error } = await supabase.from('profiles').select('id, email, role, display_name').eq('email', email).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getCurrentUserProfile() {
  console.log('🔍 [getCurrentUserProfile] Starting...');
  
  try {
    // Step 1: Get auth user - with timeout
    console.log('🔍 [getCurrentUserProfile] Getting auth user...');
    let user;
    try {
      const authPromise = supabase.auth.getUser();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Auth getUser timeout')), 3000)
      );
      
      const result = await Promise.race([authPromise, timeoutPromise]);
      user = result?.data?.user || result?.user;
      console.log('✓ [getCurrentUserProfile] Auth user retrieved:', user?.email || 'none');
    } catch (authErr) {
      console.error('❌ [getCurrentUserProfile] Auth getUser failed:', authErr?.message || authErr);
      return null;
    }
    
    if (!user) {
      console.log('❌ [getCurrentUserProfile] No auth user found');
      return null;
    }

    const ADMIN_EMAILS = ['campuslives254@gmail.com', 'paltechsomalux@gmail.com', 'eliblearning@gmail.com'];
    const normalizedEmail = String(user.email || '').trim().toLowerCase();
    const isAdminEmail = ADMIN_EMAILS.includes(normalizedEmail);

    // Step 2: Fetch profile from database - with timeout
    console.log('🔍 [getCurrentUserProfile] Querying profiles for user ID:', user.id);
    let data, error;
    try {
      const queryPromise = supabase
        .from('profiles')
        .select('id, email, role, full_name, avatar_url')
        .eq('id', user.id)
        .maybeSingle();
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile query timeout')), 3000)
      );
      
      const result = await Promise.race([queryPromise, timeoutPromise]);
      data = result?.data;
      error = result?.error;
      console.log('✓ [getCurrentUserProfile] Profile query completed');
    } catch (queryErr) {
      console.error('❌ [getCurrentUserProfile] Profile query failed:', queryErr?.message || queryErr);
      return null;
    }

    if (error) throw error;

    // Step 3: Handle missing profile - create it
    if (!data) {
      console.log('⚠️ [getCurrentUserProfile] No profile row found, creating fallback');
      const fallbackProfile = {
        id: user.id,
        email: user.email,
        role: isAdminEmail ? 'admin' : 'user',
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || null,
        avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      };

      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email,
          role: fallbackProfile.role,
          full_name: fallbackProfile.full_name,
          avatar_url: fallbackProfile.avatar_url,
          display_name: fallbackProfile.full_name,
          subscription_tier: 'basic',
          is_active: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      if (upsertError) {
        console.warn('⚠️ [getCurrentUserProfile] Profile backfill failed:', upsertError);
      }

      console.log('📤 [getCurrentUserProfile] Returning fallback profile:', {
        email: fallbackProfile.email,
        role: fallbackProfile.role,
        avatar_url: fallbackProfile.avatar_url ? `[Present]` : '[NULL]'
      });
      return fallbackProfile;
    }

    // Step 4: Promote admin if needed
    const normalizedRole = String(data.role || '').trim().toLowerCase();
    if (isAdminEmail && normalizedRole !== 'admin') {
      console.log('⚠️ [getCurrentUserProfile] Promoting user to admin');
      const { error: roleError } = await supabase
        .from('profiles')
        .update({ role: 'admin', updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (!roleError) {
        data.role = 'admin';
      }
    }

    const result = { ...data, role: data.role || (isAdminEmail ? 'admin' : 'user') };
    console.log('📤 [getCurrentUserProfile] SUCCESS returning profile:', {
      email: result.email,
      role: result.role,
      full_name: result.full_name,
      avatar_url: result.avatar_url ? `[Present]` : '[NULL]'
    });
    return result;
  } catch (err) {
    console.error('❌ [getCurrentUserProfile] FATAL Error:', err?.message || String(err));
    console.error('Stack:', err?.stack);
    return null;
  }
}

export async function fetchViewDetails() {
  try {
    // Get all views
    const { data: viewsData, error: viewsError } = await supabase
      .from('book_views')
      .select('id, book_id, user_id, viewed_at')
      .order('viewed_at', { ascending: false });
    
    if (viewsError) {
      console.error('Error fetching views:', viewsError);
      return [];
    }

    if (!viewsData || viewsData.length === 0) {
      return [];
    }

    // Get all books
    const bookIds = [...new Set(viewsData.map(v => v.book_id))];
    const { data: booksData } = await supabase
      .from('books')
      .select('id, title')
      .in('id', bookIds);

    // Get all profiles
    const userIds = [...new Set(viewsData.map(v => v.user_id))];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, email')
      .in('id', userIds);

    // Create lookup maps
    const bookMap = new Map((booksData || []).map(b => [b.id, b.title]));
    const profileMap = new Map((profilesData || []).map(p => [p.id, p.email]));
    
    // Group by book, then by user within each book so that each user appears once
    // with a list of their individual view timestamps.
    const bookStats = {};
    viewsData.forEach(view => {
      const bookId = view.book_id;
      if (!bookStats[bookId]) {
        bookStats[bookId] = {
          book_id: bookId,
          book_title: bookMap.get(bookId) || 'Unknown',
          total_views: 0,
          usersByEmail: new Map(),
        };
      }

      const bookEntry = bookStats[bookId];
      bookEntry.total_views += 1;

      const email = profileMap.get(view.user_id) || 'Unknown';
      if (!bookEntry.usersByEmail.has(email)) {
        bookEntry.usersByEmail.set(email, {
          email,
          views: [],
        });
      }

      const userEntry = bookEntry.usersByEmail.get(email);
      userEntry.views.push(view.viewed_at);
    });

    // Convert to array and add unique user count. For each user, sort their
    // views by most recent first so the UI can display them nicely.
    return Object.values(bookStats)
      .map(stat => {
        const users = Array.from(stat.usersByEmail.values()).map(u => ({
          email: u.email,
          views: (u.views || [])
            .filter(Boolean)
            .sort((a, b) => new Date(b).getTime() - new Date(a).getTime()),
        }));

        return {
          book_id: stat.book_id,
          book_title: stat.book_title,
          total_views: stat.total_views,
          unique_users: users.length,
          users,
        };
      })
      .sort((a, b) => b.total_views - a.total_views);
  } catch (error) {
    console.error('Error in fetchViewDetails:', error);
    return [];
  }
}

// =====================================================
// STORAGE CLEANUP & ORPHANED FILES MANAGEMENT
// =====================================================

/**
 * Find and remove orphaned files in a storage bucket
 * (files that exist in storage but have no corresponding database record)
 */
export async function cleanupOrphanedFiles() {
  try {
    const results = {
      books_pdf_deleted: [],
      books_cover_deleted: [],
      past_papers_deleted: [],
      university_covers_deleted: [],
      errors: []
    };

    // Get all files from books bucket
    const { data: bookFiles, error: bookFilesError } = await supabase.storage
      .from(BOOKS_BUCKET)
      .list('', { limit: 10000 });

    if (bookFilesError) {
      results.errors.push(`Failed to list books bucket: ${bookFilesError.message}`);
    } else if (bookFiles && bookFiles.length > 0) {
      // Get all file_url and cover_image_url from books table
      const { data: booksData, error: booksError } = await supabase
        .from('books')
        .select('file_url, cover_image_url');

      if (!booksError && booksData) {
        const validPaths = new Set();
        booksData.forEach(book => {
          if (book.file_url) validPaths.add(book.file_url);
          if (book.cover_image_url) validPaths.add(book.cover_image_url);
        });

        // Find and delete orphaned files
        const filesToDelete = bookFiles
          .filter(file => !file.id.startsWith('.'))
          .filter(file => !validPaths.has(file.name))
          .map(file => file.name);

        if (filesToDelete.length > 0) {
          const { error: deleteError } = await supabase.storage
            .from(BOOKS_BUCKET)
            .remove(filesToDelete);

          if (deleteError) {
            results.errors.push(`Failed to delete some book files: ${deleteError.message}`);
          } else {
            results.books_pdf_deleted = filesToDelete.slice(0, filesToDelete.length / 2);
            results.books_cover_deleted = filesToDelete.slice(filesToDelete.length / 2);
          }
        }
      }
    }

    // Get all files from past-papers bucket
    const { data: paperFiles, error: paperFilesError } = await supabase.storage
      .from('past-papers')
      .list('', { limit: 10000 });

    if (paperFilesError) {
      results.errors.push(`Failed to list past-papers bucket: ${paperFilesError.message}`);
    } else if (paperFiles && paperFiles.length > 0) {
      // Get all file_url from past_papers table
      const { data: papersData, error: papersError } = await supabase
        .from('past_papers')
        .select('file_url');

      if (!papersError && papersData) {
        const validPaths = new Set();
        papersData.forEach(paper => {
          if (paper.file_url) validPaths.add(paper.file_url);
        });

        // Find and delete orphaned files
        const filesToDelete = paperFiles
          .filter(file => !file.id.startsWith('.'))
          .filter(file => !validPaths.has(file.name))
          .map(file => file.name);

        if (filesToDelete.length > 0) {
          const { error: deleteError } = await supabase.storage
            .from('past-papers')
            .remove(filesToDelete);

          if (deleteError) {
            results.errors.push(`Failed to delete some past paper files: ${deleteError.message}`);
          } else {
            results.past_papers_deleted = filesToDelete;
          }
        }
      }
    }

    // Get all files from university-covers bucket
    const { data: uniCoverFiles, error: uniCoverError } = await supabase.storage
      .from('university-covers')
      .list('', { limit: 10000 });

    if (uniCoverError) {
      results.errors.push(`Failed to list university-covers bucket: ${uniCoverError.message}`);
    } else if (uniCoverFiles && uniCoverFiles.length > 0) {
      // Get all cover_image_url from universities table
      const { data: unisData, error: unisError } = await supabase
        .from('universities')
        .select('cover_image_url');

      if (!unisError && unisData) {
        const validPaths = new Set();
        unisData.forEach(uni => {
          if (uni.cover_image_url) {
            // Extract filename from URL if needed
            const filename = uni.cover_image_url.includes('/') 
              ? uni.cover_image_url.split('/').pop() 
              : uni.cover_image_url;
            validPaths.add(filename);
          }
        });

        // Find and delete orphaned files
        const filesToDelete = uniCoverFiles
          .filter(file => !file.id.startsWith('.'))
          .filter(file => !validPaths.has(file.name))
          .map(file => file.name);

        if (filesToDelete.length > 0) {
          const { error: deleteError } = await supabase.storage
            .from('university-covers')
            .remove(filesToDelete);

          if (deleteError) {
            results.errors.push(`Failed to delete some university cover files: ${deleteError.message}`);
          } else {
            results.university_covers_deleted = filesToDelete;
          }
        }
      }
    }

    return results;
  } catch (err) {
    console.error('Error in cleanupOrphanedFiles:', err);
    throw err;
  }
}

/**
 * Get statistics about orphaned files without deleting them
 */
export async function getOrphanedFilesReport() {
  try {
    const report = {
      books_bucket: { total: 0, orphaned: 0, files: [] },
      past_papers_bucket: { total: 0, orphaned: 0, files: [] },
      university_covers_bucket: { total: 0, orphaned: 0, files: [] }
    };

    // Check books bucket
    const { data: bookFiles } = await supabase.storage
      .from(BOOKS_BUCKET)
      .list('', { limit: 10000 });

    if (bookFiles) {
      report.books_bucket.total = bookFiles.filter(f => !f.id.startsWith('.')).length;
      const { data: booksData } = await supabase
        .from('books')
        .select('file_url, cover_image_url');

      const validPaths = new Set();
      booksData?.forEach(book => {
        if (book.file_url) validPaths.add(book.file_url);
        if (book.cover_image_url) validPaths.add(book.cover_image_url);
      });

      const orphaned = bookFiles.filter(f => !f.id.startsWith('.') && !validPaths.has(f.name));
      report.books_bucket.orphaned = orphaned.length;
      report.books_bucket.files = orphaned.map(f => f.name);
    }

    // Check past-papers bucket
    const { data: paperFiles } = await supabase.storage
      .from('past-papers')
      .list('', { limit: 10000 });

    if (paperFiles) {
      report.past_papers_bucket.total = paperFiles.filter(f => !f.id.startsWith('.')).length;
      const { data: papersData } = await supabase
        .from('past_papers')
        .select('file_url');

      const validPaths = new Set();
      papersData?.forEach(paper => {
        if (paper.file_url) validPaths.add(paper.file_url);
      });

      const orphaned = paperFiles.filter(f => !f.id.startsWith('.') && !validPaths.has(f.name));
      report.past_papers_bucket.orphaned = orphaned.length;
      report.past_papers_bucket.files = orphaned.map(f => f.name);
    }

    // Check university-covers bucket
    const { data: uniCoverFiles } = await supabase.storage
      .from('university-covers')
      .list('', { limit: 10000 });

    if (uniCoverFiles) {
      report.university_covers_bucket.total = uniCoverFiles.filter(f => !f.id.startsWith('.')).length;
      const { data: unisData } = await supabase
        .from('universities')
        .select('cover_image_url');

      const validPaths = new Set();
      unisData?.forEach(uni => {
        if (uni.cover_image_url) {
          const filename = uni.cover_image_url.includes('/') 
            ? uni.cover_image_url.split('/').pop() 
            : uni.cover_image_url;
          validPaths.add(filename);
        }
      });

      const orphaned = uniCoverFiles.filter(f => !f.id.startsWith('.') && !validPaths.has(f.name));
      report.university_covers_bucket.orphaned = orphaned.length;
      report.university_covers_bucket.files = orphaned.map(f => f.name);
    }

    return report;
  } catch (err) {
    console.error('Error in getOrphanedFilesReport:', err);
    throw err;
  }
}

// =====================================================
// CACHE MANAGEMENT
// =====================================================

/**
 * Clear all application caches (localStorage)
 */
export function clearAllCaches() {
  try {
    const keysToDelete = [];
    
    // Collect all cache-related keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      
      // Match any cache-related keys
      if (key.startsWith('books:') || 
          key.startsWith('pastPapers:') || 
          key.startsWith('universities:') ||
          key === 'universities:dropdown' ||
          key.startsWith('stats:') ||
          key.startsWith('cache:')) {
        keysToDelete.push(key);
      }
    }
    
    // Delete all collected keys
    keysToDelete.forEach(key => {
      try { localStorage.removeItem(key); } catch (e) {}
    });
    
    return {
      success: true,
      cleared: keysToDelete.length,
      keys: keysToDelete
    };
  } catch (err) {
    console.error('Error clearing caches:', err);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Get cache statistics without clearing
 */
export function getCacheStats() {
  try {
    const stats = {
      total_items: 0,
      cache_items: 0,
      items: []
    };
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      
      stats.total_items++;
      
      if (key.startsWith('books:') || 
          key.startsWith('pastPapers:') || 
          key.startsWith('universities:') ||
          key === 'universities:dropdown' ||
          key.startsWith('stats:') ||
          key.startsWith('cache:')) {
        stats.cache_items++;
        const value = localStorage.getItem(key);
        const sizeBytes = new Blob([value]).size;
        stats.items.push({
          key,
          sizeBytes,
          sizeKB: (sizeBytes / 1024).toFixed(2)
        });
      }
    }
    
    return stats;
  } catch (err) {
    console.error('Error getting cache stats:', err);
    return { error: err.message };
  }
}

// =====================================================
// SUPABASE USAGE & BILLING INFORMATION
// =====================================================

/**
 * Get database statistics and usage
 */
export async function getSupabaseDatabaseStats() {
  try {
    const stats = {
      tables: {},
      total_rows: 0,
      total_size_bytes: 0,
      last_updated: new Date().toISOString()
    };

    // Get books count and size estimate
    const { count: booksCount, error: booksError } = await supabase
      .from('books')
      .select('*', { count: 'exact', head: true });

    if (!booksError) {
      const estimatedSize = (booksCount || 0) * 512; // ~512 bytes per row average
      stats.tables.books = {
        rows: booksCount || 0,
        estimated_size_mb: (estimatedSize / 1024 / 1024).toFixed(2),
        estimated_size_bytes: estimatedSize
      };
      stats.total_rows += booksCount || 0;
      stats.total_size_bytes += estimatedSize;
    }

    // Get past papers count
    const { count: papersCount, error: papersError } = await supabase
      .from('past_papers')
      .select('*', { count: 'exact', head: true });

    if (!papersError) {
      const estimatedSize = (papersCount || 0) * 307; // ~307 bytes per row average
      stats.tables.past_papers = {
        rows: papersCount || 0,
        estimated_size_mb: (estimatedSize / 1024 / 1024).toFixed(2),
        estimated_size_bytes: estimatedSize
      };
      stats.total_rows += papersCount || 0;
      stats.total_size_bytes += estimatedSize;
    }

    // Get universities count
    const { count: unisCount, error: unisError } = await supabase
      .from('universities')
      .select('*', { count: 'exact', head: true });

    if (!unisError) {
      const estimatedSize = (unisCount || 0) * 204; // ~204 bytes per row average
      stats.tables.universities = {
        rows: unisCount || 0,
        estimated_size_mb: (estimatedSize / 1024 / 1024).toFixed(2),
        estimated_size_bytes: estimatedSize
      };
      stats.total_rows += unisCount || 0;
      stats.total_size_bytes += estimatedSize;
    }

    // Get users count
    const { count: usersCount, error: usersError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (!usersError) {
      const estimatedSize = (usersCount || 0) * 409; // ~409 bytes per row average
      stats.tables.users = {
        rows: usersCount || 0,
        estimated_size_mb: (estimatedSize / 1024 / 1024).toFixed(2),
        estimated_size_bytes: estimatedSize
      };
      stats.total_rows += usersCount || 0;
      stats.total_size_bytes += estimatedSize;
    }

    return {
      ...stats,
      total_size_mb: (stats.total_size_bytes / 1024 / 1024).toFixed(3),
      total_size_gb: (stats.total_size_bytes / 1024 / 1024 / 1024).toFixed(6)
    };
  } catch (err) {
    console.error('Error getting database stats:', err);
    return { error: err.message };
  }
}

/**
 * Get actual file sizes and calculate bandwidth usage
 */
export async function getSupabaseStorageStats() {
  try {
    const stats = {
      buckets: {},
      total_size_bytes: 0,
      total_files: 0,
      last_updated: new Date().toISOString()
    };

    // Get elib-books bucket size
    const { data: bookFiles } = await supabase.storage
      .from(BOOKS_BUCKET)
      .list('', { limit: 10000 });

    if (bookFiles) {
      const booksTotalBytes = bookFiles.reduce((sum, file) => sum + (file.metadata?.size || 0), 0);
      stats.buckets.elib_books = {
        files: bookFiles.length,
        size_bytes: booksTotalBytes,
        size_kb: (booksTotalBytes / 1024).toFixed(2),
        size_mb: (booksTotalBytes / 1024 / 1024).toFixed(3),
        size_gb: (booksTotalBytes / 1024 / 1024 / 1024).toFixed(6)
      };
      stats.total_size_bytes += booksTotalBytes;
      stats.total_files += bookFiles.length;
    }

    // Get past-papers bucket size
    const { data: paperFiles } = await supabase.storage
      .from('past-papers')
      .list('', { limit: 10000 });

    if (paperFiles) {
      const papersTotalBytes = paperFiles.reduce((sum, file) => sum + (file.metadata?.size || 0), 0);
      stats.buckets.past_papers = {
        files: paperFiles.length,
        size_bytes: papersTotalBytes,
        size_kb: (papersTotalBytes / 1024).toFixed(2),
        size_mb: (papersTotalBytes / 1024 / 1024).toFixed(3),
        size_gb: (papersTotalBytes / 1024 / 1024 / 1024).toFixed(6)
      };
      stats.total_size_bytes += papersTotalBytes;
      stats.total_files += paperFiles.length;
    }

    // Get university-covers bucket size
    const { data: coverFiles } = await supabase.storage
      .from('university-covers')
      .list('', { limit: 10000 });

    if (coverFiles) {
      const coversTotalBytes = coverFiles.reduce((sum, file) => sum + (file.metadata?.size || 0), 0);
      stats.buckets.university_covers = {
        files: coverFiles.length,
        size_bytes: coversTotalBytes,
        size_kb: (coversTotalBytes / 1024).toFixed(2),
        size_mb: (coversTotalBytes / 1024 / 1024).toFixed(3),
        size_gb: (coversTotalBytes / 1024 / 1024 / 1024).toFixed(6)
      };
      stats.total_size_bytes += coversTotalBytes;
      stats.total_files += coverFiles.length;
    }

    return {
      ...stats,
      total_size_kb: (stats.total_size_bytes / 1024).toFixed(2),
      total_size_mb: (stats.total_size_bytes / 1024 / 1024).toFixed(3),
      total_size_gb: (stats.total_size_bytes / 1024 / 1024 / 1024).toFixed(6)
    };
  } catch (err) {
    console.error('Error getting storage stats:', err);
    return { error: err.message };
  }
}

/**
 * Get accurate authenticated user count from backend
 * This counts all users in auth.users table, not just those with profiles
 */
export async function getAuthenticatedUserCount() {
  const origin = getBackendOrigin();
  const endpoint = `${origin}/api/admin/authenticated-users`;
  
  try {
    // First, try to get from backend endpoint (most reliable)
    console.log('[getAuthenticatedUserCount] Calling backend endpoint:', endpoint);
    const res = await fetch(endpoint);
    if (res.ok) {
      const data = await res.json();
      console.log('[getAuthenticatedUserCount] Backend response:', data);
      if (data.count) {
        console.log('[getAuthenticatedUserCount] Authentic user count from backend:', data.count);
        return data.count;
      }
      if (data.users && Array.isArray(data.users)) {
        console.log('[getAuthenticatedUserCount] User count from backend users array:', data.users.length);
        return data.users.length;
      }
    } else {
      console.warn('[getAuthenticatedUserCount] Backend response not ok, status:', res.status);
    }
  } catch (err) {
    console.warn('[getAuthenticatedUserCount] Backend endpoint unavailable:', err.message);
  }

  // Fallback: Get from multiple tables to find all user references
  try {
    console.log('[getAuthenticatedUserCount] Using fallback method');
    const stats = {};

    // Count profiles (most reliable table)
    const { count: profilesCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    stats.profiles = profilesCount || 0;
    console.log('[getAuthenticatedUserCount] Profiles count:', stats.profiles);

    // Count unique uploaded_by in books table (with pagination)
    const { data: booksData, error: booksError } = await supabase
      .from('books')
      .select('uploaded_by', { head: false });
    
    if (!booksError && booksData) {
      const uniqueBookUploaders = new Set(
        booksData.map(b => b.uploaded_by).filter(Boolean)
      );
      stats.book_uploaders = uniqueBookUploaders.size;
      console.log('[getAuthenticatedUserCount] Book uploaders count:', stats.book_uploaders);
    } else {
      stats.book_uploaders = 0;
      console.warn('[getAuthenticatedUserCount] Error fetching books:', booksError?.message);
    }

    // Count unique uploaded_by in past_papers
    const { data: papersData, error: papersError } = await supabase
      .from('past_papers')
      .select('uploaded_by', { head: false });
    
    if (!papersError && papersData) {
      const uniquePaperUploaders = new Set(
        papersData.map(p => p.uploaded_by).filter(Boolean)
      );
      stats.paper_uploaders = uniquePaperUploaders.size;
      console.log('[getAuthenticatedUserCount] Paper uploaders count:', stats.paper_uploaders);
    } else {
      stats.paper_uploaders = 0;
      console.warn('[getAuthenticatedUserCount] Error fetching papers:', papersError?.message);
    }

    // Get max from all sources
    const maxCount = Math.max(
      stats.profiles,
      stats.authors,
      stats.book_uploaders,
      stats.paper_uploaders
    );

    console.log('[getAuthenticatedUserCount] Fallback stats:', stats, 'Max count:', maxCount);
    return maxCount;
  } catch (err) {
    console.error('[getAuthenticatedUserCount] Error in fallback method:', err);
    // Final fallback: just return profiles count
    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    console.log('[getAuthenticatedUserCount] Final fallback, profiles count:', count);
    return count || 0;
  }
}

/**
 * Get comprehensive system statistics from backend (most accurate)
 */
export async function getSystemStatistics() {
  const origin = getBackendOrigin();
  const endpoint = `${origin}/api/admin/authenticated-users`;
  
  try {
    console.log('[getSystemStatistics] Calling:', endpoint);
    const res = await fetch(endpoint);
    
    if (!res.ok) {
      console.warn('[getSystemStatistics] Endpoint returned status:', res.status);
      throw new Error(`HTTP ${res.status}`);
    }
    
    const data = await res.json();
    console.log('[getSystemStatistics] Data received:', data);
    
    return {
      success: true,
      total_authenticated_users: data.count || data.users?.length || 0,
      users: data.users || [],
      profiles: data.profiles || [],
      sessions: data.sessions || [],
      breakdown: data.breakdown || {}
    };
  } catch (err) {
    console.error('[getSystemStatistics] Error:', err);
    return { 
      success: false, 
      error: err.message,
      total_authenticated_users: 0
    };
  }
}

/**
 * Get detailed user statistics including both auth users and profiles
 */
export async function getUserStatistics() {
  try {
    // First try to get from backend system statistics (most accurate)
    const systemStats = await getSystemStatistics();
    if (systemStats.success && systemStats.total_authenticated_users > 0) {
      console.log('[getUserStatistics] Using system statistics, authenticated users:', systemStats.total_authenticated_users);
      
      const stats = {
        authenticated_users: systemStats.total_authenticated_users,
        users_with_profiles: (systemStats.profiles || []).length,
        users_without_profiles: Math.max(0, systemStats.total_authenticated_users - (systemStats.profiles || []).length),
        monthly_active_users: 0,
        users_with_book_uploads: 0,
        users_with_paper_uploads: 0
      };

      // Count active users from profiles
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { count: activeCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('updated_at', thirtyDaysAgo.toISOString());
      
      stats.monthly_active_users = activeCount || 0;

      // Get unique uploaders
      const { data: booksData } = await supabase
        .from('books')
        .select('uploaded_by', { head: false });
      const uniqueBookUploaders = new Set(
        (booksData || []).map(b => b.uploaded_by).filter(Boolean)
      );
      stats.users_with_book_uploads = uniqueBookUploaders.size;

      const { data: papersData } = await supabase
        .from('past_papers')
        .select('uploaded_by', { head: false });
      const uniquePaperUploaders = new Set(
        (papersData || []).map(p => p.uploaded_by).filter(Boolean)
      );
      stats.users_with_paper_uploads = uniquePaperUploaders.size;

      return stats;
    }

    // Fallback: Get from database tables
    console.log('[getUserStatistics] System stats unavailable, using fallback');
    const stats = {};

    // Get authenticated users count (from auth service or multiple sources)
    const authUserCount = await getAuthenticatedUserCount();
    stats.authenticated_users = authUserCount;
    console.log('[getUserStatistics] Authenticated users:', stats.authenticated_users);

    // Get profiles count
    const { count: profilesCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    stats.users_with_profiles = profilesCount || 0;

    // Get unique users who have uploaded books
    const { data: booksData } = await supabase
      .from('books')
      .select('uploaded_by', { head: false });
    const uniqueBookUploaders = new Set(
      (booksData || []).map(b => b.uploaded_by).filter(Boolean)
    );
    stats.users_with_book_uploads = uniqueBookUploaders.size;

    // Get unique users who have uploaded papers
    const { data: papersData } = await supabase
      .from('past_papers')
      .select('uploaded_by', { head: false });
    const uniquePaperUploaders = new Set(
      (papersData || []).map(p => p.uploaded_by).filter(Boolean)
    );
    stats.users_with_paper_uploads = uniquePaperUploaders.size;

    // Calculate discrepancy
    stats.users_without_profiles = Math.max(0, authUserCount - (profilesCount || 0));

    // Get active users (those who have recent activity in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { count: activeCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('updated_at', thirtyDaysAgo.toISOString());
    
    stats.monthly_active_users = activeCount || 0;

    return stats;
  } catch (err) {
    console.error('[getUserStatistics] Error:', err);
    return { error: err.message };
  }
}

/**
 * Track and calculate billing metrics accurately
 */
export async function getBillingMetrics() {
  try {
    const metrics = {
      timestamp: new Date().toISOString(),
      usage: {}
    };

    // Get database size
    const dbStats = await getSupabaseDatabaseStats();
    metrics.usage.database = {
      size_bytes: dbStats.total_size_bytes || 0,
      size_mb: parseFloat(dbStats.total_size_mb || '0'),
      size_gb: parseFloat(dbStats.total_size_gb || '0'),
      rows: dbStats.total_rows || 0,
      tables: Object.keys(dbStats.tables || {}).length
    };

    // Get storage size
    const storageStats = await getSupabaseStorageStats();
    metrics.usage.storage = {
      size_bytes: storageStats.total_size_bytes || 0,
      size_mb: parseFloat(storageStats.total_size_mb || '0'),
      size_gb: parseFloat(storageStats.total_size_gb || '0'),
      files: storageStats.total_files || 0,
      buckets: Object.keys(storageStats.buckets || {}).length
    };

    // Get accurate user statistics
    const userStats = await getUserStatistics();
    metrics.usage.users = userStats;

    // Calculate total usage
    metrics.usage.total_storage = {
      size_bytes: (metrics.usage.database.size_bytes + metrics.usage.storage.size_bytes),
      size_mb: (metrics.usage.database.size_mb + metrics.usage.storage.size_mb).toFixed(3),
      size_gb: (metrics.usage.database.size_gb + metrics.usage.storage.size_gb).toFixed(6)
    };

    // Note: Cached Egress, Egress, and Realtime metrics require Supabase API access
    // These would be fetched from the Supabase management API if available
    metrics.usage.estimated_cached_egress = '0 GB'; // Requires Supabase API
    metrics.usage.estimated_egress = '0 GB'; // Requires Supabase API
    metrics.usage.realtime_connections = 0; // Requires Supabase monitoring

    return metrics;
  } catch (err) {
    console.error('Error calculating billing metrics:', err);
    return { error: err.message };
  }
}

/**
 * Get comprehensive usage report combining all metrics
 */
export async function getSupabaseUsageReport() {
  try {
    const dbStats = await getSupabaseDatabaseStats();
    const storageStats = await getSupabaseStorageStats();
    const billingMetrics = await getBillingMetrics();

    return {
      database: dbStats,
      storage: storageStats,
      billing: billingMetrics.usage || {},
      summary: {
        total_tables: Object.keys(dbStats.tables || {}).length,
        total_rows: dbStats.total_rows || 0,
        total_database_size_gb: parseFloat(dbStats.total_size_gb || '0'),
        total_storage_size_gb: parseFloat(storageStats.total_size_gb || '0'),
        total_combined_size_gb: (parseFloat(dbStats.total_size_gb || '0') + parseFloat(storageStats.total_size_gb || '0')).toFixed(6),
        total_files: storageStats.total_files || 0,
        total_buckets: Object.keys(storageStats.buckets || {}).length,
        // User metrics - now more accurate
        authenticated_users: billingMetrics.usage?.users?.authenticated_users || 0,
        users_with_profiles: billingMetrics.usage?.users?.users_with_profiles || 0,
        users_without_profiles: billingMetrics.usage?.users?.users_without_profiles || 0,
        monthly_active_users: billingMetrics.usage?.users?.monthly_active_users || 0,
        estimated_cached_egress: billingMetrics.usage?.estimated_cached_egress || '0 GB',
        estimated_egress: billingMetrics.usage?.estimated_egress || '0 GB',
        realtime_connections: billingMetrics.usage?.realtime_connections || 0,
        timestamp: new Date().toISOString()
      },
      note: 'Egress and realtime metrics require Supabase API access. This dashboard shows database, storage, and user counts accurately.'
    };
  } catch (err) {
    console.error('Error getting usage report:', err);
    return { error: err.message };
  }
}

// Update user subscription tier
export async function updateUserTier(userId, tier) {
  const origin = getBackendOrigin();
  const endpoint = `${origin}/api/elib/users/${encodeURIComponent(userId)}/tier`;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(endpoint, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ subscription_tier: tier })
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      let message = text;
      try {
        const payload = JSON.parse(text);
        message = payload?.error || payload?.message || text;
      } catch (parseError) {
        // Keep plain-text server errors unchanged.
      }
      throw new Error(message || `Failed to update user tier (status ${response.status})`);
    }
    const payload = await response.json().catch(() => ({}));
    return payload?.data || null;
  } catch (error) {
    console.error('[updateUserTier] Error:', error?.message || error);
    throw error;
  }
}

// Fetch all user profiles for tier management
export async function fetchAllProfilesForVerify() {
  const origin = getBackendOrigin();
  try {
    // Call backend to get fresh profile data with tier info
    const res = await fetch(`${origin}/api/admin/authenticated-users`);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `Failed to fetch profiles (status ${res.status})`);
    }
    const payload = await res.json().catch(() => ({}));
    const users = payload?.users || [];
    
    // Map to ensure all fields are present
    return (users || []).map(u => ({
      id: u.id,
      email: u.email,
      full_name: u.full_name || u.display_name,
      display_name: u.display_name || u.full_name || u.email?.split('@')[0],
      avatar_url: u.avatar_url,
      role: u.role,
      subscription_tier: u.subscription_tier || 'basic',
      subscription_started_at: u.subscription_started_at,
      subscription_expires_at: u.subscription_expires_at
    }));
  } catch (error) {
    console.error('Error fetching profiles for verify:', error?.message || error);
    throw error;
  }
}
