'use client';
import { useState, useEffect } from 'react';
import { Star, Search, ChevronLeft, ChevronRight } from 'lucide-react';

export default function ReviewsAdminPage() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedReview, setSelectedReview] = useState<any>(null);

  const fetchReviews = async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reviews?page=${p}&limit=50`);
      const data = await res.json();
      if (data.success) {
        setReviews(data.data);
        setTotalPages(data.pagination.totalPages);
        setTotalCount(data.pagination.total);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews(page);
  }, [page]);

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <Star 
        key={i} 
        size={14} 
        fill={i < rating ? '#F59E0B' : 'transparent'} 
        color={i < rating ? '#F59E0B' : '#D1D5DB'} 
        style={{ marginRight: '2px' }}
      />
    ));
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Star size={24} /> Customer Reviews
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            {totalCount} total reviews
          </p>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: '#F8FAFC' }}>
              <tr>
                <th style={{ padding: '16px', fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>Date</th>
                <th style={{ padding: '16px', fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>Customer</th>
                <th style={{ padding: '16px', fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>Ticket #</th>
                <th style={{ padding: '16px', fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>Rating</th>
                <th style={{ padding: '16px', fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', width: '40%' }}>Comment</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ padding: '32px' }}>
                    <div style={{ display: 'flex', justifyContent: 'center' }}><div className="loader" /></div>
                  </td>
                </tr>
              ) : reviews.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>No reviews yet.</td>
                </tr>
              ) : (
                reviews.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ fontWeight: 600 }}>{r.user_name || 'Anonymous'}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{r.user_phone}</div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      {r.ticket_number ? (
                        <span className="badge" style={{ background: '#FEE2E2', color: '#991B1B' }}>
                          #{r.ticket_number}
                        </span>
                      ) : '-'}
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex' }}>
                        {renderStars(r.rating)}
                      </div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      {r.comment ? (
                        <p 
                          onClick={() => setSelectedReview(r)}
                          style={{ 
                            margin: 0, 
                            fontSize: '14px', 
                            lineHeight: 1.5,
                            cursor: 'pointer',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                          title="Click to read full review"
                        >
                          "{r.comment}"
                        </p>
                      ) : (
                        <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5 }}>
                          <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No comment provided</span>
                        </p>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Page {page} of {totalPages}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ padding: '0 12px' }}
              >
                <ChevronLeft size={16} /> Prev
              </button>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{ padding: '0 12px' }}
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedReview && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          padding: '24px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '600px', padding: '32px', position: 'relative' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
              Review by {selectedReview.user_name || 'Anonymous'}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <div style={{ display: 'flex' }}>
                {renderStars(selectedReview.rating)}
              </div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                {new Date(selectedReview.created_at).toLocaleString()}
              </span>
            </div>
            
            <div style={{ 
              background: '#F8FAFC', 
              padding: '24px', 
              borderRadius: '8px',
              border: '1px solid var(--border)',
              maxHeight: '400px',
              overflowY: 'auto'
            }}>
              <p style={{ margin: 0, fontSize: '16px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                "{selectedReview.comment}"
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedReview(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
