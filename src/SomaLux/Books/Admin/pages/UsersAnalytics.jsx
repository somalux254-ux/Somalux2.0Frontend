import React, { useState, useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

const UsersAnalytics = ({ rows }) => {
  const [range, setRange] = useState('month');

  const {
    kpiActive,
    kpiSignedOut,
    totalActiveNow,
    totalUsers,
    totalSignedOut,
    chartData,
    rangeLabel,
  } = useMemo(() => {
    const now = new Date();
    let from;
    if (range === 'daily') {
      from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    } else if (range === 'week') {
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (range === 'year') {
      from = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    } else {
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const totalUsersLocal = rows.length;
    let totalActiveNowLocal = 0;
    let totalSignedOutLocal = 0;
    let activePeriod = 0;
    let signedOutPeriod = 0;

    const ONLINE_WINDOW_MINUTES = 5;
    const onlineWindowMs = ONLINE_WINDOW_MINUTES * 60 * 1000;

    rows.forEach((u) => {
      const createdAt = u.created_at ? new Date(u.created_at) : null;
      const lastActiveAt = u.last_active_at ? new Date(u.last_active_at) : createdAt;
      const deactivatedAt = u.deactivated_at ? new Date(u.deactivated_at) : null;

      const isOnlineNow = !!(lastActiveAt && now.getTime() - lastActiveAt.getTime() <= onlineWindowMs);
      const isSignedOutByTimestamp = !!deactivatedAt && deactivatedAt <= now;
      const isSignedIn = !isSignedOutByTimestamp;

      if (isOnlineNow) totalActiveNowLocal += 1;
      if (isSignedOutByTimestamp) totalSignedOutLocal += 1;

      if (isSignedIn) {
        const activityTime = lastActiveAt || createdAt;
        if (activityTime && activityTime >= from && activityTime <= now) {
          activePeriod += 1;
        }
      } else if (isSignedOutByTimestamp && deactivatedAt && deactivatedAt >= from && deactivatedAt <= now) {
        signedOutPeriod += 1;
      }
    });

    const chartDataLocal = [
      // Removed graph data for active and signed out users
    ];

    const rangeLabelLocal = range === 'daily' ? 'Last 24 hours' : range === 'week' ? 'Last 7 days' : range === 'year' ? 'Last 12 months' : 'Last 30 days';

    return {
      kpiActive: activePeriod,
      kpiSignedOut: signedOutPeriod,
      totalActiveNow: totalActiveNowLocal,
      totalUsers: totalUsersLocal,
      totalSignedOut: totalSignedOutLocal,
      chartData: chartDataLocal,
      rangeLabel: rangeLabelLocal,
    };
  }, [rows, range]);

  // Only graph removed, box counts remain
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {['daily', 'week', 'month', 'year'].map((key) => (
            <button
              key={key}
              className="btn"
              style={{
                padding: '4px 12px',
                borderRadius: 999,
                background: range === key ? '#005c4b' : '#202c33',
                color: '#e9edef',
                border: 'none',
                fontSize: 12,
                textTransform: 'capitalize',
              }}
              onClick={() => setRange(key)}
            >
              {key}
            </button>
          ))}
        </div>
        <div style={{ color: '#8696a0', fontSize: 12 }}>{rangeLabel}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 6, marginTop: 8 }}>
        <div style={{ background: '#111b21', borderRadius: 6, padding: 8, border: '1px solid #202c33' }}>
          <div style={{ fontSize: 11, color: '#8696a0', marginBottom: 2 }}>Active users ({rangeLabel})</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: '#e9edef' }}>{kpiActive}</div>
        </div>
        <div style={{ background: '#111b21', borderRadius: 6, padding: 8, border: '1px solid #202c33' }}>
          <div style={{ fontSize: 11, color: '#8696a0', marginBottom: 2 }}>Signed-out users ({rangeLabel})</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: '#e9edef' }}>{kpiSignedOut}</div>
        </div>
        <div style={{ background: '#111b21', borderRadius: 12, padding: 12, border: '1px solid #202c33' }}>
          <div style={{ fontSize: 12, color: '#8696a0', marginBottom: 4 }}>Total active now</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: '#e9edef' }}>{totalActiveNow}</div>
          <div style={{ fontSize: 11, color: '#8696a0', marginTop: 2 }}>of {totalUsers} users</div>
        </div>
        <div style={{ background: '#111b21', borderRadius: 12, padding: 12, border: '1px solid #202c33' }}>
          <div style={{ fontSize: 12, color: '#8696a0', marginBottom: 4 }}>Total signed-out</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: '#e9edef' }}>{totalSignedOut}</div>
        </div>
      </div>
    </div>
  );
};

export default UsersAnalytics;