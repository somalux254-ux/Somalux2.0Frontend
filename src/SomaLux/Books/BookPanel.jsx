// src/BookPanel.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient';
import { initializeSession, setupAuthListener } from '../../auth/sessionManager';
import { Download } from './Download';
import { AuthModal } from '../../auth/AuthModal';
import SubscriptionModal from '../Subscriptions/SubscriptionModal';
import { FaSearch } from 'react-icons/fa';
import {
  FiBook,
  FiCheck,
  FiChevronDown,
  FiFilter,
  FiChevronLeft,
  FiChevronRight,
  FiX,
  FiBookmark,
} from 'react-icons/fi';

import { motion, AnimatePresence } from 'framer-motion';
import './BookPanel.css';
import { useReaderAudio } from '../contexts/ReaderAudioContext';
import './Admin/admin.css';
import { useNavigate, useLocation } from 'react-router-dom';
import { booksCache } from './utils/cacheManager';
import { perfOptimizer } from './utils/performanceOptimizer';
import { indexedDBCache } from './utils/indexedDBCache';
import { fetchBooksOptimized } from './utils/optimizedQueries';
import { getBookSignedUrl } from './Admin/api';
import { popBackAction, pushBackAction } from '../services/backNavigation';
import { mergeBookCategories } from './defaultBookCategories';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageLoading, setPageLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const BOOKS_PER_PAGE = 20;
  const [selectedBook, setSelectedBook] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [sortBy, setSortBy] = useState('default');
  const [showWishlist, setShowWishlist] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState(demoMode);
  const [user, setUser] = useState(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(() => Boolean(location.state?.reopenAuth));
  const [authAction, setAuthAction] = useState(() => location.state?.authAction || 'action');
  const [loadingUser, setLoadingUser] = useState(true);
  const [openingBookId, setOpeningBookId] = useState(null);
  const [focusedBookId, setFocusedBookId] = useState(null);
  const [categoryFilterId, setCategoryFilterId] = useState(null);
  const [categoryFilterName, setCategoryFilterName] = useState(null);
  const [filteredByCategory, setFilteredByCategory] = useState(null);
  const [categories, setCategories] = useState([]);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const categoryMenuRef = useRef(null);
  const initialBooksLoadRef = useRef(false);
  const previousSearchTermRef = useRef('');
  const booksFetchesRef = useRef(new Map());
  const { openReader, closeReaderView, isReaderOpen } = useReaderAudio();

  // Simple network error modal state
  const [showNetworkModal, setShowNetworkModal] = useState(false);
  const [networkRetryPage, setNetworkRetryPage] = useState(1);

  const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

  const booksRef = useRef(books);
  booksRef.current = books;
  const currentPageRef = useRef(currentPage);
  currentPageRef.current = currentPage;

  const withQueryTimeout = useCallback(async (promise, timeoutMs = 15000, message = 'Query timed out') => {
    let timeoutId = null;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }, []);

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
  }, [searchTerm, user]);

  useEffect(() => {
    let mounted = true;
    supabase
      .from('categories')
      .select('id, name')
      .order('name')
      .then(({ data, error }) => {
        if (error) throw error;
        if (mounted) {
          const merged = mergeBookCategories(data || []);
          setCategories(merged);
        }
      })
      .catch((error) => {
        if (mounted) {
          setCategories(mergeBookCategories([]));
        }
      });

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const closeCategoryMenu = (event) => {
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(event.target)) {
        setCategoryMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', closeCategoryMenu);
    return () => document.removeEventListener('mousedown', closeCategoryMenu);
  }, []);

/*************  ✨ Windsurf Command ⭐  *************/
/**
 * Retrieves a cached page of books from localStorage.
 * @param {number} page The page number to retrieve.
 * @returns {null|object[]} The cached page of books, or null if it does not exist or has expired.
 */
/*******  4b59b5d0-5dd5-4852-b3b1-1400d5e8e97c  *******/
  const getCachedPageEntry = useCallback((page) => {
    try {
      const raw = localStorage.getItem(`books_page_${page}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.data || !parsed.ts) return null;
      if (Date.now() - parsed.ts > CACHE_TTL_MS) {
        localStorage.removeItem(`books_page_${page}`);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }, [CACHE_TTL_MS]);

  const setCachedPage = useCallback((page, data, hasMore = data.length >= BOOKS_PER_PAGE) => {
    try {
      localStorage.setItem(`books_page_${page}`, JSON.stringify({ ts: Date.now(), data, hasMore }));
      const pages = JSON.parse(localStorage.getItem('books_pages_loaded') || '[]');
      if (!pages.includes(page)) {
        const next = [...pages, page].sort((a,b) => a-b);
        localStorage.setItem('books_pages_loaded', JSON.stringify(next));
      }
    } catch {}
  }, [BOOKS_PER_PAGE]);

  const getSearchCachedPage = useCallback((term, page) => {
    try {
      const key = `search_cache_${term.trim().toLowerCase()}_page_${page}`;
      const cached = JSON.parse(localStorage.getItem(key) || 'null');
      if (!cached?.ts || Date.now() - cached.ts > CACHE_TTL_MS) {
        if (cached) localStorage.removeItem(key);
        return null;
      }
      return cached;
    } catch {
      return null;
    }
  }, [CACHE_TTL_MS]);

  const setSearchCachedPage = useCallback((term, page, data, hasMore) => {
    try {
      const key = `search_cache_${term.trim().toLowerCase()}_page_${page}`;
      localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data, hasMore }));
    } catch {}
  }, []);

  const clearBookCaches = useCallback(async () => {
    try {
      booksCache.clear();
    } catch  {
    }
    try {
      perfOptimizer.clearAll();
    } catch  {
    }
    await indexedDBCache.clearBooks?.();
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (key === 'books_pages_loaded' || key.startsWith('books_page_') || key.startsWith('search_cache_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch  {
    }
  }, []);

  const [wishlist, setWishlist] = useState(() => {
    try {
      const saved = localStorage.getItem('bookWishlist');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
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
  const mapRowToUi = useCallback((row) => {
    
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
   return {
  id: row.id,
  title: row.title || '',
  author: row.author || '',
  description: row.description || '',
  categoryId: row.category_id ? String(row.category_id) : null,
  genre: row.categories?.name || row.category?.name || 'Uncategorized',
  year: row.year || null,
  language: row.language || 'Unknown',
  isbn: row.isbn || '',
  bookImage: row.cover_image_url || row.cover_url || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420"%3E%3Crect fill="%23333" width="300" height="420"/%3E%3Ctext x="50%25" y="50%25" font-family="Arial" font-size="24" fill="%23888" text-anchor="middle" dominant-baseline="middle"%3ENo Cover%3C/text%3E%3C/svg%3E',
  rating,
  downloads: row.downloads_count || 0,
  newRelease: isNew,
  filePath,
  fileFormat: ext,
  pages: row.pages || 0,
  publisher: row.publisher || 'N/A',
};

  }, []);

  const fetchAll = useCallback(async (forceRefresh = false, page = 1, updatePage = true) => {
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
          setBooks(page === 1 ? memCached.books : prev => [...prev, ...memCached.books]);
          setHasMore(memCached.hasMore ?? true);
          setLoading(false);
          return;
        }

        // Persistent local cache is checked before IndexedDB so repeat visits
        // can paint synchronously without waiting for the database to open.
        const localEntry = getCachedPageEntry(page);
        if (localEntry) {
          setBooks(page === 1 ? localEntry.data : prev => [...prev, ...localEntry.data]);
          setHasMore(localEntry.hasMore ?? localEntry.data.length >= BOOKS_PER_PAGE);
          setLoading(false);
          return;
        }

        // Layer 2: IndexedDB cache (very fast)
        const idbBooks = await indexedDBCache.loadBooks(page);
        if (idbBooks && idbBooks.length > 0) {
          setBooks(page === 1 ? idbBooks : prev => [...prev, ...idbBooks]);
          setHasMore(idbBooks.length >= BOOKS_PER_PAGE);
          setLoading(false);
          return;
        }

      }

      // Keep the current catalogue visible while refreshing it in the background.
      setLoading(page === 1 && booksRef.current.length === 0);

      // 🚀 OPTIMIZED NETWORK FETCH (fastest queries)
      
      // Fetch ALL books sorted by engagement (downloads, views, likes)
      // This ensures books are displayed by highest engagement dynamically
      const result = await withQueryTimeout(
        fetchBooksOptimized(supabase, page, BOOKS_PER_PAGE),
        20000,
        'Book list query timed out while loading the library.'
      );
      
      const { books: rows, hasMore: nextHasMore, error: fetchError } = result;
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

      setHasMore(nextHasMore);
      if (updatePage) setCurrentPage(page);

      // 💾 SAVE TO ALL CACHE LAYERS
      const cacheData = { books: mapped, hasMore: nextHasMore };
      
      // Memory cache (5 min TTL)
      perfOptimizer.setMemoryCache(`books_page_${page}`, cacheData, 5 * 60 * 1000);
      
      // IndexedDB (24 hour TTL)
      await indexedDBCache.saveBooks(page, mapped, 24);
      
      // LocalStorage
      setCachedPage(page, mapped, nextHasMore);


      
    } catch (e) {
      

      // Network error handling - modal disabled during startup
      try {
        setNetworkRetryPage(page || 1);
        // Avoid blocking the entire library view with a modal during failed startup fetches.
        // Keep the page usable and allow the user to retry manually if needed.
        setShowNetworkModal(false);
      } catch  {
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
  }, [BOOKS_PER_PAGE, getCachedPageEntry, mapRowToUi, setCachedPage, withQueryTimeout]);

  // Auth state listener - optimized to prevent flickering
  useEffect(() => {
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
            .then(() => undefined, () => undefined);
        }

        const finalRole = String(profileWithFallback?.role || fallbackRole || 'user').trim().toLowerCase();
        const finalAvatar = profileWithFallback?.avatar_url || session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null;
        const finalDisplayName = profileWithFallback?.full_name || profileWithFallback?.display_name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User';

        if (ADMIN_EMAILS.includes(userEmail) && finalRole !== 'admin') {
          await supabase
            .from('profiles')
            .update({ role: 'admin', updated_at: new Date().toISOString() })
            .eq('id', session.user.id);
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
        setUser(userData);
      } catch {
        const userData = { ...session.user, role: 'viewer' };
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
          fetchUserWithRole(cachedSession);
        } else {
          setLoadingUser(false);
        }
      } catch {
        setLoadingUser(false);
      }
    })();

    // Setup auth listener for ongoing changes
    const subscription = setupAuthListener(supabase, (_event, session) => {
      fetchUserWithRole(session);
    });

    return () => {
      if (subscription?.unsubscribe && typeof subscription.unsubscribe === 'function') {
        try { subscription.unsubscribe(); } catch (e) {}
      }
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return undefined;

    const profileSubscription = supabase
      .channel(`public:profiles:id=eq.${user.id}`)
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          if (payload.new?.role) {
            setUser(prev => ({
              ...prev,
              role: payload.new.role,
              subscription_tier: payload.new.subscription_tier || prev?.subscription_tier
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileSubscription);
    };
  }, [user?.id]);

  // The book catalogue is public, so load it independently of authentication.
  useEffect(() => {
    if (showAuthModal) return;
    if (initialBooksLoadRef.current) return;
    initialBooksLoadRef.current = true;
    fetchAll();
  }, [showAuthModal, fetchAll]);

  // Initial load + realtime subscription with polling fallback
  useEffect(() => {
    if (showAuthModal) return undefined;
    let poller = null;
    let channel = null;
    try {
      channel = supabase
        .channel('public:books')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'books' }, async (payload) => {
          // Invalidate persistent caches and force refresh (DON'T reset page).
          await clearBookCaches();
          fetchAll(true, currentPageRef.current);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            if (poller) { clearInterval(poller); poller = null; }
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            if (poller) { clearInterval(poller); poller = null; }
          }
        });
    } catch (err) {
      if (poller) { clearInterval(poller); poller = null; }
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
      if (poller) clearInterval(poller);
    };
  }, [user?.id, loadingUser, showAuthModal, fetchAll, clearBookCaches]);

  useEffect(() => {
    try {
      localStorage.setItem('bookWishlist', JSON.stringify(wishlist));
      // Notify other components (especially Profile.js) that wishlist changed
      try {
        window.dispatchEvent(new CustomEvent('wishlistChanged', { detail: { count: wishlist.length, updatedAt: Date.now() } }));
      } catch (err) {}
    } catch  {
    }
  }, [wishlist]);

  // Disable initial animations until after first mount to prevent flicker
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  // Read query params for category and single-book deep links.
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search || '');
      const cid = params.get('category');
      const cname = params.get('categoryName');
      const bid = params.get('book');
      if (cid) {
        setCategoryFilterId(cid);
        setCategoryFilterName(cname || null);
        setFilteredByCategory([]);
        setCurrentPage(1);
        setWelcomeMessage(false);
      } else {
        setCategoryFilterId(null);
        setCategoryFilterName(null);
        setFilteredByCategory(null);
      }
      if (bid) {
        setFocusedBookId(bid);
        setCategoryFilterId(null);
        setCategoryFilterName(null);
        setFilteredByCategory(null);
        setSearchTerm('');
        setActiveFilter('all');
        setCurrentPage(1);
        setWelcomeMessage(false);
      }
    } catch (err) {
      // Ignore malformed URL parameters.
    }
  }, [location.search]);

  // When a focused book id is provided via query param, ensure that book exists in local state.
  useEffect(() => {
    if (!focusedBookId) return undefined;
    const alreadyLoaded = books.some(book => String(book.id) === String(focusedBookId));
    if (alreadyLoaded) {
      return undefined;
    }

    let mounted = true;
    (async () => {
      try {
        const { data: row, error } = await supabase
          .from('books')
          .select('id, title, author, description, year, language, isbn, cover_image_url, file_url, created_at, downloads_count, pages, publisher, rating, rating_count')
          .eq('id', focusedBookId)
          .maybeSingle();
        if (error) {
          return;
        }
        if (!row) return;
        const mapped = mapRowToUi(row, 50);
        if (!mounted) return;
        setBooks(prev => {
          const exists = (prev || []).some(book => String(book.id) === String(mapped.id));
          return exists ? prev : [mapped, ...(prev || [])];
        });
      } catch  {
      }
    })();

    return () => { mounted = false; };
  }, [focusedBookId, books, mapRowToUi]);

  // Load all books for a linked category, even when they are outside the current page cache.
  useEffect(() => {
    if (!categoryFilterId) return undefined;

    let mounted = true;
    (async () => {
      try {
        const { data: rows, error } = await supabase
          .from('books')
          .select('id, title, author, description, category_id, cover_image_url, file_url, downloads_count, pages, rating, rating_count, created_at')
          .eq('category_id', categoryFilterId)
          .order('created_at', { ascending: false })
          .limit(1000);

        if (error) throw error;
        if (mounted) setFilteredByCategory((rows || []).map(mapRowToUi));
      } catch (error) {
        if (mounted) setFilteredByCategory([]);
      }
    })();

    return () => { mounted = false; };
  }, [categoryFilterId, mapRowToUi]);

  const filteredBooks = useMemo(() => {
    const source = filteredByCategory !== null ? filteredByCategory : books;
    const seenIds = new Set();
    let result = source.filter(book => {
      if (seenIds.has(book.id)) return false;
      seenIds.add(book.id);
      return true;
    });

    if (focusedBookId) {
      result = result.filter(book => String(book.id) === String(focusedBookId));
    }

    if (categoryFilterId !== null && categoryFilterId !== undefined) {
      result = result.filter(book => String(book.categoryId) === String(categoryFilterId));
    }

    if (debouncedSearchTerm) {
      const query = debouncedSearchTerm.toLowerCase();
      result = result.filter(book =>
        (book.title || '').toLowerCase().includes(query) ||
        (book.author || '').toLowerCase().includes(query) ||
        (book.description || '').toLowerCase().includes(query) ||
        (book.genre || '').toLowerCase().includes(query) ||
        (categories.find(category => String(category.id) === String(book.categoryId))?.name || '').toLowerCase().includes(query)
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
  }, [books, filteredByCategory, debouncedSearchTerm, activeFilter, sortBy, wishlist, categoryFilterId, focusedBookId, categories]);

  const displayedBooks = useMemo(() => {
    const start = (currentPage - 1) * BOOKS_PER_PAGE;
    return filteredBooks.slice(start, start + BOOKS_PER_PAGE);
  }, [filteredBooks, currentPage]);

  // Server-side search fetch (paginated) to provide accurate results when searching
  const fetchSearch = useCallback(async (term, page = 1) => {
    try {
      const cachedSearch = getSearchCachedPage(term, page);
      if (cachedSearch?.data) {
        setBooks(page === 1 ? cachedSearch.data : prev => [...prev, ...cachedSearch.data]);
        setHasMore(cachedSearch.hasMore ?? cachedSearch.data.length >= BOOKS_PER_PAGE);
        setCurrentPage(page);
        setLoading(false);
        setPageLoading(false);
        return;
      }

      setPageLoading(page !== 1);
      setLoading(page === 1);

      const from = (page - 1) * BOOKS_PER_PAGE;
      const to = from + BOOKS_PER_PAGE - 1;
      const q = term.trim();

      const searchFields = 'id, title, author, description, category_id, year, language, isbn, cover_image_url, file_url, created_at, downloads_count, pages, publisher, rating, rating_count';
      const categoryIds = categories
        .filter(category => (category.name || '').toLowerCase().includes(q.toLowerCase()))
        .map(category => category.id);
      // Fetch through one extra row so pagination can reliably detect remaining matches.
      const endRange = to + 1;

      const [textSearchResult, categorySearchResult] = await Promise.all([
        supabase
        .from('books')
        .select(searchFields)
        .or(`title.ilike.%${q}%,author.ilike.%${q}%,description.ilike.%${q}%,isbn.ilike.%${q}%`)
        .range(0, endRange),
        categoryIds.length
          ? supabase.from('books').select(searchFields).in('category_id', categoryIds).order('created_at', { ascending: false }).range(0, endRange)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (textSearchResult.error) throw textSearchResult.error;
      if (categorySearchResult.error) throw categorySearchResult.error;

      const allRows = [...(textSearchResult.data || []), ...(categorySearchResult.data || [])];
      const uniqueRows = Array.from(new Map(allRows.map(row => [row.id, row])).values())
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      const rows = uniqueRows.slice(from, to + 1);
      
      const mapped = rows.slice(0, BOOKS_PER_PAGE).map(r => mapRowToUi(r));

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

      setHasMore(uniqueRows.length > to + 1);
      setCurrentPage(page);
      setSearchCachedPage(term, page, mapped, uniqueRows.length > to + 1);

    } catch  {
    } finally {
      setPageLoading(false);
      setLoading(false);
    }
  }, [BOOKS_PER_PAGE, categories, getSearchCachedPage, mapRowToUi, setSearchCachedPage]);

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
  }, [searchTerm, user, categories, fetchAll, fetchSearch]);

  const handlePageChange = async (page) => {
    if (page < 1) return;
    if (page > currentPage && !requireAuth('next page')) return;
    if (page > currentPage && !hasMore) return;
    setCurrentPage(page);
    // Ensure the page data is loaded (use cache if available) — skip network fetch when paginating filtered results
    try {
      if (searchTerm && searchTerm.trim().length >= 2) {
        // If searching, fetch the page using search
        await fetchSearch(searchTerm.trim(), page);
      } else {
        const cached = getCachedPageEntry(page);
        if (!cached) {
          setPageLoading(true);
          await fetchAll(false, page);
        } else {
          // If cached exists, ensure books state contains that page so filteredBooks slicing works
          setBooks(prev => {
            // merge cached page into prev if not present
            const ids = new Set(prev.map(b => b.id));
            const toAdd = cached.data.filter(b => !ids.has(b.id));
            return [...prev, ...toAdd];
          });
          setHasMore(cached.hasMore ?? cached.data.length >= BOOKS_PER_PAGE);
        }
      }
    } catch  {
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

    // Warm the signed URL while the details modal is open so Read is immediate.
    getBookSignedUrl(book.id)
      .then(signedUrl => {
        setSelectedBook(prev => prev?.id === book.id ? { ...prev, downloadUrl: signedUrl } : prev);
      })
      .catch(error => {
      });

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

  const clearCategoryFilter = () => {
    setCategoryFilterId(null);
    setCategoryFilterName(null);
    setFilteredByCategory(null);
    setCurrentPage(1);
    navigate('/BookManagement', { replace: true });
  };

  const handleCategoryFilterChange = (event) => {
    const categoryId = event.target.value;
    if (!categoryId) {
      clearCategoryFilter();
      return;
    }

    const category = categories.find(item => String(item.id) === categoryId);
    setCategoryFilterId(categoryId);
    setCategoryFilterName(category?.name || null);
    setFilteredByCategory([]);
    setCurrentPage(1);
    navigate(`/BookManagement?category=${encodeURIComponent(categoryId)}&categoryName=${encodeURIComponent(category?.name || '')}`);
    setCategoryMenuOpen(false);
  };

  const handleNativeBack = useCallback(() => {
    if (isReaderOpen) {
      closeReaderView();
      return;
    }
    setSelectedBook(null);
  }, [closeReaderView, isReaderOpen]);

  useEffect(() => {
    if (!selectedBook && !isReaderOpen) return undefined;

    pushBackAction(handleNativeBack);
    return () => popBackAction(handleNativeBack);
  }, [handleNativeBack, selectedBook, isReaderOpen]);

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

    setOpeningBookId(selectedBook?.id || null);
    try {
      const signedUrl = await getBookSignedUrl(selectedBook?.id);
      const bookForReader = selectedBook ? { ...selectedBook, downloadUrl: signedUrl } : null;
      setSelectedBook(bookForReader);
      openReader(bookForReader);
    } catch  {
    } finally {
      setOpeningBookId(null);
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
                    await clearBookCaches();
                    await fetchAll(true, networkRetryPage || 1);
                  } catch  {
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
          <div className="category-filter-wrapperBKP" ref={categoryMenuRef}>
            <button
              type="button"
              className={`category-filterBKP${categoryMenuOpen ? ' activeBKP' : ''}`}
              onClick={() => setCategoryMenuOpen((open) => !open)}
              aria-expanded={categoryMenuOpen}
              aria-haspopup="menu"
              aria-label="Filter books by category"
            >
              <span>{categoryFilterId ? (categoryFilterName || 'Category') : 'All'}</span>
              <FiChevronDown className="category-filter-chevronBKP" size={17} strokeWidth={3} />
            </button>
            {categoryMenuOpen && (
              <div className="category-filter-menuBKP" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className={!categoryFilterId ? 'is-selected' : ''}
                  onClick={() => handleCategoryFilterChange({ target: { value: '' } })}
                >
                  <span>All</span>
                  {!categoryFilterId && <FiCheck size={14} />}
                </button>
                {categories.map(category => (
                  <button
                    type="button"
                    role="menuitem"
                    className={String(categoryFilterId) === String(category.id) ? 'is-selected' : ''}
                    key={category.id}
                    onClick={() => handleCategoryFilterChange({ target: { value: String(category.id) } })}
                  >
                    <span>{category.name}</span>
                    {String(categoryFilterId) === String(category.id) && <FiCheck size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={toggleFilters}
            className={`filter-buttonBKP ${showFilters ? 'activeBKP' : ''}`}
            style={{ display: 'none' }}
          >
            <FiFilter /> {activeFilter !== 'all' && '• '}Filters
          </button>

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
                      onClick={() => viewBookDetails(book)}
                      tabIndex={0}
                      style={{ position: 'relative' }}
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
            if (currentPage === 1 && displayedBooks.length < BOOKS_PER_PAGE) return null;

            return (
              <div>
                <div className="book-pagination-actions" style={{ marginTop: 10 }}>
                  <button
                    className="btn book-pagination-button"
                    disabled={currentPage <= 1}
                    onClick={() => handlePageChange(currentPage - 1)}
                  >
                    <FiChevronLeft size={16} aria-hidden="true" /> Prev
                  </button>

                  <button
                    className="btn book-pagination-button"
                    disabled={!hasMore}
                    onClick={() => handlePageChange(currentPage + 1)}
                  >
                    Next <FiChevronRight size={16} aria-hidden="true" />
                  </button>
                </div>

              </div>
            );
          })()}
        </>
      )}

      {selectedBook && (
          <div
            className="modal-overlayBKP"
            onClick={closeDetails}
          >
            <div
              className="modal-contentBKP"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <button className="close-buttonBKP" onClick={closeDetails}>
                <FiX size={24} />
              </button>

              <div className="modal-headerBKP">
                <h2>{selectedBook.title}</h2>
                <p>by {selectedBook.author}</p>
              </div>

              <div className="modal-bodyBKP" style={{ paddingTop: '0', paddingLeft: '0', paddingRight: '0' }}>
                <div className="details-cover-wrapperBKP" style={{ display: 'block', paddingTop: '0.2rem' }}>
                  <img
                    src={selectedBook.bookImage}
                    alt={selectedBook.title}
                    className="book-coverBKP details-book-coverBKP"
                    loading="lazy"
                    decoding="async"
                    style={{ maxWidth: '600px', width: '100%', height: '500px', objectFit: 'contain', display: 'block' }}
                  />
                </div>
                <p className="book-descBKP" style={{ margin: '0 1.5rem 0 1.5rem' }}>
                  {selectedBook.description}
                </p>

              </div>

              <div className="modal-actionsBKP">
                <div className="actions-primary-rowBKP">
                  {false && (<Download
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

                          const { error } = await supabase
                            .from('book_downloads')
                            .insert([downloadRecord])
                            .select();

                          if (error) {
                        } else {
                          
                          // Increment count using the SQL function (bypasses RLS)
                          try {
                            const { data: result, error: rpcError } = await supabase
                              .rpc('increment_book_downloads', { p_book_id: selectedBook.id });
                            
                            if (rpcError) {
                              
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
                              } else {
                                setSelectedBook(prev => ({
                                  ...prev,
                                  downloads_count: newCount
                                }));
                              }
                            } else {
                              const newCount = result || (selectedBook.downloads_count || 0) + 1;
                              setSelectedBook(prev => ({
                                ...prev,
                                downloads_count: newCount
                              }));
                            }
                          } catch  {
                          }
                        }
                      }
                    } catch  {
                    }

                    return true;
                  }}
                  />)}
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
                    className="btn-readBKP btn-action-primaryBKP read-book-actionBKP"
                    onClick={handleReadClick}
                    disabled={openingBookId === selectedBook.id}
                    aria-busy={openingBookId === selectedBook.id}
                    title="Read this book"
                  >
                    <FiBook size={16} /> {openingBookId === selectedBook.id ? 'Opening...' : 'Read'}
                  </button>
                </div>
              </div>
            </div>
          </div>
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
        onSubscribed={() => {
          setShowSubscriptionModal(false);
        }}
      />
    </div>
  );
};