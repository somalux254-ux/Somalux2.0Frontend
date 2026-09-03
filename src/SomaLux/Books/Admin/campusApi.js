import { supabase } from '../supabaseClient';

const UNIVERSITY_COVERS_BUCKET = 'university-covers';

// =====================================================
// UNIVERSITY CRUD OPERATIONS
// =====================================================

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function makeUniversitiesCacheKey({ page, pageSize, search, sort }) {
  return `universities:${page}:${pageSize}:${search || ''}:${(sort?.col)||''}:${(sort?.dir)||''}`;
}

export async function fetchUniversities({ page = 1, pageSize = 10, search = '', sort = { col: 'created_at', dir: 'desc' }, forceRefresh = false }) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const cacheKey = makeUniversitiesCacheKey({ page, pageSize, search, sort });

  if (!forceRefresh) {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.timestamp && (Date.now() - parsed.timestamp) < CACHE_TTL_MS) {
          return { data: parsed.data || [], count: parsed.count || 0, fromCache: true };
        }
      }
    } catch (e) {
      // ignore cache read errors
    }
  }
  
  try {
    const dbSortCol = sort.col || 'created_at';
    
    let query = supabase
      .from('universities')
      .select('id, name, description, website_url, cover_image_url, location, established, student_count, created_at, uploaded_by', { count: 'exact' })
      .eq('status', 'approved')
      .order(dbSortCol, { ascending: (sort.dir || 'desc') === 'asc' })
      .range(from, to);

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,location.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) {
      console.error('Supabase error fetching universities:', error);
      throw new Error(`Failed to fetch universities: ${error.message}`);
    }
    const result = { data: data || [], count: count || 0 };
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: result.data, count: result.count }));
    } catch (e) {
      // ignore write errors
    }
    return result;
  } catch (err) {
    console.error('Error in fetchUniversities:', err);
    throw err;
  }
}

export async function uploadUniversityCover(file) {
  try {
    const ext = (file?.name?.split('.')?.pop() || 'jpg');
    const path = `${crypto.randomUUID()}.${ext}`;
    const { data, error } = await supabase.storage
      .from(UNIVERSITY_COVERS_BUCKET)
      .upload(path, file, { 
        cacheControl: '3600', 
        upsert: false, 
        contentType: file.type 
      });
    
    if (error) {
      console.error('Cover upload error:', error);
      throw new Error(`Failed to upload cover to bucket '${UNIVERSITY_COVERS_BUCKET}': ${error.message}`);
    }
    
    return { 
      path: data.path, 
      publicUrl: supabase.storage.from(UNIVERSITY_COVERS_BUCKET).getPublicUrl(data.path).data.publicUrl 
    };
  } catch (err) {
    console.error('Cover upload failed:', err);
    throw err;
  }
}

function clearUniversitiesCache() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith('universities:') || key === 'universities:dropdown' || key.startsWith('pastPapers:')) {
        try { localStorage.removeItem(key); } catch (e) {}
      }
    }
  } catch (e) {
    // ignore
  }
}

export async function createUniversity({ metadata, coverFile }) {
  let cover_image_url = null;
  
  if (coverFile) {
    const uploaded = await uploadUniversityCover(coverFile);
    cover_image_url = uploaded.publicUrl;
  }
  
  const payload = { ...metadata, cover_image_url };
  const { data, error } = await supabase
    .from('universities')
    .insert(payload)
    .select('*')
    .single();
  
  if (error) throw error;
  try { clearUniversitiesCache(); } catch (e) {}
  return data;
}

export async function createUniversitySubmission({ metadata, coverFile }) {
  // Validate required fields
  if (!metadata.name || metadata.name.trim() === '') {
    throw new Error('University name is required');
  }

  let cover_image_url = null;
  
  if (coverFile) {
    const uploaded = await uploadUniversityCover(coverFile);
    cover_image_url = uploaded.publicUrl;
  }
  
  // Get current user ID
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('Must be authenticated to upload a university');
  }
  
  // Prepare payload for universities table (directly)
  // Universities are immediately published and visible
  const { name, description, website_url, location, established, student_count } = metadata;
  const payload = {
    name: name.trim(),
    description: description || '',
    website_url: website_url || '',
    location: location || '',
    established: established || null,
    student_count: student_count || 0,
    cover_image_url,
    status: 'approved', // Published immediately
    uploaded_by: user.id
  };
  
  const { data, error } = await supabase
    .from('universities')
    .insert(payload)
    .select('*')
    .single();
  
  if (error) {
    console.error('University upload error:', error);
    throw new Error(error.message || 'Failed to upload university');
  }
  
  console.log('University uploaded successfully:', data);
  try { clearUniversitiesCache(); } catch (e) {}
  return data;
}

export async function updateUniversity(id, { updates, newCoverFile }) {
  const patch = { ...updates };
  
  if (newCoverFile) {
    const uploaded = await uploadUniversityCover(newCoverFile);
    patch.cover_image_url = uploaded.publicUrl;
  }
  
  const { data, error } = await supabase
    .from('universities')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  
  if (error) throw error;
  try { clearUniversitiesCache(); } catch (e) {}
  return data;
}

export async function deleteUniversity({ id, cover_image_url }) {
  try {
    // First, fetch the university to get all file paths
    const { data: universityData, error: fetchError } = await supabase
      .from('universities')
      .select('cover_image_url')
      .eq('id', id)
      .single();
    
    if (fetchError && fetchError.code !== 'PGRST116') {
      console.warn('Could not fetch university details before deletion:', fetchError);
    }

    // Delete from Supabase database
    const { error: deleteError } = await supabase
      .from('universities')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    // Try to delete the cover image from storage
    const imageUrl = cover_image_url || universityData?.cover_image_url;
    if (imageUrl) {
      // Extract the file path from the full URL
      const path = imageUrl.includes('/') ? imageUrl.split('/').pop() : imageUrl;
      if (path) {
        await supabase.storage
          .from(UNIVERSITY_COVERS_BUCKET)
          .remove([path])
          .catch((err) => {
            console.warn('Failed to delete university cover image from storage:', err);
            // Don't throw - record is already deleted from DB
          });
      }
    }

    try { clearUniversitiesCache(); } catch (e) {}
  } catch (error) {
    console.error('Error deleting university:', error);
    throw new Error(error.message || 'Failed to delete university');
  }
}

// =====================================================
// UNIVERSITY RATINGS
// =====================================================

export async function rateUniversity(universityId, rating) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be authenticated to rate');

  const { data, error } = await supabase
    .from('university_ratings')
    .upsert({ 
      university_id: universityId, 
      user_id: user.id, 
      rating 
    }, { 
      onConflict: 'user_id,university_id' 
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function getUserUniversityRating(universityId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('university_ratings')
    .select('rating')
    .eq('university_id', universityId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return null;
  return data?.rating || null;
}

export async function getUniversityRatingStats(universityId) {
  const { data, error } = await supabase
    .from('university_ratings')
    .select('rating')
    .eq('university_id', universityId);

  if (error) return { average: 0, count: 0 };

  const ratings = data || [];
  const average = ratings.length > 0 
    ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length 
    : 0;

  return { 
    average: Math.round(average * 10) / 10, 
    count: ratings.length 
  };
}

// =====================================================
// UNIVERSITY VIEWS TRACKING
// =====================================================

export async function trackUniversityView(universityId) {
  try {
    // Call RPC function to increment views (SECURITY DEFINER bypasses RLS)
    const { error } = await supabase.rpc('increment_university_views', {
      p_university_id: universityId
    });
    
    if (error) {
      console.error('Error incrementing university views:', error);
    }
  } catch (error) {
    console.error('University view tracking error:', error);
  }
}

export async function toggleUniversityLike(universityId, userId) {
  try {
    // Call RPC function to toggle like and get updated count
    const { data, error } = await supabase.rpc('toggle_university_like', {
      p_university_id: universityId,
      p_user_id: userId || 'anonymous'
    });
    
    if (error) {
      console.error('Error toggling university like:', error);
      return null;
    }
    
    return data; // { liked: boolean, count: number }
  } catch (error) {
    console.error('University like toggle error:', error);
    return null;
  }
}

// =====================================================
// REAL-TIME SUBSCRIPTIONS
// =====================================================

export function subscribeToUniversities(callback) {
  const subscription = supabase
    .channel('universities_changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'universities' }, 
      callback
    )
    .subscribe();

  return subscription;
}

export function subscribeToUniversityRatings(universityId, callback) {
  const subscription = supabase
    .channel(`university_ratings_${universityId}`)
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'university_ratings',
        filter: `university_id=eq.${universityId}`
      }, 
      callback
    )
    .subscribe();

  return subscription;
}
