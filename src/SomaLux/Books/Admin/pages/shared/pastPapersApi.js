import { supabase } from '../supabaseClient';
import { API_URL } from '../../../../../config';

const API_BASE = API_URL;

const PAST_PAPERS_BUCKET = 'past-papers';

// =====================================================
// PAST PAPERS CRUD OPERATIONS
// =====================================================

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function makePastPapersCacheKey({ page, pageSize, search, universityId, faculty, sort }) {
  return `pastPapers:${page}:${pageSize}:${search || ''}:${universityId || ''}:${faculty || ''}:${(sort?.col)||''}:${(sort?.dir)||''}`;
}

export async function fetchPastPapers({ 
  page = 1, 
  pageSize = 20, 
  search = '', 
  universityId = null,
  faculty = null,
  sort = { col: 'created_at', dir: 'desc' },
  forceRefresh = false
}) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  
  console.log('📥 fetchPastPapers called with:', { page, pageSize, search, universityId, faculty, forceRefresh });
  
  const cacheKey = makePastPapersCacheKey({ page, pageSize, search, universityId, faculty, sort });
  if (!forceRefresh) {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.timestamp && (Date.now() - parsed.timestamp) < CACHE_TTL_MS) {
          console.log('📦 Returning cached papers');
          return { data: parsed.data || [], count: parsed.count || 0, fromCache: true };
        }
      }
    } catch (e) {
      // ignore cache errors
    }
  }
  try {
    let query = supabase
      .from('past_papers')
      .select(`
        id, 
        unit_code, 
        unit_name, 
        faculty, 
        file_url, 
        year, 
        semester,
        exam_type,
        file_path,
        created_at, 
        uploaded_by,
        title,
        university_id,
        universities:university_id(id, name)
      `, { count: 'exact' })
      .order(sort.col || 'created_at', { ascending: (sort.dir || 'desc') === 'asc' })
      .range(from, to);

    if (search) {
      query = query.or(`unit_code.ilike.%${search}%,unit_name.ilike.%${search}%,title.ilike.%${search}%`);
    }

    if (universityId) {
      query = query.eq('university_id', universityId);
    }

    if (faculty) {
      query = query.eq('faculty', faculty);
    }

    const { data, error, count } = await query;
    if (error) {
      console.error('Supabase error fetching past papers:', error);
      throw new Error(`Failed to fetch past papers: ${error.message}`);
    }

    // Ensure file_url is properly generated from file_path for each paper
    const processedData = (data || []).map(paper => {
      let finalUrl = paper.file_url;
      
      // Always regenerate from file_path to ensure correct URL
      if (paper.file_path) {
        try {
          const publicUrlData = supabase.storage.from(PAST_PAPERS_BUCKET).getPublicUrl(paper.file_path);
          if (publicUrlData?.data?.publicUrl) {
            finalUrl = publicUrlData.data.publicUrl;
            console.log(`✓ Generated URL for ${paper.id}:`, finalUrl);
          }
        } catch (err) {
          console.warn(`⚠️ Failed to generate URL from file_path for paper ${paper.id}:`, err);
          // Fall back to stored file_url if generation fails
        }
      }
      
      // Validate URL format
      if (!finalUrl || !finalUrl.startsWith('https://')) {
        console.warn(`⚠️ Invalid file_url for paper ${paper.id}:`, finalUrl);
      }
      
      return {
        ...paper,
        file_url: finalUrl
      };
    });

    const result = { data: processedData || [], count: count || 0 };
    console.log('✅ Successfully fetched and processed papers:', {
      count: processedData.length,
      papers: processedData.map(p => ({ id: p.id, title: p.title, hasUrl: !!p.file_url }))
    });
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: result.data, count: result.count }));
    } catch (e) {
      // ignore localStorage write errors (quota, private mode)
    }
    return result;
  } catch (err) {
    console.error('❌ Error in fetchPastPapers:', err);
    throw err;
  }
}

function clearPastPapersCache() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith('pastPapers:') || key === 'universities:dropdown') {
        try { localStorage.removeItem(key); } catch (e) {}
      }
    }
  } catch (e) {
    // ignore
  }
}

export async function uploadPastPaperFile(file) {
  try {
    const ext = file.name.split('.').pop();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { data, error } = await supabase.storage
      .from(PAST_PAPERS_BUCKET)
      .upload(path, file, { 
        cacheControl: '3600', 
        upsert: false, 
        contentType: file.type 
      });
    
    if (error) {
      console.error('Upload error:', error);
      throw new Error(`Failed to upload file to bucket '${PAST_PAPERS_BUCKET}': ${error.message}`);
    }
    
    return { 
      path: data.path, 
      publicUrl: supabase.storage.from(PAST_PAPERS_BUCKET).getPublicUrl(data.path).data.publicUrl 
    };
  } catch (err) {
    console.error('File upload failed:', err);
    throw err;
  }
}

export async function createPastPaper({ metadata, pdfFile }) {
  let file_path = null;
  
  if (!pdfFile) {
    throw new Error('PDF file is required');
  }
  
  const uploaded = await uploadPastPaperFile(pdfFile);
  file_path = uploaded.path;
  const file_url = uploaded.publicUrl;
  
  // Generate title from unit_code and unit_name if not provided
  const title = metadata.title || `${metadata.unit_code} - ${metadata.unit_name}`;
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }
  
  const nowIso = new Date().toISOString();
  const payload = { 
    ...metadata, 
    file_path, 
    file_url,
    title,
    uploaded_by: user.id,
    created_at: nowIso,
    updated_at: nowIso,
    views: 0
  };
  const { data, error } = await supabase
    .from('past_papers')
    .insert(payload)
    .select('*')
    .single();
  
  if (error) throw error;
  // Clear cache so callers fetch fresh data
  try { clearPastPapersCache(); } catch (e) {}
  return data;
}

// Create a user-submitted past paper in the submissions table (awaiting admin approval)
export async function createPastPaperSubmission({ metadata, pdfFile }) {
  let file_path = null;

  if (!pdfFile) {
    throw new Error('PDF file is required');
  }

  const uploaded = await uploadPastPaperFile(pdfFile);
  file_path = uploaded.path;

  // Generate title from unit_code and unit_name if not provided
  const title = metadata.title || `${metadata.unit_code} - ${metadata.unit_name}`;

  const payload = { 
    ...metadata, 
    file_path,
    title,
    status: 'pending'
  };

  const { data, error } = await supabase
    .from('past_paper_submissions')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;

  // Fire-and-forget admin notification; do not block user on email errors
  try {
    const notifyBody = {
      type: 'past_papers',
      uploadedBy: payload.uploaded_by || null,
      faculty: payload.faculty || null,
      unitCode: payload.unit_code || null,
      unitName: payload.unit_name || null,
      year: payload.year || null,
      semester: payload.semester || null,
    };
    fetch(`${API_BASE}/api/elib/submissions/notify-admins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notifyBody),
    }).catch(() => {});
  } catch (_) {}

  return data;
}

export async function updatePastPaper(id, { updates, newPdfFile, oldFilePath }) {
  const patch = { ...updates };
  // Convert empty strings to null for integer/numeric fields
  if (patch.year === '') patch.year = null;
  
  if (newPdfFile) {
    const uploaded = await uploadPastPaperFile(newPdfFile);
    patch.file_path = uploaded.path;
    
    // Try to delete old file
    if (oldFilePath) {
      await supabase.storage
        .from(PAST_PAPERS_BUCKET)
        .remove([oldFilePath])
        .catch(() => {});
    }
  }
  
  const { data, error } = await supabase
    .from('past_papers')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  
  if (error) throw error;
  try { clearPastPapersCache(); } catch (e) {}
  return data;
}

export async function deletePastPaper({ id, file_path }) {
  try {
    // First, fetch the past paper to get the file_url
    const { data: paperData, error: fetchError } = await supabase
      .from('past_papers')
      .select('file_url')
      .eq('id', id)
      .single();
    
    if (fetchError && fetchError.code !== 'PGRST116') {
      console.warn('Could not fetch past paper details before deletion:', fetchError);
    }

    // Delete the past paper record from database
    const { error: deleteError } = await supabase
      .from('past_papers')
      .delete()
      .eq('id', id);
    
    if (deleteError) throw deleteError;

    // Delete file from Supabase storage
    const fileToDelete = file_path || paperData?.file_url;
    
    if (fileToDelete) {
      await supabase.storage
        .from(PAST_PAPERS_BUCKET)
        .remove([fileToDelete])
        .catch((err) => {
          console.warn('Failed to delete past paper file from storage:', err);
          // Don't throw - record is already deleted from DB
        });
    }

    try { clearPastPapersCache(); } catch (e) {}
  } catch (err) {
    console.error('Error in deletePastPaper:', err);
    throw err;
  }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

export async function getFaculties() {
  try {
    // Hardcoded faculties in the system (short forms only, no duplicates)
    const hardcodedFaculties = [
      'Agriculture',
      'FASS',
      'Commerce',
      'FEDCOS',
      'FERD',
      'FET',
      'Health Sciences',
      'Law',
      'Science',
  'Veterinary Medicine'
    // Get unique faculties from database
    const dbFaculties = [...new Set(data.map(item => item.faculty))].filter(Boolean);
    
    // Merge hardcoded and database faculties, keeping unique values
    const allFaculties = [...new Set([...hardcodedFaculties, ...dbFaculties])];
    
    // Sort alphabetically
    return allFaculties.sort();
  } catch (error) {
    console.error('Error fetching faculties:', error);
    // Return hardcoded faculties as fallback
    return [
      'Agriculture',
      'FASS',
      'Commerce',
      'FEDCOS',
      'FERD',
      'FET',
      'Health Sciences',
      'Law',
      'Science',
      'Veterinary Medicine'
    ].sort();
  }
}

const DROPDOWN_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export async function getUniversitiesForDropdown({ forceRefresh = false } = {}) {
  const cacheKey = 'universities:dropdown';
  if (!forceRefresh) {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.timestamp && (Date.now() - parsed.timestamp) < DROPDOWN_CACHE_TTL) {
          return parsed.data || [];
        }
      }
    } catch (e) {
      // ignore cache read
    }
  }

  try {
    const { data, error } = await supabase
      .from('universities')
      .select('id, name')
      .order('name');

    if (error) throw error;
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: data || [] }));
    } catch (e) {
      // ignore write errors
    }
    return data || [];
  } catch (error) {
    console.error('Error fetching universities:', error);
    return [];
  }
}

export async function getPastPaperStats() {
  try {
    const { count: totalPapers } = await supabase
      .from('past_papers')
      .select('*', { count: 'exact', head: true });

    return {
      totalPapers: totalPapers || 0
    };
  } catch (error) {
    console.error('Error fetching past paper stats:', error);
    return { totalPapers: 0 };
  }
}

// =====================================================
// REAL-TIME SUBSCRIPTIONS
// =====================================================

export function subscribeToPastPapers(callback) {
  const subscription = supabase
    .channel('past_papers_changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'past_papers' }, 
      callback
    )
    .subscribe();

  return subscription;
}

export function subscribeToPastPapersByUniversity(universityId, callback) {
  const subscription = supabase
    .channel(`past_papers_${universityId}`)
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'past_papers',
        filter: `university_id=eq.${universityId}`
      }, 
      callback
    )
    .subscribe();

  return subscription;
}

// =====================================================
// LOVES (LIKES) API
// =====================================================

// Return a map { paperId: count }
export async function getLoveCountsForPapers(paperIds = []) {
  try {
    // Fetch all loves for the requested papers
    const { data, error } = await supabase
      .from('past_paper_loves')
      .select('paper_id');

    if (error) {
      console.error('Error fetching love counts:', error);
      return {};
    }

    // Count loves per paper
    const counts = {};
    paperIds.forEach(id => counts[id] = 0);
    
    if (data && data.length > 0) {
      data.forEach(row => {
        if (paperIds.includes(row.paper_id)) {
          counts[row.paper_id] = (counts[row.paper_id] || 0) + 1;
        }
      });
    }
    
    return counts;
  } catch (err) {
    console.error('Unexpected error in getLoveCountsForPapers:', err);
    return {};
  }
}

// Return set/map of paperIds the user has loved
export async function getUserLovedPapers(paperIds = []) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !paperIds.length) return new Set();

  const { data, error } = await supabase
    .from('past_paper_loves')
    .select('paper_id')
    .eq('user_id', user.id)
    .in('paper_id', paperIds);

  if (error) {
    console.error('Error fetching user loved papers:', error);
    return new Set();
  }
  return new Set((data || []).map(r => r.paper_id));
}

export async function togglePaperLove(paperId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Check if already loved
  const { data: existing, error: checkErr } = await supabase
    .from('past_paper_loves')
    .select('id')
    .eq('paper_id', paperId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (checkErr && checkErr.code !== 'PGRST116') { // ignore no rows
    console.error('Error checking love state:', checkErr);
  }

  if (existing) {
    // Unlike
    const { error } = await supabase
      .from('past_paper_loves')
      .delete()
      .eq('paper_id', paperId)
      .eq('user_id', user.id);
    if (error) throw error;
    return { loved: false };
  }

  // Like
  const { error } = await supabase
    .from('past_paper_loves')
    .insert({ paper_id: paperId, user_id: user.id });
  if (error) throw error;
  return { loved: true };
}

// Subscribe to real-time changes in loves
export function subscribeToLoves(callback, filterPaperId = null) {
  const channelName = filterPaperId ? `loves_${filterPaperId}` : 'loves_all';
  const opts = { event: '*', schema: 'public', table: 'past_paper_loves' };
  const payloadFilter = filterPaperId ? { ...opts, filter: `paper_id=eq.${filterPaperId}` } : opts;

  const subscription = supabase
    .channel(channelName)
    .on('postgres_changes', payloadFilter, callback)
    .subscribe();
  return subscription;
}
