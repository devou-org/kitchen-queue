'use client';
import { useState, useEffect } from 'react';
import { Star, Search, ChevronLeft, ChevronRight } from 'lucide-react';

export default function ReviewsAdminPage() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

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
                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading...</td>
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
                      <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5 }}>
                        {r.comment ? `"${r.comment}"` : <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No comment provided</span>}
                      </p>
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
    </div>
  );
}
