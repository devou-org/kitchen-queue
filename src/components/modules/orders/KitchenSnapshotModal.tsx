'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  ChefHat,
  RefreshCw,
  X,
  Search,
  AlertTriangle,
  Clock,
  Flame,
  UtensilsCrossed,
  Filter,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { orderService } from '@/app/services/orders.api';

interface KitchenSnapshotItem {
  product_id: string;
  product_name: string;
  category?: string;
  image_url?: string;
  current_stock: number;
  pending_qty: number;
  preparing_qty: number;
}

interface KitchenSnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessDate?: string;
}

export function KitchenSnapshotModal({ isOpen, onClose, businessDate }: KitchenSnapshotModalProps) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<KitchenSnapshotItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'ALL' | 'PREPARING' | 'PENDING' | 'LOW_STOCK'>('ALL');
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadSnapshot = useCallback(async (isManual = false) => {
    setLoading(true);
    try {
      const res = await orderService.getKitchenSnapshot(businessDate);
      if (res.success && res.data) {
        setItems(res.data);
        const now = new Date();
        setLastRefreshed(
          now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        );
        if (isManual) {
          toast.success('Kitchen snapshot refreshed');
        }
      } else {
        toast.error(res.error || 'Failed to load kitchen snapshot');
      }
    } catch {
      toast.error('Error loading kitchen snapshot');
    } finally {
      setLoading(false);
    }
  }, [businessDate]);

  useEffect(() => {
    if (isOpen) {
      loadSnapshot();
      setSearchQuery('');
      setFilterTab('ALL');
    }
  }, [isOpen, loadSnapshot]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // Metrics
  const metrics = useMemo(() => {
    let totalPending = 0;
    let totalPreparing = 0;
    let lowStockCount = 0;

    for (const item of items) {
      const pending = Number(item.pending_qty) || 0;
      const preparing = Number(item.preparing_qty) || 0;
      const stock = Number(item.current_stock) || 0;

      totalPending += pending;
      totalPreparing += preparing;
      if (stock < pending + preparing) {
        lowStockCount++;
      }
    }

    return {
      totalDemand: totalPending + totalPreparing,
      totalPreparing,
      totalPending,
      lowStockCount,
    };
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const pending = Number(item.pending_qty) || 0;
      const preparing = Number(item.preparing_qty) || 0;
      const stock = Number(item.current_stock) || 0;

      // Filter Tab
      if (filterTab === 'PREPARING' && preparing === 0) return false;
      if (filterTab === 'PENDING' && pending === 0) return false;
      if (filterTab === 'LOW_STOCK' && stock >= pending + preparing) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.product_name.toLowerCase().includes(q);
        const matchCat = (item.category || '').toLowerCase().includes(q);
        if (!matchName && !matchCat) return false;
      }

      return true;
    });
  }, [items, filterTab, searchQuery]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      className="kitchen-snapshot-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100005,
        background: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <style>{`
        @keyframes snapshotModalFadeIn {
          from {
            opacity: 0;
            transform: scale(0.96) translateY(6px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .kitchen-snapshot-modal-box {
          animation: snapshotModalFadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .kitchen-snapshot-row:hover {
          background-color: #F8FAFC !important;
        }
        @media (max-width: 640px) {
          .kitchen-snapshot-backdrop {
            padding: 8px !important;
          }
          .kitchen-snapshot-modal-box {
            max-height: 95vh !important;
          }
        }
      `}</style>

      {/* Modal Container with exact 8px border radius */}
      <div
        className="kitchen-snapshot-modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '740px',
          maxHeight: '90vh',
          background: '#FFFFFF',
          borderRadius: '8px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        {/* 1. Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #F1F5F9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#FFFFFF',
            flexShrink: 0,
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                background: 'rgba(15, 23, 42, 0.06)',
                color: '#0F172A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <ChefHat size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2
                  style={{
                    fontSize: '17px',
                    fontWeight: 800,
                    color: '#0F172A',
                    margin: 0,
                    letterSpacing: '-0.01em',
                  }}
                >
                  Kitchen Demand Snapshot
                </h2>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#059669',
                    background: '#ECFDF5',
                    border: '1px solid #A7F3D0',
                    padding: '2px 7px',
                    borderRadius: '8px',
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#10B981',
                      display: 'inline-block',
                    }}
                  />
                  LIVE
                </span>
              </div>
              <p
                style={{
                  fontSize: '12px',
                  color: '#64748B',
                  margin: '2px 0 0 0',
                }}
              >
                Current consolidated demand vs available stock in real-time.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => loadSnapshot(true)}
              disabled={loading}
              title="Refresh snapshot"
              style={{
                height: '32px',
                padding: '0 10px',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                background: '#FFFFFF',
                color: '#475569',
                fontSize: '12px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
            >
              <RefreshCw
                size={13}
                style={{
                  animation: loading ? 'spin 1s linear infinite' : 'none',
                }}
              />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#F1F5F9',
                border: 'none',
                borderRadius: '8px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#64748B',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#E2E8F0')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#F1F5F9')}
              title="Close (Esc)"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 2. KPI Metrics Summary Banner with 8px radius */}
        <div
          style={{
            padding: '14px 20px',
            background: '#F8FAFC',
            borderBottom: '1px solid #E2E8F0',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '10px',
            flexShrink: 0,
          }}
        >
          {/* KPI 1: Total Demand */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              padding: '10px 12px',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748B' }}>Total Demand</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
              {metrics.totalDemand} <span style={{ fontSize: '11px', fontWeight: 500, color: '#94A3B8' }}>dishes</span>
            </div>
          </div>

          {/* KPI 2: Preparing */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #DBEAFE',
              borderRadius: '8px',
              padding: '10px 12px',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#2563EB', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Flame size={12} />
              <span>Preparing</span>
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#1D4ED8', marginTop: '2px' }}>
              {metrics.totalPreparing}
            </div>
          </div>

          {/* KPI 3: Pending */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #FEF3C7',
              borderRadius: '8px',
              padding: '10px 12px',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#D97706', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={12} />
              <span>Pending</span>
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#B45309', marginTop: '2px' }}>
              {metrics.totalPending}
            </div>
          </div>
        </div>

        {/* 3. Search & Filter Bar */}
        <div
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid #F1F5F9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            background: '#FFFFFF',
            flexShrink: 0,
            flexWrap: 'wrap',
          }}
        >
          {/* Search box with 8px radius */}
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '160px' }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94A3B8',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dish or category..."
              style={{
                width: '100%',
                height: '34px',
                paddingLeft: '32px',
                paddingRight: searchQuery ? '28px' : '10px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '12.5px',
                outline: 'none',
                color: '#0F172A',
                boxSizing: 'border-box',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '6px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  padding: '3px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Filter Pills with 8px radius */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {(
              [
                { id: 'ALL', label: `All (${items.length})` },
                { id: 'PREPARING', label: `Preparing (${metrics.totalPreparing})` },
                { id: 'PENDING', label: `Pending (${metrics.totalPending})` },
                { id: 'LOW_STOCK', label: `Low Stock (${metrics.lowStockCount})` },
              ] as const
            ).map((tab) => {
              const active = filterTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterTab(tab.id)}
                  style={{
                    height: '32px',
                    padding: '0 10px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: active ? 700 : 500,
                    border: '1px solid',
                    borderColor: active ? 'var(--primary, #0F172A)' : '#E2E8F0',
                    background: active ? 'var(--primary, #0F172A)' : '#FFFFFF',
                    color: active ? '#FFFFFF' : '#475569',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Scrollable Table Container */}
        <div
          style={{
            flex: 1,
            overflowX: 'auto',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          <div
            style={{
              minWidth: '460px',
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
            }}
          >
            {/* Sticky Table Header */}
            <div
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 10,
                padding: '10px 16px',
                background: '#F8FAFC',
                borderBottom: '1px solid #E2E8F0',
                display: 'grid',
                gridTemplateColumns: 'minmax(140px, 1fr) 75px 80px 85px',
                alignItems: 'center',
                gap: '8px',
                fontSize: '11px',
                fontWeight: 700,
                color: '#64748B',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                flexShrink: 0,
              }}
            >
              <div>Menu Item</div>
              <div style={{ textAlign: 'center' }}>Pending</div>
              <div style={{ textAlign: 'center' }}>Preparing</div>
              <div style={{ textAlign: 'right' }}>Stock Left</div>
            </div>

            {/* Items Content */}
            <div
              style={{
                padding: '4px 16px',
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
              }}
            >
              {loading && items.length === 0 ? (
                <div
                  style={{
                    padding: '60px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    color: '#64748B',
                    fontSize: '13px',
                  }}
                >
                  <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', color: '#94A3B8' }} />
                  <span>Loading kitchen demand...</span>
                </div>
              ) : filteredItems.length === 0 ? (
                <div
                  style={{
                    padding: '50px 20px',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    color: '#64748B',
                  }}
                >
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '8px',
                      background: '#F1F5F9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#94A3B8',
                    }}
                  >
                    <UtensilsCrossed size={20} />
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>
                    {searchQuery || filterTab !== 'ALL' ? 'No matching demand found' : 'No active kitchen demand'}
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8' }}>
                    {searchQuery || filterTab !== 'ALL'
                      ? 'Try clearing the search or switching filter tabs.'
                      : 'Active orders in Pending or Preparing state will show here.'}
                  </p>
                </div>
              ) : (
                filteredItems.map((item, idx) => {
                  const pending = Number(item.pending_qty) || 0;
                  const preparing = Number(item.preparing_qty) || 0;
                  const stock = Number(item.current_stock) || 0;
                  const isLowStock = stock < pending + preparing;

                  return (
                    <div
                      key={item.product_id || idx}
                      className="kitchen-snapshot-row"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(140px, 1fr) 75px 80px 85px',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 0',
                        borderBottom: '1px solid #F1F5F9',
                        borderRadius: '6px',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      {/* Dish Info */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          minWidth: 0,
                          paddingRight: '8px',
                        }}
                      >
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.product_name}
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: '8px',
                              objectFit: 'cover',
                              background: '#F1F5F9',
                              flexShrink: 0,
                              border: '1px solid #E2E8F0',
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: '8px',
                              background: '#F1F5F9',
                              border: '1px solid #E2E8F0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#64748B',
                              flexShrink: 0,
                            }}
                          >
                            <UtensilsCrossed size={16} />
                          </div>
                        )}

                        <div style={{ minWidth: 0, overflow: 'hidden' }}>
                          <div
                            style={{
                              fontSize: '13.5px',
                              fontWeight: 700,
                              color: '#0F172A',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {item.product_name}
                          </div>
                          {item.category && (
                            <div
                              style={{
                                fontSize: '11px',
                                color: '#64748B',
                                marginTop: '1px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {item.category}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Pending Column */}
                      <div style={{ textAlign: 'center' }}>
                        {pending > 0 ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minWidth: '30px',
                              padding: '3px 8px',
                              borderRadius: '8px',
                              fontSize: '13px',
                              fontWeight: 800,
                              background: '#FEF3C7',
                              color: '#B45309',
                              border: '1px solid #FDE68A',
                            }}
                          >
                            {pending}
                          </span>
                        ) : (
                          <span style={{ fontSize: '13px', color: '#CBD5E1', fontWeight: 600 }}>0</span>
                        )}
                      </div>

                      {/* Preparing Column */}
                      <div style={{ textAlign: 'center' }}>
                        {preparing > 0 ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minWidth: '30px',
                              padding: '3px 8px',
                              borderRadius: '8px',
                              fontSize: '13px',
                              fontWeight: 800,
                              background: '#DBEAFE',
                              color: '#1D4ED8',
                              border: '1px solid #BFDBFE',
                            }}
                          >
                            {preparing}
                          </span>
                        ) : (
                          <span style={{ fontSize: '13px', color: '#CBD5E1', fontWeight: 600 }}>0</span>
                        )}
                      </div>

                      {/* Stock Left Column */}
                      <div style={{ textAlign: 'right' }}>
                        {isLowStock ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              padding: '3px 8px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: 700,
                              background: '#FEE2E2',
                              color: '#DC2626',
                              border: '1px solid #FECACA',
                            }}
                          >
                            <AlertTriangle size={11} />
                            <span>{stock}</span>
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '3px 8px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: 700,
                              background: '#F1F5F9',
                              color: '#334155',
                              border: '1px solid #E2E8F0',
                            }}
                          >
                            {stock}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* 6. Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #F1F5F9',
            background: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748B' }}>
            {lastRefreshed ? `Updated at ${lastRefreshed}` : 'Live auto-calculated'}
            {businessDate ? ` · Date: ${businessDate}` : ''}
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              height: '34px',
              padding: '0 16px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#334155',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
export default KitchenSnapshotModal;
