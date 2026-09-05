'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalRecords?: number;
  pageSize?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalRecords,
  pageSize,
  className = '',
  style = {},
}: PaginationProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const safeCurrentPage = Math.max(1, Math.min(currentPage, safeTotalPages));

  // Generate page numbers array with smart ellipsis
  const getPageNumbers = () => {
    if (safeTotalPages <= 7) {
      return Array.from({ length: safeTotalPages }, (_, i) => i + 1);
    }

    const pages: (number | string)[] = [];
    pages.push(1);

    if (currentPage > 3) {
      pages.push('...');
    }

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      if (!pages.includes(i)) {
        pages.push(i);
      }
    }

    if (currentPage < totalPages - 2) {
      pages.push('...');
    }

    if (!pages.includes(totalPages)) {
      pages.push(totalPages);
    }

    return pages;
  };

  const pages = getPageNumbers();

  const startRecord = totalRecords && pageSize ? (currentPage - 1) * pageSize + 1 : null;
  const endRecord = totalRecords && pageSize ? Math.min(currentPage * pageSize, totalRecords) : null;

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        borderTop: '1px solid var(--border)',
        flexWrap: 'wrap',
        gap: '12px',
        fontSize: '13.5px',
        color: 'var(--text-secondary)',
        ...style,
      }}
    >
      <div>
        {startRecord !== null && endRecord !== null && totalRecords ? (
          <span>
            Showing <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{startRecord}</strong> to{' '}
            <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{endRecord}</strong> of{' '}
            <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{totalRecords}</strong> entries
          </span>
        ) : totalRecords !== undefined ? (
          <span>
            Total <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{totalRecords}</strong> records
          </span>
        ) : (
          <span>
            Page <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{currentPage}</strong> of{' '}
            <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{Math.max(1, totalPages)}</strong>
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {/* Previous Button */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '34px',
            height: '34px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'white',
            color: currentPage <= 1 ? 'var(--text-secondary)' : 'var(--text-primary)',
            cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
            opacity: currentPage <= 1 ? 0.4 : 1,
            transition: 'all 0.15s ease',
          }}
          title="Previous Page"
        >
          <ChevronLeft size={16} />
        </button>

        {/* Page Numbers */}
        {pages.map((p, idx) => {
          if (p === '...') {
            return (
              <span
                key={`dots-${idx}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '34px',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '14px',
                }}
              >
                ...
              </span>
            );
          }

          const pageNum = p as number;
          const isActive = pageNum === currentPage;

          return (
            <button
              key={pageNum}
              type="button"
              onClick={() => onPageChange(pageNum)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '34px',
                height: '34px',
                padding: '0 8px',
                borderRadius: '8px',
                border: isActive ? 'none' : '1px solid var(--border)',
                background: isActive ? 'var(--primary)' : 'white',
                color: isActive ? 'white' : 'var(--text-primary)',
                fontWeight: isActive ? 800 : 600,
                fontSize: '13.5px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: isActive ? '0 3px 8px rgba(0, 0, 0, 0.12)' : 'none',
              }}
            >
              {pageNum}
            </button>
          );
        })}

        {/* Next Button */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '34px',
            height: '34px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'white',
            color: currentPage >= totalPages ? 'var(--text-secondary)' : 'var(--text-primary)',
            cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
            opacity: currentPage >= totalPages ? 0.4 : 1,
            transition: 'all 0.15s ease',
          }}
          title="Next Page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
