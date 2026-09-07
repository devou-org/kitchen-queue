'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChefHat, RefreshCw } from 'lucide-react';
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

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      const res = await orderService.getKitchenSnapshot(businessDate);
      if (res.success && res.data) {
        setItems(res.data);
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
    }
  }, [isOpen, loadSnapshot]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      className="modal-backdrop"
      onClick={onClose}
      style={{ alignItems: 'center', zIndex: 1000 }}
    >
      <div
        className="modal-desktop"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '700px',
          width: '95%',
          padding: '24px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              style={{
                fontSize: '24px',
                background: 'rgba(151,19,69,0.1)',
                width: '44px',
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '12px',
                color: 'var(--primary)',
                flexShrink: 0,
              }}
            >
              <ChefHat size={24} />
            </span>
            <div>
              <h2
                style={{
                  fontSize: '20px',
                  fontWeight: 900,
                  color: 'var(--primary)',
                  lineHeight: 1.1,
                  margin: 0,
                }}
              >
                Kitchen Snapshot{' '}
                <span
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: '14px',
                    fontWeight: 600,
                  }}
                >
                  (Live)
                </span>
              </h2>
              <p
                style={{
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  marginTop: '2px',
                  marginBottom: 0,
                }}
              >
                Current consolidated demand vs available stock.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={loadSnapshot}
              disabled={loading}
              title="Refresh snapshot"
              style={{
                background: 'none',
                border: 'none',
                fontSize: '16px',
                color: 'var(--text-secondary)',
                cursor: loading ? 'not-allowed' : 'pointer',
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px',
              }}
            >
              <RefreshCw
                size={18}
                style={{
                  animation: loading ? 'spin 1s linear infinite' : 'none',
                }}
              />
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '8px',
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        {loading && items.length === 0 ? (
          <div
            style={{
              padding: '60px',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div className="loader" />
          </div>
        ) : (
          <div style={{ marginTop: '24px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0 12px 12px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span
                style={{
                  flex: 1,
                  fontSize: '11px',
                  fontWeight: 800,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                ITEM
              </span>
              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  textAlign: 'center',
                  width: '160px',
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    flex: 1,
                    fontSize: '10px',
                    fontWeight: 800,
                    color: '#D97706',
                    textTransform: 'uppercase',
                  }}
                >
                  Pending
                </span>
                <span
                  style={{
                    flex: 1,
                    fontSize: '10px',
                    fontWeight: 800,
                    color: '#2563EB',
                    textTransform: 'uppercase',
                  }}
                >
                  Preparing
                </span>
                <span
                  style={{
                    flex: 1,
                    fontSize: '10px',
                    fontWeight: 800,
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                  }}
                >
                  Stock
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {items.map((item, idx) => {
                const pending = Number(item.pending_qty) || 0;
                const preparing = Number(item.preparing_qty) || 0;
                const stock = Number(item.current_stock) || 0;
                const isLowStock = stock < pending + preparing;

                return (
                  <div
                    key={item.product_id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '12px 12px',
                      borderBottom: '1px solid #F3F4F6',
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
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
                            width: 44,
                            height: 44,
                            borderRadius: 10,
                            objectFit: 'cover',
                            background: '#F3F4F6',
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 10,
                            background: '#F3F4F6',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 20,
                            flexShrink: 0,
                          }}
                        >
                          🍽️
                        </div>
                      )}
                      <div
                        style={{
                          minWidth: 0,
                          overflowWrap: 'break-word',
                          wordBreak: 'break-word',
                        }}
                      >
                        <p
                          style={{
                            fontWeight: 700,
                            fontSize: '14px',
                            color: 'var(--text-primary)',
                            lineHeight: 1.2,
                            margin: 0,
                          }}
                        >
                          {item.product_name}
                        </p>
                        {isLowStock && (
                          <p
                            style={{
                              fontSize: '10px',
                              color: '#DC2626',
                              fontWeight: 700,
                              marginTop: '2px',
                              marginBottom: 0,
                            }}
                          >
                            ⚠️ LOW
                          </p>
                        )}
                      </div>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: '12px',
                        textAlign: 'center',
                        width: '160px',
                        alignItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          flex: 1,
                          fontSize: '18px',
                          fontWeight: 900,
                          color: pending > 0 ? '#D97706' : '#E5E7EB',
                        }}
                      >
                        {pending}
                      </span>
                      <span
                        style={{
                          flex: 1,
                          fontSize: '18px',
                          fontWeight: 900,
                          color: '#2563EB',
                        }}
                      >
                        {preparing}
                      </span>
                      <span
                        style={{
                          flex: 1,
                          fontSize: '16px',
                          fontWeight: 700,
                          color: isLowStock ? '#DC2626' : 'var(--text-secondary)',
                        }}
                      >
                        {stock}
                      </span>
                    </div>
                  </div>
                );
              })}

              {items.length === 0 && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '60px',
                    color: 'var(--text-secondary)',
                    fontSize: '14px',
                  }}
                >
                  No active demand to display
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
