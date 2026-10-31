'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, ExternalLink, Calendar, RefreshCw, CheckCircle2 } from 'lucide-react';

interface SystemUpdate {
  id: string;
  version_tag: string | null;
  title: string;
  description: string;
  learn_more_url: string | null;
  published_at: string;
  created_at: string;
}

interface UpdatesAndPatchesCardProps {
  primaryColor?: string;
}

export function UpdatesAndPatchesCard({ primaryColor = 'var(--primary, #971345)' }: UpdatesAndPatchesCardProps) {
  const [updates, setUpdates] = useState<SystemUpdate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUpdates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/system-updates');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setUpdates(data.data);
      }
    } catch (err) {
      console.error('Failed to load system updates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUpdates();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '24px 12px', textAlign: 'center', color: '#64748B' }}>
        <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
        <p style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>Loading latest updates and patches...</p>
      </div>
    );
  }

  if (updates.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px dashed #CBD5E1' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', borderRadius: '50%', backgroundColor: '#E2E8F0', color: '#64748B', marginBottom: '8px' }}>
          <CheckCircle2 size={20} />
        </div>
        <h4 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
          Your system is running the latest version
        </h4>
        <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>
          No new patch notes have been published yet. Updates and release notes from the engineering team will automatically appear here.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <p style={{ margin: '0 0 6px', fontSize: '13px', color: '#64748B', lineHeight: 1.5 }}>
        Review platform updates, newly deployed features, and recent bug fixes.
      </p>

      {updates.map((item, idx) => {
        const dateStr = item.published_at || item.created_at;
        const formattedDate = dateStr
          ? new Date(dateStr).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : '';

        const isLatest = idx === 0;

        return (
          <div
            key={item.id}
            style={{
              padding: '16px 18px',
              borderRadius: '10px',
              backgroundColor: isLatest ? '#F8FAFC' : '#FFFFFF',
              border: isLatest ? '1.5px solid #E2E8F0' : '1px solid #E2E8F0',
              boxShadow: isLatest ? '0 2px 6px rgba(0, 0, 0, 0.02)' : 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            {/* Header: Version, Title, Date */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {item.version_tag && (
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      fontSize: '11px',
                      fontWeight: 800,
                      borderRadius: '6px',
                      backgroundColor: '#DBEAFE',
                      color: '#1E40AF',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {item.version_tag}
                  </span>
                )}
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
                  {item.title}
                </h4>
                {isLatest && (
                  <span
                    style={{
                      padding: '2px 7px',
                      fontSize: '10px',
                      fontWeight: 700,
                      borderRadius: '12px',
                      backgroundColor: '#DCFCE7',
                      color: '#15803D',
                    }}
                  >
                    Latest
                  </span>
                )}
              </div>

              {formattedDate && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#64748B', fontWeight: 500 }}>
                  <Calendar size={13} />
                  <span>{formattedDate}</span>
                </div>
              )}
            </div>

            {/* Description lines */}
            <div style={{ fontSize: '13px', color: '#334155', lineHeight: 1.55 }}>
              {item.description.split('\n').map((line, lIdx) => (
                <p key={lIdx} style={{ margin: '2px 0' }}>
                  {line}
                </p>
              ))}
            </div>

            {/* Learn More link */}
            {item.learn_more_url && (
              <div style={{ paddingTop: '2px' }}>
                <a
                  href={item.learn_more_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: primaryColor,
                    textDecoration: 'none',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                  onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                >
                  Learn more <ExternalLink size={13} />
                </a>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
export default UpdatesAndPatchesCard;

