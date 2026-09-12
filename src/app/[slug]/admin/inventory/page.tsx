'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Boxes,
  TrendingDown,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Truck,
  Trash2,
  RefreshCw,
  Sparkles,
  ClipboardList,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminContentWrapper } from '@/components/AdminContentWrapper';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { InventoryNav } from '@/components/modules/inventory/InventoryNav';
import { inventoryService } from '@/app/services/inventory.api';
import { InventoryDashboardSummary } from '@/types/inventory';
import { formatPrice } from '@/lib/format';

export default function InventoryDashboardPage() {
  const { slug } = useParams();
  const slugStr = Array.isArray(slug) ? slug[0] : slug;
  const [data, setData] = useState<InventoryDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await inventoryService.getDashboardSummary();
      if (res.success && res.data) {
        setData(res.data);
      } else {
        toast.error(res.error || 'Failed to load inventory summary');
      }
    } catch {
      toast.error('Network error loading inventory summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  return (
    <AdminContentWrapper>
      <AdminPageHeader
        title="Inventory Overview"
        subtitle="Live tracking of ingredients, stock valuation, consumption, and audit ledgers."
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={fetchSummary}
              disabled={loading}
              className="btn-minimal"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                height: '38px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: '#FFFFFF',
                cursor: 'pointer',
              }}
              title="Refresh inventory data"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
            <Link
              href={`/${slugStr}/admin/inventory/purchases`}
              prefetch={false}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                height: '38px',
                padding: '0 14px',
                borderRadius: '8px',
                background: '#0F172A',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              <Truck size={15} />
              <span>Receive Stock</span>
            </Link>
          </div>
        }
      />

      <InventoryNav />

      {/* KPI Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          marginBottom: '24px',
        }}
      >
        {/* Stock Value */}
        <div
          className="card"
          style={{
            padding: '18px 20px',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            background: '#FFFFFF',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>Total Stock Value</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', marginTop: '6px' }}>
            {formatPrice(data?.stock_value || 0)}
          </div>
          <div style={{ fontSize: '11px', color: '#16A34A', fontWeight: 600, marginTop: '4px' }}>
            Active inventory assets
          </div>
        </div>

        {/* Total Items */}
        <div
          className="card"
          style={{
            padding: '18px 20px',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            background: '#FFFFFF',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>Total Ingredients</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', marginTop: '6px' }}>
            {data?.total_items || 0}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, marginTop: '4px' }}>
            Configured inventory master
          </div>
        </div>

        {/* Low Stock Items */}
        <div
          className="card"
          style={{
            padding: '18px 20px',
            borderRadius: '12px',
            border: (data?.low_stock_count || 0) > 0 ? '1px solid #FED7AA' : '1px solid var(--border)',
            background: (data?.low_stock_count || 0) > 0 ? '#FFFBEB' : '#FFFFFF',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#B45309' }}>Low Stock Items</span>
            <AlertTriangle size={15} color="#D97706" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#B45309', marginTop: '6px' }}>
            {data?.low_stock_count || 0}
          </div>
          <div style={{ fontSize: '11px', color: '#D97706', fontWeight: 600, marginTop: '4px' }}>
            Below minimum threshold
          </div>
        </div>

        {/* Out of Stock */}
        <div
          className="card"
          style={{
            padding: '18px 20px',
            borderRadius: '12px',
            border: (data?.out_of_stock_count || 0) > 0 ? '1px solid #FECACA' : '1px solid var(--border)',
            background: (data?.out_of_stock_count || 0) > 0 ? '#FEF2F2' : '#FFFFFF',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#DC2626' }}>Out of Stock</span>
            <TrendingDown size={15} color="#DC2626" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#DC2626', marginTop: '6px' }}>
            {data?.out_of_stock_count || 0}
          </div>
          <div style={{ fontSize: '11px', color: '#DC2626', fontWeight: 600, marginTop: '4px' }}>
            Zero stock available
          </div>
        </div>

        {/* Today's Consumption */}
        <div
          className="card"
          style={{
            padding: '18px 20px',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            background: '#FFFFFF',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>Today's Consumption</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#2563EB', marginTop: '6px' }}>
            {formatPrice(data?.today_consumption || 0)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, marginTop: '4px' }}>
            Deducted from customer orders
          </div>
        </div>

        {/* Today's Wastage */}
        <div
          className="card"
          style={{
            padding: '18px 20px',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            background: '#FFFFFF',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>Today's Wastage</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#E11D48', marginTop: '6px' }}>
            {formatPrice(data?.today_wastage || 0)}
          </div>
          <div style={{ fontSize: '11px', color: '#E11D48', fontWeight: 600, marginTop: '4px' }}>
            Spoiled / Expired / Damaged
          </div>
        </div>
      </div>

      {/* Main Grid: Low Stock + Expiring Soon + Recent Activity */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '20px',
        }}
      >
        {/* Left Col: Low Stock Alerts */}
        <div
          className="card"
          style={{
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            background: '#FFFFFF',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={17} color="#D97706" />
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                Low Stock Alerts
              </h3>
            </div>
            <Link
              href={`/${slugStr}/admin/inventory/ingredients?status=LOW_STOCK`}
              style={{ fontSize: '12px', fontWeight: 600, color: '#2563EB', textDecoration: 'none' }}
            >
              View All →
            </Link>
          </div>

          {loading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#94A3B8' }}>Loading...</div>
          ) : !data?.low_stock_items?.length ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
              ✓ All ingredients are currently above minimum stock levels.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {data.low_stock_items.map((item) => {
                const ratio = Math.min(100, Math.round((item.current_stock / (item.min_stock || 1)) * 100));
                const isCritical = item.current_stock <= 0;

                return (
                  <Link
                    key={item.id}
                    href={`/${slugStr}/admin/inventory/ingredients/${item.id}`}
                    prefetch={false}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '8px',
                      border: '1px solid #FED7AA',
                      backgroundColor: isCritical ? '#FEF2F2' : '#FFFDF5',
                      textDecoration: 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      transition: 'transform 0.1s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>
                        {item.name}
                      </span>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          color: isCritical ? '#DC2626' : '#B45309',
                        }}
                      >
                        {item.current_stock} {item.unit} / Min {item.min_stock} {item.unit}
                      </span>
                    </div>
                    {/* Meter bar */}
                    <div
                      style={{
                        width: '100%',
                        height: '5px',
                        backgroundColor: '#E2E8F0',
                        borderRadius: '3px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${ratio}%`,
                          height: '100%',
                          backgroundColor: isCritical ? '#DC2626' : '#F59E0B',
                          borderRadius: '3px',
                        }}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Middle Col: Expiring Soon Batches */}
        <div
          className="card"
          style={{
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            background: '#FFFFFF',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={17} color="#E11D48" />
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                Expiring Soon Batches
              </h3>
            </div>
            <span style={{ fontSize: '12px', color: '#64748B' }}>Within 7 Days</span>
          </div>

          {loading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#94A3B8' }}>Loading...</div>
          ) : !data?.expiring_soon?.length ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
              ✓ No batches expiring in the next 7 days.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {data.expiring_soon.map((b) => (
                <div
                  key={b.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1px solid #FFE4E6',
                    backgroundColor: '#FFF1F2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>
                      {b.item_name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                      Batch: {b.batch_number} • Qty: {b.current_quantity} {b.unit}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: b.days_left <= 2 ? '#EF4444' : '#F43F5E',
                        color: '#FFFFFF',
                      }}
                    >
                      {b.days_left <= 0
                        ? 'Expired Today'
                        : b.days_left === 1
                        ? '1 day left'
                        : `${b.days_left} days left`}
                    </span>
                    <div style={{ fontSize: '10px', color: '#64748B', marginTop: '4px' }}>
                      Exp: {b.expiry_date}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Col: Recent Stock Movement Ledger Activity */}
        <div
          className="card"
          style={{
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            background: '#FFFFFF',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Boxes size={17} color="#2563EB" />
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                Recent Stock Activity
              </h3>
            </div>
            <span style={{ fontSize: '12px', color: '#64748B' }}>Audit Ledger</span>
          </div>

          {loading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#94A3B8' }}>Loading...</div>
          ) : !data?.recent_movements?.length ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
              No recent movements logged.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {data.recent_movements.map((m) => {
                const isPositive = Number(m.quantity) > 0;
                let badgeColor = '#2563EB';
                let badgeBg = '#EFF6FF';

                if (m.movement_type === 'PURCHASE') {
                  badgeColor = '#16A34A';
                  badgeBg = '#F0FDF4';
                } else if (m.movement_type === 'WASTAGE') {
                  badgeColor = '#DC2626';
                  badgeBg = '#FEF2F2';
                } else if (m.movement_type === 'CONSUMPTION') {
                  badgeColor = '#2563EB';
                  badgeBg = '#EFF6FF';
                } else if (m.movement_type === 'ADJUSTMENT') {
                  badgeColor = '#9333EA';
                  badgeBg = '#FAF5FF';
                }

                return (
                  <div
                    key={m.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #F1F5F9',
                      backgroundColor: '#F8FAFC',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {isPositive ? (
                        <ArrowUpRight size={15} color="#16A34A" />
                      ) : (
                        <ArrowDownRight size={15} color="#DC2626" />
                      )}
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '12px', color: '#0F172A' }}>
                          {isPositive ? `+${m.quantity}` : `${m.quantity}`} {m.unit} {m.item_name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>
                          {m.reason || m.movement_type}
                        </div>
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: '4px',
                        backgroundColor: badgeBg,
                        color: badgeColor,
                        textTransform: 'uppercase',
                      }}
                    >
                      {m.movement_type}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AdminContentWrapper>
  );
}
