import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import profilePlaceholder from '../../../BookDashboard/user-profile.svg';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'downloads', label: 'Downloads' },
  { id: 'likes', label: 'Liked Books' },
  { id: 'uploads', label: 'Uploads' },
  { id: 'search_overview', label: 'Search Overview' },
];

const COLORS = ['#00a884', '#34B7F1', '#FFCC00', '#f15e6c', '#8b5cf6', '#22d3ee'];

const UserDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [views, setViews] = useState([]);
  const [downloads, setDownloads] = useState([]);
  const [likes, setLikes] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [pastPapers, setPastPapers] = useState([]);
  const [universities, setUniversities] = useState([]);
  const [readingSessions, setReadingSessions] = useState([]);
  const [readingGoals, setReadingGoals] = useState([]);
  const [readingStats, setReadingStats] = useState(null);
  const [readingStreak, setReadingStreak] = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [authorLikes, setAuthorLikes] = useState([]);
  const [authorFollows, setAuthorFollows] = useState([]);
  const [authorRatings, setAuthorRatings] = useState([]);
  const [authorStats, setAuthorStats] = useState([]);
  const [firstLogin, setFirstLogin] = useState(null);
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(location.search);
    const t = params.get('tab');
    return t && TABS.some(tab => tab.id === t) ? t : 'overview';
  });

  useEffect(() => {
    if (!id) return;
    if (activeTab === 'search_overview') {
      navigate(`/books/admin/users/${id}/search`);
    }
  }, [activeTab, id, navigate]);

  useEffect(() => {
    // Keep tab in sync if query param changes
    const params = new URLSearchParams(location.search);
    const t = params.get('tab');
    if (t && TABS.some(tab => tab.id === t) && t !== activeTab) {
      setActiveTab(t);
    }
  }, [location.search]);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      setLoading(true);
      try {
        // First, get profile data with username
        const profileRes = await supabase
          .from('profiles')
          .select('id, email, username, display_name, full_name, role, created_at, avatar_url, subscription_tier')
          .eq('id', id)
          .maybeSingle();

        if (profileRes.error) throw profileRes.error;
        setProfile(profileRes.data || null);
        console.log('✅ Profile loaded:', profileRes.data);
        console.log('👤 Profile keys:', Object.keys(profileRes.data || {}));
        console.log('📝 Username field:', profileRes.data?.username);
        console.log('📝 Display name field:', profileRes.data?.display_name);
        console.log('📝 Full name field:', profileRes.data?.full_name);
        console.log('👮 Role field (raw):', profileRes.data?.role);
        console.log('👮 Role type:', typeof profileRes.data?.role);
        console.log('👮 Role JSON:', JSON.stringify(profileRes.data?.role));

        // Get likes, downloads, views data
        const [viewsRes, likesRes, downloadsRes, uploadsRes, pastPapersRes, universitiesRes, firstLoginRes] = await Promise.all([
          supabase
            .from('book_views')
            .select('id, book_id, viewed_at')
            .eq('user_id', id)
            .order('viewed_at', { ascending: false }),
          supabase
            .from('book_likes')
            .select('id, book_id, created_at')
            .eq('user_id', id)
            .order('created_at', { ascending: false }),
          supabase
            .from('book_downloads')
            .select('id, book_id, downloaded_at')
            .eq('user_id', id)
            .order('downloaded_at', { ascending: false }),
          supabase
            .from('books')
            .select('id, title, author, created_at, downloads_count, year, language, publisher')
            .eq('uploaded_by', id)
            .order('created_at', { ascending: false }),
          supabase
            .from('past_papers')
            .select('id, title, unit_code, unit_name, created_at')
            .eq('uploaded_by', id)
            .order('created_at', { ascending: false }),
          supabase
            .from('universities')
            .select('id, name, code, created_at')
            .eq('uploaded_by', id)
            .order('created_at', { ascending: false }),
          // Fetch first login info - with better error handling
          supabase
            .from('first_login_tracking')
            .select('id, user_id, first_login_at, first_login_date, first_login_time, timezone, device_type, browser, operating_system, ip_address, user_agent, location')
            .eq('user_id', id)
            .maybeSingle(),
        ]);

        const viewsData = viewsRes.error ? [] : viewsRes.data || [];
        const likesData = likesRes.error ? [] : likesRes.data || [];
        const downloadsData = downloadsRes.error ? [] : downloadsRes.data || [];
        const uploadsData = uploadsRes.error ? [] : uploadsRes.data || [];
        const pastPapersData = pastPapersRes.error ? [] : pastPapersRes.data || [];
        const universitiesData = universitiesRes.error ? [] : universitiesRes.data || [];
        
        // Log any errors
        if (viewsRes.error) console.error('❌ Views error:', viewsRes.error);
        if (likesRes.error) console.error('❌ Likes error:', likesRes.error);
        if (downloadsRes.error) console.error('❌ Downloads error:', downloadsRes.error);
        if (uploadsRes.error) console.error('❌ Uploads error:', uploadsRes.error);
        if (pastPapersRes.error) console.error('❌ Past Papers error:', pastPapersRes.error);
        if (universitiesRes.error) console.error('❌ Universities error:', universitiesRes.error);
        if (firstLoginRes.error) console.error('❌ First Login error:', firstLoginRes.error);
        
        // Get first login data
        const firstLoginData = firstLoginRes.error ? null : firstLoginRes.data;
        console.log('🔑 First login response:', firstLoginRes);
        console.log('🔑 First login data:', firstLoginData);
        console.log('🔑 First login data keys:', Object.keys(firstLoginData || {}));
        console.log('🔑 First login error:', firstLoginRes.error);
        console.log('🔑 First login status:', firstLoginRes.status);
        if (firstLoginData) {
          console.log('🔑 First login has data:');
          console.log('  - first_login_at:', firstLoginData.first_login_at);
          console.log('  - device_type:', firstLoginData.device_type);
          console.log('  - browser:', firstLoginData.browser);
          console.log('  - operating_system:', firstLoginData.operating_system);
          console.log('  - ip_address:', firstLoginData.ip_address);
          console.log('  - timezone:', firstLoginData.timezone);
        }

        // Log errors if any
        if (likesRes.error) console.error('Likes fetch error:', likesRes.error);
        if (downloadsRes.error) console.error('Downloads fetch error:', downloadsRes.error);

        console.log('Data fetched - Likes:', likesData.length, 'Downloads:', downloadsData.length);
        
        // DEBUG: Show raw downloads data
        if (downloadsData.length > 0) {
          console.log('📥 First download record:', downloadsData[0]);
          console.log('📥 Download record keys:', Object.keys(downloadsData[0]));
          console.log('📥 All download book_ids:', downloadsData.map(d => d.book_id));
        } else {
          console.log('⚠️ No downloads data');
        }
        
        if (likesData.length > 0) {
          console.log('❤️ First like record:', likesData[0]);
          console.log('❤️ Like record keys:', Object.keys(likesData[0]));
        }

        // Collect ALL unique book IDs from likes, views, downloads
        const bookIds = Array.from(
          new Set([
            ...likesData.map((l) => l.book_id).filter(Boolean),
            ...viewsData.map((v) => v.book_id).filter(Boolean),
            ...downloadsData.map((d) => d.book_id).filter(Boolean),
          ])
        );

        console.log('Total unique book IDs to fetch:', bookIds.length);
        console.log('Book IDs from downloads:', downloadsData.map((d) => d.book_id).filter(Boolean));
        console.log('Book IDs from views:', viewsData.map((v) => v.book_id).filter(Boolean));
        console.log('Book IDs from likes:', likesData.map((l) => l.book_id).filter(Boolean));

        // Fetch all books in one query (with batching if too many IDs)
        let booksMap = new Map();
        if (bookIds.length > 0) {
          console.log('Fetching', bookIds.length, 'books from IDs');
          
          // Batch requests if there are too many IDs (Supabase has limits)
          const batchSize = 30; // Reduced from 50 to be safer
          const batches = [];
          
          for (let i = 0; i < bookIds.length; i += batchSize) {
            const batch = bookIds.slice(i, i + batchSize);
            batches.push(
              (async () => {
                try {
                  const { data, error } = await supabase
                    .from('books')
                    .select('id, title, author')
                    .in('id', batch);
                  
                  if (error) {
                    console.error(`🔴 Error in batch (${batch.length} items):`, error.message);
                    return [];
                  }
                  
                  console.log(`✅ Batch loaded: ${data?.length || 0} books`);
                  return data || [];
                } catch (err) {
                  console.error('🔴 Catch error in batch:', err);
                  return [];
                }
              })()
            );
          }

          try {
            const results = await Promise.all(batches);
            let allBooks = results.flat();
            
            if (allBooks.length > 0) {
              booksMap = new Map(allBooks.map((b) => [b.id, b]));
              console.log('✅ Books map populated with:', booksMap.size, 'entries');
              allBooks.forEach((b) => console.log(`  ✓ ${b.id.substring(0, 8)}: "${b.title}" by ${b.author}`));
            } else {
              console.log('⚠️ No books found in batches');
            }
          } catch (err) {
            console.error('🔴 Error in Promise.all:', err);
          }
        } else {
          console.log('⚠️ No book IDs found in user data');
        }

        // Enrich all datasets with book data
        const withBook = (row) => ({
          ...row,
          book: booksMap.get(row.book_id) || null,
        });

        const enrichedLikes = likesData.map(withBook);
        const enrichedViews = viewsData.map(withBook);
        const enrichedDownloads = downloadsData.map(withBook);

        console.log('✅ After enrichment - Likes with books:', enrichedLikes.filter(l => l.book).length);
        console.log('✅ After enrichment - Views with books:', enrichedViews.filter(v => v.book).length);
        console.log('✅ After enrichment - Downloads with books:', enrichedDownloads.filter(d => d.book).length);
        
        // Show first enriched download
        if (enrichedDownloads.length > 0) {
          console.log('📥 First enriched download:', enrichedDownloads[0]);
          console.log('📥 Has book?', enrichedDownloads[0].book ? 'YES' : 'NO');
          if (enrichedDownloads[0].book) {
            console.log('📥 Book title:', enrichedDownloads[0].book.title);
          }
        }

        setLikes(enrichedLikes);
        setViews(enrichedViews);
        setDownloads(enrichedDownloads);

        setUploads(uploadsData || []);
        setPastPapers(pastPapersData || []);
        setUniversities(universitiesData || []);
        setFirstLogin(firstLoginData);

        // Set empty arrays for removed tables
        setSubscriptions([]);
        setReadingSessions([]);
        setReadingGoals([]);
        setReadingStats(null);
        setReadingStreak(null);
        setAchievements([]);
        setAuthorLikes([]);
        setAuthorFollows([]);
        setAuthorRatings([]);
        setAuthorStats([]);
      } catch (err) {
        console.error('Failed to load user details', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  const viewSummary = useMemo(() => {
    const byBook = new Map();
    views.forEach((v) => {
      if (!v.book_id) return;
      const existing = byBook.get(v.book_id) || {
        book: v.book || null,
        count: 0,
        lastViewed: null,
      };
      existing.count += 1;
      const ts = v.viewed_at ? new Date(v.viewed_at).getTime() : 0;
      const lastTs = existing.lastViewed ? new Date(existing.lastViewed).getTime() : 0;
      if (ts > lastTs) existing.lastViewed = v.viewed_at;
      byBook.set(v.book_id, existing);
    });
    return Array.from(byBook.values());
  }, [views]);

  const likesCount = likes.length;
  const viewsCount = views.length;
  const downloadsCount = downloads.length;
  const uploadsCount = uploads.length;
  const pastPapersCount = pastPapers.length;
  const universitiesCount = universities.length;

  const totalEngagement = viewsCount + likesCount + downloadsCount + uploadsCount + pastPapersCount + universitiesCount;

  const engagementShare = (value) => {
    if (!totalEngagement) return 0;
    return Math.round((value / totalEngagement) * 100);
  };

  const engagementPieData = useMemo(() => {
    return [
      { name: 'Views', value: viewsCount },
      { name: 'Downloads', value: downloadsCount },
      { name: 'Uploads', value: uploadsCount },
    ].filter((d) => d.value > 0);
  }, [viewsCount, likesCount, downloadsCount, uploadsCount]);

  const activitySeries = useMemo(() => {
    const byDay = new Map();

    const add = (dateStr, key) => {
      if (!dateStr) return;
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return;
      const dayKey = d.toISOString().slice(0, 10);
      const existing = byDay.get(dayKey) || { day: dayKey, views: 0, downloads: 0 };
      existing[key] += 1;
      byDay.set(dayKey, existing);
    };

    views.forEach((v) => add(v.viewed_at, 'views'));
    downloads.forEach((d) => add(d.downloaded_at, 'downloads'));

    return Array.from(byDay.values()).sort((a, b) => (a.day < b.day ? -1 : 1));
  }, [views, downloads]);

  const downloadsSummary = useMemo(() => {
    const byBook = new Map();
    downloads.forEach((d) => {
      if (!d.book_id) return;
      const existing = byBook.get(d.book_id) || {
        book: d.book || null,
        count: 0,
        lastDownloaded: null,
      };
      existing.count += 1;
      const ts = d.downloaded_at ? new Date(d.downloaded_at).getTime() : 0;
      const lastTs = existing.lastDownloaded ? new Date(existing.lastDownloaded).getTime() : 0;
      if (ts > lastTs) existing.lastDownloaded = d.downloaded_at;
      byBook.set(d.book_id, existing);
    });
    return Array.from(byBook.values());
  }, [downloads]);

  const latestSubscription = useMemo(() => {
    if (!subscriptions || subscriptions.length === 0) return null;
    return subscriptions[0];
  }, [subscriptions]);

  const renderTabContent = () => {
    if (activeTab === 'overview') {
      return (
        <div>
          {/* User Profile & First Login Details */}
          <div style={{ marginBottom: 16, padding: 12, borderRadius: 12, background: '#111b21', border: '1px solid #202c33' }}>
            <div style={{ color: '#e9edef', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>📋 User Profile & Login Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              {/* Email */}
              <div style={{ padding: 8, borderRadius: 8, background: 'rgba(0,0,0,0.2)' }}>
                <div style={{ color: '#8696a0', fontSize: 11, marginBottom: 4 }}>📧 Email</div>
                <div style={{ color: '#e9edef', fontSize: 13, fontWeight: 500 }}>{profile?.email || '—'}</div>
              </div>

              {/* Username */}
              <div style={{ padding: 8, borderRadius: 8, background: 'rgba(0,0,0,0.2)' }}>
                <div style={{ color: '#8696a0', fontSize: 11, marginBottom: 4 }}>👥 Username</div>
                <div style={{ color: '#e9edef', fontSize: 13, fontWeight: 500 }}>
                  {profile?.username || profile?.display_name || profile?.full_name || '—'}
                </div>
              </div>

              {/* Role */}
              <div style={{ padding: 8, borderRadius: 8, background: 'rgba(0,0,0,0.2)' }}>
                <div style={{ color: '#8696a0', fontSize: 11, marginBottom: 4 }}>👤 Role</div>
                <div style={{ color: '#e9edef', fontSize: 13, fontWeight: 500 }}>
                  {profile?.role ? profile.role
                    .split('_')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ') : '—'}
                </div>
              </div>

              {/* Account Created */}
              <div style={{ padding: 8, borderRadius: 8, background: 'rgba(0,0,0,0.2)' }}>
                <div style={{ color: '#8696a0', fontSize: 11, marginBottom: 4 }}>📅 Account Created</div>
                <div style={{ color: '#e9edef', fontSize: 13, fontWeight: 500 }}>
                  {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                </div>
              </div>

              {/* Subscription Tier */}
              <div style={{ padding: 8, borderRadius: 8, background: 'rgba(0,0,0,0.2)' }}>
                <div style={{ color: '#8696a0', fontSize: 11, marginBottom: 4 }}>💎 Subscription</div>
                <div style={{ color: '#e9edef', fontSize: 13, fontWeight: 500, textTransform: 'capitalize' }}>
                  {latestSubscription?.status || profile?.subscription_tier || 'None'}
                </div>
              </div>

              {/* First Login Date */}
              <div style={{ padding: 8, borderRadius: 8, background: 'rgba(0, 168, 132, 0.1)', border: '1px solid rgba(0, 168, 132, 0.3)' }}>
                <div style={{ color: '#8696a0', fontSize: 11, marginBottom: 4 }}>🔓 First Login (Member Since)</div>
                <div style={{ color: '#00a884', fontSize: 13, fontWeight: 600 }}>
                  {firstLogin?.first_login_at 
                    ? new Date(firstLogin.first_login_at).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
                    : firstLogin?.first_login_date
                    ? firstLogin.first_login_date
                    : '—'
                  }
                </div>
                <div style={{ color: '#7a8a94', fontSize: 10, marginTop: 4 }}>
                  {firstLogin?.timezone 
                    ? `Timezone: ${firstLogin.timezone}` 
                    : firstLogin?.first_login_time 
                    ? `Time: ${firstLogin.first_login_time?.substring(0, 8)} UTC` 
                    : ''}
                </div>
              </div>

              {/* First Login Time - REMOVED, now combined above */}

              {/* Device Type */}
              <div style={{ padding: 8, borderRadius: 8, background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                <div style={{ color: '#8696a0', fontSize: 11, marginBottom: 4 }}>📱 Device</div>
                <div style={{ color: '#8b5cf6', fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>
                  {firstLogin?.device_type || '—'}
                </div>
              </div>

              {/* Browser */}
              <div style={{ padding: 8, borderRadius: 8, background: 'rgba(255, 204, 0, 0.1)', border: '1px solid rgba(255, 204, 0, 0.3)' }}>
                <div style={{ color: '#8696a0', fontSize: 11, marginBottom: 4 }}>🌐 Browser</div>
                <div style={{ color: '#FFCC00', fontSize: 13, fontWeight: 600 }}>
                  {firstLogin?.browser || '—'}
                </div>
              </div>

              {/* Operating System */}
              <div style={{ padding: 8, borderRadius: 8, background: 'rgba(241, 94, 108, 0.1)', border: '1px solid rgba(241, 94, 108, 0.3)' }}>
                <div style={{ color: '#8696a0', fontSize: 11, marginBottom: 4 }}>🖥️ OS</div>
                <div style={{ color: '#f15e6c', fontSize: 13, fontWeight: 600 }}>
                  {firstLogin?.operating_system || '—'}
                </div>
              </div>

              {/* IP Address */}
              <div style={{ padding: 8, borderRadius: 8, background: 'rgba(52, 183, 241, 0.1)', border: '1px solid rgba(52, 183, 241, 0.3)' }}>
                <div style={{ color: '#8696a0', fontSize: 11, marginBottom: 4 }}>🌍 IP Address</div>
                <div style={{ color: '#34B7F1', fontSize: 13, fontWeight: 600, wordBreak: 'break-all' }}>
                  {firstLogin?.ip_address || '—'}
                </div>
              </div>

              {/* Account Age */}
              <div style={{ padding: 8, borderRadius: 8, background: 'rgba(0,0,0,0.2)' }}>
                <div style={{ color: '#8696a0', fontSize: 11, marginBottom: 4 }}>⏱️ Account Age</div>
                <div style={{ color: '#e9edef', fontSize: 13, fontWeight: 500 }}>
                  {profile?.created_at ? (() => {
                    const days = Math.floor((new Date() - new Date(profile.created_at)) / (1000 * 60 * 60 * 24));
                    return `${days} days`;
                  })() : '—'}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {[{
              label: 'Books Viewed',
              value: viewsCount,
              color: '#00a884',
              bg: 'rgba(0,168,132,0.1)',
            }, {
              label: 'Downloads',
              value: downloadsCount,
              color: '#8b5cf6',
              bg: 'rgba(139,92,246,0.1)',
            }, {
              label: 'Books Uploaded',
              value: uploadsCount,
              color: '#f15e6c',
              bg: 'rgba(241,94,108,0.1)',
            }, {
              label: 'Past Papers',
              value: pastPapersCount,
              color: '#FF9500',
              bg: 'rgba(255,149,0,0.1)',
            }, {
              label: 'Universities',
              value: universitiesCount,
              color: '#5AC8FA',
              bg: 'rgba(90,200,250,0.1)',
            }].map((card, idx) => {
              const pct = engagementShare(card.value);
              return (
                <div
                  key={idx}
                  style={{
                    padding: 8,
                    borderRadius: 12,
                    background: '#111b21',
                    minWidth: 200,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div style={{ color: '#8696a0', fontSize: 12 }}>{card.label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                    <div style={{ fontSize: 22, fontWeight: 600 }}>{card.value}</div>
                    <div
                      style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: card.bg,
                        color: card.color,
                      }}
                    >
                      {totalEngagement ? `${pct}% of activity` : '—'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {latestSubscription && (
            <div
              style={{
                marginTop: 6,
                padding: 8,
                borderRadius: 12,
                background: '#111b21',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                maxWidth: 420,
              }}
            >
              <div style={{ fontSize: 13, color: '#8696a0' }}>Latest Subscription</div>
              <div style={{ fontSize: 13 }}>
                <strong>{latestSubscription.product}</strong> · Plan {latestSubscription.plan_id} · Ksh{' '}
                {latestSubscription.price_kes}
              </div>
              <div style={{ fontSize: 12, color: '#8696a0' }}>
                Status:{' '}
                <span style={{ fontWeight: 600 }}>{latestSubscription.status}</span>
                {latestSubscription.start_at && (
                  <>
                    {' '}
                    · From {new Date(latestSubscription.start_at).toLocaleDateString()} to{' '}
                    {latestSubscription.end_date
                      ? new Date(latestSubscription.end_date).toLocaleDateString()
                      : '—'}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (activeTab === 'uploads') {
      return (
        <div>
          {uploads.length === 0 ? (
            <div style={{ color: '#8696a0' }}>No uploads recorded for this user.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Author</th>
                  <th>Year</th>
                  <th>Language</th>
                  <th>Views</th>
                  <th>Downloads</th>
                  <th>Uploaded At</th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((b) => (
                  <tr key={b.id}>
                    <td>{b.title}</td>
                    <td>{b.author || '—'}</td>
                    <td>{b.year || '—'}</td>
                    <td>{b.language || '—'}</td>
                    <td>{b.views ?? 0}</td>
                    <td>{b.downloads ?? 0}</td>
                    <td>{b.created_at ? new Date(b.created_at).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      );
    }

    if (activeTab === 'downloads') {
      return (
        <div>
          {downloadsSummary.length === 0 ? (
            <div style={{ color: '#8696a0' }}>No downloads recorded for this user.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Book</th>
                  <th>Author</th>
                  <th>Times Downloaded</th>
                  <th>Last Downloaded</th>
                </tr>
              </thead>
              <tbody>
                {downloadsSummary.map((row, idx) => (
                  <tr key={idx}>
                    <td>{row.book?.title || 'Unknown'}</td>
                    <td>{row.book?.author || '—'}</td>
                    <td>{row.count}</td>
                    <td>
                      {row.lastDownloaded
                        ? new Date(row.lastDownloaded).toLocaleString()
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      );
    }

    if (activeTab === 'likes') {
      return (
        <div>
          {likes.length === 0 ? (
            <div style={{ color: '#8696a0' }}>No liked books for this user.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Book Title</th>
                  <th>Author</th>
                  <th>Liked At</th>
                </tr>
              </thead>
              <tbody>
                {likes.map((like) => (
                  <tr key={like.id}>
                    <td style={{ wordWrap: 'break-word', maxWidth: 300 }}>
                      {like.book?.title && like.book?.id ? (
                        <a href={`/book/${like.book.id}`} style={{ color: '#00a884', textDecoration: 'none', fontWeight: 500 }}>
                          {like.book.title}
                        </a>
                      ) : (
                        <span style={{ color: '#8696a0' }}>—</span>
                      )}
                    </td>
                    <td style={{ color: like.book?.author ? '#e9edef' : '#8696a0' }}>
                      {like.book?.author || '—'}
                    </td>
                    <td style={{ fontSize: 12, color: '#8696a0' }}>
                      {like.created_at
                        ? new Date(like.created_at).toLocaleString('en-US', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric', 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      );
    }

    if (activeTab === 'authors') {
      const statsByAuthor = new Map(
        (authorStats || []).map((s) => [s.author_name, s])
      );

      return (
        <div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <div
              style={{
                padding: 8,
                borderRadius: 12,
                background: '#111b21',
                minWidth: 180,
              }}
            >
              <div style={{ color: '#8696a0', fontSize: 12 }}>Authors Followed</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{authorFollows.length}</div>
            </div>
            <div
              style={{
                padding: 8,
                borderRadius: 12,
                background: '#111b21',
                minWidth: 180,
              }}
            >
              <div style={{ color: '#8696a0', fontSize: 12 }}>Authors Rated</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{authorRatings.length}</div>
            </div>
          </div>

          <h4 style={{ color: '#e9edef', marginBottom: 8 }}>Author Ratings</h4>
          {authorRatings.length === 0 ? (
            <div style={{ color: '#8696a0', marginBottom: 12 }}>No author ratings from this user.</div>
          ) : (
            <table className="table" style={{ marginBottom: 12 }}>
              <thead>
                <tr>
                  <th>Author</th>
                  <th>Rating</th>
                  <th>Given At</th>
                  <th>Author Avg Rating</th>
                  <th>Author Rating Count</th>
                </tr>
              </thead>
              <tbody>
                {authorRatings.map((r) => {
                  const s = statsByAuthor.get(r.author_name);
                  return (
                    <tr key={r.id}>
                      <td>{r.author_name}</td>
                      <td>{r.rating}</td>
                      <td>{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</td>
                      <td>{s?.average_rating ?? '—'}</td>
                      <td>{s?.rating_count ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <h4 style={{ color: '#e9edef', marginBottom: 8 }}>Authors Followed</h4>
          {authorFollows.length === 0 ? (
            <div style={{ color: '#8696a0', marginBottom: 12 }}>No authors followed by this user.</div>
          ) : (
            <table className="table" style={{ marginBottom: 12 }}>
              <thead>
                <tr>
                  <th>Author</th>
                  <th>Followed At</th>
                  <th>Total Followers</th>
                </tr>
              </thead>
              <tbody>
                {authorFollows.map((f) => {
                  const s = statsByAuthor.get(f.author_name);
                  return (
                    <tr key={f.id}>
                      <td>{f.author_name}</td>
                      <td>{f.created_at ? new Date(f.created_at).toLocaleString() : '—'}</td>
                      <td>{s?.followers_count ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <h4 style={{ color: '#e9edef', marginBottom: 8 }}>Authors Liked</h4>
          {authorLikes.length === 0 ? (
            <div style={{ color: '#8696a0' }}>No authors liked by this user.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Author</th>
                  <th>Liked At</th>
                </tr>
              </thead>
              <tbody>
                {authorLikes.map((l) => {
                  const s = statsByAuthor.get(l.author_name);
                  return (
                    <tr key={l.id}>
                      <td>{l.author_name}</td>
                      <td>{l.created_at ? new Date(l.created_at).toLocaleString() : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="panel">
      <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
        <button className="btn" onClick={() => navigate(-1)}>
          Back
        </button>
        <span>User Details</span>
      </div>

      {loading ? (
        <div style={{ color: '#8696a0', padding: 12 }}>Loading user details...</div>
      ) : !profile ? (
        <div style={{ color: '#8696a0', padding: 12 }}>User not found.</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="viewer-avatar" style={{ width: 48, height: 48, fontSize: 20 }}>
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.display_name || profile.email || 'User avatar'}
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                    onError={(e) => {
                      // Fallback to initials if image fails
                      e.target.style.display = 'none';
                      if (e.target.parentElement) {
                        const initials = (profile.display_name || profile.email || '?').charAt(0).toUpperCase();
                        e.target.parentElement.textContent = initials;
                      }
                    }}
                  />
                ) : (
                  <img src={profilePlaceholder} alt="Profile placeholder" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                )}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>
                  {profile.username || profile.display_name || profile.full_name || '—'}
                </div>
                <div style={{ color: '#8696a0', fontSize: 13 }}>{profile.email}</div>
                <div style={{ color: '#8696a0', fontSize: 12 }}>
                  Role: <strong>{profile?.role ? profile.role
                    .split('_')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ') : 'Viewer'}</strong>
                  {profile.created_at && (
                    <>
                      {' '}
                      · Joined {new Date(profile.created_at).toLocaleDateString()}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className="btn"
                style={{
                  padding: '6px 14px',
                  fontSize: 12,
                  background: activeTab === tab.id ? '#202c33' : 'transparent',
                  borderColor: activeTab === tab.id ? '#23a76d' : 'rgba(134,150,160,0.3)',
                }}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {renderTabContent()}
        </>
      )}
    </div>
  );
};

export default UserDetails;
