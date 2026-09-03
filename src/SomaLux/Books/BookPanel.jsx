// src/BookPanel.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient';
import { initializeSession, setupAuthListener } from '../../utils/sessionManager';
import { Download } from './Download';
import { AuthModal } from './AuthModal';
import SubscriptionModal from '../Subscriptions/SubscriptionModal';
import { FaSearch } from 'react-icons/fa';
import {
  FiBook,
  FiFilter,
  FiChevronLeft,
  FiChevronRight,
  FiX,
  FiClock,
  FiShare2,
  FiCopy,
  FiBookmark,
  FiThumbsUp,
  FiMail,
  FiInfo,
  FiLink,
} from 'react-icons/fi';

import {
  SiX,
  SiFacebook,
  SiLinkedin,
  SiWhatsapp,
  SiGoogledrive,
} from 'react-icons/si';
import { motion, AnimatePresence } from 'framer-motion';
import SimpleScrollReader from './SimpleScrollReader';
import { API_URL } from '../../config';
import './BookPanel.css';
import './Admin/admin.css';
import { useNavigate, useLocation } from 'react-router-dom';
import { booksCache } from './utils/cacheManager';
import { perfOptimizer } from './utils/performanceOptimizer';
import { indexedDBCache } from './utils/indexedDBCache';
import { fetchBooksOptimized } from './utils/optimizedQueries';
 

const highlightSearchText = (text, searchText) => {
  const value = String(text || '');
  const query = String(searchText || '').trim();
  if (!query) return value;

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = value.split(new RegExp(`(${escapedQuery})`, 'ig'));
  return parts.map((part, index) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={`${part}-${index}`} className="search-matchBKP">{part}</mark>
      : part
  );
};

export const BookPanel = ({ demoMode = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [books, setBooks] = useState([]);
  const [displayedBooks, setDisplayedBooks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalBooks, setTotalBooks] = useState(0);
  const [pageLoading, setPageLoading] = useState(false);
  const [pageCacheStatus, setPageCacheStatus] = useState({}); // page -> 'cached'|'remote'|'loading'
  const [hasMore, setHasMore] = useState(true);
  const BOOKS_PER_PAGE = 31;
  const [selectedBook, setSelectedBook] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [sortBy, setSortBy] = useState('default');
  const [showWishlist, setShowWishlist] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState(demoMode);
  const [user, setUser] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [checkingSubscription, setCheckingSubscription] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authAction, setAuthAction] = useState('action');
  const [loadingUser, setLoadingUser] = useState(true);
  const [showReader, setShowReader] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [focusedBookId, setFocusedBookId] = useState(null);
  const [focusedBookLoading, setFocusedBookLoading] = useState(false);
  const initialBooksLoadRef = useRef(false);
  const previousSearchTermRef = useRef('');
  const booksFetchesRef = useRef(new Map());

  // Simple network error modal state
  const [showNetworkModal, setShowNetworkModal] = useState(false);
  const [networkRetryPage, setNetworkRetryPage] = useState(1);

  // Sharing modal state
  const [showSharingModal, setShowSharingModal] = useState(false);
  
  // Book Details dropdown state
  const [showDetailsDropdown, setShowDetailsDropdown] = useState(false);
  const detailsRef = useRef(null);

  // Admin notification state
  const [pendingSubmissions, setPendingSubmissions] = useState(0);

  // Bulk download selection state
  const [selectedBooksForDownload, setSelectedBooksForDownload] = useState(new Set());
  const [selectAllBooks, setSelectAllBooks] = useState(false);
  const [bulkDownloadMode, setBulkDownloadMode] = useState(false);
  const [downloadingBooks, setDownloadingBooks] = useState({});

  const CACHE_TTL_MS = 5 * 60 * 1000;

  const withQueryTimeout = async (promise, timeoutMs = 15000, message = 'Query timed out') => {
    let timeoutId = null;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  // ⚡ Debounce search term to avoid excessive filtering on every keystroke
  useEffect(() => {
    if (!user) {
      setDebouncedSearchTerm('');
      setSearchTerm('');
      return undefined;
    }

    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1); // Reset to page 1 on search
    }, 300); // 300ms debounce delay

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Update Open Graph meta tags for sharing
  useEffect(() => {
    if (selectedBook) {
      const bookCover = selectedBook.bookImage || selectedBook.cover_image_url;
      const bookUrl = `${window.location.origin}${window.location.pathname}?id=${selectedBook.id}`;
      
      // Update og:image
      let ogImage = document.querySelector('meta[property="og:image"]');
      if (!ogImage) {
        ogImage = document.createElement('meta');
        ogImage.setAttribute('property', 'og:image');
        document.head.appendChild(ogImage);
      }
      ogImage.setAttribute('content', bookCover);
      
      // Update og:title
      let ogTitle = document.querySelector('meta[property="og:title"]');
      if (!ogTitle) {
        ogTitle = document.createElement('meta');
        ogTitle.setAttribute('property', 'og:title');
        document.head.appendChild(ogTitle);
      }
      ogTitle.setAttribute('content', selectedBook.title);
      
      // Update og:description
      let ogDesc = document.querySelector('meta[property="og:description"]');
      if (!ogDesc) {
        ogDesc = document.createElement('meta');
        ogDesc.setAttribute('property', 'og:description');
        document.head.appendChild(ogDesc);
      }
      ogDesc.setAttribute('content', `Check out "${selectedBook.title}" by ${selectedBook.author || 'Unknown Author'}`);
      
      // Update og:url
      let ogUrl = document.querySelector('meta[property="og:url"]');
      if (!ogUrl) {
        ogUrl = document.createElement('meta');
        ogUrl.setAttribute('property', 'og:url');
        document.head.appendChild(ogUrl);
      }
      ogUrl.setAttribute('content', bookUrl);
    }
  }, [selectedBook]);

/*************  ✨ Windsurf Command ⭐  *************/
/**
 * Retrieves a cached page of books from localStorage.
 * @param {number} page The page number to retrieve.
 * @returns {null|object[]} The cached page of books, or null if it does not exist or has expired.
 */
/*******  4b59b5d0-5dd5-4852-b3b1-1400d5e8e97c  *******/
  const getCachedPage = (page) => {
    try {
      const raw = localStorage.getItem(`books_page_${page}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.data || !parsed.ts) return null;
      if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
      return parsed.data;
    } catch {
      return null;
    }
  };

  const setCachedPage = (page, data) => {
    try {
      localStorage.setItem(`books_page_${page}` , JSON.stringify({ ts: Date.now(), data }));
      const pages = JSON.parse(localStorage.getItem('books_pages_loaded') || '[]');
      if (!pages.includes(page)) {
        const next = [...pages, page].sort((a,b) => a-b);
        localStorage.setItem('books_pages_loaded', JSON.stringify(next));
      }
    } catch {}
    // mark page cached - tracking removed
    // setPageCacheStatus(prev => ({ ...prev, [page]: 'cached' }));
  };

  const setSearchCachedPage = (term, page, data) => {
    try {
      const key = `search_cache_${term.toLowerCase()}_page_${page}`;
      localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
      // Cache status tracking removed
    } catch {}
  };

  // Prefetch helper: tries link prefetch + background fetch to warm CDN/cache
  const prefetchResource = (url) => {
    try {
      if (!url) return;
      if (typeof window === 'undefined') return;
      window.__prefetched = window.__prefetched || new Set();
      if (window.__prefetched.has(url)) return;
      window.__prefetched.add(url);

      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = url;
      // for PDFs/large docs allow crossOrigin
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);

      // fire-and-forget fetch to prime browser cache (may be CORS-limited)
      try {
        fetch(url, { method: 'GET', mode: 'cors', cache: 'force-cache' }).catch(() => {});
      } catch (e) {}
    } catch (e) {
      // noop
    }
  };

  const clearBookCaches = () => {
    try {
      booksCache.clear();
    } catch (err) {
      console.warn('Failed to clear booksCache', err);
    }
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (key === 'books_pages_loaded' || key.startsWith('books_page_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch (err) {
      console.warn('Failed to clear page caches from localStorage', err);
    }
    try {
      setPageCacheStatus({});
      // Cache tracking removed
    } catch {}
  };

  const [wishlist, setWishlist] = useState(() => {
    try {
      const saved = localStorage.getItem('bookWishlist');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Failed to parse wishlist from localStorage', error);
      return [];
    }
  });

  // ⚡ Memoized inline styles to prevent object recreation on every render (critical for perf)
  const modalStyles = useMemo(() => ({
    overlay: { position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', zIndex: 1100 },
    modal: { width: 360, background: '#0b1220', color: '#e6eef7', padding: 20, borderRadius: 8, boxShadow: '0 8px 30px rgba(0,0,0,0.6)', textAlign: 'center' },
    title: { margin: 0, marginBottom: 8 },
    description: { margin: 0, marginBottom: 18, color: '#9ca3af' },
    buttonGroup: { display: 'flex', gap: 8, justifyContent: 'center' },
    loadingContainer: { minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    loadingText: { color: '#6b7280', fontSize: 14 },
    paginationContainer: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '24px', marginBottom: '20px' },
    paginationText: { fontSize: '13px', fontWeight: '500', color: '#666', minWidth: '80px', textAlign: 'center' },
  }), []);

  // Map a Supabase row to current UI shape
  const mapRowToUi = (row) => {
    
    // Improved "New" badge logic
    const isNew = (() => {
      const created = row.created_at ? new Date(row.created_at) : null;
      if (!created) return false;
      
      const daysSinceCreation = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
      
      // Not new if older than 14 days
      if (daysSinceCreation > 14) return false;
      
      // Within 7 days - always show as new
      if (daysSinceCreation <= 7) return true;
      
      return true;
    })();
    
    // Use actual rating from database (0 for new books without ratings)
    const rating = row.rating !== null && row.rating !== undefined ? row.rating : 0;
    const filePath = row.file_url || '';
    const ext = filePath.split('.').pop()?.toLowerCase() || 'pdf';
    // file_url is already a full public URL from the backend
    // Support both full URLs and storage paths
    let publicUrl = null;
    if (filePath) {
      if (/^https?:\/\//.test(filePath)) {
        // Already a full HTTP URL
        publicUrl = filePath;
      } else if (filePath.includes('supabase') || filePath.includes('storage')) {
        // Supabase storage path - construct full URL
        publicUrl = filePath.startsWith('/') ? `https://agirxwnwpxpddaqylucg.supabase.co/storage/v1/object/public${filePath}` : `https://agirxwnwpxpddaqylucg.supabase.co/storage/v1/object/public/${filePath}`;
      } else if (!filePath.startsWith('/')) {
        // Path without leading slash - assume it's in elib-books bucket
        publicUrl = `https://agirxwnwpxpddaqylucg.supabase.co/storage/v1/object/public/elib-books/${filePath}`;
      } else {
        // Path with leading slash - use as-is with public URL
        publicUrl = `https://agirxwnwpxpddaqylucg.supabase.co/storage/v1/object/public${filePath}`;
      }
    }
   return {
  id: row.id,
  title: row.title || '',
  author: row.author || '',
  description: row.description || '',
  year: row.year || null,
  language: row.language || 'Unknown',
  isbn: row.isbn || '',
  bookImage: row.cover_image_url || row.cover_url || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420"%3E%3Crect fill="%23333" width="300" height="420"/%3E%3Ctext x="50%25" y="50%25" font-family="Arial" font-size="24" fill="%23888" text-anchor="middle" dominant-baseline="middle"%3ENo Cover%3C/text%3E%3C/svg%3E',
  rating,
  downloads: row.downloads_count || 0,
  newRelease: isNew,
  downloadUrl: publicUrl || undefined,
  fileFormat: ext,
  pages: row.pages || 0,
  publisher: row.publisher || 'N/A',
};

  };

  const fetchAll = async (forceRefresh = false, page = 1) => {
    const requestKey = `${forceRefresh ? 'refresh' : 'cached'}:${page}`;
    if (booksFetchesRef.current.has(requestKey)) {
      return booksFetchesRef.current.get(requestKey);
    }

    const request = (async () => {
    try {
      // ⚡ TRIPLE-LAYER CACHE CHECK (memory → IndexedDB → network)
      if (!forceRefresh) {
        // Layer 1: Memory cache (instant)
        const memCached = perfOptimizer.getMemoryCache(`books_page_${page}`);
        if (memCached) {
          console.log('🔥 [Layer 1] Memory cache hit!');
          setBooks(page === 1 ? memCached.books : prev => [...prev, ...memCached.books]);
          setTotalBooks(memCached.total);
          setLoading(false);
          return;
        }

        // Layer 2: IndexedDB cache (very fast)
        const idbBooks = await indexedDBCache.loadBooks(page);
        if (idbBooks && idbBooks.length > 0) {
          console.log('🔥 [Layer 2] IndexedDB cache hit!');
          setBooks(page === 1 ? idbBooks : prev => [...prev, ...idbBooks]);
          setTotalBooks(idbBooks.length); // Will refetch count in background
          setLoading(false);
          return;
        }

        // Layer 3: Browser localStorage cache (fast)
        const localBooks = getCachedPage(page);
        if (localBooks) {
          console.log('🔥 [Layer 3] LocalStorage cache hit!');
          setBooks(page === 1 ? localBooks : prev => [...prev, ...localBooks]);
          setLoading(false);
          return;
        }
      }

      // Keep the current catalogue visible while refreshing it in the background.
      setLoading(page === 1 && books.length === 0);

      // 🚀 OPTIMIZED NETWORK FETCH (fastest queries)
      console.log(`📡 Fetching page ${page} from network...`);
      console.log('🔍 Supabase URL:', process.env.REACT_APP_SUPABASE_URL || 'using fallback');
      console.log('🔑 Supabase Key available:', !!process.env.REACT_APP_SUPABASE_ANON_KEY);
      
      // Fetch ALL books sorted by engagement (downloads, views, likes)
      // This ensures books are displayed by highest engagement dynamically
      const result = await withQueryTimeout(
        fetchBooksOptimized(supabase, page, BOOKS_PER_PAGE),
        20000,
        'Book list query timed out while loading the library.'
      );
      
      const { books: rows, totalCount: count, error: fetchError } = result;
      if (fetchError) {
        throw new Error(fetchError);
      }

      const mapped = (rows || []).map(r => mapRowToUi(r));

      // Update UI
      if (page === 1) {
        setBooks(mapped);
      } else {
        setBooks(prev => [...prev, ...mapped]);
      }

      const loadedSoFar = (page - 1) * BOOKS_PER_PAGE + rows.length;
      setHasMore((count || 0) > loadedSoFar);
      setCurrentPage(page);
      setTotalBooks(count || 0);

      // 💾 SAVE TO ALL CACHE LAYERS
      const cacheData = { books: mapped, total: count };
      
      // Memory cache (5 min TTL)
      perfOptimizer.setMemoryCache(`books_page_${page}`, cacheData, 5 * 60 * 1000);
      
      // IndexedDB (24 hour TTL)
      await indexedDBCache.saveBooks(page, mapped, 24);
      
      // LocalStorage
      setCachedPage(page, mapped);


      console.log(`✅ Loaded page ${page}: ${mapped.length} books (Total: ${count})`);
      
    } catch (e) {
      console.error('Failed to fetch books:', e);
      console.error('❌ RAW ERROR:', {
        message: e.message,
        type: e.name,
        toString: e.toString(),
        stack: e.stack
      });
      
      let errorMessage = 'Error loading books:\n\n';
      if (e.message && e.message.includes('Failed to fetch')) {
        errorMessage += '❌ Network Error: Cannot connect to database.\n\n';
        errorMessage += 'Possible causes:\n';
        errorMessage += '1. Supabase project is not accessible\n';
        errorMessage += '2. Check your internet connection\n';
        errorMessage += '3. Verify SUPABASE_URL in .env file\n';
        errorMessage += '4. Check if Supabase project is paused\n\n';
        errorMessage += 'Supabase URL: ' + (process.env.REACT_APP_SUPABASE_URL || 'Using fallback URL');
      } else if (e.message && e.message.includes('JWT')) {
        errorMessage += '❌ Authentication Error: Invalid Supabase key.\n\n';
        errorMessage += 'Please check REACT_APP_SUPABASE_ANON_KEY in your .env file.';
      } else if (e.message && e.message.includes('column')) {
        errorMessage += '❌ Database Schema Error:\n\n';
        errorMessage += e.message + '\n\n';
        errorMessage += 'Please run the database migration scripts.';
      } else {
        errorMessage += e.message || 'Unknown error occurred';
      }

      console.error('📊 Error Details:', {
        message: e.message,
        type: e.name,
        stack: e.stack,
        supabaseUrl: process.env.REACT_APP_SUPABASE_URL || 'fallback URL'
      });

      // Network error handling - modal disabled during startup
      try {
        setNetworkRetryPage(page || 1);
        // Avoid blocking the entire library view with a modal during failed startup fetches.
        // Keep the page usable and allow the user to retry manually if needed.
        setShowNetworkModal(false);
      } catch (modalErr) {
        console.warn('Network modal fallback failed:', modalErr);
      }
    } finally {
      setLoading(false);
    }
    })();

    booksFetchesRef.current.set(requestKey, request);
    try {
      return await request;
    } finally {
      booksFetchesRef.current.delete(requestKey);
    }
  };

  // Auth state listener - optimized to prevent flickering
  useEffect(() => {
    let userCache = null;

    const fetchUserWithRole = async (session) => {
      if (!session?.user) {
        setUser(null);
        setLoadingUser(false);
        return;
      }

      try {
        setLoadingUser(true);

        const ADMIN_EMAILS = ['campuslives254@gmail.com', 'paltechsomalux@gmail.com', 'eliblearning@gmail.com'].map((e) => String(e).trim().toLowerCase());
        const userEmail = String(session.user.email || '').trim().toLowerCase();
        const fallbackRole = ADMIN_EMAILS.includes(userEmail) ? 'admin' : 'user';

        // Fetch profile row safely; if it does not exist, create it from auth metadata.
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('id, email, created_at, last_active_at, subscription_tier, role, display_name, full_name, avatar_url')
          .eq('id', session.user.id)
          .maybeSingle();

        const profileWithFallback = profile || {
          id: session.user.id,
          email: session.user.email,
          role: fallbackRole,
          subscription_tier: 'basic',
          full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
          display_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
          avatar_url: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null,
        };

        if (!profile && !error) {
          supabase
            .from('profiles')
            .upsert({
              id: session.user.id,
              email: session.user.email,
              role: fallbackRole,
              subscription_tier: 'basic',
              full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
              display_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
              avatar_url: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null,
              is_active: true,
              last_active_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }, { onConflict: 'id' })
            .then(({ error: upsertError }) => {
              if (upsertError) console.warn('Profile upsert failed in BookPanel:', upsertError);
            })
            .catch((upsertErr) => {
              console.warn('Profile backfill error in BookPanel:', upsertErr);
            });
        }

        const finalRole = String(profileWithFallback?.role || fallbackRole || 'user').trim().toLowerCase();
        const finalAvatar = profileWithFallback?.avatar_url || session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null;
        const finalDisplayName = profileWithFallback?.full_name || profileWithFallback?.display_name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User';

        if (ADMIN_EMAILS.includes(userEmail) && finalRole !== 'admin') {
          const { error: roleUpdateError } = await supabase
            .from('profiles')
            .update({ role: 'admin', updated_at: new Date().toISOString() })
            .eq('id', session.user.id);
          if (roleUpdateError) console.warn('Role update fallback failed:', roleUpdateError);
        }

        const userData = {
          ...session.user,
          role: finalRole,
          subscription_tier: profileWithFallback?.subscription_tier || 'basic',
          display_name: finalDisplayName,
          avatar_url: finalAvatar,
          avatar: finalAvatar,
          email: session.user.email,
        };
        userCache = userData;
        setUser(userData);
      } catch (error) {
        console.error('Error fetching user role:', error);
        const userData = { ...session.user, role: 'viewer' };
        userCache = userData;
        setUser(userData);
      } finally {
        setLoadingUser(false);
      }
    };

    // Initialize session with cache-first approach
    (async () => {
      try {
        // Try to restore from cache instantly (no network call)
        const cachedSession = await initializeSession(supabase);
        if (cachedSession) {
          console.log('✓ Session restored from cache (instant)');
          fetchUserWithRole(cachedSession);
        } else {
          console.log('ℹ No cached session, user will be prompted to login');
          setLoadingUser(false);
        }
      } catch (err) {
        console.error('Session initialization failed:', err);
        setLoadingUser(false);
      }
    })();

    // Setup auth listener for ongoing changes
    const subscription = setupAuthListener(supabase, (_event, session) => {
      fetchUserWithRole(session);
    });

    // Setup realtime listener for profile changes (e.g., role updates)
    let profileSubscription = null;
    if (user?.id) {
      profileSubscription = supabase
        .channel(`public:profiles:id=eq.${user.id}`)
        .on('postgres_changes', 
          { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'profiles',
            filter: `id=eq.${user.id}`
          },
          (payload) => {
            console.log('[BookPanel] Profile updated:', payload);
            if (payload.new?.role) {
              // Refresh user with new role data
              setUser(prev => ({
                ...prev,
                role: payload.new.role,
                subscription_tier: payload.new.subscription_tier || prev?.subscription_tier
              }));
              userCache = { ...userCache, role: payload.new.role, subscription_tier: payload.new.subscription_tier };
            }
          }
        )
        .subscribe();
    }

    return () => {
      if (subscription?.unsubscribe && typeof subscription.unsubscribe === 'function') {
        try { subscription.unsubscribe(); } catch (e) {}
      }
      if (profileSubscription?.unsubscribe && typeof profileSubscription.unsubscribe === 'function') {
        try { profileSubscription.unsubscribe(); } catch (e) {}
      }
    };
  }, []);

  const fetchSubscription = useCallback(async (currentUser) => {
    setSubscription(null);
    setCheckingSubscription(false);
  }, []);

  // Bulk download functions
  const toggleBookSelection = (bookId) => {
    const newSelected = new Set(selectedBooksForDownload);
    if (newSelected.has(bookId)) {
      newSelected.delete(bookId);
    } else {
      newSelected.add(bookId);
    }
    setSelectedBooksForDownload(newSelected);
    setSelectAllBooks(newSelected.size === displayedBooks.length && displayedBooks.length > 0);
  };

  const toggleSelectAllBooks = () => {
    if (selectAllBooks) {
      setSelectedBooksForDownload(new Set());
      setSelectAllBooks(false);
    } else {
      const allIds = new Set(displayedBooks.map(b => b.id));
      setSelectedBooksForDownload(allIds);
      setSelectAllBooks(true);
    }
  };

  const downloadSelectedBooks = async () => {
    if (selectedBooksForDownload.size === 0) return;

    const booksToDownload = displayedBooks.filter(b => selectedBooksForDownload.has(b.id));
    
    for (const book of booksToDownload) {
      // Use the existing Download component logic
      setDownloadingBooks(prev => ({ ...prev, [book.id]: true }));
      
      try {
        // Create a temporary download element
        const link = document.createElement('a');
        link.href = book.downloadUrl;
        link.download = `${book.title.replace(/\s+/g, '_')}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (error) {
        console.error(`Failed to download ${book.title}:`, error);
      } finally {
        setDownloadingBooks(prev => ({ ...prev, [book.id]: false }));
      }

      // Add delay between downloads to avoid browser overload
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  const cancelBulkDownload = () => {
    setSelectedBooksForDownload(new Set());
    setSelectAllBooks(false);
    setBulkDownloadMode(false);
  };

  // The book catalogue is public, so load it independently of authentication.
  useEffect(() => {
    if (initialBooksLoadRef.current) return;
    initialBooksLoadRef.current = true;
    console.log('📚 Starting initial books load');
    fetchAll();
  }, []);

  // Initial load + realtime subscription with polling fallback
  useEffect(() => {
    let poller = null;
    let channel = null;
    try {
      channel = supabase
        .channel('public:books')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'books' }, (payload) => {
          console.log('📡 Real-time update: books table changed', payload.eventType);
          // Invalidate cache and force refresh (DON'T reset page)
          booksCache.remove('all_books_page_1');
          booksCache.remove('total_books_count');
          fetchAll(true, currentPage);
        })
        .subscribe((status) => {
          console.log('📡 Subscription status:', status);
          if (status === 'SUBSCRIBED') {
            console.log('✅ Real-time subscription active');
            if (poller) { clearInterval(poller); poller = null; }
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn('⚠️ Real-time subscription failed, using polling');
            if (poller) { clearInterval(poller); poller = null; }
          }
        });
    } catch (err) {
      console.warn('Realtime unavailable, falling back to polling.', err);
      if (poller) { clearInterval(poller); poller = null; }
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
      if (poller) clearInterval(poller);
    };
  }, [user?.id, loadingUser]);

  useEffect(() => {
    try {
      localStorage.setItem('bookWishlist', JSON.stringify(wishlist));
      // Notify other components (especially Profile.js) that wishlist changed
      try {
        window.dispatchEvent(new CustomEvent('wishlistChanged', { detail: { count: wishlist.length, updatedAt: Date.now() } }));
      } catch (err) {}
    } catch (error) {
      console.error('Failed to save wishlist to localStorage', error);
    }
  }, [wishlist]);

  useEffect(() => {
    if (user && !loadingUser) {
      fetchSubscription(user);
    }
  }, [user, loadingUser, fetchSubscription]);

  // Background prefetch: after first page loads, prefetch next pages to make Show More instant
  useEffect(() => {
    if (loading) return;
    if (!hasMore) return;
    // Prefetch up to first 3 pages total, without spamming network
    const pagesLoaded = Math.ceil(books.length / BOOKS_PER_PAGE) || 0;
    const targetPages = Math.min(3, Math.ceil((totalBooks || 0) / BOOKS_PER_PAGE));
    const fetchNext = async () => {
      for (let p = pagesLoaded + 1; p <= targetPages; p++) {
        // Skip if this page is already cached in localStorage
        if (getCachedPage(p)) continue;
        await fetchAll(false, p);
        // If no longer more pages, stop
        if (!hasMore) break;
      }
    };
    fetchNext();
  }, [loading, books.length, hasMore, totalBooks]);

  // Disable initial animations until after first mount to prevent flicker
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  // Read query params for single-book deep links (bookmarkable link)
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search || '');
      const bid = params.get('book');
      if (bid) {
        // For a direct book link, clear any previous filters/search so we don't hide the book
        setFocusedBookId(bid);
        setSearchTerm('');
        setActiveFilter('all');
        setCurrentPage(1);
        setWelcomeMessage(false);
      }
    } catch (err) {
      // ignore
    }
  }, [location.search]);

  // When a focused book id is provided via query param, ensure that book exists in local state
  useEffect(() => {
    if (!focusedBookId) return;

    // If we already have this book loaded, no need to fetch
    const alreadyLoaded = books.some(b => String(b.id) === String(focusedBookId));
    if (alreadyLoaded) {
      setFocusedBookLoading(false);
      return;
    }

    let mounted = true;
    (async () => {
      try {
        setFocusedBookLoading(true);
        // Fetch the single book row by id
        const { data: row, error } = await supabase
          .from('books')
          .select('id, title, author, description, year, language, isbn, cover_image_url, file_url, created_at, downloads_count, pages, publisher, rating, rating_count')
          .eq('id', focusedBookId)
          .maybeSingle();

        if (error) {
          console.warn('BookPanel: failed to fetch focused book by id', focusedBookId, error);
          return;
        }
        if (!row) {
          console.warn('BookPanel: no book found for id', focusedBookId);
          return;
        }

        const mapped = mapRowToUi(row, 50);

        if (!mounted) return;

        // Merge into books state if not present
        setBooks(prev => {
          const exists = (prev || []).some(b => String(b.id) === String(mapped.id));
          if (exists) return prev;
          return [mapped, ...(prev || [])];
        });
      } catch (err) {
        console.error('BookPanel: error ensuring focused book is loaded', err);
      } finally {
        if (mounted) setFocusedBookLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [focusedBookId, books]);

  const filteredBooks = useMemo(() => {
    const source = books;
    // Deduplicate by book ID to prevent React key warnings
    const seenIds = new Set();
    let result = source.filter(book => {
      if (seenIds.has(book.id)) {
        return false; // Skip duplicate
      }
      seenIds.add(book.id);
      return true;
    });

    // If a focused book id was provided (e.g. via ?book= in the URL), only show that book
    if (focusedBookId) {
      result = result.filter(book => String(book.id) === String(focusedBookId));
    }

    if (debouncedSearchTerm) {
      const query = debouncedSearchTerm.toLowerCase();
      result = result.filter(book =>
        (book.title || '').toLowerCase().includes(query) ||
        (book.author || '').toLowerCase().includes(query) ||
        (book.description || '').toLowerCase().includes(query)
      );
    }

    if (activeFilter === 'new') {
      result = result.filter(book => book.newRelease);
    } else if (activeFilter === 'wishlist') {
      result = result.filter(book => wishlist.includes(book.id));
    }

    if (sortBy === 'title') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'author') {
      result.sort((a, b) => a.author.localeCompare(b.author));
    } else if (sortBy === 'year') {
      result.sort((a, b) => b.year - a.year);
    }

    return result;
  }, [books, debouncedSearchTerm, activeFilter, sortBy, wishlist, focusedBookId]);

  useEffect(() => {
    // Show the current page slice
    const start = (currentPage - 1) * BOOKS_PER_PAGE;
    setDisplayedBooks(filteredBooks.slice(start, start + BOOKS_PER_PAGE));
  }, [filteredBooks, currentPage]);

  // Server-side search fetch (paginated) to provide accurate results when searching
  const fetchSearch = async (term, page = 1) => {
    try {
      setPageLoading(page !== 1);
      setLoading(page === 1);

      const from = (page - 1) * BOOKS_PER_PAGE;
      const to = from + BOOKS_PER_PAGE - 1;
      const q = term.trim();

      // Count matching rows
      const countRes = await supabase
        .from('books')
        .select('*', { count: 'exact', head: true })
        .or(`title.ilike.%${q}%,author.ilike.%${q}%,description.ilike.%${q}%,isbn.ilike.%${q}%`);

      const total = countRes.count || 0;
      setTotalBooks(total);

      const { data: rows } = await supabase
        .from('books')
        .select('id, title, author, description, year, language, isbn, cover_image_url, file_url, created_at, downloads_count, pages, publisher, rating, rating_count')
        .or(`title.ilike.%${q}%,author.ilike.%${q}%,description.ilike.%${q}%,isbn.ilike.%${q}%`)
        .range(from, to);
      
      const mapped = (rows || []).map(r => mapRowToUi(r));

      // Replace books with search results (only pages loaded)
      if (page === 1) {
        setBooks(mapped);
      } else {
        setBooks(prev => {
          // ensure pages are merged in order
          const copy = [...prev];
          // append new mapped entries
          return [...copy, ...mapped];
        });
      }

      setHasMore((total || 0) > (page * BOOKS_PER_PAGE));
      setCurrentPage(page);
      setCachedPage(page, mapped);

    } catch (err) {
      console.error('Search fetch failed', err);
    } finally {
      setPageLoading(false);
      setLoading(false);
    }
  };

  // Debounced search effect: when searchTerm changes, perform server-side search
  useEffect(() => {
    const term = (searchTerm || '').trim();
    if (!user) return undefined;

    if (!term) {
      // The initial catalogue load already handles an empty search.
      if (previousSearchTermRef.current) fetchAll(true, 1);
      previousSearchTermRef.current = '';
      return;
    }

    previousSearchTermRef.current = term;

    const id = setTimeout(() => {
      // For short terms (<2) avoid querying
      if (term.length < 2) return;
      fetchSearch(term, 1);
    }, 300);

    return () => clearTimeout(id);
  }, [searchTerm, user]);

  // Background search fetch that stores results in cache without touching UI state
  const fetchSearchBackground = async (term, page = 1) => {
    try {
      const from = (page - 1) * BOOKS_PER_PAGE;
      const q = term.trim();
      // Use direct query search
      const { data: rows } = await supabase
        .from('books')
        .select('id, title, author, description, year, language, isbn, cover_image_url, file_url, created_at, downloads_count, pages, publisher, rating, rating_count')
        .or(`title.ilike.%${q}%,author.ilike.%${q}%,description.ilike.%${q}%,isbn.ilike.%${q}%`)
        .range(from, from + BOOKS_PER_PAGE - 1);
      
      const mapped = (rows || []).map(r => mapRowToUi(r));
      setSearchCachedPage(term, page, mapped);
      return mapped;
    } catch (err) {
      return null;
    }
  };

  const handlePageChange = async (page) => {
    if (page < 1) return;
    const totalCountForPaging = totalBooks || filteredBooks.length;
    const computedTotalPages = Math.max(1, Math.ceil((totalCountForPaging) / BOOKS_PER_PAGE));
    if (page > computedTotalPages) return;
    setCurrentPage(page);
    // Ensure the page data is loaded (use cache if available) — skip network fetch when paginating filtered results
    try {
      if (searchTerm && searchTerm.trim().length >= 2) {
        // If searching, fetch the page using search
        await fetchSearch(searchTerm.trim(), page);
      } else {
        const cached = getCachedPage(page);
        if (!cached) {
          setPageLoading(true);
          await fetchAll(false, page);
        } else {
          // If cached exists, ensure books state contains that page so filteredBooks slicing works
          setBooks(prev => {
            // merge cached page into prev if not present
            const ids = new Set(prev.map(b => b.id));
            const toAdd = cached.filter(b => !ids.has(b.id));
            return [...prev, ...toAdd];
          });
        }
      }
    } catch (err) {
      console.warn('Failed to ensure page data', err);
    } finally {
      setPageLoading(false);
    }

    // Scroll to top of the grid for better UX
    const grid = document.querySelector('.gridBKP');
    if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Note: No infinite scroll. Background fetch can still occur via realtime or manual triggers.

  const viewBookDetails = async (book) => {
    if (!requireAuth('view')) return;
    setSelectedBook(book);
    setWelcomeMessage(false);

  };
  const handleSortChange = (sortType) => {
    setSortBy(sortType);
    setCurrentPage(1);
    setWelcomeMessage(false);
  };

  const toggleFilters = () => {
    setShowFilters(prev => !prev);
  };

  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
    setShowFilters(false);
    setCurrentPage(1);
    setWelcomeMessage(false);
  };

  const closeDetails = () => {
    setSelectedBook(null);
  };

  // Close details dropdown when clicking outside
  useEffect(() => {
    if (!showDetailsDropdown) return;

    const handleClickOutside = (event) => {
      if (detailsRef.current && !detailsRef.current.contains(event.target)) {
        setShowDetailsDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDetailsDropdown]);

  const requireAuth = (action) => {
    // Don't show modal while auth is loading - wait for verification
    if (loadingUser) {
      return false;
    }
    if (!user) {
      setAuthAction(action);
      setShowAuthModal(true);
      return false;
    }
    return true;
  };

  const toggleWishlist = (bookId) => {
    setWishlist(prev => {
      const newWishlist = prev.includes(bookId)
        ? prev.filter(id => id !== bookId)
        : [...prev, bookId];
      return newWishlist;
    });
    // Emit custom event so Profile.js can update
    try {
      window.dispatchEvent(new CustomEvent('wishlistChanged', { detail: { updatedAt: Date.now() } }));
    } catch (err) {}
  };

  const handleReadClick = async () => {
    if (!requireAuth('read')) return;
    setShowReader(true);
  };

  const handleShare = async (method, book) => {
    if (!book) return;
    
    // Ensure cover image URL is absolute
    let coverImageUrl = book.bookImage || book.cover_image_url || '';
    if (coverImageUrl && !coverImageUrl.startsWith('http')) {
      // If it's relative, make it absolute
      coverImageUrl = `${window.location.origin}${coverImageUrl.startsWith('/') ? '' : '/'}${coverImageUrl}`;
    }
    if (!coverImageUrl.startsWith('http')) {
      // Fallback to a default
          coverImageUrl = `${window.location.origin}/somalux-logo.svg`;
    }
    
    // Use OG endpoint for proper meta tag serving to social platforms
    const ogUrl = `${window.location.origin}/api/og?type=book&id=${book.id}&title=${encodeURIComponent(book.title)}&image=${encodeURIComponent(coverImageUrl)}&description=${encodeURIComponent(`Check out "${book.title}" by ${book.author || 'Unknown Author'}`)}`;
    
    // Fallback URL for direct sharing
    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    const directUrl = `${baseUrl}?id=${book.id}`;
    const text = `Check out "${book.title}" by ${book.author}`;
    
    try {
      switch (method) {
        case 'copy': {
          if (navigator.clipboard) {
            await navigator.clipboard.writeText(`${text}\n${directUrl}`);
            alert('Link copied to clipboard');
          } else {
            const input = document.createElement('input');
            input.value = `${text}\n${directUrl}`;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            alert('Link copied to clipboard');
          }
          break;
        }
        case 'twitter':
          window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(ogUrl)}&hashtags=books,reading`,`_blank`,`noopener,noreferrer`);
          break;
        case 'facebook':
          window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(ogUrl)}`,`_blank`,`noopener,noreferrer`);
          break;
        case 'linkedin':
          window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(ogUrl)}`,`_blank`,`noopener,noreferrer`);
          break;
        case 'email':
          window.open(`mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(`${text}\n\n${ogUrl}\n\n`)}`);
          break;
        case 'whatsapp':
          // Send only URL - WhatsApp will show preview with image automatically
          window.open(`https://wa.me/?text=${encodeURIComponent(ogUrl)}`,`_blank`,`noopener,noreferrer`);
          break;
        case 'googledrive':
          // Open Google Drive in new window
          window.open(`https://drive.google.com/`,`_blank`,`noopener,noreferrer`);
          // Copy link to clipboard for user to save manually
          if (navigator.clipboard) {
            await navigator.clipboard.writeText(`${text}\n${ogUrl}`);
          }
          break;
        default:
          break;
      }
    } catch (err) {
      console.error('Share failed', err);
    }
  };

  const wishlistBooks = useMemo(() => {
    return books.filter(book => wishlist.includes(book.id));
  }, [books, wishlist]);

  return (
    <div className="containerBKP">
      {/* Ads Banner */}
      
      {/* Inline overrides: compact horizontal padding for small screens */}
      <style>{`
        .containerBKP{padding-left:12px;padding-right:12px}
        .headerBKP{margin-bottom:0}
        .controlsBKP{margin-bottom:0.5rem;margin-top:-0.5rem}
        @media (max-width: 768px){
          .containerBKP{padding-left:8px;padding-right:8px}
          .controlsBKP{padding-left:0;padding-right:0}
          .search-containerBKP{padding-left:0;padding-right:0}
          .filter-wrapperBKP{gap:8px}
          .modal-contentBKP{margin-left:8px;margin-right:8px;width:calc(100% - 16px)}
          .recommendations-panelBKP,.wishlist-panelBKP{left:8px;right:8px;width:calc(100% - 16px)}
        }
        @media (max-width: 420px){
          .containerBKP{padding-left:6px;padding-right:6px}
          .modal-contentBKP{margin-left:6px;margin-right:6px;width:calc(100% - 12px)}
          .recommendations-panelBKP,.wishlist-panelBKP{left:6px;right:6px;width:calc(100% - 12px)}
          .titleBKP{font-size:1.1rem}
          .controlsBKP{padding-left:0;padding-right:0}
        }
      `}</style>
      {/* Network error modal */}
      {showNetworkModal && (
        <div style={modalStyles.overlay}>
          <div style={modalStyles.modal}>
            <h3 style={modalStyles.title}>Please check your network</h3>
            <p style={modalStyles.description}>Unable to connect. Please verify your internet connection and try again.</p>
            <div style={modalStyles.buttonGroup}>
              <button className="btn" onClick={() => setShowNetworkModal(false)}>Close</button>
              <button
                className="btn primary"
                onClick={async () => {
                  setShowNetworkModal(false);
                  setLoading(true);
                  try {
                    clearBookCaches();
                    await fetchAll(true, networkRetryPage || 1);
                  } catch (err) {
                    console.error('Retry failed', err);
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}
      {welcomeMessage && (
        <motion.div
          className="welcome-bannerBKP"
          initial={isMounted ? { opacity: 0, y: -12 } : false}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div className="welcome-contentBKP">
            <h3>Welcome to the Book Library!</h3>
            <p>Discover your next favorite read</p>
            <button
              className="close-welcomeBKP"
              onClick={() => setWelcomeMessage(false)}
            >
              <FiX size={18} />
            </button>
          </div>
        </motion.div>
      )}

      <div className="controlsBKP">
        <div className="search-containerBKP">
          <span className="search-iconBKP" aria-hidden="true">
            <FaSearch size={14} />
          </span>
          <input
            type="text"
            placeholder="Search books by title or author..."
            value={searchTerm}
            inputMode="search"
            enterKeyHint="search"
            onFocus={(e) => {
              if (!loadingUser && !user) {
                e.currentTarget.blur();
                requireAuth('search');
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            onChange={(e) => {
              if (!user) return;
              setSearchTerm(e.target.value);
              setWelcomeMessage(false);
            }}
            className="search-inputBKP"
            autoComplete="off"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="clear-buttonBKP"
            >
              <FiX size={16} />
            </button>
          )}
        </div>

        <div className="filter-wrapperBKP">
          <button
            onClick={toggleFilters}
            className={`filter-buttonBKP ${showFilters ? 'activeBKP' : ''}`}
            style={{ display: 'none' }}
          >
            <FiFilter /> {activeFilter !== 'all' && '• '}Filters
          </button>

          {((user?.role === 'admin' || user?.role === 'editor') || ['campuslives254@gmail.com', 'paltechsomalux@gmail.com', 'eliblearning@gmail.com'].includes(user?.email)) && (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <button
                onClick={() => navigate('/books/admin')}
                className="filter-buttonBKP"
                title="Open Admin Dashboard"
              >
                {user?.role === 'admin' || ['campuslives254@gmail.com', 'paltechsomalux@gmail.com', 'eliblearning@gmail.com'].includes(user?.email) ? 'Admin' : 'Editor'}
              </button>
              {pendingSubmissions > 0 && (
                <div style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  background: '#ea4335',
                  color: '#fff',
                  borderRadius: '50%',
                  width: 20,
                  height: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: '600',
                  border: '2px solid #0b1216'
                }}>
                  {pendingSubmissions > 99 ? '99+' : pendingSubmissions}
                </div>
              )}
            </div>
          )}

          {showFilters && (
            <div className="filter-dropdownBKP" style={{ display: 'none' }}>
              <div className="filter-sectionBKP">
                <h4>Filter by:</h4>
                <div
                  className={`filter-optionBKP ${activeFilter === 'all' ? 'activeBKP' : ''}`}
                  onClick={() => handleFilterChange('all')}
                >
                  All Books
                </div>
                <div
                  className={`filter-optionBKP ${activeFilter === 'new' ? 'activeBKP' : ''}`}
                  onClick={() => handleFilterChange('new')}
                >
                  New Releases
                </div>
                <div
                  className={`filter-optionBKP ${activeFilter === 'wishlist' ? 'activeBKP' : ''}`}
                  onClick={() => handleFilterChange('wishlist')}
                >
                  My Wishlist
                </div>
              </div>
              <div className="filter-sectionBKP">
                <h4>Sort by:</h4>
                <div
                  className={`filter-optionBKP ${sortBy === 'default' ? 'activeBKP' : ''}`}
                  onClick={() => handleSortChange('default')}
                >
                  Default
                </div>
                <div
                  className={`filter-optionBKP ${sortBy === 'title' ? 'activeBKP' : ''}`}
                  onClick={() => handleSortChange('title')}
                >
                  Title (A-Z)
                </div>
                <div
                  className={`filter-optionBKP ${sortBy === 'author' ? 'activeBKP' : ''}`}
                  onClick={() => handleSortChange('author')}
                >
                  Author (A-Z)
                </div>
                <div
                  className={`filter-optionBKP ${sortBy === 'year' ? 'activeBKP' : ''}`}
                  onClick={() => handleSortChange('year')}
                >
                  Year (Newest)
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {wishlist.length > 0 && (
        <motion.button
          className="wishlist-toggleBKP"
          onClick={() => setShowWishlist(!showWishlist)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <FiBookmark size={24} />
          <span className="wishlist-countBKP">{wishlist.length}</span>
        </motion.button>
      )}

      <AnimatePresence initial={false}>
        {showWishlist && (
          <motion.div
            className="wishlist-panelBKP"
            initial={{ x: 300 }}
            animate={{ x: 0 }}
            exit={{ x: 300 }}
            transition={{ type: 'spring', damping: 25 }}
          >
            <div className="wishlist-headerBKP">
              <h3 className="wishlist-titleBKP">Your Wishlist</h3>
              <button className="wishlist-close-buttonBKP" onClick={() => setShowWishlist(false)}>
                <FiX size={20} />
              </button>
            </div>

            <div className="wishlist-booksBKP">
              {wishlistBooks.length > 0 ? (
                wishlistBooks.map(book => (
                  <div
                    key={book.id}
                    className="recommendation-itemBKP"
                    onClick={() => {
                      viewBookDetails(book);
                      setShowWishlist(false);
                    }}
                  >
                    <img src={book.bookImage} alt={book.title} className="rec-book-imgBKP" loading="lazy" decoding="async" />
                    <div className="rec-book-infoBKP">
                      <h4 className="rec-book-titleBKP">{book.title}</h4>
                      <p className="rec-book-authorBKP">{book.author}</p>
                      <p className="rec-reasonBKP">
                        <FiBookmark size={12} color="#6366f1" /> In your wishlist
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleWishlist(book.id);
                      }}
                      style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        background: 'rgba(239, 68, 68, 0.9)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'white'
                      }}
                    >
                      <FiX size={14} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="wishlist-emptyBKP">
                  <FiBookmark size={40} color="#6366f1" />
                  <p>Your wishlist is empty</p>
                  <button
                    onClick={() => setShowWishlist(false)}
                    className="browse-books-buttonBKP"
                  >
                    Browse Books
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {displayedBooks.length === 0 && !loading && !pageLoading ? (
        <div className="empty-stateBKP">
          <p>No books available right now.</p>
        </div>
      ) : (
        <>
          <div className="gridBKP">
            <AnimatePresence initial={false}>
              {displayedBooks.map((book, index) => {
                if (index < 0) {
                  return (
                    <React.Fragment key={`ad-position-${index}`}>
                      {/* Grid Ad */}
                      <motion.div
                        key="grid-ad-0"
                        initial={isMounted ? { opacity: 0, y: 12 } : false}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.22 }}
                        layout
                      >
                        <div className="book-cardBKP">
                        </div>
                      </motion.div>
                      
                      {/* Current Book */}
                      <motion.div
                      key={book.id}
                      initial={isMounted ? { opacity: 0, y: 12 } : false}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.22 }}
                      layout
                    >
                    <div
                      className="book-cardBKP"
                      onClick={() => bulkDownloadMode ? toggleBookSelection(book.id) : viewBookDetails(book)}
                      onMouseEnter={() => prefetchResource(book.downloadUrl)}
                      onFocus={() => prefetchResource(book.downloadUrl)}
                      tabIndex={0}
                      style={{ position: 'relative' }}
                    >
                      {/* Bulk Selection Checkbox */}
                      {bulkDownloadMode && (
                        <div style={{
                          position: 'absolute',
                          top: '8px',
                          left: '8px',
                          zIndex: 10,
                          background: 'rgba(0, 0, 0, 0.7)',
                          padding: '8px',
                          borderRadius: '8px',
                          border: selectedBooksForDownload.has(book.id) ? '3px solid #00a884' : '3px solid #374151',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <input
                            type="checkbox"
                            checked={selectedBooksForDownload.has(book.id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleBookSelection(book.id);
                            }}
                            style={{ cursor: 'pointer', width: '22px', height: '22px', accentColor: '#00a884' }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      )}

                      <div className="badge-containerBKP">
                      </div>

                      <img src={book.bookImage} alt={book.title} className="book-coverBKP" loading="lazy" decoding="async" />

                        <div className="card-contentBKP">
                          <h3 className="book-titleBKP">{highlightSearchText(book.title, debouncedSearchTerm)}</h3>
                          <p className="book-authorBKP">by {highlightSearchText(book.author, debouncedSearchTerm)}</p>

                          <div className="book-metaBKP">
                          </div>
                        </div>

                      </div>
                    </motion.div>
                  </React.Fragment>
                  );
                }
                
                // For all other indices, render the book normally
                return (
                  <motion.div
                    key={book.id}
                    initial={isMounted ? { opacity: 0, y: 12 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.22 }}
                    layout
                  >
                    <div
                      className="book-cardBKP"
                      onClick={() => viewBookDetails(book)}
                      onMouseEnter={() => prefetchResource(book.downloadUrl)}
                      onFocus={() => prefetchResource(book.downloadUrl)}
                      tabIndex={0}
                    >
                      <div className="badge-containerBKP">
                      </div>

                      <img src={book.bookImage} alt={book.title} className="book-coverBKP" loading="lazy" decoding="async" />

                      <div className="card-contentBKP">
                        <h3 className="book-titleBKP">{highlightSearchText(book.title, debouncedSearchTerm)}</h3>
                        <p className="book-authorBKP">by {highlightSearchText(book.author, debouncedSearchTerm)}</p>

                        <div className="book-metaBKP">
                        </div>
                      </div>

                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {(() => {
            const totalCountForPaging = totalBooks || filteredBooks.length;
            const computedTotal = Math.max(1, Math.ceil((totalCountForPaging) / BOOKS_PER_PAGE));
            if (computedTotal <= 1) return null;

            return (
              <div>
                <div className="actions" style={{ marginTop: 10, justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                  <button
                    className="btn"
                    disabled={currentPage <= 1}
                    onClick={() => handlePageChange(currentPage - 1)}
                  >
                    ← Prev
                  </button>

                  <span style={{ color: '#cfd8dc', fontSize: 12 }}>
                    Page {currentPage} of {computedTotal}
                  </span>

                  <button
                    className="btn"
                    disabled={currentPage >= computedTotal}
                    onClick={() => handlePageChange(currentPage + 1)}
                  >
                    Next →
                  </button>
                </div>

              </div>
            );
          })()}
        </>
      )}

      <AnimatePresence initial={false}>
        {selectedBook && (
          <motion.div
            className="modal-overlayBKP"
            initial={isMounted ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeDetails}
          >
            <motion.div
              className="modal-contentBKP"
              initial={isMounted ? { scale: 0.98, opacity: 0 } : false}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              transition={{ type: 'tween', duration: 0.16 }}
              onClick={(e) => {
                if (showDetailsDropdown && detailsRef.current && !detailsRef.current.contains(e.target)) {
                  setShowDetailsDropdown(false);
                } else {
                  e.stopPropagation();
                }
              }}
            >
              <button className="close-buttonBKP" onClick={closeDetails}>
                <FiX size={24} />
              </button>

              <div style={{ position: 'relative' }} ref={detailsRef}>
                <button
                  style={{
                    position: 'absolute',
                    top: '1rem',
                    left: '1rem',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 8px',
                    cursor: 'pointer',
                    color: '#64748b',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    zIndex: 1001
                  }}
                  onClick={() => setShowDetailsDropdown(!showDetailsDropdown)}
                  title="View book details"
                >
                  <div style={{ width: '3px', height: '3px', borderRadius: '50%', backgroundColor: '#64748b' }}></div>
                  <div style={{ width: '3px', height: '3px', borderRadius: '50%', backgroundColor: '#64748b' }}></div>
                  <div style={{ width: '3px', height: '3px', borderRadius: '50%', backgroundColor: '#64748b' }}></div>
                </button>
                <AnimatePresence>
                  {showDetailsDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      style={{
                        position: 'absolute',
                        top: '50px',
                        left: '1rem',
                        background: '#0d1621',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '12px 16px',
                        minWidth: '200px',
                        zIndex: 1001,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ borderBottom: '1px solid #1f2c33', paddingBottom: '10px' }}>
                          <div style={{ color: '#8696a0', fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>Pages</div>
                          <div style={{ color: '#e9edef', fontSize: '0.8rem', fontWeight: '500' }}>{selectedBook.pages || 'N/A'}</div>
                        </div>
                        <div style={{ borderBottom: '1px solid #1f2c33', paddingBottom: '10px' }}>
                          <div style={{ color: '#8696a0', fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>Language</div>
                          <div style={{ color: '#e9edef', fontSize: '0.8rem', fontWeight: '500' }}>{selectedBook.language || 'Unknown'}</div>
                        </div>
                        <div>
                          <div style={{ color: '#8696a0', fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>Publisher</div>
                          <div style={{ color: '#e9edef', fontSize: '0.8rem', fontWeight: '500' }}>{selectedBook.publisher || 'N/A'}</div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="modal-headerBKP">
                <h2>{selectedBook.title}</h2>
                <p>by {selectedBook.author}</p>
              </div>

              <div className="modal-bodyBKP" style={{ paddingTop: '0', paddingLeft: '0', paddingRight: '0' }}>
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '0.2rem' }}>
                  <img
                    src={selectedBook.bookImage}
                    alt={selectedBook.title}
                    className="book-coverBKP details-book-coverBKP"
                    loading="lazy"
                    decoding="async"
                    style={{ maxWidth: '600px', width: '100%', height: '500px', objectFit: 'contain', borderRadius: '8px', display: 'block' }}
                  />
                </div>
                <p className="book-descBKP" style={{ margin: '0 1.5rem 0 1.5rem' }}>
                  {selectedBook.description}
                </p>

              </div>

              <div className="modal-actionsBKP">
                <div className="actions-primary-rowBKP">
                  <Download
                    book={selectedBook}
                    variant="full"
                    user={user}
                    onUpgradeClick={() => setShowSubscriptionModal(true)}
                    className="btn-readBKP btn-action-primaryBKP"
                    onDownloadStart={async () => {
                      if (!requireAuth('download')) return false;

                      // Log per-user download (analytics) - with better error handling
                      try {
                        if (user && selectedBook && selectedBook.id) {
                          const downloadRecord = {
                            user_id: user.id,
                            book_id: selectedBook.id,
                            downloaded_at: new Date().toISOString(),
                            user_agent: navigator.userAgent || 'unknown'
                          };

                          const { data, error } = await supabase
                            .from('book_downloads')
                            .insert([downloadRecord])
                            .select();

                          if (error) {
                            console.error('❌ Failed to log book download:', {
                              error: error.message,
                              code: error.code,
                              details: error.details,
                              hint: error.hint,
                              context: { userId: user.id, bookId: selectedBook.id }
                            });
                        } else {
                          console.log('✅ Download logged successfully:', data);
                          
                          // Increment count using the SQL function (bypasses RLS)
                          try {
                            const { data: result, error: rpcError } = await supabase
                              .rpc('increment_book_downloads', { p_book_id: selectedBook.id });
                            
                            if (rpcError) {
                              console.error('❌ RPC increment failed, trying direct update:', {
                                message: rpcError.message,
                                code: rpcError.code,
                                details: rpcError.details
                              });
                              
                              // Fallback: direct update
                              const { data: bookData } = await supabase
                                .from('books')
                                .select('downloads_count')
                                .eq('id', selectedBook.id)
                                .single();
                              
                              const currentCount = bookData?.downloads_count || 0;
                              const newCount = currentCount + 1;
                              
                              const { error: updateError } = await supabase
                                .from('books')
                                .update({ downloads_count: newCount })
                                .eq('id', selectedBook.id);
                              
                              if (updateError) {
                                console.error('❌ Count UPDATE FAILED:', {
                                  message: updateError.message,
                                  code: updateError.code,
                                  details: updateError.details,
                                  status: updateError.status
                                });
                              } else {
                                console.log(`✅ Count incremented (fallback): ${currentCount} → ${newCount}`);
                                setSelectedBook(prev => ({
                                  ...prev,
                                  downloads_count: newCount
                                }));
                              }
                            } else {
                              const newCount = result || (selectedBook.downloads_count || 0) + 1;
                              console.log(`✅ Count incremented (RPC): ${selectedBook.downloads_count || 0} → ${newCount}`);
                              setSelectedBook(prev => ({
                                ...prev,
                                downloads_count: newCount
                              }));
                            }
                          } catch (countError) {
                            console.error('⚠️ Count increment exception:', countError);
                          }
                        }
                      }
                    } catch (error) {
                      console.error('Exception while logging book download:', error);
                    }

                    return true;
                  }}
                />
                  <button
                    onClick={() => toggleWishlist(selectedBook.id)}
                    className={`btn-readBKP btn-action-primaryBKP ${wishlist.includes(selectedBook.id) ? 'activeBKP' : ''}`}
                    title={wishlist.includes(selectedBook.id) ? 'Remove from wishlist' : 'Add to wishlist'}
                  >
                    <FiBookmark
                      size={16}
                      fill={wishlist.includes(selectedBook.id) ? '#6366f1' : 'none'}
                      color={wishlist.includes(selectedBook.id) ? '#6366f1' : '#64748b'}
                    />
                    Mark
                  </button>
                  <button
                    className="btn-readBKP btn-action-primaryBKP"
                    onClick={() => setShowSharingModal(true)}
                    title="Share this book"
                  >
                    <FiShare2 size={16} /> Share
                  </button>
                  <button
                    className="btn-readBKP btn-action-primaryBKP"
                    onClick={handleReadClick}
                    title="Read this book"
                  >
                    <FiBook size={16} /> Read
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {showReader && selectedBook && (
        <SimpleScrollReader
          src={selectedBook.downloadUrl}
          title={selectedBook.title}
          author={selectedBook.author}
          sampleText={selectedBook.sampleText || selectedBook.description}
          onClose={() => setShowReader(false)}
        />
      )}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => setShowAuthModal(false)}
        action={authAction}
      />

      <SubscriptionModal
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        user={user}
        product="books"
        onSubscribed={(sub) => {
          setSubscription(sub);
          setShowSubscriptionModal(false);
        }}
      />

      {/* Sharing Modal */}
      <AnimatePresence>
        {showSharingModal && selectedBook && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSharingModal(false)}
            style={{
              position: 'fixed',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.6)',
              zIndex: 1100,
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#0b1220',
                color: '#e6eef7',
                padding: 48,
                borderRadius: 20,
                boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
                textAlign: 'center',
                maxWidth: '600px',
                width: '85%',
                maxHeight: '90vh',
                position: 'relative',
              }}
            >
              <button
                className="share-modal-btn"
                title="Close"
                onClick={() => setShowSharingModal(false)}
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 12,
                  background: 'transparent',
                  color: '#9ca3af',
                  border: 'none',
                  padding: '0',
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                <FiX size={20} color="#9ca3af" />
              </button>
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ margin: 0, marginBottom: 8, fontSize: 28, fontWeight: 700, color: '#e6eef7' }}>
                  Share "{selectedBook.title}"
                </h3>
              </div>

              {/* Book Cover Image as Clickable Link */}
              <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'center' }}>
                <a 
                  href={`${window.location.origin}${window.location.pathname}?id=${selectedBook.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    borderRadius: 12,
                    overflow: 'hidden',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
                    textDecoration: 'none',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.6)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.4)';
                  }}
                >
                  <img 
                    src={selectedBook.bookImage || selectedBook.cover_image_url} 
                    alt={selectedBook.title}
                    style={{
                      width: 140,
                      height: 200,
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                </a>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 0 }}>
                <button
                  className="share-modal-btn"
                  title="Share on WhatsApp"
                  onClick={() => {
                    handleShare('whatsapp', selectedBook);
                    setShowSharingModal(false);
                  }}
                  style={{
                    background: 'transparent',
                    color: '#e6eef7',
                    border: 'none',
                    padding: '8px 0',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 9,
                    fontWeight: 400,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}
                >
                  <div style={{ background: '#34C759', borderRadius: '8px', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <SiWhatsapp size={30} color="#ffffff" />
                  </div>
                  WhatsApp
                </button>

                <button
                  className="share-modal-btn"
                  title="Share on X"
                  onClick={() => {
                    handleShare('twitter', selectedBook);
                    setShowSharingModal(false);
                  }}
                  style={{
                    background: 'transparent',
                    color: '#e6eef7',
                    border: 'none',
                    padding: '8px 0',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 9,
                    fontWeight: 400,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}
                >
                  <div style={{ background: '#000000', borderRadius: '8px', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <SiX size={26} color="#ffffff" />
                  </div>
                  X
                </button>

                <button
                  className="share-modal-btn"
                  title="Copy Link"
                  onClick={() => {
                    handleShare('copy', selectedBook);
                    setShowSharingModal(false);
                  }}
                  style={{
                    background: 'transparent',
                    color: '#e6eef7',
                    border: 'none',
                    padding: '8px 0',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 9,
                    fontWeight: 400,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}
                >
                  <div style={{ background: '#8B5CF6', borderRadius: '8px', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FiLink size={26} color="#ffffff" />
                  </div>
                  Copy Link
                </button>

                <button
                  className="share-modal-btn"
                  title="Share on Facebook"
                  onClick={() => {
                    handleShare('facebook', selectedBook);
                    setShowSharingModal(false);
                  }}
                  style={{
                    background: 'transparent',
                    color: '#e6eef7',
                    border: 'none',
                    padding: '8px 0',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 9,
                    fontWeight: 400,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}
                >
                  <div style={{ background: '#1877F2', borderRadius: '8px', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <SiFacebook size={26} color="#ffffff" />
                  </div>
                  Facebook
                </button>

                <button
                  className="share-modal-btn"
                  title="Share on LinkedIn"
                  onClick={() => {
                    handleShare('linkedin', selectedBook);
                    setShowSharingModal(false);
                  }}
                  style={{
                    background: 'transparent',
                    color: '#e6eef7',
                    border: 'none',
                    padding: '8px 0',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 9,
                    fontWeight: 400,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}
                >
                  <div style={{ background: '#0A66C2', borderRadius: '8px', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <SiLinkedin size={26} color="#ffffff" />
                  </div>
                  LinkedIn
                </button>

                <button
                  className="share-modal-btn"
                  title="Share via Email"
                  onClick={() => {
                    handleShare('email', selectedBook);
                    setShowSharingModal(false);
                  }}
                  style={{
                    background: 'transparent',
                    color: '#e6eef7',
                    border: 'none',
                    padding: '8px 0',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 9,
                    fontWeight: 400,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}
                >
                  <div style={{ background: '#D44638', borderRadius: '8px', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="#ffffff">
                      <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                    </svg>
                  </div>
                  Email
                </button>

                <button
                  className="share-modal-btn"
                  title="Save to Google Drive"
                  onClick={() => {
                    handleShare('googledrive', selectedBook);
                    setShowSharingModal(false);
                  }}
                  style={{
                    background: 'transparent',
                    color: '#e6eef7',
                    border: 'none',
                    padding: '8px 0',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 9,
                    fontWeight: 400,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}
                >
                  <div style={{ background: '#1F2937', borderRadius: '8px', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <SiGoogledrive size={26} color="#ffffff" />
                  </div>
                  Google Drive
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};