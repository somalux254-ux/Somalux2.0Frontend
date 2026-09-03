import { supabase } from '../supabaseClient';
import { API_URL } from '../../../config';

// API Configuration
const USE_BACKEND_PROXY = true; // Set to false to use direct API calls

/**
 * Search for university names for autocomplete
 */
export async function searchUniversityNames(query, limit = 10) {
  try {
    // Check cache first
    let { data, error } = await supabase
      .rpc('search_university_names', { p_query: query, p_limit: limit });

    if (error) throw error;
    if (data?.length) return data;

    // Try Wikipedia/Wikidata search as primary method (more reliable, no API key needed)
    const wikiResults = await searchWikipediaUniversities(query, limit);
    if (wikiResults.length > 0) {
      // Cache results
      await Promise.all(wikiResults.map(uni => 
        cacheUniversityPrefillData(uni.name, uni, 'wikipedia')
      ));
      return wikiResults;
    }

    // Try backend proxy for Google Knowledge Graph (if enabled)
    if (USE_BACKEND_PROXY) {
      try {
        const response = await fetch(`${API_URL}/api/university/search?query=${encodeURIComponent(query)}&limit=${limit}`);
        
        if (response.ok) {
          const data = await response.json();
          const universities = data.universities || [];
          
          // Cache results
          if (universities.length > 0) {
            await Promise.all(universities.map(uni => 
              cacheUniversityPrefillData(uni.name, uni, 'google_proxy')
            ));
          }
          
          return universities;
        }
      } catch (proxyError) {
        console.warn('Backend proxy unavailable:', proxyError.message);
      }
    }

    return [];
  } catch (error) {
    console.error('Error searching university names:', error);
    return [];
  }
}

/**
 * Search for universities using Wikipedia API (more reliable, no API key needed)
 */
async function searchWikipediaUniversities(query, limit = 10) {
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query + ' university')}&limit=${limit}&namespace=0&format=json&origin=*`;
    const response = await fetch(searchUrl);
    
    if (!response.ok) return [];
    
    const data = await response.json();
    // data[0] = query, data[1] = titles, data[2] = descriptions, data[3] = urls
    const titles = data[1] || [];
    const descriptions = data[2] || [];
    const urls = data[3] || [];
    
    return titles
      .filter(title => title.toLowerCase().includes('university') || title.toLowerCase().includes('college'))
      .map((title, index) => ({
        name: title,
        description: descriptions[index] || '',
        website_url: urls[index] || '',
      }));
  } catch (error) {
    console.error('Error searching Wikipedia:', error);
    return [];
  }
}

/**
 * Get prefill data for a university by name from cache
 */
export async function getUniversityPrefillData(universityName) {
  try {
    const { data, error } = await supabase
      .rpc('get_university_prefill_data', {
        p_university_name: universityName,
      });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching prefill data:', error);
    return null;
  }
}

/**
 * Fetch university data from Google Knowledge Graph (via backend proxy)
 */
export async function fetchUniversityDataFromGoogle(universityName) {
  if (USE_BACKEND_PROXY) {
    try {
      const response = await fetch(`${API_URL}/api/university/details?name=${encodeURIComponent(universityName)}`);
      
      if (response.ok) {
        const data = await response.json();
        return {
          name: data.university.name || universityName,
          description: data.university.description || '',
          website_url: data.university.website_url || '',
          location: data.university.location || '',
          established: null,
          student_count: null,
          cover_images: data.university.image ? [data.university.image] : [],
        };
      }
    } catch (error) {
      console.error('Error fetching from Google via proxy:', error);
    }
  }
  
  return null;
}

/**
 * Fetch university summary from Wikipedia REST API
 */
export async function fetchUniversityDataFromWikipedia(universityName) {
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(universityName)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();

    return {
      name: json.title || universityName,
      description: json.extract || '',
      website_url: '',
      location: '',
      established: null,
      student_count: null,
      cover_images: json.thumbnail?.source ? [json.thumbnail.source] : [],
    };
  } catch (e) {
    console.error('Error fetching from Wikipedia REST:', e);
    return null;
  }
}

/**
 * Fetch university data from Wikidata
 */
export async function fetchUniversityDataFromWikidata(universityName) {
  try {
    const sparqlQuery = `
      SELECT ?item ?itemLabel ?locationLabel ?established ?studentCount ?website
      WHERE {
        ?item wdt:P31/wdt:P279* wd:Q3918;
              rdfs:label ?itemLabel.
        OPTIONAL { ?item wdt:P131 ?location. }
        OPTIONAL { ?item wdt:P571 ?established. }
        OPTIONAL { ?item wdt:P2196 ?studentCount. }
        OPTIONAL { ?item wdt:P856 ?website. }
        FILTER(CONTAINS(LCASE(?itemLabel), LCASE("${universityName}")))
        FILTER(LANG(?itemLabel) = "en")
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }
      LIMIT 1
    `;
    const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparqlQuery)}&format=json`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const binding = data.results.bindings[0];

    if (!binding) return null;

    return {
      name: binding.itemLabel.value,
      description: '',
      website_url: binding.website?.value || '',
      location: binding.locationLabel?.value || '',
      established: binding.established?.value ? new Date(binding.established.value).getFullYear() : null,
      student_count: binding.studentCount?.value || null,
      cover_images: [],
    };
  } catch (error) {
    console.error('Error fetching from Wikidata:', error);
    return null;
  }
}

/**
 * Fetch Wikimedia Commons images for a university
 */
export async function fetchWikimediaImages(universityName) {
  try {
    const title = (universityName || '').trim().replace(/\s+/g, '_');
    if (!title) return [];

    const listUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=images&titles=${encodeURIComponent(title)}`;
    const listRes = await fetch(listUrl);
    if (!listRes.ok) return [];
    const listJson = await listRes.json();

    const pages = listJson?.query?.pages ? Object.values(listJson.query.pages) : [];
    const images = pages[0]?.images || [];
    if (!images.length) return [];

    const fileTitles = images
      .map((img) => img?.title)
      .filter(Boolean)
      .slice(0, 50)
      .join('|');

    if (!fileTitles) return [];

    const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=imageinfo&iiprop=url&titles=${encodeURIComponent(fileTitles)}`;
    const infoRes = await fetch(infoUrl);
    if (!infoRes.ok) return [];
    const infoJson = await infoRes.json();

    const filePages = infoJson?.query?.pages ? Object.values(infoJson.query.pages) : [];
    const urls = filePages
      .map((p) => p?.imageinfo?.[0]?.url)
      .filter((u) => typeof u === 'string' && /\.(jpg|jpeg|png|webp)$/i.test(u));

    const prioritized = urls.sort((a, b) => {
      const deprioritize = (s) => /logo|seal|coat_of_arms|emblem/i.test(s) ? 1 : 0;
      return deprioritize(a) - deprioritize(b);
    });

    return prioritized.slice(0, 5);
  } catch (e) {
    console.error('Error fetching Wikimedia images:', e);
    return [];
  }
}

/**
 * Fetch images from Unsplash (via backend proxy if enabled)
 */
export async function fetchUnsplashImages(universityName) {
  if (USE_BACKEND_PROXY) {
    try {
      const response = await fetch(`${API_URL}/api/university/images?query=${encodeURIComponent(universityName)}`);
      
      if (response.ok) {
        const data = await response.json();
        return data.images?.map(img => img.url) || [];
      }
    } catch (error) {
      console.error('Error fetching Unsplash images via proxy:', error);
    }
  }
  
  return [];
}

/**
 * Download image from URL and convert to File object
 */
export async function downloadImageAsFile(imageUrl, fileName) {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error('Failed to download image');

    const blob = await response.blob();
    const file = new File([blob], fileName, { type: blob.type });
    return file;
  } catch (error) {
    console.error('Error downloading image:', error);
    return null;
  }
}

/**
 * Cache university prefill data
 */
export async function cacheUniversityPrefillData(universityName, data, source = 'manual') {
  try {
    const { error } = await supabase
      .from('university_prefill_cache')
      .upsert({
        university_name: universityName,
        data: data,
        source: source,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error caching prefill data:', error);
    return false;
  }
}

/**
 * Upload multiple images for a university
 */
export async function uploadUniversityImages(universityId, imageFiles) {
  try {
    const uploadedImages = [];
    const bucket = 'university-covers';

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      const fileExt = file.name.split('.').pop();
      const fileName = `${universityId}/image_${i + 1}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Error uploading image:', uploadError);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      uploadedImages.push({
        url: urlData.publicUrl,
        fileName: fileName,
      });
    }

    return uploadedImages;
  } catch (error) {
    console.error('Error uploading multiple images:', error);
    throw error;
  }
}

/**
 * Add image record to university_images table
 */
export async function addUniversityImage(universityId, imageUrl, caption = null, isPrimary = false, displayOrder = 0) {
  try {
    const { data, error } = await supabase
      .rpc('add_university_image', {
        p_university_id: universityId,
        p_image_url: imageUrl,
        p_caption: caption,
        p_is_primary: isPrimary,
        p_display_order: displayOrder,
      });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error adding university image:', error);
    throw error;
  }
}

/**
 * Get all images for a university
 */
export async function getUniversityImages(universityId) {
  try {
    const { data, error } = await supabase
      .from('university_images')
      .select('*')
      .eq('university_id', universityId)
      .order('is_primary', { ascending: false })
      .order('display_order', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching university images:', error);
    throw error;
  }
}

/**
 * Set image as primary
 */
export async function setPrimaryUniversityImage(imageId) {
  try {
    const { error } = await supabase
      .rpc('set_primary_university_image', {
        p_image_id: imageId,
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error setting primary image:', error);
    return false;
  }
}

/**
 * Delete university image
 */
export async function deleteUniversityImage(imageId, imageUrl) {
  try {
    const urlParts = imageUrl.split('/');
    const bucket = 'university-covers';
    const filePath = urlParts.slice(urlParts.indexOf(bucket) + 1).join('/');

    const { error: storageError } = await supabase.storage
      .from(bucket)
      .remove([filePath]);

    if (storageError) {
      console.error('Error deleting from storage:', storageError);
    }

    const { error: dbError } = await supabase
      .from('university_images')
      .delete()
      .eq('id', imageId);

    if (dbError) throw dbError;
    return true;
  } catch (error) {
    console.error('Error deleting university image:', error);
    throw error;
  }
}

/**
 * Main auto-fill function triggered on tab/input
 */
export async function autoFillUniversityData(universityName) {
  try {
    // Check cache first
    let data = await getUniversityPrefillData(universityName);
    if (data) return data;

    // Prefer Wikipedia + Wikidata for accuracy (no API keys needed)
    const wikiSummary = await fetchUniversityDataFromWikipedia(universityName);
    const wikidata = await fetchUniversityDataFromWikidata(universityName);

    if (wikiSummary || wikidata) {
      const merged = {
        name: (wikiSummary?.name || wikidata?.name || universityName) ?? universityName,
        description: wikiSummary?.description || '',
        website_url: wikidata?.website_url || '',
        location: wikidata?.location || '',
        established: wikidata?.established ?? null,
        student_count: wikidata?.student_count ?? null,
        cover_images: wikiSummary?.cover_images || [],
      };
      data = merged;
    }

    // Try Google as last resort (via proxy if enabled)
    if (!data) {
      data = await fetchUniversityDataFromGoogle(universityName);
    }

    // Fetch images
    if (data && (!data.cover_images || data.cover_images.length === 0)) {
      const commons = await fetchWikimediaImages(data.name || universityName);
      if (commons.length) {
        data.cover_images = commons;
      } else {
        const unsplash = await fetchUnsplashImages(data.name || universityName);
        data.cover_images = unsplash;
      }
    }

    // Cache the result
    if (data) {
      await cacheUniversityPrefillData(universityName, data, 'wikipedia_wikidata');
    }

    return (
      data || {
        name: universityName,
        description: '',
        website_url: '',
        location: '',
        established: null,
        student_count: null,
        cover_images: [],
      }
    );
  } catch (error) {
    console.error('Error auto-filling university data:', error);
    return {
      name: universityName,
      description: '',
      website_url: '',
      location: '',
      established: null,
      student_count: null,
      cover_images: [],
    };
  }
}

/**
 * Get all cached universities for dropdown/autocomplete
 */
export async function getAllCachedUniversities() {
  try {
    const { data, error } = await supabase
      .from('university_prefill_cache')
      .select('university_name')
      .order('university_name');

    if (error) throw error;
    return data?.map(u => u.university_name) || [];
  } catch (error) {
    console.error('Error fetching cached universities:', error);
    return [];
  }
}

/**
 * Debounce utility
 */
function debounce(func, wait) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Frontend integration for auto-fill
 */
export function setupAutoFill(inputElement, resultContainer) {
  inputElement.addEventListener(
    'input',
    debounce(async () => {
      const query = inputElement.value.trim();
      if (query.length < 3) return;

      const suggestions = await searchUniversityNames(query);
      console.log('Suggestions:', suggestions);
      
      const datalist = document.createElement('datalist');
      datalist.id = 'university-suggestions';
      suggestions.forEach(s => {
        const option = document.createElement('option');
        option.value = s.name;
        datalist.appendChild(option);
      });
      inputElement.setAttribute('list', 'university-suggestions');
      inputElement.parentNode.appendChild(datalist);
    }, 300)
  );

  inputElement.addEventListener('keydown', async (event) => {
    if (event.key === 'Tab') {
      event.preventDefault();
      const universityName = inputElement.value.trim();
      if (!universityName) return;

      const data = await autoFillUniversityData(universityName);
      if (data) {
        resultContainer.innerHTML = `
          <h3>${data.name}</h3>
          <p>${data.description || 'No description available'}</p>
          <a href="${data.website_url || '#'}" target="_blank">Website</a>
          <p>Location: ${data.location || 'N/A'}</p>
          <p>Established: ${data.established || 'N/A'}</p>
          <p>Students: ${data.student_count || 'N/A'}</p>
          <div>
            ${data.cover_images
              .map(img => `<img src="${img}" alt="${data.name} campus" width="200" style="margin-right: 10px;" />`)
              .join('')}
          </div>
        `;
      }
    }
  });
}