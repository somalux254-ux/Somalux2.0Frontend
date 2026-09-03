import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import logo from '../../../../Assets/SomaLuxLogo.svg';
import { fetchStats, fetchViewDetails, fetchAllUsers } from '../api';
import { useAdminUI } from '../AdminUIContext';
import { supabase } from '../../supabaseClient';

const Settings = ({ userProfile }) => {
  const [pdfOptions, setPdfOptions] = useState({
    overview: true,
    uploadsPerMonth: true,
    topBooks: true,
    recentBooks: true,
    viewsDetails: true,
    includeUsers: false,
    usersMode: 'names_emails',
    dateRange: 'all',
  });
  const [generating, setGenerating] = useState(false);
  const [usersPanelOpen, setUsersPanelOpen] = useState(false);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [usersDataCache, setUsersDataCache] = useState([]);

  const { showToast } = useAdminUI();

  const isAdmin = userProfile?.role === 'admin';

  const handleOptionChange = (key) => {
    setPdfOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Load roles dynamically when users panel opens
  useEffect(() => {
    if (!usersPanelOpen) return;
    (async () => {
      const users = await fetchAllUsers();
      setUsersDataCache(users);
      const rolesSet = Array.from(new Set((users || []).map(u => (u.role || 'viewer').toLowerCase())));
      // Order Admin, Editor, Viewer first, then others alphabetically
      const priority = { admin: 0, editor: 1, viewer: 2 };
      const ordered = rolesSet.sort((a, b) => (priority[a] ?? 99) - (priority[b] ?? 99) || a.localeCompare(b));
      setAvailableRoles(ordered);
      // Default select all roles
      setSelectedRoles(ordered);
    })();
  }, [usersPanelOpen]);

  const toggleRole = (role) => {
    setSelectedRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  };

  // Helper: fetch asset and convert to Base64 data URL
  const toDataUrl = async (url) => {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      return null;
    }
  };

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const logoDataUrl = await toDataUrl(logo);
      const stats = await fetchStats();
      const viewDetails = pdfOptions.viewsDetails ? await fetchViewDetails() : [];
      const usersAll = (pdfOptions.includeUsers ? (usersDataCache.length ? usersDataCache : await fetchAllUsers()) : []);

      const doc = new jsPDF();
      let yPos = 20;

      // Add watermark to first page (behind content)
      const addWatermark = () => {
        if (!logoDataUrl) return;
        const pw = doc.internal.pageSize.width;
        const ph = doc.internal.pageSize.height;
        const w = Math.min(pw * 0.25, 60); // Smaller size
        const h = w; // Keep square for simplicity
        const x = (pw - w) / 2;
        const y = (ph - h) / 2;
        try {
          // @ts-ignore
          const g = doc.GState && new doc.GState({ opacity: 0.06 });
          if (g && doc.setGState) doc.setGState(g);
          doc.addImage(logoDataUrl, 'PNG', x, y, w, h, undefined, 'FAST');
        } catch {}
        // Reset opacity
        try {
          if (doc.setGState) doc.setGState(new doc.GState({ opacity: 1 }));
        } catch {}
      };

      addWatermark(); // Add to page 1

      // Header with embedded logo
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 168, 132); // Brand green
      try {
        if (logoDataUrl) {
          doc.addImage(logoDataUrl, 'PNG', 15, yPos - 6, 22, 22);
        }
      } catch {}
      doc.text('SomaLux Documentation', 105, yPos, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 105, yPos + 8, { align: 'center' });
      
      // Add separator line
      doc.setDrawColor(0, 168, 132);
      doc.setLineWidth(0.5);
      doc.line(15, yPos + 12, 195, yPos + 12);
      
      // Reset color
      doc.setTextColor(0);
      yPos = 40;

      // Helper to ensure enough space before starting a new section (title + head)
      const ensureSpace = (y, reserve = 50) => {
        const pageH = doc.internal.pageSize.height;
        if (y > pageH - reserve) {
          doc.addPage();
          addWatermark(); // Add watermark behind content on new page
          return 20;
        }
        return y;
      };

      const tableCommon = {
        theme: 'striped',
        headStyles: { fillColor: [0, 168, 132], textColor: 255 },
        styles: { fontSize: 10, cellPadding: 3, overflow: 'linebreak' },
        margin: { left: 15, right: 15 },
      };

      // Overview Section
      if (pdfOptions.overview && stats.counts) {
        yPos = ensureSpace(yPos);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('Overview Statistics', 15, yPos);
        const startY = yPos + 6;
        autoTable(doc, {
          startY,
          head: [['Metric', 'Value']],
          body: [
            ['Total Books', stats.counts.books || 0],
            ['Total Users', stats.counts.users || 0],
            ['Total Downloads', stats.counts.downloads || 0],
            ['Total Views', stats.counts.views || 0],
          ],
          theme: 'grid',
          headStyles: { fillColor: [0, 168, 132], textColor: 255, fontStyle: 'bold' },
          styles: { fontSize: 10, cellPadding: 3, overflow: 'linebreak' },
          margin: { left: 15, right: 15 },
        });
        yPos = doc.lastAutoTable.finalY + 15;
      }

      // Uploads per Month
      if (pdfOptions.uploadsPerMonth && stats.monthly?.length > 0) {
        const filtered = stats.monthly.filter(m => (m.uploads || 0) > 0);
        if (filtered.length > 0) {
          yPos = ensureSpace(yPos);
          doc.setFontSize(16);
          doc.setFont('helvetica', 'bold');
          doc.text('Uploads per Month', 15, yPos);
          const startY = yPos + 6;
          autoTable(doc, {
            startY,
            head: [['Month', 'Uploads']],
            body: filtered.sort((a, b) => (b.uploads || 0) - (a.uploads || 0)).map(m => [m.month, m.uploads || 0]),
            ...tableCommon,
          });
          yPos = doc.lastAutoTable.finalY + 15;
        }
      }

      // Top Books by Downloads
      if (pdfOptions.topBooks && stats.top?.length > 0) {
        const filtered = stats.top.filter(b => (b.downloads || 0) > 0);
        if (filtered.length > 0) {
          yPos = ensureSpace(yPos);
          doc.setFontSize(16);
          doc.setFont('helvetica', 'bold');
          doc.text('Top Books (Downloads)', 15, yPos);
          const startY = yPos + 6;
          autoTable(doc, {
            startY,
            head: [['Title', 'Downloads']],
            body: filtered.sort((a, b) => (b.downloads || 0) - (a.downloads || 0)).map(b => [b.title || 'Untitled', b.downloads || 0]),
            ...tableCommon,
          });
          yPos = doc.lastAutoTable.finalY + 15;
        }
      }

      // Recent Books
      if (pdfOptions.recentBooks && stats.recent?.length > 0) {
        yPos = ensureSpace(yPos);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('Recent Books', 15, yPos);
        const startY = yPos + 6;
        autoTable(doc, {
          startY,
          head: [['Title', 'Author', 'Date Added']],
          body: stats.recent.slice(0, 10).map(b => [
            b.title || 'Untitled',
            b.author || 'Unknown',
            new Date(b.created_at).toLocaleDateString()
          ]),
          ...tableCommon,
        });
        yPos = doc.lastAutoTable.finalY + 15;
      }

      // Views Details
      if (pdfOptions.viewsDetails && viewDetails.length > 0) {
        yPos = ensureSpace(yPos);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('Book Views Details', 15, yPos);
        const startY = yPos + 6;
        autoTable(doc, {
          startY,
          head: [['Book Title', 'Total Views', 'Unique Users']],
          body: viewDetails.slice(0, 20).map(v => [
            v.book_title || 'Unknown',
            v.total_views || 0,
            v.unique_users || 0
          ]),
          ...tableCommon,
        });
        yPos = doc.lastAutoTable.finalY + 15;
      }

      // Users (optional)
      if (pdfOptions.includeUsers && usersAll.length > 0) {
        yPos = ensureSpace(yPos);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('Users', 15, yPos);
        const startY = yPos + 6;

        const priority = { admin: 0, editor: 1, viewer: 2 };
        const normRole = (r) => (r || 'viewer').toLowerCase();

        let rows = usersAll;
        if (pdfOptions.usersMode === 'with_roles') {
          const allowed = new Set(selectedRoles);
          rows = rows.filter(u => allowed.has(normRole(u.role)));
        }
        // Sort by role priority then display_name
        rows = [...rows].sort((a, b) => {
          const ra = normRole(a.role), rb = normRole(b.role);
          const pr = (priority[ra] ?? 99) - (priority[rb] ?? 99);
          return pr !== 0 ? pr : (a.display_name || '').localeCompare(b.display_name || '');
        });

        if (pdfOptions.usersMode === 'with_roles') {
          autoTable(doc, {
            startY,
            head: [['Name', 'Email', 'Role']],
            body: rows.map(u => [u.display_name || '—', u.email || '—', (u.role || 'viewer')]),
            ...tableCommon,
            columnStyles: { 1: { cellWidth: 90 } },
          });
        } else {
          autoTable(doc, {
            startY,
            head: [['Name', 'Email']],
            body: rows.map(u => [u.display_name || '—', u.email || '—']),
            ...tableCommon,
            columnStyles: { 1: { cellWidth: 110 } },
          });
        }
        yPos = doc.lastAutoTable.finalY + 15;
      }

      // Footer on all pages
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(150);
        doc.text(
          `SomaLux | Page ${i} of ${pageCount}`,
          doc.internal.pageSize.width / 2,
          doc.internal.pageSize.height - 10,
          { align: 'center' }
        );
      }

      // Save PDF
      doc.save(`SomaLux-Report-${new Date().toISOString().split('T')[0]}.pdf`);
      showToast({ type: 'success', message: 'PDF report downloaded.' });
    } catch (error) {
      console.error('Error generating PDF:', error);
      showToast({ type: 'error', message: 'Failed to generate PDF. Please try again.' });
    } finally {
      setGenerating(false);
    }
  };
  return (
    <div>
      {isAdmin && (
        <div className="panel" style={{ marginBottom: 8 }}>
          <div className="panel-title">PDF Documentation Export</div>
          <p style={{ color: '#8696a0', marginBottom: 8, fontSize: 12 }}>
            Generate a comprehensive PDF report of your library statistics and data. Select the sections you want to include:
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6, marginBottom: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={pdfOptions.overview}
                onChange={() => handleOptionChange('overview')}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              <span style={{ color: '#e9edef' }}>Overview Statistics</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={pdfOptions.uploadsPerMonth}
                onChange={() => handleOptionChange('uploadsPerMonth')}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              <span style={{ color: '#e9edef' }}>Uploads per Month</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={pdfOptions.topBooks}
                onChange={() => handleOptionChange('topBooks')}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              <span style={{ color: '#e9edef' }}>Top Books (Downloads)</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={pdfOptions.recentBooks}
                onChange={() => handleOptionChange('recentBooks')}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              <span style={{ color: '#e9edef' }}>Recent Books</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={pdfOptions.viewsDetails}
                onChange={() => handleOptionChange('viewsDetails')}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              <span style={{ color: '#e9edef' }}>Book Views Details</span>
            </label>
          </div>

          {/* More (Users) */}
          <div style={{ marginTop: 6, marginBottom: 8 }}>
            <button className="btn" onClick={() => setUsersPanelOpen(v => !v)}>
              {usersPanelOpen ? 'Hide' : 'More'}
            </button>
          </div>

          {usersPanelOpen && (
            <div className="panel" style={{ marginTop: 6 }}>
              <div className="panel-title">Users Export Options</div>

              <div className="settings-tree">
                <div className="settings-branch">
                  <label className="settings-check" style={{ width: 'fit-content' }}>
                    <input
                      type="checkbox"
                      checked={!!pdfOptions.includeUsers}
                      onChange={() => setPdfOptions(p => ({ ...p, includeUsers: !p.includeUsers }))}
                      style={{ width: 16, height: 16 }}
                    />
                    <div>
                      <div className="settings-check-title">Include Users in PDF</div>
                      <div className="muted">Toggle to include a Users section in the report</div>
                    </div>
                  </label>

                  {pdfOptions.includeUsers && (
                    <div className="settings-children">
                      <div className="option-grid">
                        <label className={`option-card ${pdfOptions.usersMode !== 'with_roles' ? 'active' : ''}`}>
                          <input
                            type="radio"
                            name="usersMode"
                            checked={pdfOptions.usersMode !== 'with_roles'}
                            onChange={() => setPdfOptions(p => ({ ...p, usersMode: 'names_emails' }))}
                          />
                          <div>
                            <div className="option-title">Users</div>
                            <div className="muted small">Only name and email are included</div>
                          </div>
                        </label>

                        <label className={`option-card ${pdfOptions.usersMode === 'with_roles' ? 'active' : ''}`}>
                          <input
                            type="radio"
                            name="usersMode"
                            checked={pdfOptions.usersMode === 'with_roles'}
                            onChange={() => setPdfOptions(p => ({ ...p, usersMode: 'with_roles' }))}
                          />
                          <div>
                            <div className="option-title">Users with Roles</div>
                            <div className="muted small">Include roles and filter which roles to show</div>
                          </div>
                        </label>
                      </div>

                      {pdfOptions.usersMode === 'with_roles' && (
                        <div className="settings-branch" style={{ marginTop: 6 }}>
                          <div className="muted" style={{ marginBottom: 3 }}>Include roles</div>
                          <div className="roles-grid">
                            {availableRoles.map(role => (
                              <label key={role} className="role-chip">
                                <input
                                  type="checkbox"
                                  checked={selectedRoles.includes(role)}
                                  onChange={() => toggleRole(role)}
                                />
                                <span className="cap">{role}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="actions">
            <button
              className="btn primary"
              onClick={generatePDF}
              disabled={generating || Object.values(pdfOptions).filter(v => v === true).length === 0}
            >
              {generating ? 'Generating PDF...' : 'Download PDF Report'}
            </button>
          </div>
        </div>
      )}

      <div className="grid-2">
      <div className="panel">
        <div className="panel-title">General</div>
        <label className="label">App Name</label>
        <input className="input" placeholder="eLib" />
        <label className="label" style={{ marginTop: 6 }}>Storage Bucket</label>
        <input className="input" placeholder="books" />
        <div className="actions" style={{ marginTop: 6 }}>
          <button className="btn primary">Save</button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Account Config</div>
        <label className="label">Project URL</label>
        <input className="input" value={process.env.REACT_APP_SUPABASE_URL || ''} readOnly />
        <label className="label" style={{ marginTop: 6 }}>Public Key</label>
        <input className="input" value={(process.env.REACT_APP_SUPABASE_ANON_KEY || '').slice(0, 8) + '•••'} readOnly />
        <div style={{ marginTop: 4, color: '#8696a0', fontSize: 11 }}>Set values in .env file</div>
      </div>

      <div className="panel">
        <div className="panel-title">Activity Logs</div>
        <div style={{ color: '#8696a0' }}>No logs yet</div>
      </div>
    </div>
    </div>
  );
};

export default Settings;