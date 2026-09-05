import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchProfiles, updateUserTier } from '../api';
import { useAdminUI } from '../AdminUIContext';
import { FiCheck, FiAward, FiChevronDown, FiFilter, FiStar, FiSearch } from 'react-icons/fi';
import VerificationBadge from '../components/VerificationBadge';
import profilePlaceholder from '../../../BookDashboard/user-profile.svg';

const highlightSearchText = (text, searchText) => {
  const value = String(text || '');
  const query = String(searchText || '').trim();
  if (!query) return value;

  const lowerValue = value.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const parts = [];
  let start = 0;
  let matchIndex = lowerValue.indexOf(lowerQuery, start);

  while (matchIndex !== -1) {
    if (matchIndex > start) parts.push(value.slice(start, matchIndex));
    parts.push(
      <span className="admin-search-match" key={`${matchIndex}-${query}`}>
        {value.slice(matchIndex, matchIndex + query.length)}
      </span>
    );
    start = matchIndex + query.length;
    matchIndex = lowerValue.indexOf(lowerQuery, start);
  }

  if (start === 0) return value;
  if (start < value.length) parts.push(value.slice(start));
  return parts;
};

const TierDropdown = ({ value, disabled, onChange }) => {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);
  const menuRef = useRef(null);
  const panelRef = useRef(null);
  const options = [
    ['basic', 'Basic'],
    ['premium', 'Premium'],
    ['premium_pro', 'PremPro']
  ];
  const selectedLabel = options.find(([optionValue]) => optionValue === value)?.[1] || 'Basic';

  useEffect(() => {
    const closeMenu = (event) => {
      if (
        menuRef.current && !menuRef.current.contains(event.target) &&
        panelRef.current && !panelRef.current.contains(event.target)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', closeMenu);
    return () => document.removeEventListener('mousedown', closeMenu);
  }, []);

  const toggleMenu = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const button = menuRef.current?.querySelector('.users-filter-trigger');
    if (button) {
      const rect = button.getBoundingClientRect();
      setMenuPosition({ top: rect.bottom + 5, left: rect.right - 160 });
    }
    setOpen(true);
  };

  return (
    <div className="users-filter-menu verify-tier-dropdown" ref={menuRef}>
      <button
        type="button"
        className={`users-filter-trigger${open ? ' is-open' : ''}`}
        onClick={toggleMenu}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span>{selectedLabel}</span>
        <FiChevronDown className="users-filter-chevron" />
      </button>
      {open && menuPosition && createPortal(
        <div
          className="users-filter-panel verify-tier-portal-panel"
          role="menu"
          ref={panelRef}
          style={{ top: menuPosition.top, left: menuPosition.left }}
        >
          {options.map(([optionValue, label]) => (
            <button
              type="button"
              role="menuitem"
              className={`users-filter-option${value === optionValue ? ' is-selected' : ''}`}
              onClick={() => {
                onChange(optionValue);
                setOpen(false);
              }}
              key={optionValue}
            >
              <span>{label}</span>
              {value === optionValue && <FiCheck />}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

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
  const [tierMenuOpen, setTierMenuOpen] = useState(false);
  const tierMenuRef = useRef(null);

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

  useEffect(() => {
    const closeTierMenu = (event) => {
      if (tierMenuRef.current && !tierMenuRef.current.contains(event.target)) {
        setTierMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', closeTierMenu);
    return () => document.removeEventListener('mousedown', closeTierMenu);
  }, []);

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
      const updatedUser = await updateUserTier(userId, newTier);
      console.log('[Verify.updateTier] Tier updated successfully');
      setRows((currentRows) => currentRows.map((row) => (
        row.id === userId
          ? {
              ...row,
              subscription_tier: updatedUser?.subscription_tier || newTier,
              subscription_started_at: updatedUser?.subscription_started_at || new Date().toISOString(),
            }
          : row
      )));
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
        return { icon: <FiAward />, color: '#FFD700', label: 'PremPro', bgColor: 'rgba(255, 215, 0, 0.1)' };
      default:
        return { icon: <FiStar />, color: '#8696a0', label: 'Basic', bgColor: 'rgba(134, 150, 160, 0.05)' };
    }
  };

  const tierLabel = tierFilter
    ? tierFilter === 'premium_pro' ? 'PremPro' : tierFilter.charAt(0).toUpperCase() + tierFilter.slice(1)
    : 'Filters';

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
    <div className="verify-page" style={{ padding: 12 }}>
      <div className="section-header" style={{ marginBottom: 16 }}>
        <h2 style={{ color: '#e9edef', fontSize: 18, margin: 0 }}>Verify Users</h2>
        <p style={{ color: '#8696a0', fontSize: 12, margin: '4px 0 0 0' }}>
          Manage user subscription tiers and verification status
        </p>
      </div>

      {/* Filters */}
      <div className="verify-controls" style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <div className="verify-search-control" style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <FiSearch style={{ position: 'absolute', left: 8, top: 8, color: '#8696a0' }} />
          <input
            type="search"
            enterKeyHint="search"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            className="input"
            style={{ paddingLeft: 32, width: '100%', backgroundColor: 'black', fontSize: '13px' }}
          />
        </div>
        <div className="users-filter-menu verify-tier-menu" ref={tierMenuRef}>
          <button
            type="button"
            className={`users-filter-trigger${tierMenuOpen ? ' is-open' : ''}`}
            onClick={() => setTierMenuOpen((open) => !open)}
            aria-expanded={tierMenuOpen}
            aria-haspopup="menu"
          >
            <FiFilter />
            <span>{tierLabel}</span>
            <FiChevronDown className="users-filter-chevron" />
          </button>
          {tierMenuOpen && (
            <div className="users-filter-panel" role="menu">
              {[
                ['', 'All tiers'],
                ['basic', 'Basic'],
                ['premium', 'Premium'],
                ['premium_pro', 'PremPro']
              ].map(([value, label]) => (
                <button
                  type="button"
                  role="menuitem"
                  className={`users-filter-option${tierFilter === value ? ' is-selected' : ''}`}
                  onClick={() => {
                    setTierFilter(value);
                    setTierMenuOpen(false);
                  }}
                  key={value || 'all-tiers'}
                >
                  <span>{label}</span>
                  {tierFilter === value && <FiCheck />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="verify-table-scroll" style={{ overflowX: 'auto' }}>
        <table className="table verify-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Email</th>
              <th>Tier</th>
              <th>Started</th>
              <th>Change Tier</th>
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
                        <span>{highlightSearchText(u.display_name || '—', search)}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: '#8696a0' }}>{highlightSearchText(u.email, search)}</td>
                    <td>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 8px',
                        borderRadius: 4,
                        backgroundColor: 'transparent',
                        width: 'fit-content'
                      }}>
                        <VerificationBadge
                          tier={u.subscription_tier}
                          size="sm"
                          showLabel={false}
                          showTooltip={true}
                        />
                        <span style={{ color: tier.color, fontSize: 12, fontWeight: 500 }}>{tier.label}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: '#8696a0' }}>
                      {u.subscription_started_at 
                        ? new Date(u.subscription_started_at).toLocaleDateString()
                        : '—'}
                    </td>
                    <td>
                      <TierDropdown
                        value={u.subscription_tier}
                        onChange={(newTier) => updateTier(u.id, newTier)}
                        disabled={updating[u.id]}
                      />
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
        <span className="verify-pagination-label" style={{ color: '#cfd8dc' }}>Page {page} of {totalPages} ({filteredRows.length} users)</span>
        <button className="btn" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</button>
      </div>
    </div>
  );
};

export default Verify;
