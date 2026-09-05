// Pastpapers.jsx - Updated with Auth and Real-time Data
import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import { Document, Page } from 'react-pdf';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../Books/supabaseClient';
import {
  fetchPastPapers,
  subscribeToPastPapers,
  getFaculties,
  getUniversitiesForDropdown,
  createPastPaperSubmission,
  getPastPaperSignedUrl
} from '../Books/Admin/pastPapersApi';
import {
  fetchUniversities,
  toggleUniversityLike
} from '../Books/Admin/campusApi';
import { ShareButton } from './PastpaperShare';
import { AuthModal } from '../Books/AuthModal';
import SubscriptionModal from '../Subscriptions/SubscriptionModal';
import SecureReader from '../Books/SecureReader';
import SimpleScrollReader from '../Books/SimpleScrollReader';
import { FaSearch, FaFacebook, FaLinkedin, FaWhatsapp } from 'react-icons/fa';
import { SiX, SiGoogledrive } from 'react-icons/si';
import { 
  FiSearch, FiFileText, FiFilter, FiChevronRight, FiChevronLeft, FiX, 
  FiTrendingUp, FiArrowLeft, FiEye, FiStar, FiMapPin, FiUpload, FiBook, FiBookmark, FiShare2, FiCopy, FiLink
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { UniversityGrid } from './UniversityGrid';
import { FacultyGridDisplay } from './FacultyGridDisplay';
import { API_URL } from '../../config';
import { PaperGrid } from './PaperGrid';
import { PulseLoader, InfiniteScrollLoader } from './PaperSkeleton';
import { pushBackAction, popBackAction } from '../services/backNavigation';
import './PaperPanel.css';

export const PaperPanel = ({ demoMode = false }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const reloadTimeoutRef = useRef(null);
  const [papers, setPapers] = useState([]);
  const [displayedPapers, setDisplayedPapers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [universitySearchTerm, setUniversitySearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [sortBy, setSortBy] = useState('default');
  const [welcomeMessage, setWelcomeMessage] = useState(demoMode);
  const [universityFilter, setUniversityFilter] = useState(null);
  const [facultyFilter, setFacultyFilter] = useState(null);
  const [showFacultyGrid, setShowFacultyGrid] = useState(false);
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authAction, setAuthAction] = useState('view');
  const [universities, setUniversities] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [checkingSubscription, setCheckingSubscription] = useState(false);
  const [showBookmarksPanel, setShowBookmarksPanel] = useState(false);
  const [selectedUniversity, setSelectedUniversity] = useState(null);
  const [universityLikes, setUniversityLikes] = useState(() => {
    try {
      const saved = localStorage.getItem('universityLikes');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });
  const [universityLikesCounts, setUniversityLikesCounts] = useState(() => {
    try {
      const saved = localStorage.getItem('universityLikesCounts');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });
  const [paperLikes, setPaperLikes] = useState(() => {
    try {
      const saved = localStorage.getItem('paperLikes');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });
  const [paperLikesCounts, setPaperLikesCounts] = useState(() => {
    try {
      const saved = localStorage.getItem('paperLikesCounts');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });
  const [paperBookmarks, setPaperBookmarks] = useState(() => {
    try {
      const saved = localStorage.getItem('paperBookmarks');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [facultyViews, setFacultyViews] = useState(() => {
    try {
      const saved = localStorage.getItem('facultyViews');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });
  const [facultyLikes, setFacultyLikes] = useState(() => {
    try {
      const saved = localStorage.getItem('facultyLikes');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });
  const [facultyLikesCounts, setFacultyLikesCounts] = useState(() => {
    try {
      const saved = localStorage.getItem('facultyLikesCounts');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });
  const [paperBookmarksCounts, setpaperBookmarksCounts] = useState(() => {
    try {
      const saved = localStorage.getItem('paperBookmarksCounts');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadPdf, setUploadPdf] = useState(null);
  const [uploadForm, setUploadForm] = useState({
    faculty: '',
    unit_code: '',
    unit_name: '',
    year: '',
    semester: '',
    exam_type: 'Main'
  });
  const [notification, setNotification] = useState(null);

  const carouselRef = useRef(null);

  const [showReader, setShowReader] = useState(false);
  const [readerUrl, setReaderUrl] = useState(null);
  const [showSharingModal, setShowSharingModal] = useState(false);

  const hasActiveSubscription = useMemo(() => {
    if (!subscription || !subscription.end_at) return false;
    return new Date(subscription.end_at) > new Date();
  }, [subscription]);

  // Define data loading functions BEFORE useEffects that depend on them
  const loadPastPapers = useCallback(async () => {
    try {
      // Load papers in small batches (250 each) for responsive UI updates
      const BATCH_SIZE = 250;
      let allPapers = [];
      let pageNum = 1;
      let hasMore = true;
      let attempts = 0;
      const maxAttempts = 100; // Support up to 25,000 papers (100 chunks × 250)
      let initialLoadDone = false;

      while (hasMore && attempts < maxAttempts) {
        try {
          console.log(`📄 Loading papers batch ${pageNum}...`);
          const { data } = await fetchPastPapers({ page: pageNum, pageSize: BATCH_SIZE });
          
          if (data && data.length > 0) {
            allPapers = allPapers.concat(data);
            const totalLoaded = allPapers.length;
            console.log(`✅ Loaded batch ${pageNum}: ${data.length} papers. Total: ${totalLoaded}`);
            
            // Transform and display papers immediately after each batch
            const transformedData = transformData(allPapers);
            setPapers(transformedData);
            
            // Unblock UI after first batch
            if (!initialLoadDone) {
              setLoading(false);
              initialLoadDone = true;
              console.log(`🚀 UI unblocked - first batch displayed`);
            }
            
            pageNum++;
            attempts++;
            hasMore = data.length === BATCH_SIZE;
            
            // Small delay between batches to avoid overwhelming the server
            if (hasMore) {
              await new Promise(resolve => setTimeout(resolve, 50));
            }
          } else {
            console.log(`ℹ️ No more papers found. Total loaded: ${allPapers.length}`);
            hasMore = false;
          }
        } catch (batchError) {
          console.error(`Error loading batch ${pageNum}:`, batchError);
          // Continue loading remaining batches even if one fails
          pageNum++;
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      console.log(`✨ Finished loading ${allPapers.length} total papers`);
      
      // Final update with complete dataset
      const transformedData = transformData(allPapers);
      
      // Cache papers in localStorage
      try {
        localStorage.setItem('cachedPastPapers', JSON.stringify({
          data: transformedData,
          timestamp: Date.now()
        }));
        console.log(`💾 Papers cached successfully`);
      } catch (e) {
        console.warn('Could not cache papers (storage full):', e.message);
      }
      
      setPapers(transformedData);
      setLoading(false);
    } catch (error) {
      console.error('Error loading past papers:', error);
      // If API fails, try to show cached data
      try {
        const cached = localStorage.getItem('cachedPastPapers');
        if (cached) {
          try {
            const { data } = JSON.parse(cached);
            console.log(`📦 Loaded ${data.length} papers from cache`);
            setPapers(data);
            setLoading(false);
            return;
          } catch (parseError) {
            console.warn('Cache parse error:', parseError);
          }
        }
      } catch (storageError) {
        console.warn('localStorage access error:', storageError);
      }
      setLoading(false);
    }
  }, []);

  // Helper function to transform raw paper data
  const transformData = useCallback((papers) => {
    return (papers || []).map(paper => ({
      id: paper.id,
      title: paper.title || `${paper.unit_code || ''} - ${paper.unit_name || ''}`,
      course: paper.unit_name || paper.title,
      courseCode: paper.unit_code || '',
      faculty: paper.faculty || 'Unknown',
      university: paper.universities?.name || paper.university || 'Unknown',
      year: paper.year,
      semester: paper.semester,
      examType: paper.exam_type,
      downloads: paper.downloads_count || 0,
      downloads_count: paper.downloads_count || 0,
      file_url: paper.file_url,
      downloadUrl: null,
      created_at: paper.created_at
    }));
  }, []);

  const loadUniversities = useCallback(async () => {
    try {
      // Try cache first
      try {
        const cached = localStorage.getItem('cachedUniversities');
        if (cached) {
          try {
            const { data, timestamp } = JSON.parse(cached);
            // Use cache if less than 30 minutes old
            if (Date.now() - timestamp < 30 * 60 * 1000) {
              setUniversities(data || []);
              setLoading(false);
              // Fetch fresh in background
              setTimeout(() => fetchAndUpdateUniversities(), 500);
              return;
            }
          } catch (parseError) {
            console.warn('Cache parse error:', parseError);
          }
        }
      } catch (storageError) {
        console.warn('localStorage access error:', storageError);
      }
      
      // No cache, fetch normally
      await fetchAndUpdateUniversities();
    } catch (error) {
      console.error('Error loading universities:', error);
      setLoading(false);
    }
  }, [user]);

  const fetchAndUpdateUniversities = async () => {
    try {
      const { data } = await fetchUniversities({ page: 1, pageSize: 5 });
      // Cache universities IMMEDIATELY - don't wait for stats
      if (data && data.length > 0) {
        localStorage.setItem('cachedUniversities', JSON.stringify({ data, timestamp: Date.now() }));
        setUniversities(data || []);
        setLoading(false); // UNBLOCK immediately!
      }

    } catch (error) {
      console.error('Error fetching universities:', error);
      setLoading(false);
    }
  };

  const loadFaculties = useCallback(async () => {
    try {
      const data = await getFaculties();
      setFaculties(data);
    } catch (error) {
      console.error('Error loading faculties:', error);
    }
  }, []);

  // Check authentication status and load user profile with subscription_tier and role
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // Fetch user profile to get subscription_tier and role
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('subscription_tier, role, display_name, full_name')
            .eq('id', user.id)
            .single();
          
          // Merge profile data with auth user
          setUser({
            ...user,
            subscription_tier: profile?.subscription_tier || 'basic',
            role: profile?.role || 'viewer',
            display_name: profile?.full_name || profile?.display_name || user.email?.split('@')[0] || 'User'
          });
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Error checking user auth:', error);
        setUser(null);
      } finally {
        setIsAuthLoading(false);
      }
    };
    
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        // Fetch user profile to get subscription_tier and role
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('subscription_tier, role, display_name, full_name')
          .eq('id', session.user.id)
          .single();
        
        // Merge profile data with auth user
        setUser({
          ...session.user,
          subscription_tier: profile?.subscription_tier || 'basic',
          role: profile?.role || 'viewer',
          display_name: profile?.full_name || profile?.display_name || session.user.email?.split('@')[0] || 'User'
        });
        setAuthModalOpen(false);
      } else {
        setUser(null);
      }
      setIsAuthLoading(false);
    });

    // Setup realtime listener for profile changes (e.g., role updates)
    let profileSubscription = null;
    const setupProfileListener = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser?.id) {
        profileSubscription = supabase
          .channel(`public:profiles:id=eq.${currentUser.id}`)
          .on('postgres_changes', 
            { 
              event: 'UPDATE', 
              schema: 'public', 
              table: 'profiles',
              filter: `id=eq.${currentUser.id}`
            },
            (payload) => {
              console.log('[PastPapers] Profile updated:', payload);
              if (payload.new) {
                setUser(prev => ({
                  ...prev,
                  role: payload.new.role || prev?.role || 'viewer',
                  subscription_tier: payload.new.subscription_tier || prev?.subscription_tier || 'basic',
                  display_name: payload.new.full_name || payload.new.display_name || prev?.display_name || 'User'
                }));
              }
            }
          )
          .subscribe();
      }
    };

    setupProfileListener();

    return () => {
      authListener?.subscription?.unsubscribe();
      if (profileSubscription?.unsubscribe && typeof profileSubscription.unsubscribe === 'function') {
        try { profileSubscription.unsubscribe(); } catch (e) {}
      }
    };
  }, []);

  // Load faculty views and likes from database
  useEffect(() => {
    const loadFacultyData = async () => {
      if (!user) {
        // For anonymous users, use localStorage
        const savedViews = JSON.parse(localStorage.getItem('facultyViews') || '{}');
        const savedLikes = JSON.parse(localStorage.getItem('facultyLikes') || '{}');
        const savedCounts = JSON.parse(localStorage.getItem('facultyLikesCounts') || '{}');
        setFacultyViews(savedViews);
        setFacultyLikes(savedLikes);
        setFacultyLikesCounts(savedCounts);
        return;
      }

      try {
        // Load faculty views for current user
        const { data: viewsData, error: viewsError } = await supabase
          .from('faculty_views')
          .select('faculty_name, views')
          .eq('user_id', user.id);

        if (viewsError) throw viewsError;

        const viewsObj = {};
        if (viewsData) {
          viewsData.forEach(row => {
            viewsObj[row.faculty_name] = row.views || 0;
          });
        }
        setFacultyViews(viewsObj);

        // Load faculty likes for current user
        const { data: likesData, error: likesError } = await supabase
          .from('faculty_likes')
          .select('faculty_name')
          .eq('user_id', user.id);

        if (likesError) throw likesError;

        const likesObj = {};
        if (likesData) {
          likesData.forEach(row => {
            likesObj[row.faculty_name] = true;
          });
        }
        setFacultyLikes(likesObj);

        // Load aggregated like counts across all users
        const { data: countsData, error: countsError } = await supabase.rpc('get_faculty_like_counts');

        if (!countsError && countsData) {
          const countsObj = {};
          countsData.forEach(row => {
            countsObj[row.faculty_name] = row.count || 0;
          });
          setFacultyLikesCounts(countsObj);
        } else {
          // Fallback: count likes from faculty_likes table
          const { data: allLikes } = await supabase
            .from('faculty_likes')
            .select('faculty_name');

          const countsObj = {};
          if (allLikes) {
            allLikes.forEach(row => {
              countsObj[row.faculty_name] = (countsObj[row.faculty_name] || 0) + 1;
            });
          }
          setFacultyLikesCounts(countsObj);
        }
      } catch (error) {
        console.error('Error loading faculty data:', error);
        // Fallback to localStorage
        const savedViews = JSON.parse(localStorage.getItem('facultyViews') || '{}');
        const savedLikes = JSON.parse(localStorage.getItem('facultyLikes') || '{}');
        const savedCounts = JSON.parse(localStorage.getItem('facultyLikesCounts') || '{}');
        setFacultyViews(savedViews);
        setFacultyLikes(savedLikes);
        setFacultyLikesCounts(savedCounts);
      }
    };

    loadFacultyData();
  }, [user?.id]);

  const fetchSubscription = useCallback(async (currentUser) => {
    setSubscription(null);
    setCheckingSubscription(false);
  }, []);

  // Debounce search term to avoid excessive filtering
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1); // Reset pagination on search
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Update Open Graph meta tags for sharing
  useEffect(() => {
    if (selectedPaper) {
      const paperUrl = `${window.location.origin}${window.location.pathname}?paper=${selectedPaper.id}`;
      
      // Update og:image
      let ogImage = document.querySelector('meta[property="og:image"]');
      if (!ogImage) {
        ogImage = document.createElement('meta');
        ogImage.setAttribute('property', 'og:image');
        document.head.appendChild(ogImage);
      }
      ogImage.setAttribute('content', selectedPaper.thumbnail_url || `${window.location.origin}/paper-icon.png`);
      
      // Update og:title
      let ogTitle = document.querySelector('meta[property="og:title"]');
      if (!ogTitle) {
        ogTitle = document.createElement('meta');
        ogTitle.setAttribute('property', 'og:title');
        document.head.appendChild(ogTitle);
      }
      ogTitle.setAttribute('content', selectedPaper.title);
      
      // Update og:description
      let ogDesc = document.querySelector('meta[property="og:description"]');
      if (!ogDesc) {
        ogDesc = document.createElement('meta');
        ogDesc.setAttribute('property', 'og:description');
        document.head.appendChild(ogDesc);
      }
      ogDesc.setAttribute('content', `Check out "${selectedPaper.title}" from ${selectedPaper.university || 'Unknown'}`);
      
      // Update og:url
      let ogUrl = document.querySelector('meta[property="og:url"]');
      if (!ogUrl) {
        ogUrl = document.createElement('meta');
        ogUrl.setAttribute('property', 'og:url');
        document.head.appendChild(ogUrl);
      }
      ogUrl.setAttribute('content', paperUrl);
    }
  }, [selectedPaper]);

  // Real-time subscription for past papers - start FIRST before loading
  useEffect(() => {
    if (!subscribeToPastPapers) return;
    
    console.log('Setting up real-time subscription for past papers');
    const subscription = subscribeToPastPapers((payload) => {
      console.log('Past paper change detected:', payload);
      // Reload papers with a debounce to prevent multiple rapid reloads
      if (reloadTimeoutRef.current) clearTimeout(reloadTimeoutRef.current);
      reloadTimeoutRef.current = setTimeout(() => {
        loadPastPapers();
      }, 1000);
    });

    return () => {
      subscription?.unsubscribe();
      if (reloadTimeoutRef.current) clearTimeout(reloadTimeoutRef.current);
    };
  }, [loadPastPapers]);

  // Handle university filter from navigation
  useEffect(() => {
    if (location.state?.universityFilter) {
      setUniversityFilter(location.state.universityFilter);
      setSearchTerm(location.state.universityFilter);
      setActiveFilter('university');
    }
  }, [location.state]);

  // Load past papers from database - use cache first for INSTANT load
  useEffect(() => {
    // Try to load from cache FIRST (instant display)
    let hasCachedPapers = false;
    let hasCachedUnis = false;
    
    try {
      const cached = localStorage.getItem('cachedPastPapers');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        // Use cache if less than 5 minutes old
        if (Date.now() - timestamp < 5 * 60 * 1000) {
          setPapers(data);
          hasCachedPapers = true;
        }
      }
    } catch (e) {}

    try {
      const cachedUnis = localStorage.getItem('cachedUniversities');
      if (cachedUnis) {
        const { data, timestamp } = JSON.parse(cachedUnis);
        // Use cache if less than 30 minutes old
        if (Date.now() - timestamp < 30 * 60 * 1000) {
          setUniversities(data || []);
          hasCachedUnis = true;
        }
      }
    } catch (e) {}

    // If we have cache, mark loading as false immediately
    if (hasCachedUnis) {
      setLoading(false);
    }

    // Load fresh data in background (non-blocking)
    loadFaculties(); // Load faculties ASAP (fast operation)
    
    // Load papers in background
    loadPastPapers().catch(() => setLoading(false));
    
    // Load universities in background
    loadUniversities().catch(() => setLoading(false));
  }, [loadPastPapers, loadUniversities, loadFaculties]);

  // Reload papers when university filter changes - debounced
  useEffect(() => {
    if (!universityFilter) return;
    
    if (reloadTimeoutRef.current) clearTimeout(reloadTimeoutRef.current);
    reloadTimeoutRef.current = setTimeout(() => {
      loadPastPapers();
    }, 300);
    
    return () => {
      if (reloadTimeoutRef.current) clearTimeout(reloadTimeoutRef.current);
    };
  }, [universityFilter]);

  // Refresh subscription whenever user changes
  useEffect(() => {
    if (user) {
      fetchSubscription(user);
    } else {
      setSubscription(null);
    }
  }, [user, fetchSubscription]);

  // Real-time subscription to universities changes (likes_count updates)
  useEffect(() => {
    const subscription = supabase
      .channel('universities-likes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'universities',
          filter: 'likes_count=neq.null'
        },
        (payload) => {
          if (payload.new && payload.new.likes_count !== undefined) {
            // Update the university in our state with new likes_count
            setUniversities(prevUnis => prevUnis.map(u => 
              u.id === payload.new.id ? { ...u, likes_count: payload.new.likes_count } : u
            ));
            
            // Update the counts state
            setUniversityLikesCounts(counts => ({
              ...counts,
              [payload.new.id]: payload.new.likes_count
            }));
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const onUploadChange = (k) => (e) => {
    setUploadForm((f) => ({ ...f, [k]: e.target.value }));
  };

  const handleSubmitUpload = async () => {
    // Don't show modal while auth is loading - wait for verification
    if (isAuthLoading) {
      setNotification({ type: 'info', message: 'Verifying your account...' });
      setTimeout(() => setNotification(null), 4000);
      return;
    }
    if (!user) {
      setNotification({ type: 'error', message: 'Please sign in to upload a past paper' });
      setTimeout(() => setNotification(null), 4000);
      setAuthAction('action');
      setAuthModalOpen(true);
      return;
    }
    if (!uploadPdf) {
      setNotification({ type: 'error', message: 'Please select a PDF file to upload' });
      setTimeout(() => setNotification(null), 4000);
      return;
    }
    if (!uploadForm.faculty || !uploadForm.unit_code || !uploadForm.unit_name) {
      setNotification({ type: 'error', message: 'Please fill in all required fields (Faculty, Unit Code, Unit Name)' });
      setTimeout(() => setNotification(null), 4000);
      return;
    }

    const currentUni = universities.find(
      (u) => u.name?.toLowerCase() === (universityFilter || '').toLowerCase()
    );

    setUploadBusy(true);
    try {
      const metadata = {
        university_id: currentUni?.id || null,
        faculty: uploadForm.faculty,
        unit_code: uploadForm.unit_code,
        unit_name: uploadForm.unit_name,
        year: uploadForm.year ? Number(uploadForm.year) : null,
        semester: uploadForm.semester || '',
        exam_type: uploadForm.exam_type || 'Main',
        uploaded_by: user?.id || null
      };

      await createPastPaperSubmission({ metadata, pdfFile: uploadPdf });

      setNotification({ 
        type: 'success', 
        message: '✓ Thank you! Your past paper has been submitted and is awaiting review.' 
      });
      
      setTimeout(() => {
        setShowUploadModal(false);
        setUploadPdf(null);
        setUploadForm({
          faculty: '',
          unit_code: '',
          unit_name: '',
          year: '',
          semester: '',
          exam_type: 'Main'
        });
        setNotification(null);
      }, 2000);
    } catch (e) {
      console.error('Past paper submission failed:', e);
      setNotification({ 
        type: 'error', 
        message: e?.message || 'Failed to submit past paper. Please try again.' 
      });
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setUploadBusy(false);
    }
  };

  const filteredPapers = useMemo(() => {
    // Early exit if no papers
    if (!papers.length) return [];
    
    let result = papers;
    const uniFilterLower = universityFilter?.toLowerCase();
    const facultyFilterLower = facultyFilter?.toLowerCase();
    const searchLower = debouncedSearchTerm?.trim().toLowerCase();
     
    // ALWAYS apply university filter if one is selected - papers are university-specific
    if (uniFilterLower) {
      result = result.filter(paper => 
        paper.university?.toLowerCase() === uniFilterLower
      );
    }
    
    // Apply faculty filter if one is selected
    if (facultyFilterLower) {
      result = result.filter(paper => 
        paper.faculty?.toLowerCase() === facultyFilterLower
      );
    }
    
    // Apply search filter (works with university filter too)
    if (searchLower) {
      const raw = searchLower;

      // Try to interpret semester-style queries like "sem 1", "semester 2", "sem3"
      let semesterNumber = null;
      const semMatch = raw.match(/^(sem|semester)\s*([0-9]+)/i) || raw.match(/\bsem\s*([0-9]+)/i);
      if (semMatch && semMatch[2]) {
        semesterNumber = semMatch[2];
      } else {
        // Also allow just "1", "2", "3" if the word "sem" is not present but user typed a small digit
        if (/^[1-9]$/.test(raw)) {
          semesterNumber = raw;
        }
      }

      result = result.filter(paper => {
        const title = (paper.title || '').toLowerCase();
        const course = (paper.course || '').toLowerCase();
        const code = (paper.courseCode || '').toLowerCase();
        const yearStr = String(paper.year || '');
        const semesterStr = String(paper.semester || '').toLowerCase();
        
        // Create a combined searchable field that includes both unit name and code
        const combinedCourseField = `${course} ${code}`;

        const textMatch =
          title.includes(raw) ||
          course.includes(raw) ||
          code.includes(raw) ||
          combinedCourseField.includes(raw) ||
          yearStr.includes(raw);

        const semesterMatch = semesterNumber
          ? semesterStr.includes(semesterNumber) || semesterStr.includes(`sem ${semesterNumber}`) || semesterStr.includes(`semester ${semesterNumber}`)
          : false;

        return textMatch || semesterMatch;
      });
    }
    
    // Apply other filters
    if (activeFilter === 'recent') {
      result = result.filter(paper => paper.year >= new Date().getFullYear() - 2);
    }
    
    // Apply sorting with early exit for best performance
    if (sortBy !== 'default') {
      const sortedResult = result.slice(); // Non-mutating copy
      if (sortBy === 'title') {
        sortedResult.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      } else if (sortBy === 'course') {
        sortedResult.sort((a, b) => (a.course || '').localeCompare(b.course || ''));
      } else if (sortBy === 'university') {
        sortedResult.sort((a, b) => (a.university || '').localeCompare(b.university || ''));
      } else if (sortBy === 'year') {
        sortedResult.sort((a, b) => (b.year || 0) - (a.year || 0));
      }
      return sortedResult;
    }
    
    return result;
  }, [papers, debouncedSearchTerm, activeFilter, sortBy, universityFilter, facultyFilter]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredPapers.length / pageSize)), [filteredPapers.length, pageSize]);

  // Get unique faculties for the selected university
  const universitiesFilteredFaculties = useMemo(() => {
    if (!universityFilter || !Array.isArray(papers)) return [];
    
    const uniqueFaculties = new Set();
    papers.forEach(paper => {
      if (paper.university?.toLowerCase() === universityFilter.toLowerCase() && paper.faculty) {
        uniqueFaculties.add(paper.faculty);
      }
    });
    
    return Array.from(uniqueFaculties).sort();
  }, [papers, universityFilter]);

  useEffect(() => {
    // Reset to page 1 when filters change
    setCurrentPage(1);
  }, [debouncedSearchTerm, activeFilter, sortBy, universityFilter, facultyFilter]);

  const displayedPapersMemo = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    return filteredPapers.slice(startIdx, endIdx);
  }, [filteredPapers, currentPage, pageSize]);

  useEffect(() => {
    // Sync memoized value with state
    setDisplayedPapers(displayedPapersMemo);
  }, [displayedPapersMemo]);

  const handlePaperClick = async (paper) => {
    // Don't show modal while auth is loading - wait for verification
    if (isAuthLoading) {
      return;
    }
    if (!user) {
      setAuthAction('view');
      setAuthModalOpen(true);
      return;
    }

    // Now show the paper details
    setSelectedPaper(paper);
    setWelcomeMessage(false);
  };

  const viewPaperDetails = async (paper) => {
    // Don't show modal while auth is loading - wait for verification
    if (isAuthLoading) {
      return;
    }
    if (!user) {
      setAuthAction('view');
      setAuthModalOpen(true);
      return;
    }

    setSelectedPaper(paper);
    setWelcomeMessage(false);

    getPastPaperSignedUrl(paper.id)
      .then(signedUrl => {
        setSelectedPaper(prev => prev?.id === paper.id ? { ...prev, downloadUrl: signedUrl } : prev);
      })
      .catch(error => console.warn('Failed to prewarm past paper URL:', { paperId: paper.id, error: error.message }));
    
  };

  const openReader = async (paper) => {
    if (!paper) return;
    if (!user) {
      setAuthAction('view');
      setAuthModalOpen(true);
      return;
    }

    try {
      const url = await getPastPaperSignedUrl(paper.id);

      if (!url) {
        console.warn('Unable to resolve reader URL for past paper', paper.id);
        return;
      }

      setSelectedPaper(paper);
      setSelectedPaper(prev => prev?.id === paper.id ? { ...prev, downloadUrl: url } : prev);
      setReaderUrl(url);
      setShowReader(true);
      
    } catch (e) {
      console.warn('Failed to open reader for past paper', e);
    }
  };

  const closeDetails = () => {
    setSelectedPaper(null);
  };

  const toggleFilters = useCallback(() => {
    setShowFilters(!showFilters);
  }, [showFilters]);

  const handleFilterChange = useCallback((filter) => {
    setActiveFilter(filter);
    setShowFilters(false);
    setWelcomeMessage(false);
    
    // Clear university and faculty filters if changing to another filter
    if (filter !== 'university') {
      setUniversityFilter(null);
    }
    if (filter !== 'faculty') {
      setFacultyFilter(null);
    }
  }, []);

  const handleFacultyClick = useCallback((faculty) => {
    setFacultyFilter(faculty);
    setActiveFilter('faculty');
    setShowFilters(false);
    setWelcomeMessage(false);
    setShowFacultyGrid(false);
  }, []);

  const handleFacultyGridOpen = useCallback(() => {
    setShowFacultyGrid(true);
    setShowFilters(false);
  }, []);

  const handleBackFromFacultyGrid = useCallback(() => {
    // Close faculty grid while preserving university filter and other state
    setShowFacultyGrid(false);
    // Keep universityFilter, searchTerm, and other paper viewing state intact
  }, []);

  const handleNativeBack = useCallback(() => {
    if (showSharingModal) {
      setShowSharingModal(false);
      return;
    }

    if (showReader) {
      setShowReader(false);
      setReaderUrl(null);
      return;
    }

    if (selectedPaper) {
      closeDetails();
      return;
    }

    if (showFacultyGrid) {
      setShowFacultyGrid(false);
      return;
    }

    setUniversityFilter(null);
    setFacultyFilter(null);
    setSearchTerm('');
    setUniversitySearchTerm('');
  }, [selectedPaper, showFacultyGrid, showReader, showSharingModal]);

  useEffect(() => {
    const hasNestedView = Boolean(
      showSharingModal ||
      showReader ||
      selectedPaper ||
      showFacultyGrid ||
      universityFilter
    );

    if (!hasNestedView) return undefined;

    pushBackAction(handleNativeBack);
    return () => popBackAction(handleNativeBack);
  }, [handleNativeBack, selectedPaper, showFacultyGrid, showReader, showSharingModal, universityFilter]);

  const handleFacultySelect = useCallback((faculty) => {
    // Record view for this faculty in database
    const trackFacultyView = async () => {
      try {
        if (user?.id) {
          // Insert or update faculty view record in database
          const { error } = await supabase.from('faculty_views').upsert({
            user_id: user.id,
            faculty_name: faculty,
            views: (facultyViews[faculty] || 0) + 1,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,faculty_name' });

          if (!error) {
            // Update local state
            setFacultyViews(prev => {
              const updated = { ...prev, [faculty]: (prev[faculty] || 0) + 1 };
              localStorage.setItem('facultyViews', JSON.stringify(updated));
              return updated;
            });
          }
        } else {
          // For anonymous users, just use localStorage
          setFacultyViews(prev => {
            const updated = { ...prev, [faculty]: (prev[faculty] || 0) + 1 };
            localStorage.setItem('facultyViews', JSON.stringify(updated));
            return updated;
          });
        }
      } catch (err) {
        console.error('Error tracking faculty view:', err);
        // Fallback to localStorage
        setFacultyViews(prev => {
          const updated = { ...prev, [faculty]: (prev[faculty] || 0) + 1 };
          localStorage.setItem('facultyViews', JSON.stringify(updated));
          return updated;
        });
      }
    };

    trackFacultyView();

    // Select the faculty and close grid
    setFacultyFilter(faculty);
    setShowFacultyGrid(false);
    setActiveFilter('faculty');
  }, [user]);

  const handleToggleFacultyLike = async (faculty) => {
    if (!user?.id) return; // Only authenticated users can like

    const isCurrentlyLiked = facultyLikes[faculty];
    
    try {
      // Update database
      if (isCurrentlyLiked) {
        // Unlike - delete the like record
        const { error } = await supabase
          .from('faculty_likes')
          .delete()
          .eq('user_id', user.id)
          .eq('faculty_name', faculty);

        if (!error) {
          // Update local state
          setFacultyLikes(prev => {
            const updated = { ...prev, [faculty]: false };
            localStorage.setItem('facultyLikes', JSON.stringify(updated));
            return updated;
          });

          setFacultyLikesCounts(prev => {
            const updated = {
              ...prev,
              [faculty]: (prev[faculty] || 1) - 1
            };
            localStorage.setItem('facultyLikesCounts', JSON.stringify(updated));
            return updated;
          });
        }
      } else {
        // Like - insert new like record
        const { error } = await supabase.from('faculty_likes').insert({
          user_id: user.id,
          faculty_name: faculty,
          created_at: new Date().toISOString()
        });

        if (!error) {
          // Update local state
          setFacultyLikes(prev => {
            const updated = { ...prev, [faculty]: true };
            localStorage.setItem('facultyLikes', JSON.stringify(updated));
            return updated;
          });

          setFacultyLikesCounts(prev => {
            const updated = {
              ...prev,
              [faculty]: (prev[faculty] || 0) + 1
            };
            localStorage.setItem('facultyLikesCounts', JSON.stringify(updated));
            return updated;
          });
        }
      }
    } catch (err) {
      console.error('Error toggling faculty like:', err);
    }
  };

  const handleSortChange = useCallback((sortType) => {
    setSortBy(sortType);
    setWelcomeMessage(false);
  }, []);

  const handleToggleUniversityLike = async (uniId) => {
    // Optimistic update - update UI immediately
    setUniversityLikes(prev => {
      const updated = { ...prev };
      updated[uniId] = !updated[uniId];
      localStorage.setItem('universityLikes', JSON.stringify(updated));
      return updated;
    });
    
    // Sync to database and get authoritative count
    const userId = user?.id || 'anonymous-' + Math.random().toString(36).substr(2, 9);
    try {
      const result = await toggleUniversityLike(uniId, userId);
      if (result) {
        // Use the count from database (source of truth)
        setUniversityLikesCounts(counts => {
          const updatedCounts = { ...counts };
          updatedCounts[uniId] = result.count;
          localStorage.setItem('universityLikesCounts', JSON.stringify(updatedCounts));
          return updatedCounts;
        });
        
        // Update the university's likes_count in the universities list
        setUniversities(prevUnis => prevUnis.map(u => 
          u.id === uniId ? { ...u, likes_count: result.count } : u
        ));
      }
    } catch (err) {
      console.error('Failed to sync university like to database:', err);
    }
  };

  const handleShare = async (method) => {
    if (!selectedPaper) return;

    // Use OG endpoint for proper meta tag serving to social platforms
    const ogUrl = `${window.location.origin}/api/og?type=paper&id=${selectedPaper.id}&title=${encodeURIComponent(selectedPaper.title)}&description=${encodeURIComponent(`Check out "${selectedPaper.title}" from ${selectedPaper.university}`)}`;
    
    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    const shareUrl = `${baseUrl}?paper=${selectedPaper.id}`;
    const shareText = `Check out "${selectedPaper.title}" from ${selectedPaper.university}`;
    const hashtags = 'pastpapers,study,learning';

    try {
      switch (method) {
        case 'copy':
          if (navigator.clipboard) {
            await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
          } else {
            const textarea = document.createElement('textarea');
            textarea.value = `${shareText}\n${shareUrl}`;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
          }
          break;

        case 'twitter':
          window.open(
            `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(ogUrl)}&hashtags=${encodeURIComponent(hashtags)}`,
            '_blank',
            'noopener,noreferrer'
          );
          break;

        case 'facebook':
          window.open(
            `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(ogUrl)}`,
            '_blank',
            'noopener,noreferrer'
          );
          break;

        case 'linkedin':
          window.open(
            `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(ogUrl)}`,
            '_blank',
            'noopener,noreferrer'
          );
          break;

        case 'email':
          window.open(
            `mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(`${shareText}%0A%0A${ogUrl}%0A%0A`)}`,
            '_blank',
            'noopener,noreferrer'
          );
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
            await navigator.clipboard.writeText(`${shareText}\n${ogUrl}`);
          }
          break;

        case 'native':
          if (navigator.share) {
            await navigator.share({
              title: shareText,
              text: selectedPaper.description || shareText,
              url: ogUrl,
            });
          }
          break;

        default:
          break;
      }
    } catch (error) {
      console.error('Error sharing:', error);
    } finally {
      setShowSharingModal(false);
    }
  };

  const scrollCarousel = (direction) => {
    const carousel = carouselRef.current;
    if (carousel) {
      const scrollAmount = direction === 'left' ? -100 : 100;
      carousel.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Show empty state only if truly loading (no cached data)
  if (loading && universities.length === 0 && papers.length === 0) {
    return (
      <div className="containerpast">
        <p style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>Loading universities...</p>
      </div>
    );
  }

  return (
    <div className="containerpast" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Feed Ad - Between Past Paper Items */}
      
      {/* Show Universities Grid if no university is selected */}
      {!universityFilter ? (
        <UniversityGrid
          universities={universities}
          universitySearchTerm={universitySearchTerm}
          setUniversitySearchTerm={setUniversitySearchTerm}
          papers={papers}
          onUniversitySelect={(uni) => {
            setUniversities(prevUnis => 
              prevUnis.map(u => 
                u.id === uni.id 
                  ? { ...u, views: (u.views || 0) + 1 }
                  : u
              )
            );
            setUniversityFilter(uni.name);
            setSearchTerm('');
          }}
          setSelectedUniversity={setSelectedUniversity}
          user={user}
        />
      ) : (
        <>
          {/* Show Faculty Grid if faculty filter button is clicked */}
          {showFacultyGrid ? (
            <FacultyGridDisplay
              faculties={universitiesFilteredFaculties}
              papers={papers}
              universityFilter={universityFilter}
              facultyViews={facultyViews}
              facultyLikes={facultyLikes}
              facultyLikesCounts={facultyLikesCounts}
              onToggleLike={handleToggleFacultyLike}
              onFacultySelect={handleFacultySelect}
              onBack={handleBackFromFacultyGrid}
              user={user}
            />
          ) : (
            <>
          {/* Search and Filter Controls - Matching BookPanel Layout */}
          <PaperGrid
            displayedPapers={displayedPapers}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            pageSize={pageSize}
            filteredPapers={filteredPapers}
            showFilters={showFilters}
            activeFilter={activeFilter}
            sortBy={sortBy}
            searchTerm={searchTerm}
            toggleFilters={toggleFilters}
            handleFilterChange={handleFilterChange}
            handleSortChange={handleSortChange}
            setSearchTerm={setSearchTerm}
            user={user}
            onPaperSelect={handlePaperClick}
            onBack={() => {
              setUniversityFilter(null);
              setSearchTerm('');
              setUniversitySearchTerm('');
            }}
            faculties={faculties}
            facultyFilter={facultyFilter}
            onFacultyClick={handleFacultyGridOpen}
          />
            </>
          )}
        </>
      )}

      {/* Paper Details Modal */}
      <AnimatePresence>
        {selectedPaper && user && (
          <motion.div
            className="modal-overlaypast"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeDetails}
          >
            <motion.div
              className="modal-contentpast"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button className="close-buttonpast" onClick={closeDetails} aria-label="Close">
                <FiX size={24} />
              </button>

              <div className="modal-bodyBKP" style={{ paddingTop: '0', paddingLeft: '0', paddingRight: '0' }}>
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '0.2rem' }}>
                  {selectedPaper.downloadUrl ? (
                    <div style={{ width: '100%', maxWidth: '400px', display: 'flex', justifyContent: 'center', borderRadius: '8px', overflow: 'hidden', background: '#121a1f', padding: '0.2rem' }}>
                      <Suspense fallback={<div style={{ width: '100%', minHeight: '600px' }} />}>
                        <Document file={selectedPaper.downloadUrl} loading="">
                          <Page pageNumber={1} width={380} renderTextLayer={false} renderAnnotationLayer={false} loading="" />
                        </Document>
                      </Suspense>
                    </div>
                  ) : (
                    <div
                      style={{
                        maxWidth: '400px',
                        width: '100%',
                        height: '500px',
                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.1))',
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '2rem',
                        textAlign: 'center'
                      }}
                    >
                      <FiFileText size={80} style={{ color: '#6366f1', marginBottom: '1.5rem', opacity: 0.8 }} />
                      <h2 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', fontWeight: '700', color: '#e9edef' }}>{selectedPaper.title}</h2>
                      <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#8696a0', fontWeight: '500' }}>{selectedPaper.course}</p>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '1rem', lineHeight: '1.6' }}>
                        {
                          [
                            selectedPaper.university,
                            selectedPaper.year ? `Year: ${selectedPaper.year}` : null,
                            selectedPaper.semester ? `Semester ${selectedPaper.semester}` : null,
                            selectedPaper.examType || null
                          ].filter(Boolean).join(' • ')
                        }
                      </div>
                    </div>
                  )}
                </div>

              </div>

              <div className="modal-actionspast" style={{ marginTop: '16px', paddingTop: '16px' }}>
                <div className="actions-primary-rowpast">
                  <button
                    className="btn-readBKP btn-action-primaryBKP"
                    onClick={() => setShowSharingModal(true)}
                    title="Share this paper"
                  >
                    <FiShare2 size={16} /> Share
                  </button>
                  <button
                    className="btn-readBKP btn-action-primaryBKP"
                    onClick={() => openReader(selectedPaper)}
                  >
                    <FiBook size={16} /> Read
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sharing Modal */}
      <AnimatePresence>
        {showSharingModal && selectedPaper && (
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
                title="Close"
                onClick={() => setShowSharingModal(false)}
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 12,
                  background: 'transparent',
                  color: '#9ca3af',
                  border: 'none',
                  padding: 0,
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
                  Share "{selectedPaper.title}"
                </h3>
              </div>

              {/* Paper PDF/Thumbnail as Clickable Link */}
              <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'center' }}>
                <a 
                  href={`${window.location.origin}${window.location.pathname}?paper=${selectedPaper.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 12,
                    overflow: 'hidden',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
                    textDecoration: 'none',
                    width: 140,
                    height: 200,
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.1))',
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
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <FiFileText size={48} style={{ color: '#6366f1', opacity: 0.8 }} />
                    <span style={{ fontSize: 11, color: '#e6eef7', fontWeight: 600, textAlign: 'center', paddingX: 8 }}>
                      View Paper
                    </span>
                  </div>
                </a>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 24 }}>
                <button
                  title="Share on WhatsApp"
                  onClick={() => handleShare('whatsapp')}
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
                    e.target.style.opacity = '0.8';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.opacity = '1';
                  }}
                >
                  <div style={{ background: '#34C759', borderRadius: '8px', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FaWhatsapp size={30} color="#ffffff" />
                  </div>
                  WhatsApp
                </button>

                <button
                  title="Share on X"
                  onClick={() => handleShare('twitter')}
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
                    e.target.style.opacity = '0.8';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.opacity = '1';
                  }}
                >
                  <div style={{ background: '#000000', borderRadius: '8px', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <SiX size={26} color="#ffffff" />
                  </div>
                  X
                </button>

                <button
                  title="Copy Link"
                  onClick={() => handleShare('copy')}
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
                    e.target.style.opacity = '0.8';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.opacity = '1';
                  }}
                >
                  <div style={{ background: '#8B5CF6', borderRadius: '8px', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FiLink size={26} color="#ffffff" />
                  </div>
                  Copy Link
                </button>

                <button
                  title="Share on Facebook"
                  onClick={() => handleShare('facebook')}
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
                    e.target.style.opacity = '0.8';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.opacity = '1';
                  }}
                >
                  <div style={{ background: '#1877F2', borderRadius: '8px', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FaFacebook size={26} color="#ffffff" />
                  </div>
                  Facebook
                </button>

                <button
                  title="Share on LinkedIn"
                  onClick={() => handleShare('linkedin')}
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
                    e.target.style.opacity = '0.8';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.opacity = '1';
                  }}
                >
                  <div style={{ background: '#0A66C2', borderRadius: '8px', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FaLinkedin size={26} color="#ffffff" />
                  </div>
                  LinkedIn
                </button>

                <button
                  title="Share via Email"
                  onClick={() => handleShare('email')}
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
                    e.target.style.opacity = '0.8';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.opacity = '1';
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
                  title="Save to Google Drive"
                  onClick={() => handleShare('googledrive')}
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
                    e.target.style.opacity = '0.8';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.opacity = '1';
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

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => setAuthModalOpen(false)}
        action={authAction}
      />

      <SubscriptionModal
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        user={user}
        product="pastpapers"
        onSubscribed={() => setShowSubscriptionModal(false)}
      />

      {/* Enhanced User Upload Past Paper Modal - Simplified */}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div
            className="upload-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !uploadBusy && setShowUploadModal(false)}
          >
            <motion.div
              className="upload-modal-container"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Simple Header */}
              <div className="upload-header-simple">
                <div>
                  <h2 className="upload-title-simple">Share a Past Paper</h2>
                  <p className="upload-subtitle-simple">Help your classmates succeed</p>
                </div>
                <button
                  className="upload-close-btn"
                  onClick={() => !uploadBusy && setShowUploadModal(false)}
                  aria-label="Close upload"
                  disabled={uploadBusy}
                >
                  <FiX size={20} />
                </button>
              </div>

              {/* Main Form - Simplified */}
              <div className="upload-form-simple">
                {/* Step 1: PDF Upload */}
                <div className="form-section-simple">
                  <div className="step-label">Step 1: Upload PDF</div>
                  <div
                    className={`simple-dropzone ${uploadPdf ? 'has-file' : ''} ${uploadBusy ? 'disabled' : ''}`}
                    onClick={() => !uploadBusy && document.getElementById('user-paper-input')?.click()}
                    onDragOver={(e) => {
                      if (!uploadBusy) {
                        e.preventDefault();
                        e.currentTarget.classList.add('drag-active');
                      }
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.classList.remove('drag-active');
                    }}
                    onDrop={(e) => {
                      if (!uploadBusy) {
                        e.preventDefault();
                        e.currentTarget.classList.remove('drag-active');
                        const file = e.dataTransfer.files?.[0];
                        if (file?.type === 'application/pdf') {
                          setUploadPdf(file);
                        }
                      }
                    }}
                  >
                    <input
                      id="user-paper-input"
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setUploadPdf(e.target.files?.[0] || null)}
                      style={{ display: 'none' }}
                      disabled={uploadBusy}
                    />
                    {uploadPdf ? (
                      <div className="file-status">
                        <div className="success-badge">✓</div>
                        <div>
                          <p className="file-name-text">{uploadPdf.name}</p>
                          <p className="file-size-text">{(uploadPdf.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                    ) : (
                      <div className="dropzone-empty">
                        <FiUpload size={32} />
                        <p>Click to upload or drag & drop</p>
                        <span>PDF format</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 2: Basic Info */}
                <div className="form-section-simple">
                  <div className="step-label">Step 2: Course Details</div>
                  
                  <div className="simple-input-group">
                    <label>University</label>
                    <input
                      className="simple-input"
                      value={universityFilter || ''}
                      disabled
                    />
                  </div>

                  <div className="simple-input-group">
                    <label>Faculty <span className="required">*</span></label>
                    <input
                      className="simple-input"
                      placeholder="e.g., Engineering, Business"
                      value={uploadForm.faculty}
                      onChange={onUploadChange('faculty')}
                      disabled={uploadBusy}
                    />
                  </div>

                  <div className="input-row-simple">
                    <div className="simple-input-group">
                      <label>Course Code <span className="required">*</span></label>
                      <input
                        className="simple-input"
                        placeholder="e.g., CS101"
                        value={uploadForm.unit_code}
                        onChange={onUploadChange('unit_code')}
                        disabled={uploadBusy}
                      />
                    </div>

                    <div className="simple-input-group">
                      <label>Course Name <span className="required">*</span></label>
                      <input
                        className="simple-input"
                        placeholder="e.g., Programming"
                        value={uploadForm.unit_name}
                        onChange={onUploadChange('unit_name')}
                        disabled={uploadBusy}
                      />
                    </div>
                  </div>
                </div>

                {/* Step 3: Optional Details */}
                <div className="form-section-simple">
                  <div className="step-label">Step 3: Optional Info</div>
                  
                  <div className="input-row-simple">
                    <div className="simple-input-group">
                      <label>Year</label>
                      <input
                        className="simple-input"
                        type="number"
                        placeholder="2023"
                        min="2000"
                        max={new Date().getFullYear()}
                        value={uploadForm.year}
                        onChange={onUploadChange('year')}
                        disabled={uploadBusy}
                      />
                    </div>

                    <div className="simple-input-group">
                      <label>Semester</label>
                      <select
                        className="simple-input"
                        value={uploadForm.semester}
                        onChange={onUploadChange('semester')}
                        disabled={uploadBusy}
                      >
                        <option value="">Select</option>
                        <option value="1">1st</option>
                        <option value="2">2nd</option>
                        <option value="3">3rd</option>
                      </select>
                    </div>

                    <div className="simple-input-group">
                      <label>Type</label>
                      <select
                        className="simple-input"
                        value={uploadForm.exam_type}
                        onChange={onUploadChange('exam_type')}
                        disabled={uploadBusy}
                      >
                        <option value="Main">Main</option>
                        <option value="Supplementary">Supplementary</option>
                        <option value="CAT">CAT</option>
                        <option value="Mock">Mock</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Clean Actions */}
              <div className="upload-actions-simple">
                <button
                  className="btn-secondary-simple"
                  onClick={() => setShowUploadModal(false)}
                  disabled={uploadBusy}
                >
                  Cancel
                </button>
                <motion.button
                  className="btn-primary-simple"
                  disabled={uploadBusy || !uploadPdf || !uploadForm.faculty || !uploadForm.unit_code || !uploadForm.unit_name}
                  onClick={handleSubmitUpload}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {uploadBusy ? (
                    <>
                      <span className="spinner-small"></span>
                      Uploading...
                    </>
                  ) : (
                    <>Upload</>
                  )}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PDF Reader - Opens same way as Books */}
      {showReader && selectedPaper && readerUrl && (
        <SimpleScrollReader
          src={readerUrl}
          cacheKey={`paper:${selectedPaper.id}`}
          title={selectedPaper.title}
          author={selectedPaper.courseCode || ''}
          sampleText={`${selectedPaper.university} - ${selectedPaper.year}`}
          onClose={() => {
            setShowReader(false);
            setReaderUrl(null);
          }}
        />
      )}

      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            className={`notification-toast notification-${notification.type}`}
            initial={{ opacity: 0, y: -20, x: -20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -20, x: -20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <div className="notification-content">
              {notification.type === 'success' && (
                <span className="notification-icon">✓</span>
              )}
              {notification.type === 'error' && (
                <span className="notification-icon">✕</span>
              )}
              <p className="notification-message">{notification.message}</p>
            </div>
            <motion.div
              className="notification-progress"
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: 4, ease: 'linear' }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bookmarks Toggle Button - Only show when bookmarks exist */}
      {user && universityFilter && (() => {
        // Count bookmarks only for papers in the current university
        const currentUniversityBookmarkCount = paperBookmarks.filter(
          bookmarkId => displayedPapers.some(paper => paper.id === bookmarkId)
        ).length;
        
        // Only render button if there are bookmarked papers
        if (currentUniversityBookmarkCount === 0) {
          return null;
        }
        
        return (
          <motion.button
            onClick={() => setShowBookmarksPanel(!showBookmarksPanel)}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            style={{
              position: 'fixed',
              bottom: '24px',
              right: '24px',
              zIndex: 999,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              transition: 'all 0.2s'
            }}
            title="View Bookmarked Papers"
          >
            <FiBookmark size={16} color="#00a884" />
            <span style={{
              color: '#00a884',
              fontSize: '11px',
              fontWeight: '600'
            }}>
              {currentUniversityBookmarkCount}
            </span>
          </motion.button>
        );
      })()}

      {/* Bookmarks Sidebar Panel */}
      <AnimatePresence>
        {showBookmarksPanel && user && (
          <motion.div
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            transition={{ type: 'spring', damping: 25 }}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              width: '320px',
              height: '100vh',
              background: '#0b1216',
              boxShadow: '-2px 0 10px rgba(0, 0, 0, 0.3)',
              zIndex: 1000,
              padding: '20px',
              overflowY: 'auto',
              borderLeft: '1px solid #2a3942'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#cbd5f5', fontSize: '1.1rem' }}>Bookmarked Papers</h3>
              <button
                onClick={() => setShowBookmarksPanel(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#8696a0',
                  fontSize: '1.2rem'
                }}
              >
                ✕
              </button>
            </div>

            {displayedPapers.filter(p => paperBookmarks.includes(p.id)).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {displayedPapers
                  .filter(p => paperBookmarks.includes(p.id))
                  .map(paper => (
                    <div
                      key={paper.id}
                      onClick={() => {
                        viewPaperDetails(paper);
                        setShowBookmarksPanel(false);
                      }}
                      style={{
                        padding: '12px',
                        background: '#1a2332',
                        border: '1px solid #2a3942',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#252f3c';
                        e.currentTarget.style.borderColor = '#34B7F1';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#1a2332';
                        e.currentTarget.style.borderColor = '#2a3942';
                      }}
                    >
                      <div style={{ color: '#cbd5f5', fontSize: '0.9rem', fontWeight: '500', marginBottom: '4px' }}>
                        {paper.unit_name || 'Past Paper'}
                      </div>
                      <div style={{ color: '#64748b', fontSize: '0.8rem' }}>
                        {paper.year} • {paper.exam_type}
                      </div>
                      <div style={{ color: '#8696a0', fontSize: '0.75rem', marginTop: '4px' }}>
                        {paper.faculty || 'Faculty'}
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#8696a0', padding: '40px 0' }}>
                <FiBookmark size={40} style={{ marginBottom: '12px', opacity: 0.5 }} />
                <p>No bookmarked papers yet</p>
                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Bookmark papers to save them for later</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
