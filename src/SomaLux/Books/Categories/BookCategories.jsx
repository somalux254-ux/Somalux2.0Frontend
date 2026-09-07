import React, { useState, useEffect, useMemo, useCallback } from 'react';

import { 
  FiBookOpen, 
  FiStar, 
  FiFilter, 
  FiChevronRight,
  FiX,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiSave,
  FiTrendingUp,  
  FiClock
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import './BookCategories.css';
import { API_URL } from '../../../config';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useAdminUI } from '../Admin/AdminUIContext';

const AdBanner = () => null;
const cacheDB = {
  loadCategories: async () => null,
  saveCategories: async () => undefined,
};

export const BookCategories = () => {

  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [displayedCategories, setDisplayedCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(32);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [sortBy, setSortBy] = useState('default');
  const [userProfile, setUserProfile] = useState(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [savingCategory, setSavingCategory] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState({ name: '', description: '' });
  const { confirm, showToast } = useAdminUI();

  // ⚡ Initialize from cache IMMEDIATELY on mount
  useEffect(() => {
    const cacheKey = 'categories_cache_v2';
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const cacheAge = parsed.timestamp ? Date.now() - parsed.timestamp : Infinity;
          if (cacheAge < 24 * 60 * 60 * 1000 && parsed.data?.length > 0) {
            console.log('⚡ Categories instant load from localStorage cache');
            setCategories(parsed.data);
            setDisplayedCategories(parsed.data.slice(0, visibleCount));
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn('localStorage cache error:', e);
        }
      }
    } catch (e) {
      console.warn('localStorage access error:', e);
    }
    
    // Try IndexedDB as fallback
    (async () => {
      try {
        if (!cacheDB || !cacheDB.loadCategories) {
          console.warn('cacheDB not available');
          return;
        }
        const idbCategories = await cacheDB.loadCategories();
        if (idbCategories && idbCategories.length > 0) {
          console.log('⚡ Categories instant load from IndexedDB cache');
          setCategories(idbCategories);
          setDisplayedCategories(idbCategories.slice(0, visibleCount));
          setLoading(false);
        }
      } catch (e) {
        console.warn('IndexedDB cache error:', e);
      }
    })();
  }, [visibleCount]);

  // Fetch user profile on mount
  useEffect(() => {
    (async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user?.id) {
          const { data, error } = await supabase
            .from('profiles')
            .select('subscription_tier')
            .eq('id', authData.user.id)
            .single();
          
          if (!error && data) {
            setUserProfile(data);
          }
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
      }
    })();
  }, []);

  // ⚡ Debounce search term (300ms delay to prevent excessive filtering)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Helper: log category search events to backend for analytics
  const logSearchEvent = useCallback(
    async ({ queryText, resultsCount }) => {
      try {
        const trimmed = (queryText || '').trim();
        if (!trimmed || trimmed.length < 2) return;

        const { data } = await supabase.auth.getSession();
        const session = data?.session || null;
        const token = session?.access_token || null;
        const currentUserId = session?.user?.id || null;

        let origin = '';
        if (typeof window !== 'undefined') {
          const { protocol, hostname } = window.location || {};
          if (window.__API_ORIGIN__) {
            origin = window.__API_ORIGIN__;
          } else if (hostname === 'localhost' || hostname === '127.0.0.1') {
            origin = `${protocol}//${hostname}:5000`;
          } else {
            origin = API_URL;
          }
        } else {
          origin = API_URL;
        }

        await fetch(`${origin}/api/elib/search-events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            scope: 'categories',
            queryText: trimmed,
            userId: currentUserId,
            categoryId: null,
            bookId: null,
            authorName: null,
            pastPaperId: null,
            resultsCount: typeof resultsCount === 'number' ? resultsCount : null,
          }),
        }).catch(() => {});
      } catch (e) {
        console.warn('logSearchEvent (categories) failed', e);
      }
    },
    []
  );

  // Use icon from Supabase database instead of fallback mapping
  const pickIcon = (icon) => {
    // Return the icon stored in the database, or a default if not provided
    return icon || '📚';
  };

  useEffect(() => {
    let mounted = true;
    const cacheKey = 'categories_cache_v2';
    
    const fetchCategories = async () => {
      // ⚡ Check localStorage cache FIRST - instant load
      const cached = localStorage.getItem(cacheKey);
      const cachedData = cached ? JSON.parse(cached) : null;
      const cacheAge = cachedData?.timestamp ? Date.now() - cachedData.timestamp : Infinity;
      
      // Use cache if less than 24 hours old
      if (cachedData && cacheAge < 24 * 60 * 60 * 1000) {
        if (mounted) {
          console.log('⚡ Categories loaded from cache - INSTANT');
          setCategories(cachedData.data);
          setLoading(false);
        }
        // Still refresh in background without blocking UI
        setTimeout(() => fetchCategoriesFromDB(mounted), 2000);
        return;
      }
      
      setLoading(true);
      await fetchCategoriesFromDB(mounted);
    };
    
    const fetchCategoriesFromDB = async (mounted) => {
      try {
        if (mounted) setError('');

        // Try to select detailed fields; if the table doesn't have some columns (400),
        // fall back to a minimal select so the UI can still render.
        let catsData = null;
        let catsError = null;
        try {
          // Avoid selecting columns that may not exist in all schemas (e.g. color, updated_at)
          // Request only the most common fields; fall back logic below will handle missing data.
          const res = await supabase
            .from('categories')
            .select('id,name,description');
          catsData = res.data;
          catsError = res.error;
        } catch (e) {
          catsError = e;
        }

        if (catsError) {
          // Log detailed error to help debugging
          try { console.error('Categories query error:', JSON.stringify(catsError, Object.getOwnPropertyNames(catsError), 2)); } catch (_) { console.error('Categories query error (non-serializable):', catsError); }
          // Try a minimal fallback select (id,name) which is less likely to fail
          try {
            const fallback = await supabase.from('categories').select('id,name');
            catsData = fallback.data || [];
            if (fallback.error) console.warn('Fallback categories query also returned error:', fallback.error);
            console.info('Used fallback category select (id,name)');
          } catch (fbErr) {
            console.error('Fallback categories query failed:', fbErr);
            throw catsError;
          }
        } else {
          console.debug('Fetched categories:', catsData);
        }

        // ⚡ FAST COUNT: Use lightweight aggregate query instead of fetching all books
        const { data: countData, error: countError } = await supabase
          .rpc('get_category_book_counts');
        
        const counts = {};
        if (!countError && countData) {
          // Assume RPC returns [{category_id, count}]
          countData.forEach(row => {
            counts[row.category_id] = row.count || 0;
          });
        } else {
          // Fallback: fetch with minimal fields for counting
          const { data: booksData, error: booksError } = await supabase
            .from('books')
            .select('category_id', { count: 'exact' });

          if (!booksError && booksData) {
            booksData.forEach(b => {
              const key = b.category_id;
              counts[key] = (counts[key] || 0) + 1;
            });
          }
        }

        let mapped = (catsData || []).map(cat => ({
          id: cat.id,
          name: cat.name || 'Unknown',
          description: cat.description || '',
          icon: pickIcon(cat.icon),
          color: cat.color || '#6366f1',
          bookCount: counts[cat.id] || 0,
          rating: 4.2,
          trending: false,
          newReleases: [],
          updatedAt: cat.updated_at || new Date().toISOString()
        }));

        // ⚡ Cache the results
        try {
          localStorage.setItem(cacheKey, JSON.stringify({
            data: mapped,
            timestamp: Date.now()
          }));
        } catch (e) {
          console.warn('Failed to cache categories:', e);
        }

        // ⚡ Also cache to IndexedDB for offline support
        cacheDB.saveCategories(mapped).catch(e => console.warn('IndexedDB save error:', e));

        if (mounted) {
          setCategories(mapped);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to fetch categories', err);
        if (mounted) {
          setCategories([]);
          setDisplayedCategories([]);
          setError(err?.message || 'Could not load categories. Check the categories table and permissions.');
          setLoading(false);
        }
      }
    };

    fetchCategories();

    return () => { mounted = false; };
  }, [reloadKey]);

  // Debounced logging of category searches
  useEffect(() => {
    try {
      const q = (searchTerm || '').trim();
      if (!q || q.length < 2) return;

      const handle = setTimeout(() => {
        logSearchEvent({ queryText: q, resultsCount: displayedCategories.length });
      }, 800);

      return () => clearTimeout(handle);
    } catch {
      // ignore
    }
  }, [searchTerm, displayedCategories.length, logSearchEvent]);

  const filteredCategories = useMemo(() => {
    let result = [...categories];
    
    // Apply search filter (uses debounced term for performance)
    if (debouncedSearchTerm) {
      result = result.filter(cat => 
        cat.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        cat.description.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
      );
    }
    
    // Apply category filter
    if (activeFilter === 'trending') {
      result = result.filter(cat => cat.trending);
    } else if (activeFilter === 'new') {
      // Assuming "new" means updated in the last 3 months
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      result = result.filter(cat => new Date(cat.updatedAt) > threeMonthsAgo);
    }
    
    // Apply sorting
    if (sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'bookCount') {
      result.sort((a, b) => b.bookCount - a.bookCount);
    } else if (sortBy === 'rating') {
      result.sort((a, b) => b.rating - a.rating);
    }
    
    return result;
  }, [categories, debouncedSearchTerm, activeFilter, sortBy]);

  useEffect(() => {
    setDisplayedCategories(filteredCategories.slice(0, visibleCount));
  }, [filteredCategories, visibleCount]);

  const loadMore = () => {
    setVisibleCount(prev => prev + 4);
  };

  const viewCategoryDetails = (category) => {
    setSelectedCategory(category);
  };

  const closeDetails = () => {
    setSelectedCategory(null);
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
    setShowFilters(false);
    setVisibleCount(8); // Reset visible count when changing filters
  };

  const handleSortChange = (sortType) => {
    setSortBy(sortType);
    setVisibleCount(8); // Reset visible count when changing sort
  };

  const openCategoryForm = (category = null) => {
    setEditingCategoryId(category?.id || null);
    setCategoryDraft({
      name: category?.name || '',
      description: category?.description || ''
    });
    setShowCategoryForm(true);
  };

  const closeCategoryForm = () => {
    if (savingCategory) return;
    setShowCategoryForm(false);
    setEditingCategoryId(null);
    setCategoryDraft({ name: '', description: '' });
  };

  const saveCategory = async (event) => {
    event.preventDefault();
    const name = categoryDraft.name.trim();
    const description = categoryDraft.description.trim();
    if (!name) {
      showToast({ type: 'error', message: 'Category name is required.' });
      return;
    }

    setSavingCategory(true);
    try {
      const payload = { name, description };
      const result = editingCategoryId
        ? await supabase.from('categories').update(payload).eq('id', editingCategoryId)
        : await supabase.from('categories').insert(payload);

      if (result.error) throw result.error;
      localStorage.removeItem('categories_cache_v2');
      closeCategoryForm();
      setReloadKey((value) => value + 1);
      showToast({ type: 'success', message: editingCategoryId ? 'Category updated.' : 'Category created.' });
    } catch (saveError) {
      showToast({ type: 'error', message: saveError?.message || 'Could not save category.' });
    } finally {
      setSavingCategory(false);
    }
  };

  const removeCategory = async (category) => {
    const confirmed = await confirm({
      title: 'Delete category?',
      message: `Delete "${category.name}"? Books assigned to it may become uncategorized.`,
      confirmText: 'Delete',
      cancelText: 'Cancel'
    });
    if (!confirmed) return;

    try {
      const { error: deleteError } = await supabase.from('categories').delete().eq('id', category.id);
      if (deleteError) throw deleteError;
      localStorage.removeItem('categories_cache_v2');
      setReloadKey((value) => value + 1);
      showToast({ type: 'success', message: 'Category deleted.' });
    } catch (deleteError) {
      showToast({ type: 'error', message: deleteError?.message || 'Could not delete category.' });
    }
  };

  if (loading) {
    return (
      <div className="containercat">
        <header className="headercat">
          <h1 className="titlecat">Categories</h1>
        </header>
        
        <div className="controlscat">
          <input
            type="text"
            className="search-inputcat"
            placeholder="Search categories..."
            disabled
            value={searchTerm}
          />
          <button className="filter-buttoncat" disabled>
            <FiFilter /> Filters
          </button>
        </div>
        
        <div className="gridcat">
          {[...Array(8)].map((_, index) => (
            <div key={index} className="skeleton-cardcat">
              <div className="skeleton-iconcat"></div>
              <div className="skeleton-textcat" style={{ width: '70%' }}></div>
              <div className="skeleton-textcat" style={{ width: '90%' }}></div>
              <div className="skeleton-textcat" style={{ width: '50%' }}></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="containercat">
      <AdBanner placement="categories" limit={1} user={userProfile} />
      
      <header className="headercat">
        <h1 className="titlecat">Categories</h1>
      </header>

      <div className="controlscat">
        <input
          type="text"
          className="search-inputcat"
          placeholder="Search categories..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button 
            className="clear-searchcat"
            onClick={() => setSearchTerm('')}
          >
            <FiX size={16} />
          </button>
        )}
        <div className="filter-wrappercat">
          <button 
            className={`filter-buttoncat ${showFilters ? 'activecat' : ''}`}
            onClick={toggleFilters}
          >
            <FiFilter /> {activeFilter !== 'all' && '• '}Filters
          </button>
          
          {showFilters && (
            <div className="filter-dropdowncat">
              <div 
                className={`filter-optioncat ${activeFilter === 'all' ? 'activecat' : ''}`}
                onClick={() => handleFilterChange('all')}
              >
                All Categories
              </div>
              <div 
                className={`filter-optioncat ${activeFilter === 'trending' ? 'activecat' : ''}`}
                onClick={() => handleFilterChange('trending')}
              >
                <FiTrendingUp /> Trending
              </div>
              <div 
                className={`filter-optioncat ${activeFilter === 'new' ? 'activecat' : ''}`}
                onClick={() => handleFilterChange('new')}
              >
                <FiClock /> Recently Updated
              </div>
              
              <div className="sort-sectioncat">
                <small>Sort By:</small>
                <div 
                  className={`filter-optioncat ${sortBy === 'default' ? 'activecat' : ''}`}
                  onClick={() => handleSortChange('default')}
                >
                  Default
                </div>
                <div 
                  className={`filter-optioncat ${sortBy === 'name' ? 'activecat' : ''}`}
                  onClick={() => handleSortChange('name')}
                >
                  Name (A-Z)
                </div>
                {(userProfile?.subscription_tier === 'premium' || userProfile?.subscription_tier === 'premium_pro') && (
                  <div 
                    className={`filter-optioncat ${sortBy === 'bookCount' ? 'activecat' : ''}`}
                    onClick={() => handleSortChange('bookCount')}
                  >
                    Most Books
                  </div>
                )}
                <div 
                  className={`filter-optioncat ${sortBy === 'rating' ? 'activecat' : ''}`}
                  onClick={() => handleSortChange('rating')}
                >
                  Highest Rating
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {displayedCategories.length === 0 ? (
        <div className="empty-statecat">
          <FiBookOpen size={48} />
          <h3>No categories found</h3>
          <p>Try adjusting your search or filters</p>
          <button 
            className="reset-filterscat"
            onClick={() => {
              setSearchTerm('');
              setActiveFilter('all');
              setSortBy('default');
            }}
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <>
          <div className="gridcat">
            <AnimatePresence>
              {displayedCategories.map((category, index) => {
                // For mobile: Show ad after 3rd category (index 2)
                // For desktop: Show ad in middle position
                const isMobile = window.innerWidth < 768;
                const adPosition = isMobile ? 3 : Math.floor(displayedCategories.length / 2);
                
                // Render ad at the appropriate position
                if (index === adPosition && displayedCategories.length > 0 && userProfile?.subscription_tier !== 'premium_pro') {
                  return (
                    <React.Fragment key={`ad-position-${index}`}>
                      {/* Grid Ad */}
                      <motion.div
                        key="grid-ad-categories"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        layout
                      >
                        <div className="category-cardcat">
                          <AdBanner placement="grid-categories" limit={5} user={userProfile} />
                        </div>
                      </motion.div>
                      
                      {/* Current Category */}
                      <motion.div
                        key={category.id}
                        className="category-cardcat"
                        style={{ '--category-color': category.color }}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        layout
                        whileHover={{ y: -5 }}
                        onClick={() => viewCategoryDetails(category)}
                      >
                  <div className="card-contentcat">
                    <div className="badge-containercat">
                      {category.trending && (
                        <span className="trending-badgecat">
                          <FiTrendingUp size={12} /> Trending
                        </span>
                      )}
                      {new Date(category.updatedAt) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) && (
                        <span className="new-badgecat">New</span>
                      )}
                    </div>
                    
                    {(userProfile?.subscription_tier === 'premium' || userProfile?.subscription_tier === 'premium_pro') && (
                      <span
                        className="book-countcat"
                        aria-label={`Books in category ${category.name}: ${category.bookCount}`}
                        title={`${category.bookCount.toLocaleString()} books`}
                      >
                        <FiBookOpen size={14} /> {category.bookCount.toLocaleString()} books
                      </span>
                    )}
                    <h3 className="category-namecat">{category.name}</h3>
                    <p className="category-desccat">{category.description}</p>
                    <div className="category-metacat">
                    </div>
                  </div>
                  <div className="view-buttoncat">
                    View <FiChevronRight />
                  </div>
                      </motion.div>
                    </React.Fragment>
                  );
                }
                
                // Render regular category card
                return (
                  <motion.div
                    key={category.id}
                    className="category-cardcat"
                    style={{ '--category-color': category.color }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    layout
                    whileHover={{ y: -5 }}
                    onClick={() => viewCategoryDetails(category)}
                  >
                    <div className="card-contentcat">
                      <div className="badge-containercat">
                        {category.trending && (
                          <span className="trending-badgecat">
                            <FiTrendingUp size={12} /> Trending
                          </span>
                        )}
                        {new Date(category.updatedAt) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) && (
                          <span className="new-badgecat">New</span>
                        )}
                      </div>
                      
                      {(userProfile?.subscription_tier === 'premium' || userProfile?.subscription_tier === 'premium_pro') && (
                        <span
                          className="book-countcat"
                          aria-label={`Books in category ${category.name}: ${category.bookCount}`}
                          title={`${category.bookCount.toLocaleString()} books`}
                        >
                          <FiBookOpen size={14} /> {category.bookCount.toLocaleString()} books
                        </span>
                      )}
                      <h3 className="category-namecat">{category.name}</h3>
                      <p className="category-desccat">{category.description}</p>
                      <div className="category-metacat">
                      </div>
                    </div>
                    <div className="view-buttoncat">
                      View <FiChevronRight />
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {visibleCount < filteredCategories.length && (
            <motion.button
              className="load-more-buttoncat"
              onClick={loadMore}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Load More ({filteredCategories.length - visibleCount} remaining)
            </motion.button>
          )}
        </>
      )}

      {/* Category Detail Modal */}
      <AnimatePresence>
        {selectedCategory && (
          <motion.div
            className="modal-overlaycat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeDetails}
          >
            <motion.div
                className="modal-contentcat"
                style={{ '--category-color': selectedCategory.color }}
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button className="close-buttoncat" onClick={closeDetails}>
                <FiX size={24} />
              </button>
              
                <div
                  className="modal-headercat"
                  style={{
                    background: `linear-gradient(135deg, ${selectedCategory.color}22, ${selectedCategory.color}12)`,
                    color: '#fff'
                  }}
                >
                  <div className="modal-iconcat">{selectedCategory.icon}</div>
                  <h2>{selectedCategory.name}</h2>
                  <p>{selectedCategory.description}</p>
                </div>
              
              <div className="modal-bodycat">
                <div className="stats-containercat">
                  {(userProfile?.subscription_tier === 'premium' || userProfile?.subscription_tier === 'premium_pro') && (
                    <div className="stat-itemcat">
                      <FiBookOpen size={20} />
                      <span>{selectedCategory.bookCount.toLocaleString()} books available</span>
                    </div>
                  )}
                  <div className="stat-itemcat">
                    <FiClock size={20} />
                    <span>Last updated: {new Date(selectedCategory.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                
                <div className="new-releasescat">
                  <h3>New Releases</h3>
                  <ul>
                    {selectedCategory.newReleases.map((book, index) => (
                      <li key={index}>
                        <FiChevronRight size={14} /> {book}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              
              <motion.button
                className="explore-buttoncat"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  // Use bookmarkable query params so the filter can be shared/bookmarked.
                  if (selectedCategory && selectedCategory.id) {
                    const cid = encodeURIComponent(selectedCategory.id);
                    const cname = encodeURIComponent(selectedCategory.name || '');
                    navigate(`/BookManagement?category=${cid}&categoryName=${cname}`);
                  } else {
                    navigate('/BookManagement');
                  }
                  closeDetails();
                }}
              >
                Explore {selectedCategory.name} &rarr;
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};