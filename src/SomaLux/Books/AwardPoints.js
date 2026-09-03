import React, { useState } from 'react';
import { supabase } from './supabaseClient'; // adjust the path if needed

const AwardPoints = ({ userId }) => {
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleAwardPoints = async () => {
    if (!userId) {
      setMessage('Error: User ID is missing.');
      return;
    }

    if (points <= 0) {
      setMessage('Error: Points must be greater than 0.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {      const { data, error } = await supabase.rpc('award_reading_points', {
        user_id: userId,
        points: points
      });

      if (error) {
        if (error.code === 'PGRST116' || error.status === 404) {
          setMessage('RPC function not available. Please contact support.');
        } else {
          console.error('RPC Error:', error);
          setMessage(`Error: ${error.message}`);
        }
      } else {
        console.log('RPC Data:', data);
        setMessage(`Successfully awarded ${points} points!`);
      }
    } catch (err) {
      console.error('Unexpected Error:', err);
      setMessage('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '1rem', maxWidth: '400px', margin: 'auto' }}>
      <h2>Award Reading Points</h2>
      <input
        type="number"
        value={points}
        onChange={(e) => setPoints(Number(e.target.value))}
        placeholder="Enter points"
        min="1"
        style={{ padding: '0.5rem', width: '100%', marginBottom: '1rem' }}
      />
      <button
        onClick={handleAwardPoints}
        disabled={loading}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: '#2563eb',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {loading ? 'Awarding...' : 'Award Points'}
      </button>
      {message && <p style={{ marginTop: '1rem' }}>{message}</p>}
    </div>
  );
};

export default AwardPoints;
