import React, { useEffect, useMemo, useState } from 'react';
import { fetchProfiles, updateUserTier } from '../api';
import { useAdminUI } from '../AdminUIContext';
import { FiCheck, FiAward, FiStar, FiSearch } from 'react-icons/fi';
import VerificationBadge from '../components/VerificationBadge';
import profilePlaceholder from '../../../BookDashboard/user-profile.svg';

const Verify = ({ userProfile }) => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [updating, setUpdating] = useState({});
  const [sort, setSort] = useState({ col: 'created_at', dir: 'desc' });

  const { confirm, showToast } = useAdminUI();
  const ADMIN_EMAILS = ['campuslives254@gmail.com', 'paltechsomalux@gmail.com', 'eliblearning@gmail.com'];
  const isAdmin = userProfile?.role === 'admin' || ADMIN_EMAILS.includes(userProfile?.email);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(count / pageSize)), [count, pageSize]);

  const load = async () => {
    setLoading(true);
    try {
      console.log('[Verify.load] Loading profiles...');
      const allProfiles = await fetchProfiles();
      console.log('[Verify.load] Fetched', allProfiles?.length || 0, 'profiles');
      
      const profiles = (allProfiles || [])
        .filter(p => p && p.id) // Ensure valid profiles
        .map(p => {
          return {
            ...p,
            display_name: p.full_name || p.email,
            subscription_tier: p.subscription_tier || 'basic',
            subscription_started_at: p.subscription_started_at,
            subscription_expires_at: p.subscription_expires_at,
            avatar_url: p.avatar_url
          };
        });
      
      console.log('[Verify.load] Loaded profiles:', profiles.length);
      setRows(profiles);
      setCount(profiles.length);
    } catch (error) {
      console.error('[Verify.load] Failed to load profiles:', error?.message || error);
      showToast({ type: 'error', message: 'Failed to load users.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userProfile) load();
  }, [userProfile]);

  const filteredRows = useMemo(() => {
    return rows.filter(u => {
      const matchSearch = !search || 
        (u.email && u.email.toLowerCase().includes(search.toLowerCase())) ||
        (u.display_name && u.display_name.toLowerCase().includes(search.toLowerCase()));
      const matchTier = !tierFilter || u.subscription_tier === tierFilter;
      return matchSearch && matchTier;
    });
  }, [rows, search, tierFilter]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  const updateTier = async (userId, newTier) => {
    setUpdating(s => ({ ...s, [userId]: true }));
    try {
      console.log('[Verify.updateTier] Updating tier for user:', userId, 'to:', newTier);
      await updateUserTier(userId, newTier);
      console.log('[Verify.updateTier] Tier updated successfully');
      await load();
    } catch (error) {
      console.error('[Verify.updateTier] Error updating tier:', error?.message || error);
      showToast({ type: 'error', message: `Failed to update user tier: ${error?.message || 'Unknown error'}` });
    } finally {
      setUpdating(s => ({ ...s, [userId]: false }));
    }
  };

  const getTierBadge = (tier) => {
    switch (tier) {
      case 'premium':
        return { icon: <FiCheck />, color: '#2196F3', label: 'Premium', bgColor: 'rgba(33, 150, 243, 0.1)' };
      case 'premium_pro':
        return { icon: <FiAward />, color: '#FFD700', label: 'Premium Pro', bgColor: 'rgba(255, 215, 0, 0.1)' };
      default:
        return { icon: <FiStar />, color: '#8696a0', label: 'Basic', bgColor: 'rgba(134, 150, 160, 0.05)' };
    }
  };

  if (!isAdmin) {
    return (
      <div style={{ padding: 20, color: '#e9edef' }}>
        You don't have permission to access this page.
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: 20, color: '#8696a0' }}>Loading...</div>;
  }

  return (
    <div style={{ padding: 12 }}>
      <div className="section-header" style={{ marginBottom: 16 }}>
        <h2 style={{ color: '#e9edef', fontSize: 18, margin: 0 }}>Verify Users</h2>
        <p style={{ color: '#8696a0', fontSize: 12, margin: '4px 0 0 0' }}>
          Manage user subscription tiers and verification status
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <FiSearch style={{ position: 'absolute', left: 8, top: 8, color: '#8696a0' }} />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input"
            style={{ paddingLeft: 32, width: '100%', backgroundColor: 'black', color: 'white', fontSize: '13px' }}
          />
        </div>
        <select
          className="select"
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          style={{ minWidth: 150, width: 'auto' }}
        >
          <option value="">All Tiers</option>
          <option value="basic">Basic</option>
          <option value="premium">Premium</option>
          <option value="premium_pro">Premium Pro</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Email</th>
              <th>Uploads</th>
              <th>Current Tier</th>
              <th>Subscription Date</th>
              <th>Change Tier To</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: '#8696a0', padding: 20 }}>
                  No users found
                </td>
              </tr>
            ) : (
              paginatedRows.map((u, idx) => {
                const rowNum = (page - 1) * pageSize + idx + 1;
                const tier = getTierBadge(u.subscription_tier);
                return (
                  <tr key={u.id}>
                    <td style={{ fontSize: '13px', fontWeight: '600', color: '#00a884' }}>
                      #{rowNum}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ position: 'relative' }} className="viewer-avatar">
                          {u.avatar_url ? (
                            <img
                              src={u.avatar_url}
                              alt={u.display_name || u.email || 'User avatar'}
                              style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                              onError={(e) => {
                                // Fallback if image fails to load
                                e.target.style.display = 'none';
                                if (e.target.parentElement) {
                                  const initials = (u.display_name || u.email || '?').charAt(0).toUpperCase();
                                  e.target.parentElement.textContent = initials;
                                }
                              }}
                            />
                          ) : (
                            <img src={profilePlaceholder} alt="Profile placeholder" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                          )}
                          {u.uploadCount > 0 && (
                            <div style={{
                              position: 'absolute',
                              bottom: -4,
                              right: -4,
                              backgroundColor: '#00a884',
                              color: 'white',
                              borderRadius: '50%',
                              width: 20,
                              height: 20,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 10,
                              fontWeight: 'bold',
                              border: '2px solid #0a1419'
                            }}>
                              {u.uploadCount > 99 ? '99+' : u.uploadCount}
                            </div>
                          )}
                          {(u.subscription_tier === 'premium' || u.subscription_tier === 'premium_pro') && (
                            <div style={{
                              position: 'absolute',
                              top: -6,
                              right: -6,
                              zIndex: 2
                            }}>
                              <VerificationBadge tier={u.subscription_tier} size="sm" showLabel={false} showTooltip={true} />
                            </div>
                          )}
                        </div>
                        <span>{u.display_name || '—'}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: '#8696a0' }}>{u.email}</td>
                    <td style={{ fontSize: 12, fontWeight: '600', color: '#00a884' }}>{u.uploadCount}</td>
                    <td>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 8px',
                        borderRadius: 4,
                        backgroundColor: tier.bgColor,
                        width: 'fit-content'
                      }}>
                        <span style={{ color: tier.color, fontSize: 14 }}>{tier.icon}</span>
                        <span style={{ color: tier.color, fontSize: 12, fontWeight: 500 }}>{tier.label}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: '#8696a0' }}>
                      {u.subscription_started_at 
                        ? new Date(u.subscription_started_at).toLocaleDateString()
                        : '—'}
                    </td>
                    <td>
                      <select
                        value={u.subscription_tier}
                        onChange={(e) => updateTier(u.id, e.target.value)}
                        disabled={updating[u.id]}
                        className="select"
                        style={{ fontSize: 12 }}
                      >
                        <option value="basic">Basic</option>
                        <option value="premium">Premium</option>
                        <option value="premium_pro">Premium Pro</option>
                      </select>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="actions" style={{ marginTop: 10, justifyContent: 'space-between' }}>
        <button className="btn" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</button>
        <span style={{ color: '#cfd8dc' }}>Page {page} of {totalPages} ({filteredRows.length} users)</span>
        <button className="btn" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</button>
      </div>
    </div>
  );
};

export default Verify;
