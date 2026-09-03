// Clear the old cache when this script is loaded
if (typeof window !== 'undefined') {
  // Clear localStorage
  localStorage.removeItem('authors_list_cache_v2');
  localStorage.removeItem('author_enrichment_v1');
  
  // Clear IndexedDB if available
  if (typeof indexedDB !== 'undefined') {
    try {
      const request = indexedDB.deleteDatabase('cacheDB');
      request.onsuccess = () => console.log('IndexedDB cleared');
      request.onerror = () => console.warn('Failed to clear IndexedDB');
    } catch (e) {
      console.warn('Could not clear IndexedDB:', e);
    }
  }
  
  console.log('✅ Cache cleared - Authors will reload from fresh Supabase data');
}
