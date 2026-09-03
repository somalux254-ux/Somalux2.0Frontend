import React, { useEffect, useState } from 'react';
import { fetchStats, fetchViewDetails } from '../api';
import { FiX, FiEye } from 'react-icons/fi';
import { Box, Grid, Card, CardContent, Typography, Divider } from '@mui/material';
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


const Dashboard = () => {
  const [stats, setStats] = useState({
    counts: { books: 0, users: 0, downloads: 0, views: 0, universities: 0, pastPapers: 0 },
    monthly: [],
    top: [],
    topPastPapers: [],
    recent: [],
  });
  const [loading, setLoading] = useState(true);
  const [showViewsModal, setShowViewsModal] = useState(false);
  const [viewDetails, setViewDetails] = useState([]);
  const [loadingViews, setLoadingViews] = useState(false);
  const [viewerPages, setViewerPages] = useState({});
  const [expandedViewers, setExpandedViewers] = useState({});
  // Per-user pagination for view timestamps inside the dropdown
  const [viewerTimePages, setViewerTimePages] = useState({});
  const [monthlyPage, setMonthlyPage] = useState(1);
  const [topPage, setTopPage] = useState(1);
  const [topPastPapersPage, setTopPastPapersPage] = useState(1);
  const [activityTrendTab, setActivityTrendTab] = useState('books'); // 'books' or 'pastpapers'

  // added: pagination for viewDetails table
  const [viewPage, setViewPage] = useState(1);
  const VIEW_PAGE_SIZE = 15;

  const OVERVIEW_PAGE_SIZE = 7;

  // Normalized datasets for charts
  const safeMonthly = (stats.monthly || []).map(d => ({
    month: d.month || 'Unknown',
    Uploads: Number(d.uploads || d.uploads || 0),
  })).filter(d => !isNaN(d.Uploads));
  const safeTop = (stats.top || []).map(b => ({
    title: b.title || 'Untitled',
    downloads: Number(b.downloads_count || b.downloads || b.Downloads || 0),
    views: Number(b.views_count || b.views || b.Views || 0),
  })).filter(b => !isNaN(b.downloads));
  const safeTopPastPapers = (stats.topPastPapers || []).map(p => ({
    title: p.title || 'Untitled',
    downloads: Number(p.downloads_count || p.downloads || 0),
    views: Number(p.views_count || p.views || 0),
  })).filter(p => !isNaN(p.downloads));

  // Time-series data for line chart (uploads/views/downloads if available)
  const _extractNumber = (obj, ...keys) => {
    for (const k of keys) {
      if (obj && Object.prototype.hasOwnProperty.call(obj, k)) {
        const v = Number(obj[k]);
        if (!Number.isNaN(v)) return v;
      }
    }
    return 0;
  };

  // robust download extractor (supports many common variants)
  const extractDownloads = (m) =>
    _extractNumber(
      m,
      'downloads',
      'Downloads',
      'download_count',
      'downloadCount',
      'total_downloads',
      'totalDownloads',
      'dls',
    );

  const extractUploads = (m) =>
    _extractNumber(m, 'uploads', 'Uploads', 'upload_count', 'uploadCount', 'total_uploads', 'totalUploads');

  const extractViews = (m) =>
    _extractNumber(m, 'views', 'Views', 'view_count', 'viewCount', 'total_views', 'totalViews');

  const months = (stats.monthly || []).map(m => ({
    raw: m,
    month: m.month || m.label || 'Unknown',
    uploads: extractUploads(m),
    views: extractViews(m),
    downloads: extractDownloads(m),
  }));

  // If monthly download values are all zero but we have a total downloads counter,
  // distribute total downloads across months proportionally to uploads (or evenly).
  const totalDownloadsAvailable = (months.some(m => m.downloads > 0));
  const overallDownloads = Number(stats.counts?.downloads || 0);

  let timeSeries = months.map(m => ({ month: m.month, uploads: m.uploads, views: m.views, downloads: m.downloads }));

  if (!totalDownloadsAvailable && overallDownloads > 0 && timeSeries.length > 0) {
    const totalUploads = timeSeries.reduce((s, r) => s + (r.uploads || 0), 0);
    if (totalUploads > 0) {
      // distribute proportionally by uploads
      timeSeries = timeSeries.map(r => ({
        ...r,
        downloads: Math.round(((r.uploads || 0) / totalUploads) * overallDownloads),
      }));
      // adjust rounding errors to match overallDownloads exactly
      const assigned = timeSeries.reduce((s, r) => s + (r.downloads || 0), 0);
      let diff = overallDownloads - assigned;
      for (let i = 0; diff !== 0 && i < timeSeries.length; i += 1) {
        timeSeries[i].downloads = (timeSeries[i].downloads || 0) + (diff > 0 ? 1 : -1);
        diff += (diff > 0 ? -1 : 1);
      }
    } else {
      // distribute evenly
      const base = Math.floor(overallDownloads / timeSeries.length);
      let remainder = overallDownloads - base * timeSeries.length;
      timeSeries = timeSeries.map((r) => {
        const add = remainder > 0 ? 1 : 0;
        remainder -= add;
        return { ...r, downloads: base + add };
      });
    }
  }

  // Ensure numeric values and remove NaN entries
  timeSeries = timeSeries.map(d => ({
    month: d.month || 'Unknown',
    uploads: Number(d.uploads || 0),
    views: Number(d.views || 0),
    downloads: Number(d.downloads || 0),
  })).filter(d => !Number.isNaN((d.uploads || 0) + (d.views || 0) + (d.downloads || 0)));

  const calcTrend = (series, key) => {
    if (!series || series.length < 2) return null;
    const values = series.map(d => Number(d[key] || 0));
    const current = values[values.length - 1];
    const prev = values[values.length - 2];
    if (!prev) return null;
    return ((current - prev) / prev) * 100;
  };

  const formatTrend = (value) => {
    if (value === null || Number.isNaN(value)) return '-';
    const rounded = value.toFixed(1);
    const sign = value > 0 ? '+' : '';
    return `${sign}${rounded}%`;
  };

  const uploadsTrend = calcTrend(timeSeries, 'uploads');
  const viewsTrend = calcTrend(timeSeries, 'views');
  const downloadsTrend = calcTrend(timeSeries, 'downloads');

  // Past Papers time series data (for Activity Trend tabs)
  const monthsPastPapers = (stats.monthlyPastPapers || []).map(m => ({
    raw: m,
    month: m.month || m.label || 'Unknown',
    uploads: Number(m.uploads || 0),
    views: Number(m.views || 0),
    downloads: extractDownloads(m),
  }));

  const pastPapersTimeSeries = monthsPastPapers.map(m => ({
    month: m.month,
    uploads: m.uploads,
    views: m.views,
    downloads: 0
  }));

  // Only show non-zero rows in tables and sort highest first
  const nonZeroMonthly = safeMonthly
    .filter(m => m.Uploads > 0)
    .sort((a, b) => b.Uploads - a.Uploads);
  const nonZeroTop = safeTop
    .filter(b => b.downloads > 0)
    .sort((a, b) => b.downloads - a.downloads);
  const nonZeroTopPastPapers = safeTopPastPapers
    .filter(p => p.downloads > 0)
    .sort((a, b) => b.downloads - a.downloads);

  const monthlyTotalPages = Math.max(1, Math.ceil((nonZeroMonthly.length || 0) / OVERVIEW_PAGE_SIZE));
  const topTotalPages = Math.max(1, Math.ceil((nonZeroTop.length || 0) / OVERVIEW_PAGE_SIZE));
  const topPastPapersTotalPages = Math.max(1, Math.ceil((nonZeroTopPastPapers.length || 0) / OVERVIEW_PAGE_SIZE));

  const monthlyStart = (monthlyPage - 1) * OVERVIEW_PAGE_SIZE;
  const monthlyEnd = monthlyStart + OVERVIEW_PAGE_SIZE;
  const pagedMonthly = nonZeroMonthly.slice(monthlyStart, monthlyEnd);


  const topStart = (topPage - 1) * OVERVIEW_PAGE_SIZE;
  const topEnd = topStart + OVERVIEW_PAGE_SIZE;
  const pagedTop = nonZeroTop.slice(topStart, topEnd);

  const topPastPapersStart = (topPastPapersPage - 1) * OVERVIEW_PAGE_SIZE;
  const topPastPapersEnd = topPastPapersStart + OVERVIEW_PAGE_SIZE;
  const pagedTopPastPapers = nonZeroTopPastPapers.slice(topPastPapersStart, topPastPapersEnd);

  // added: compute pagedViewDetails for viewDetails pagination
  const pagedViewDetails = viewDetails.slice((viewPage - 1) * VIEW_PAGE_SIZE, viewPage * VIEW_PAGE_SIZE);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await fetchStats();
        console.log('[Dashboard] fetchStats returned:', data);
        setStats(data);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="admin-loading">Loading...</div>;
  }

  return (
    <Box sx={{ padding: 0.5 }}>
      <Grid container spacing={0.5}>
        <Grid size={{ xs: 12 }}>
          <Typography variant="h5" sx={{ color: '#e9edef', mb: 0.25, fontSize: '1.1rem' }}>
            Overview
          </Typography>
          <Typography variant="body2" sx={{ color: '#8696a0', fontSize: '0.75rem' }}>
            High-level summary of books, users, universities and reading activity.
          </Typography>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Grid container spacing={0.5}>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 1.7 }}>
              <Card sx={{ background: '#111b21', borderRadius: 1, boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 0.2, padding: 0.75 }}>
                  <Typography variant="caption" sx={{ color: '#8696a0', fontSize: '0.65rem' }}>Total Books</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.1 }}>
                    <Typography variant="h5" sx={{ color: '#e9edef', fontSize: '1.1rem' }}>{stats.counts.books}</Typography>
                    <Box sx={{ fontSize: 10, px: 0.5, py: 0.15, borderRadius: 999, bgcolor: 'rgba(0,168,132,0.1)', color: '#00a884' }}>
                      {formatTrend(uploadsTrend)}
                    </Box>
                  </Box>
                  <Typography variant="caption" sx={{ color: '#8696a0', mt: 0.1, fontSize: '0.6rem' }}>
                    Overall books in library
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 1.7 }}>
              <Card sx={{ background: '#111b21', borderRadius: 1, boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 0.2, padding: 0.75 }}>
                  <Typography variant="caption" sx={{ color: '#8696a0', fontSize: '0.65rem' }}>Total Users</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.1 }}>
                    <Typography variant="h5" sx={{ color: '#e9edef', fontSize: '1.1rem' }}>{stats.counts.users}</Typography>
                    <Box sx={{ fontSize: 10, px: 0.5, py: 0.15, borderRadius: 999, bgcolor: 'rgba(52,183,241,0.1)', color: '#34B7F1' }}>
                      —
                    </Box>
                  </Box>
                  <Typography variant="caption" sx={{ color: '#8696a0', mt: 0.1, fontSize: '0.6rem' }}>
                    Registered readers
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 1.7 }}>
              <Card sx={{ background: '#111b21', borderRadius: 1, boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 0.2, padding: 0.75 }}>
                  <Typography variant="caption" sx={{ color: '#8696a0', fontSize: '0.65rem' }}>Universities</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.1 }}>
                    <Typography variant="h5" sx={{ color: '#e9edef', fontSize: '1.1rem' }}>{stats.counts.universities}</Typography>
                    <Box sx={{ fontSize: 10, px: 0.5, py: 0.15, borderRadius: 999, bgcolor: 'rgba(255,204,0,0.1)', color: '#FFCC00' }}>
                      —
                    </Box>
                  </Box>
                  <Typography variant="caption" sx={{ color: '#8696a0', mt: 0.1, fontSize: '0.6rem' }}>
                    Partner institutions
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 1.7 }}>
              <Card sx={{ background: '#111b21', borderRadius: 1, boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 0.2, padding: 0.75 }}>
                  <Typography variant="caption" sx={{ color: '#8696a0', fontSize: '0.65rem' }}>Past Papers</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.1 }}>
                    <Typography variant="h5" sx={{ color: '#e9edef', fontSize: '1.1rem' }}>{stats.counts.pastPapers}</Typography>
                    <Box sx={{ fontSize: 10, px: 0.5, py: 0.15, borderRadius: 999, bgcolor: 'rgba(241,94,108,0.1)', color: '#f15e6c' }}>
                      —
                    </Box>
                  </Box>
                  <Typography variant="caption" sx={{ color: '#8696a0', mt: 0.1, fontSize: '0.6rem' }}>
                    Available exam papers
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 1.7 }} style={{ display: 'none' }}>
              <Card
                sx={{ background: '#111b21', borderRadius: 1, cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                onClick={async () => {
                  setShowViewsModal(true);
                  setLoadingViews(true);
                  try {
                    const details = await fetchViewDetails();
                    setViewDetails(details);
                  } catch (error) {
                    console.error('Error fetching view details:', error);
                  } finally {
                    setLoadingViews(false);
                  }
                }}
              >
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 0.2, padding: 0.75 }}>
                  <Typography variant="caption" sx={{ color: '#8696a0', display: 'flex', alignItems: 'center', gap: 0.2, fontSize: '0.65rem' }}>
                    Total Views <FiEye />
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.1 }}>
                    <Typography variant="h5" sx={{ color: '#e9edef', fontSize: '1.1rem' }}>{stats.counts.views}</Typography>
                    <Box sx={{ fontSize: 10, px: 0.5, py: 0.15, borderRadius: 999, bgcolor: 'rgba(34,211,238,0.1)', color: '#22d3ee' }}>
                      {formatTrend(viewsTrend)}
                    </Box>
                  </Box>
                  <Typography variant="caption" sx={{ color: '#8696a0', mt: 0.1, fontSize: '0.6rem' }}>Click details</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Grid>

        {/* Sharing Features Section */}


        {/* Activity Trend Section - Tabbed with Uploads Chart */}
        <Grid size={{ xs: 12 }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <button
              onClick={() => setActivityTrendTab('books')}
              style={{
                padding: '8px 16px',
                background: activityTrendTab === 'books' ? '#00a884' : 'transparent',
                border: 'none',
                color: activityTrendTab === 'books' ? '#111b21' : '#8696a0',
                cursor: 'pointer',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: 500,
                transition: 'all 0.2s ease',
              }}
            >
              Books
            </button>
            <button
              onClick={() => setActivityTrendTab('pastpapers')}
              style={{
                padding: '8px 16px',
                background: activityTrendTab === 'pastpapers' ? '#00a884' : 'transparent',
                border: 'none',
                color: activityTrendTab === 'pastpapers' ? '#111b21' : '#8696a0',
                cursor: 'pointer',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: 500,
                transition: 'all 0.2s ease',
              }}
            >
              Past Papers
            </button>
          </Box>
        </Grid>

        {/* Books Tab Content */}
        {activityTrendTab === 'books' && (
          <>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ background: '#111b21', borderRadius: 1, mt: 0, minHeight: 380 }}>
                <CardContent sx={{ padding: 1 }}>
                  <Typography variant="subtitle1" sx={{ color: '#e9edef', mb: 0.3, fontSize: '0.85rem' }}>Books Activity Trend</Typography>
                  <Divider sx={{ borderColor: '#202c33', mb: 0.5 }} />
                  <Box sx={{ width: '100%', height: 280 }}>
                    {timeSeries && timeSeries.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={timeSeries} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#202c33" />
                          <XAxis dataKey="month" stroke="#8696a0" tick={{ fontSize: 9 }} tickMargin={4} />
                          <YAxis stroke="#8696a0" tick={{ fontSize: 9 }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#1f2c33',
                              border: '1px solid #2a3942',
                              borderRadius: 4,
                              color: '#e9edef',
                              fontSize: '11px',
                            }}
                            labelStyle={{ color: '#cfd8dc' }}
                          />
                          <Legend />
                          <Line type="monotone" dataKey="uploads" name="Uploads" stroke="#00a884" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="views" name="Views" stroke="#34B7F1" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="downloads" name="Downloads" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <Box sx={{ color: '#8696a0', textAlign: 'center', pt: 4 }}>
                        No data available
                      </Box>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ background: '#111b21', borderRadius: 1, minHeight: 380 }}>
                <CardContent sx={{ padding: 1 }}>
                  <Typography variant="subtitle1" sx={{ color: '#e9edef', mb: 0.3, fontSize: '0.85rem' }}>Books Uploads per Month</Typography>
                  <Divider sx={{ borderColor: '#202c33', mb: 0.5 }} />
                  <Box sx={{ width: '100%', height: 280, mb: 1 }}>
                    {safeMonthly.length === 0 ? (
                      <Box sx={{ color: '#8696a0', textAlign: 'center', pt: 4 }}>
                        No uploads yet
                      </Box>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={safeMonthly} margin={{ top: 10, right: 16, left: -16, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#202c33" />
                          <XAxis dataKey="month" stroke="#8696a0" tick={{ fontSize: 11 }} tickMargin={8} />
                          <YAxis stroke="#8696a0" tick={{ fontSize: 11 }} />
                          <Tooltip
                            cursor={{ fill: 'rgba(32,44,51,0.6)' }}
                            contentStyle={{
                              backgroundColor: '#1f2c33',
                              border: '1px solid #2a3942',
                              borderRadius: 8,
                              color: '#e9edef',
                            }}
                            labelStyle={{ color: '#cfd8dc' }}
                          />
                          <Legend />
                          <Bar dataKey="Uploads" name="Uploads" fill="#00a884" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Top Books for Books Tab */}
            <Grid size={{ xs: 12, md: 6 }} style={{ display: 'none' }}>
              <Card sx={{ background: '#111b21', borderRadius: 1, minHeight: 380 }}>
                <CardContent sx={{ padding: 1 }}>
                  <Typography variant="subtitle1" sx={{ color: '#e9edef', mb: 0.3, fontSize: '0.85rem' }}>Top Books (Downloads)</Typography>
                  <Divider sx={{ borderColor: '#202c33', mb: 0.5 }} />
                  <Box sx={{ overflowX: 'auto', maxHeight: 320, overflowY: 'auto' }}>
                    <table className="table overview-table">
                      <thead>
                        <tr>
                          <th>Title</th>
                          <th>Downloads</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(pagedTop.length ? pagedTop : []).map((b, i) => {
                          const totalDownloads = stats.counts.downloads || 0;
                          const ratio = totalDownloads > 0 ? Math.min(1, (b.downloads_count || 0) / totalDownloads) : 0;
                          const percent = Math.round(ratio * 100);
                          return (
                            <tr key={i}>
                              <td>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                  <span>{b.title}</span>
                                  <Box sx={{ background: '#202c33', borderRadius: 999, overflow: 'hidden', height: 6 }}>
                                    <Box sx={{ width: `${percent}%`, height: '100%', bgcolor: '#00a884' }} />
                                  </Box>
                                </Box>
                              </td>
                              <td>{b.downloads_count || 0}</td>
                            </tr>
                          );
                        })}
                        {nonZeroTop.length === 0 && (
                          <tr><td colSpan={2} style={{ color: '#8696a0' }}>No top books data</td></tr>
                        )}
                      </tbody>
                    </table>
                  </Box>
                  {nonZeroTop.length > OVERVIEW_PAGE_SIZE && (
                    <Box className="actions" sx={{ mt: 1.5, display: 'flex', justifyContent: 'space-between' }}>
                      <button
                        className="btn"
                        disabled={topPage <= 1}
                        onClick={() => setTopPage(p => Math.max(1, p - 1))}
                      >
                        Prev
                      </button>
                      <span style={{ color: '#cfd8dc', fontSize: 12 }}>
                        Page {topPage} of {topTotalPages}
                      </span>
                      <button
                        className="btn"
                        disabled={topPage >= topTotalPages}
                        onClick={() => setTopPage(p => Math.min(topTotalPages, p + 1))}
                      >
                        Next
                      </button>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </>
        )}

        {/* Past Papers Tab Content */}
        {activityTrendTab === 'pastpapers' && (
          <>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ background: '#111b21', borderRadius: 1, mt: 0, minHeight: 380 }}>
                <CardContent sx={{ padding: 1 }}>
                  <Typography variant="subtitle1" sx={{ color: '#e9edef', mb: 0.3, fontSize: '0.85rem' }}>Past Papers Activity Trend</Typography>
                  <Divider sx={{ borderColor: '#202c33', mb: 0.5 }} />
                  <Box sx={{ width: '100%', height: 280 }}>
                    {pastPapersTimeSeries && pastPapersTimeSeries.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={pastPapersTimeSeries} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#202c33" />
                          <XAxis dataKey="month" stroke="#8696a0" tick={{ fontSize: 9 }} tickMargin={4} />
                          <YAxis stroke="#8696a0" tick={{ fontSize: 9 }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#1f2c33',
                              border: '1px solid #2a3942',
                              borderRadius: 4,
                              color: '#e9edef',
                              fontSize: '11px',
                            }}
                            labelStyle={{ color: '#cfd8dc' }}
                          />
                          <Legend />
                          <Line type="monotone" dataKey="uploads" name="Uploads" stroke="#f15e6c" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="views" name="Views" stroke="#ffa726" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <Box sx={{ color: '#8696a0', textAlign: 'center', pt: 4 }}>
                        No data available
                      </Box>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ background: '#111b21', borderRadius: 1, minHeight: 380 }}>
                <CardContent sx={{ padding: 1 }}>
                  <Typography variant="subtitle1" sx={{ color: '#e9edef', mb: 0.3, fontSize: '0.85rem' }}>Past Papers per Month</Typography>
                  <Divider sx={{ borderColor: '#202c33', mb: 0.5 }} />
                  <Box sx={{ width: '100%', height: 280, mb: 1 }}>
                    {monthsPastPapers.length === 0 ? (
                      <Box sx={{ color: '#8696a0', textAlign: 'center', pt: 4 }}>
                        No past papers yet
                      </Box>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthsPastPapers} margin={{ top: 10, right: 16, left: -16, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#202c33" />
                          <XAxis dataKey="month" stroke="#8696a0" tick={{ fontSize: 11 }} tickMargin={8} />
                          <YAxis stroke="#8696a0" tick={{ fontSize: 11 }} />
                          <Tooltip
                            cursor={{ fill: 'rgba(32,44,51,0.6)' }}
                            contentStyle={{
                              backgroundColor: '#1f2c33',
                              border: '1px solid #2a3942',
                              borderRadius: 8,
                              color: '#e9edef',
                            }}
                            labelStyle={{ color: '#cfd8dc' }}
                          />
                          <Legend />
                          <Bar dataKey="uploads" name="Uploads" fill="#f15e6c" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Top Past Papers for Past Papers Tab */}
            <Grid size={{ xs: 12, md: 6 }} style={{ display: 'none' }}>
              <Card sx={{ background: '#111b21', borderRadius: 1, minHeight: 380 }}>
                <CardContent sx={{ padding: 1 }}>
                  <Typography variant="subtitle1" sx={{ color: '#e9edef', mb: 0.3, fontSize: '0.85rem' }}>Top Past Papers (Downloads)</Typography>
                  <Divider sx={{ borderColor: '#202c33', mb: 0.5 }} />
                  <Box sx={{ overflowX: 'auto', maxHeight: 320, overflowY: 'auto' }}>
                    <table className="table overview-table">
                      <thead>
                        <tr>
                          <th>Title</th>
                          <th>Downloads</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(pagedTopPastPapers.length ? pagedTopPastPapers : []).map((p, i) => {
                          const totalPastPapersDownloads = stats.counts.pastPapersDownloads || 0;
                          const ratio = totalPastPapersDownloads > 0 ? Math.min(1, (p.downloads_count || 0) / totalPastPapersDownloads) : 0;
                          const percent = Math.round(ratio * 100);
                          return (
                            <tr key={i}>
                              <td>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                  <span>{p.title}</span>
                                  <Box sx={{ background: '#202c33', borderRadius: 999, overflow: 'hidden', height: 6 }}>
                                    <Box sx={{ width: `${percent}%`, height: '100%', bgcolor: '#f15e6c' }} />
                                  </Box>
                                </Box>
                              </td>
                              <td>{p.downloads_count || 0}</td>
                            </tr>
                          );
                        })}
                        {nonZeroTopPastPapers.length === 0 && (
                          <tr><td colSpan={2} style={{ color: '#8696a0' }}>No top past papers data</td></tr>
                        )}
                      </tbody>
                    </table>
                  </Box>
                  {nonZeroTopPastPapers.length > OVERVIEW_PAGE_SIZE && (
                    <Box className="actions" sx={{ mt: 1.5, display: 'flex', justifyContent: 'space-between' }}>
                      <button
                        className="btn"
                        disabled={topPastPapersPage <= 1}
                        onClick={() => setTopPastPapersPage(p => Math.max(1, p - 1))}
                      >
                        Prev
                      </button>
                      <span style={{ color: '#cfd8dc', fontSize: 12 }}>
                        Page {topPastPapersPage} of {topPastPapersTotalPages}
                      </span>
                      <button
                        className="btn"
                        disabled={topPastPapersPage >= topPastPapersTotalPages}
                        onClick={() => setTopPastPapersPage(p => Math.min(topPastPapersTotalPages, p + 1))}
                      >
                        Next
                      </button>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </>
        )}
      </Grid>

      {showViewsModal && (
        <div className="modal-overlay" onClick={() => setShowViewsModal(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 style={{ margin: 0, color: '#e9edef' }}>Book View Details</h2>
              <button onClick={() => setShowViewsModal(false)} className="icon-btn">
                <FiX size={20} />
              </button>
            </div>
            <div className="modal-body">
              {loadingViews ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#8696a0' }}>
                  Loading...
                </div>
              ) : (
                <div>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Book Title</th>
                        <th>Total Views</th>
                        <th>Unique Users</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedViewDetails.map((book, idx) => (
                        <React.Fragment key={book.book_id}>
                          <tr>
                            <td><strong>{book.book_title}</strong></td>
                            <td>{book.total_views}</td>
                            <td>{book.unique_users}</td>
                            <td>
                              <button
                                className="btn"
                                onClick={() => {
                                  setExpandedViewers((prev) => {
                                    const isOpen = prev[book.book_id];
                                    // close if already open
                                    if (isOpen) {
                                      return { ...prev, [book.book_id]: false };
                                    }
                                    // open this row and ensure viewerPages is initialized
                                    return { ...prev, [book.book_id]: true };
                                  });
                                  setViewerPages((p) => ({ ...p, [book.book_id]: p[book.book_id] || 1 }));
                                }}
                                style={{
                                  backgroundColor: expandedViewers[book.book_id] ? '#2c7a7f' : undefined,
                                  color: expandedViewers[book.book_id] ? '#fff' : undefined,
                                }}
                              >
                                {expandedViewers[book.book_id] ? 'Close' : 'View Users'}
                              </button>
                            </td>
                          </tr>
                          {expandedViewers[book.book_id] && (
                            <tr style={{ backgroundColor: '#111b21' }}>
                              <td colSpan={4}>
                                <div className="viewer-section">
                                  <div className="viewer-section-title">Users who viewed</div>
                                  {(() => {
                                    const pageSize = 8;
                                    const page = viewerPages[book.book_id] || 1;
                                    const totalPages = Math.max(1, Math.ceil((book.users?.length || 0) / pageSize));
                                    const start = (page - 1) * pageSize;
                                    const end = start + pageSize;
                                    const current = (book.users || []).slice(start, end);

                                    // helper to lookup avatar from shared localStorage map by email
                                    const getAvatarFor = (email) => {
                                      if (!email) return null;
                                      try {
                                        const map = JSON.parse(localStorage.getItem('avatarsByEmail') || '{}');
                                        return map[email] || null;
                                      } catch (e) {
                                        return null;
                                      }
                                    };

                                    return (
                                      <>
                                        <div className="viewer-list">
                                          {current.map((user, userIdx) => {
                                            const avatarUrl = getAvatarFor(user.email);
                                            const latestView = (user.views && user.views.length > 0)
                                              ? new Date(user.views[0]).toLocaleString()
                                              : 'No timestamps';
                                            return (
                                              <div className="viewer-item" key={userIdx}>
                                                {avatarUrl ? (
                                                  <img
                                                    src={avatarUrl}
                                                    alt={user.email || 'avatar'}
                                                    style={{
                                                      width: 36,
                                                      height: 36,
                                                      borderRadius: 999,
                                                      objectFit: 'cover',
                                                      flex: '0 0 36px',
                                                    }}
                                                    className="viewer-avatar-img"
                                                  />
                                                ) : (
                                                  <div className="viewer-avatar">
                                                    <img src={profilePlaceholder} alt="Profile placeholder" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                                                  </div>
                                                )}
                                                <div className="viewer-meta">
                                                  <div className="viewer-email">{user.email}</div>
                                                  <details className="viewer-time-dropdown">
                                                    <summary>
                                                      Latest: {latestView}
                                                    </summary>
                                                    {(() => {
                                                      const pageSize = 8;
                                                      const key = `${book.book_id}:${user.email || 'unknown'}`;
                                                      const page = viewerTimePages[key] || 1;
                                                      const totalViews = (user.views || []).length;
                                                      const totalPages = Math.max(1, Math.ceil(totalViews / pageSize));
                                                      const start = (page - 1) * pageSize;
                                                      const end = start + pageSize;
                                                      const currentViews = (user.views || []).slice(start, end);

                                                      return (
                                                        <>
                                                          <ul className="viewer-time-list">
                                                            {currentViews.map((ts, i) => (
                                                              <li key={i}>
                                                                {new Date(ts).toLocaleString()}
                                                              </li>
                                                            ))}
                                                          </ul>
                                                          {totalViews > pageSize && (
                                                            <div
                                                              style={{
                                                                marginTop: 6,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between',
                                                                gap: 8,
                                                                fontSize: 11,
                                                                color: '#cfd8dc',
                                                              }}
                                                            >
                                                              <button
                                                                className="btn"
                                                                style={{ padding: '4px 8px', fontSize: 11 }}
                                                                disabled={page <= 1}
                                                                onClick={(e) => {
                                                                  e.preventDefault();
                                                                  e.stopPropagation();
                                                                  setViewerTimePages((p) => ({
                                                                    ...p,
                                                                    [key]: Math.max(1, page - 1),
                                                                  }));
                                                                }}
                                                              >
                                                                Prev
                                                              </button>
                                                              <span>
                                                                Page {page} of {totalPages}
                                                              </span>
                                                              <button
                                                                className="btn"
                                                                style={{ padding: '4px 8px', fontSize: 11 }}
                                                                disabled={page >= totalPages}
                                                                onClick={(e) => {
                                                                  e.preventDefault();
                                                                  e.stopPropagation();
                                                                  setViewerTimePages((p) => ({
                                                                    ...p,
                                                                    [key]: Math.min(totalPages, page + 1),
                                                                  }));
                                                                }}
                                                              >
                                                                Next
                                                              </button>
                                                            </div>
                                                          )}
                                                        </>
                                                      );
                                                    })()}
                                                  </details>
                                                </div>
                                              </div>
                                            );
                                          })}
                                          {current.length === 0 && (
                                            <div style={{ color: '#8696a0' }}>
                                              No viewers on this page.
                                            </div>
                                          )}
                                        </div>
                                        {book.users && book.users.length > pageSize && (
                                          <div
                                            className="actions"
                                            style={{ marginTop: 10, justifyContent: 'space-between' }}
                                          >
                                            <button
                                              className="btn"
                                              disabled={page <= 1}
                                              onClick={() =>
                                                setViewerPages((p) => ({
                                                  ...p,
                                                  [book.book_id]: Math.max(1, (p[book.book_id] || 1) - 1),
                                                }))
                                              }
                                            >
                                              Prev
                                            </button>
                                            <span style={{ color: '#cfd8dc' }}>
                                              Page {page} of {totalPages} ({book.users.length} viewers)
                                            </span>
                                            <button
                                              className="btn"
                                              disabled={page >= totalPages}
                                              onClick={() =>
                                                setViewerPages((p) => ({
                                                  ...p,
                                                  [book.book_id]: Math.min(totalPages, (p[book.book_id] || 1) + 1),
                                                }))
                                              }
                                            >
                                              Next
                                            </button>
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                              </div>
                            </td>
                          </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                  {viewDetails.length > VIEW_PAGE_SIZE && (
                    <div className="actions" style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between' }}>
                      <button
                        className="btn"
                        disabled={viewPage <= 1}
                        onClick={() => setViewPage(p => Math.max(1, p - 1))}
                      >
                        Prev
                      </button>
                      <span style={{ color: '#cfd8dc' }}>
                        Page {viewPage} of {Math.ceil(viewDetails.length / VIEW_PAGE_SIZE)}
                      </span>
                      <button
                        className="btn"
                        disabled={viewPage >= Math.ceil(viewDetails.length / VIEW_PAGE_SIZE)}
                        onClick={() => setViewPage(p => Math.min(Math.ceil(viewDetails.length / VIEW_PAGE_SIZE), p + 1))}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Box>
  );
};

export default Dashboard;