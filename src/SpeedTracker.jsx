import React, { useCallback, useEffect, useRef, useState } from 'react';

const formatMbps = (mbps) => {
  if (mbps == null || Number.isNaN(mbps)) return '-';
  if (mbps >= 1000) return `${(mbps / 1000).toFixed(2)} Gbps`;
  return `${mbps.toFixed(2)} Mbps`;
};

const SpeedTracker = () => {
  const [testing, setTesting] = useState(false);
  const [lastResult, setLastResult] = useState(null); // { mbps, bytes, ms, timestamp }
  const [liveMbps, setLiveMbps] = useState(null);
  const [progress, setProgress] = useState(0);

  const abortRef = useRef(null);
  const rafRef = useRef(null);
  const bytesRef = useRef(0);
  const startTimeRef = useRef(0);
  const durationSec = 10; // Shorter for faster tests like fast.com
  const connections = 6; // More connections for accuracy

  const runSpeedTest = useCallback(async () => {
    if (testing) return;
    setTesting(true);
    setLastResult(null);
    setLiveMbps(null);
    setProgress(0);
    bytesRef.current = 0;
    startTimeRef.current = performance.now();

    const controller = new AbortController();
    abortRef.current = controller;

    const until = startTimeRef.current + durationSec * 1000;
    // Use Cloudflare's speed test endpoint for true internet speed
    const testUrlBase = `https://speed.cloudflare.com/__down?bytes=10000000`; // 10MB chunks

    const worker = async () => {
      while (performance.now() < until && !controller.signal.aborted) {
        const testUrl = `${testUrlBase}&r=${Math.random()}`;
        try {
          const res = await fetch(testUrl, { cache: 'no-store', signal: controller.signal });
          if (!res.ok) continue;
          const buf = await res.arrayBuffer();
          bytesRef.current += buf.byteLength;
        } catch (_) {
          if (controller.signal.aborted) break;
        }
      }
    };

    const raf = () => {
      const now = performance.now();
      const elapsed = now - startTimeRef.current;
      const prog = Math.min((elapsed / (durationSec * 1000)) * 100, 100);
      setProgress(prog);
      const bits = bytesRef.current * 8;
      const mbpsNow = elapsed > 0 ? bits / (elapsed / 1000) / 1_000_000 : 0;
      setLiveMbps(mbpsNow);
      if (now < until && !controller.signal.aborted) {
        rafRef.current = requestAnimationFrame(raf);
      }
    };
    rafRef.current = requestAnimationFrame(raf);

    const workers = Array.from({ length: connections }, () => worker());
    await Promise.allSettled(workers);

    controller.abort();
    cancelAnimationFrame(rafRef.current);

    const end = performance.now();
    const ms = Math.max(1, end - startTimeRef.current);
    const finalBytes = bytesRef.current;
    const mbps = finalBytes > 0 ? (finalBytes * 8) / (ms / 1000) / 1_000_000 : null;
    const result = { mbps: mbps ?? null, bytes: finalBytes, ms, timestamp: Date.now() };
    setLastResult(result);
    setTesting(false);
  }, [testing]);

  const stopTest = useCallback(() => {
    abortRef.current?.abort();
    setTesting(false);
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    // Auto-start like fast.com
    runSpeedTest();
  }, [runSpeedTest]);

  const displaySpeed = testing ? (liveMbps != null ? liveMbps : 0) : (lastResult?.mbps ?? 0);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0b0d10',
      color: '#e6edf3',
      fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
      padding: '20px',
    }}>
      <div style={{
        textAlign: 'center',
        maxWidth: '400px',
        width: '100%',
      }}>
        <h1 style={{ margin: '0 0 20px 0', fontSize: 24, color: '#9ad0ff' }}>Speed Test</h1>
        
        <div style={{
          background: '#0f1318',
          padding: '40px 20px',
          borderRadius: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        }}>
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 10 }}>
            Download
          </div>
          <div style={{ 
            fontSize: 64, 
            fontWeight: 800, 
            lineHeight: 1, 
            color: '#7ee787',
            marginBottom: 20 
          }}>
            {formatMbps(displaySpeed)}
          </div>
          
          {testing && (
            <div style={{ marginBottom: 20 }}>
              <div style={{
                width: '100%',
                height: 4,
                background: '#374151',
                borderRadius: 2,
                overflow: 'hidden',
                marginBottom: 8,
              }}>
                <div style={{
                  width: `${progress}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #7ee787, #22c55e)',
                  transition: 'width 0.3s ease',
                }} />
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>
                {Math.round(progress)}% complete
              </div>
            </div>
          )}
          
          <div style={{ fontSize: 14, color: '#9ca3af' }}>
            {testing ? `Testing your download speed…` : (lastResult ? 'Test complete' : 'Click to start')}
          </div>
        </div>

        <div style={{ marginTop: 30 }}>
          <button
            onClick={() => (testing ? stopTest() : runSpeedTest())}
            style={{
              background: testing ? '#ef4444' : '#2563eb',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 16,
              transition: 'background 0.2s ease',
            }}
          >
            {testing ? 'Cancel' : (lastResult ? 'Run Again' : 'Start')}
          </button>
        </div>

        <div style={{ 
          marginTop: 20, 
          fontSize: 12, 
          color: '#6b7280',
          textAlign: 'left',
          maxWidth: '300px',
          margin: '20px auto 0',
        }}>
          Powered by Cloudflare. Tests your download speed to the nearest server.
        </div>
      </div>
    </div>
  );
};

export default SpeedTracker;