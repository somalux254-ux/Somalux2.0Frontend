import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchProfiles, fetchUploadCountsByUser, updateUserRole, fetchAuthenticatedUsers } from '../api';
import { FiCheck, FiChevronDown, FiFilter, FiSearch } from 'react-icons/fi';
import UsersAnalytics from './UsersAnalytics';
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

const Users = ({ isSuperAdmin }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [sortBy, setSortBy] = useState('latest_login');
  const [sortDir, setSortDir] = useState('desc'); // 'asc' or 'desc'
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef(null);
  const navigate = useNavigate();

  const SUPERADMIN_EMAILS = ['campuslives254@gmail.com', 'paltechsomalux@gmail.com', 'eliblearning@gmail.com'];

  const load = async () => {
    setLoading(true);
    try {
      let profiles = [];
      let uploadCounts = [];

      try {
        profiles = await fetchProfiles();
        console.log('[Users.load] fetchProfiles success:', profiles?.length || 0);
      } catch (e) {
        console.error('[Users.load] fetchProfiles error:', e?.message || e);
        setRows([]);
        setLoading(false);
        return;
      }

      try {
        uploadCounts = await fetchUploadCountsByUser();
        console.log('[Users.load] fetchUploadCountsByUser success:', uploadCounts?.length || 0);
      } catch (e) {
        console.error('[Users.load] fetchUploadCountsByUser error:', e?.message || e);
      }

      console.groupCollapsed('[Users.load] fetched data');
      console.log('profiles (count):', Array.isArray(profiles) ? profiles.length : profiles, profiles?.slice?.(0, 3));
      console.log('uploadCounts (count):', Array.isArray(uploadCounts) ? uploadCounts.length : uploadCounts, uploadCounts?.slice?.(0, 10));
      console.groupEnd();

      const uploadsMap = new Map(
        (uploadCounts || []).map((u) => [String(u.uploaded_by), {
          books: u.books || 0,
          pastPapers: u.past_papers || 0,
          universities: u.universities || 0,
          total: typeof u.total === 'number' ? u.total : (u.books || 0) + (u.past_papers || 0) + (u.universities || 0),
        }])
      );

      // Helper function to compute user status and last seen
      const computeUserStatus = (profile) => {
        const now = Date.now();
        const lastActiveTime = profile.last_active_at 
          ? new Date(profile.last_active_at).getTime()
          : new Date(profile.created_at).getTime();
        const minutesAgo = (now - lastActiveTime) / (1000 * 60);
        
        // Determine status: online if active in last 5 minutes
        const isOnline = minutesAgo <= 5;
        const status = profile.deactivated_at ? 'signed_out' : (isOnline ? 'online' : 'offline');

        // Format last seen - show "Online" if online, otherwise show time
        let lastSeen = null;
        if (isOnline) {
          lastSeen = 'Online';
        } else if (profile.last_active_at || profile.created_at) {
          if (minutesAgo < 1) {
            lastSeen = 'now';
          } else if (minutesAgo < 60) {
            lastSeen = `${Math.round(minutesAgo)}m ago`;
          } else if (minutesAgo < 1440) {
            lastSeen = `${Math.round(minutesAgo / 60)}h ago`;
          } else {
            lastSeen = `${Math.round(minutesAgo / 1440)}d ago`;
          }
        } else {
          lastSeen = 'never';
        }

        return { status, lastSeen };
      };

      const enriched = (profiles || []).map((p) => {
        const contrib = uploadsMap.get(String(p.id)) || { total: 0, books: 0, pastPapers: 0, universities: 0 };
        const userStatus = computeUserStatus(p);

        return {
          ...p,
          uploadCount: contrib.total || 0,
          contribBooks: contrib.books || 0,
          contribPastPapers: contrib.pastPapers || 0,
          contribUniversities: contrib.universities || 0,
          status: userStatus.status,
          lastSeen: userStatus.lastSeen,
        };
      });

      enriched.sort((a, b) => {
        const roleOrder = { admin: 0, editor: 1, viewer: 2 };
        const ra = roleOrder[a.role] ?? 3;
        const rb = roleOrder[b.role] ?? 3;
        if (ra !== rb) return ra - rb;
        const nameA = (a.full_name || a.display_name || a.email || '').toLowerCase();
        const nameB = (b.full_name || b.display_name || b.email || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });

      setRows(enriched);
    } catch (error) {
      console.error('[Users.load] Error loading users:', error);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const changeRole = async (id, role) => {
    setSaving((s) => ({ ...s, [id]: true }));
    try {
      console.log('[Users.changeRole] Updating role for user:', id, 'to:', role);
      await updateUserRole(id, role);
      console.log('[Users.changeRole] Role updated successfully');
      await load();
    } catch (error) {
      console.error('[Users.changeRole] Error updating role:', error?.message || error);
      alert(`Failed to update role: ${error?.message || 'Unknown error'}`);
    } finally { 
      setSaving((s) => ({ ...s, [id]: false })); 
    }
  };

  const filteredRows = useMemo(() => {
    let filtered = rows.filter(u => {
      const matchSearch = !search || 
        (u.email && u.email.toLowerCase().includes(search.toLowerCase())) ||
        (u.full_name && u.full_name.toLowerCase().includes(search.toLowerCase())) ||
        (u.display_name && u.display_name.toLowerCase().includes(search.toLowerCase()));
      const matchRole = !roleFilter || u.role === roleFilter;
      const matchActive = !activeFilter || u.status === activeFilter;
      return matchSearch && matchRole && matchActive;
    });

    // Apply sorting
    if (sortBy === 'latest_login') {
      filtered.sort((a, b) => {
        const dateA = a.last_active_at ? new Date(a.last_active_at).getTime() : (a.created_at ? new Date(a.created_at).getTime() : 0);
        const dateB = b.last_active_at ? new Date(b.last_active_at).getTime() : (b.created_at ? new Date(b.created_at).getTime() : 0);
        const diff = dateB - dateA;
        if (diff !== 0) return sortDir === 'desc' ? diff : -diff;
        // Tiebreaker: sort by name
        const nameA = (a.full_name || a.display_name || a.email || '').toLowerCase();
        const nameB = (b.full_name || b.display_name || b.email || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
    }

    return filtered;
  }, [rows, search, roleFilter, activeFilter, sortBy, sortDir]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filteredRows.slice(start, end);
  }, [filteredRows, page, pageSize]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredRows.length / pageSize)), [filteredRows.length, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, activeFilter, sortBy, sortDir]);

  useEffect(() => {
    const closeFilterMenu = (event) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target)) {
        setFilterMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', closeFilterMenu);
    return () => document.removeEventListener('mousedown', closeFilterMenu);
  }, []);

  const applyFilter = (value) => {
    if (value.startsWith('role:')) {
      setRoleFilter(value.substring(5));
      setActiveFilter('');
      setSortBy('latest_login');
      setSortDir('desc');
    } else if (value.startsWith('active:')) {
      setActiveFilter(value.substring(7));
      setRoleFilter('');
      setSortBy('latest_login');
      setSortDir('desc');
    } else if (value.startsWith('sort:')) {
      const parts = value.substring(5).split(':');
      setSortBy(parts[0]);
      setSortDir(parts[1]);
      setRoleFilter('');
      setActiveFilter('');
    }
    setFilterMenuOpen(false);
  };

  const activeFilterLabel = roleFilter
    ? roleFilter.charAt(0).toUpperCase() + roleFilter.slice(1)
    : activeFilter
      ? activeFilter.replace('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
      : sortBy === 'latest_login'
        ? sortDir === 'asc' ? 'Oldest first' : 'Newest first'
        : 'Filters';

  const isSuperadminEmail = (email) => {
    return SUPERADMIN_EMAILS.includes(email);
  };

  return (
    <div className="panel users-panel">
      <div className="panel-title">Users</div>
      
      <UsersAnalytics rows={rows} />
      
      <div className="users-controls" style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 250px', minWidth: '200px', maxWidth: '270px' }}>
          <FiSearch style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#8696a0', fontSize: '14px' }} />
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
        <div className="users-filter-menu" ref={filterMenuRef}>
          <button
            type="button"
            className={`users-filter-trigger${filterMenuOpen ? ' is-open' : ''}`}
            onClick={() => setFilterMenuOpen((open) => !open)}
            aria-expanded={filterMenuOpen}
            aria-haspopup="menu"
          >
            <FiFilter />
            <span>{activeFilterLabel}</span>
            <FiChevronDown className="users-filter-chevron" />
          </button>
          {filterMenuOpen && (
            <div className="users-filter-panel" role="menu">
              <div className="users-filter-group">
                <div className="users-filter-heading">Role</div>
                {['', 'admin', 'editor', 'viewer'].map((role) => (
                  <button
                    type="button"
                    role="menuitem"
                    className={`users-filter-option${role && roleFilter === role ? ' is-selected' : ''}`}
                    onClick={() => applyFilter(`role:${role}`)}
                    key={role || 'all-roles'}
                  >
                    <span>{role ? role.charAt(0).toUpperCase() + role.slice(1) : 'All roles'}</span>
                    {role && roleFilter === role && <FiCheck />}
                  </button>
                ))}
              </div>
              <div className="users-filter-group">
                <div className="users-filter-heading">Status</div>
                {['', 'online', 'offline', 'signed_out'].map((status) => (
                  <button
                    type="button"
                    role="menuitem"
                    className={`users-filter-option${status && activeFilter === status ? ' is-selected' : ''}`}
                    onClick={() => applyFilter(`active:${status}`)}
                    key={status || 'all-status'}
                  >
                    <span>{status ? status.replace('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'All status'}</span>
                    {status && activeFilter === status && <FiCheck />}
                  </button>
                ))}
              </div>
              <div className="users-filter-group">
                <div className="users-filter-heading">Sort by login</div>
                {[['desc', 'Newest first'], ['asc', 'Oldest first']].map(([direction, label]) => (
                  <button
                    type="button"
                    role="menuitem"
                    className={`users-filter-option${sortBy === 'latest_login' && sortDir === direction && !roleFilter && !activeFilter ? ' is-selected' : ''}`}
                    onClick={() => applyFilter(`sort:latest_login:${direction}`)}
                    key={direction}
                  >
                    <span>{label}</span>
                    {sortBy === 'latest_login' && sortDir === direction && !roleFilter && !activeFilter && <FiCheck />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ overflowX: 'auto', width: '100%' }}>
        <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Last Seen</th>
            <th>Role</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={5} style={{ color: '#8696a0', textAlign: 'center' }}>Loading...</td></tr>
          ) : paginatedRows.length === 0 ? (
            <tr><td colSpan={5} style={{ color: '#8696a0', textAlign: 'center' }}>No users found</td></tr>
          ) : paginatedRows.map((u, idx) => {
            return (
            <tr key={u.id}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="viewer-avatar">
                    {u.avatar_url ? (
                      <img
                        src={u.avatar_url}
                        alt={u.full_name || u.display_name || u.email || 'User avatar'}
                        style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          if (e.target.parentElement) {
                            const initials = (u.full_name || u.display_name || u.email || '?').charAt(0).toUpperCase();
                            e.target.parentElement.textContent = initials;
                          }
                        }}
                      />
                    ) : (
                      <img src={profilePlaceholder} alt="Profile placeholder" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                    )}
                  </div>
                  <span>{highlightSearchText(u.full_name || u.display_name || '—', search)}</span>
                </div>
              </td>
              <td>{highlightSearchText(u.email, search)}</td>
              <td>
                <span style={{
                  fontSize: '12px',
                  fontWeight: u.lastSeen === 'Online' ? '600' : '500',
                  color: u.lastSeen === 'Online' ? '#00a884' : '#8696a0'
                }}>
                  {u.lastSeen || 'never'}
                </span>
              </td>
              <td>
                {isSuperadminEmail(u.email) ? (
                  <span style={{ color: '#ffd700', fontWeight: 600 }}>
                    Superadmin
                  </span>
                ) : (
                  <select
                    className="select"
                    value={u.role}
                    onChange={(e) => changeRole(u.id, e.target.value)}
                    disabled={!isSuperAdmin || !!saving[u.id]}
                    title={
                      !isSuperAdmin
                        ? 'Only the superadmin can change roles'
                        : undefined
                    }
                  >
                    <option value="viewer">viewer</option>
                    <option value="editor">editor</option>
                    <option value="admin">admin</option>
                  </select>
                )}
              </td>
              <td>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    className="btn"
                    onClick={() => navigate(`/books/admin/users/${u.id}`)}
                    style={{ padding: '4px 8px', fontSize: '12px', whiteSpace: 'nowrap', width: 'auto', minWidth: 'auto', maxWidth: 'max-content' }}
                  >
                    Details
                  </button>
                  {(() => {
                    const hasUploads = (u.uploadCount || 0) > 0;
                    const elevated = u.role === 'admin' || u.role === 'editor';
                    if (!elevated && !hasUploads) return null;
                    return (
                      <button
                        className="btn"
                        onClick={() => navigate(`/books/admin/users/${u.id}?tab=uploads`)}
                        style={{ padding: '4px 8px', fontSize: '12px', whiteSpace: 'nowrap', width: 'auto', minWidth: 'auto', maxWidth: 'max-content' }}
                      >
                        View uploads
                      </button>
                    );
                  })()}
                </div>
              </td>
            </tr>
          );
          })}
        </tbody>
      </table>
      </div>
      
      {filteredRows.length > 0 && (
        <div className="actions" style={{ marginTop: 10, justifyContent: 'space-between' }}>
          <button className="btn" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</button>
          <span className="users-pagination-label" style={{ color: '#cfd8dc' }}>Page {page} of {totalPages} ({filteredRows.length} users)</span>
          <button className="btn" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</button>
        </div>
      )}

    </div>
  );
};

export default Users;