'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  BarChart3,
  Calendar,
  Layers,
  DollarSign,
  TrendingDown,
  Trash2,
  Boxes,
  Loader2,
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminContentWrapper } from '@/components/AdminContentWrapper';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { InventoryNav } from '@/components/modules/inventory/InventoryNav';
import { inventoryService } from '@/app/services/inventory.api';
import { formatPrice } from '@/lib/format';

type ReportTab = 'valuation' | 'consumption' | 'wastage' | 'category';

export default function InventoryReportsPage() {
  const { slug } = useParams();
  const [tab, setTab] = useState<ReportTab>('valuation');

  const [dateFrom, setDateFrom] = useState(
    new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  );
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await inventoryService.getReports({
        date_from: dateFrom,
        date_to: dateTo,
      });
      if (res.success && res.data) {
        setData(res.data);
      } else {
        toast.error(res.error || 'Failed to load inventory reports');
      }
    } catch {
      toast.error('Network error loading reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [dateFrom, dateTo]);

  return (
    <AdminContentWrapper>
      <AdminPageHeader
        title="Inventory Reports & Analytics"
        subtitle="Auditable stock valuation, raw material consumption ledgers, wastage by cause, and category asset distribution."
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#FFFFFF', padding: '4px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <Calendar size={14} style={{ color: '#64748B' }} />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                style={{ border: 'none', fontSize: '12px', outline: 'none', color: '#0F172A' }}
              />
              <span style={{ fontSize: '12px', color: '#94A3B8' }}>to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                style={{ border: 'none', fontSize: '12px', outline: 'none', color: '#0F172A' }}
              />
            </div>
          </div>
        }
      />

      <InventoryNav />

      {/* Report Sub Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setTab('valuation')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: tab === 'valuation' ? 800 : 600,
            border: tab === 'valuation' ? '2px solid #0F172A' : '1px solid #CBD5E1',
            backgroundColor: tab === 'valuation' ? '#0F172A' : '#FFFFFF',
            border: tab === 'valuation' ? '2px solid var(--primary, #971345)' : '1px solid #CBD5E1',
            backgroundColor: tab === 'valuation' ? 'var(--primary, #971345)' : '#FFFFFF',
            color: tab === 'valuation' ? '#FFFFFF' : '#64748B',
            cursor: 'pointer',
          }}
        >
          Stock Valuation Report
        </button>

        <button
          onClick={() => setTab('consumption')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: tab === 'consumption' ? 800 : 600,
            border: tab === 'consumption' ? '2px solid #2563EB' : '1px solid #CBD5E1',
            backgroundColor: tab === 'consumption' ? '#EFF6FF' : '#FFFFFF',
            color: tab === 'consumption' ? '#2563EB' : '#64748B',
            cursor: 'pointer',
          }}
        >
          Consumption & Ledger
        </button>

        <button
          onClick={() => setTab('wastage')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: tab === 'wastage' ? 800 : 600,
            border: tab === 'wastage' ? '2px solid #DC2626' : '1px solid #CBD5E1',
            backgroundColor: tab === 'wastage' ? '#FEF2F2' : '#FFFFFF',
            color: tab === 'wastage' ? '#DC2626' : '#64748B',
            cursor: 'pointer',
          }}
        >
          Wastage Breakdown
        </button>

        <button
          onClick={() => setTab('category')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: tab === 'category' ? 800 : 600,
            border: tab === 'category' ? '2px solid #16A34A' : '1px solid #CBD5E1',
            backgroundColor: tab === 'category' ? '#F0FDF4' : '#FFFFFF',
            color: tab === 'category' ? '#16A34A' : '#64748B',
            cursor: 'pointer',
          }}
        >
          Category Valuation
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '80px', textAlign: 'center', color: '#94A3B8' }}>
          <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 10px' }} />
          Calculating reports...
        </div>
      ) : !data ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>No report data available.</div>
      ) : (
        <>
          {/* Tab 1: Stock Valuation Report */}
          {tab === 'valuation' && (
            <div className="card" style={{ padding: 0, borderRadius: '12px', border: '1px solid var(--border)', background: '#FFFFFF', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: '#0F172A' }}>
                  Stock Valuation Report
                </h3>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#16A34A' }}>
                  Total Valuation:{' '}
                  {formatPrice(
                    data.valuation_report?.reduce((s: number, r: any) => s + (r.total_value || 0), 0) || 0
                  )}
                </span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: '#64748B', fontSize: '11px', textTransform: 'uppercase' }}>
                      <th style={{ padding: '12px 16px' }}>Ingredient</th>
                      <th style={{ padding: '12px 16px' }}>Category</th>
                      <th style={{ padding: '12px 16px' }}>Current Stock</th>
                      <th style={{ padding: '12px 16px' }}>Cost Per Unit</th>
                      <th style={{ padding: '12px 16px' }}>Asset Value</th>
                      <th style={{ padding: '12px 16px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.valuation_report?.map((r: any) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '14px 16px', fontWeight: 700, color: '#0F172A' }}>{r.name}</td>
                        <td style={{ padding: '14px 16px', color: '#64748B' }}>{r.category || 'General'}</td>
                        <td style={{ padding: '14px 16px', fontWeight: 800 }}>
                          {r.current_stock} {r.unit}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#475569' }}>{formatPrice(r.cost_per_unit)}</td>
                        <td style={{ padding: '14px 16px', fontWeight: 800, color: '#16A34A' }}>
                          {formatPrice(r.total_value)}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              backgroundColor:
                                r.status === 'Out of Stock' ? '#FEF2F2' : r.status === 'Low Stock' ? '#FFFBEB' : '#F0FDF4',
                              color:
                                r.status === 'Out of Stock' ? '#DC2626' : r.status === 'Low Stock' ? '#D97706' : '#16A34A',
                            }}
                          >
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 2: Consumption & Movement Summary */}
          {tab === 'consumption' && (
            <div className="card" style={{ padding: 0, borderRadius: '12px', border: '1px solid var(--border)', background: '#FFFFFF', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: '#0F172A' }}>
                  Consumption Ledger ({dateFrom} to {dateTo})
                </h3>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: '#64748B', fontSize: '11px', textTransform: 'uppercase' }}>
                      <th style={{ padding: '12px 16px' }}>Ingredient</th>
                      <th style={{ padding: '12px 16px' }}>Purchased (+)</th>
                      <th style={{ padding: '12px 16px' }}>Consumed (-)</th>
                      <th style={{ padding: '12px 16px' }}>Wastage (-)</th>
                      <th style={{ padding: '12px 16px' }}>Adjustment (±)</th>
                      <th style={{ padding: '12px 16px' }}>Closing Stock</th>
                      <th style={{ padding: '12px 16px' }}>Consumption Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.consumption_report?.map((r: any) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '14px 16px', fontWeight: 700, color: '#0F172A' }}>{r.name}</td>
                        <td style={{ padding: '14px 16px', fontWeight: 700, color: '#16A34A' }}>
                          +{r.purchased_qty} {r.unit}
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 700, color: '#2563EB' }}>
                          -{r.consumed_qty} {r.unit}
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 700, color: '#DC2626' }}>
                          -{r.wastage_qty} {r.unit}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#475569' }}>
                          {r.adjustment_qty > 0 ? `+${r.adjustment_qty}` : r.adjustment_qty} {r.unit}
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 800, color: '#0F172A' }}>
                          {r.closing_stock} {r.unit}
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 800, color: '#0F172A' }}>
                          {formatPrice(r.consumed_value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 3: Wastage by Reason */}
          {tab === 'wastage' && (
            <div className="card" style={{ padding: '24px', borderRadius: '12px', border: '1px solid var(--border)', background: '#FFFFFF' }}>
              <div style={{ marginBottom: '18px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#0F172A' }}>
                  Wastage Impact by Cause ({dateFrom} to {dateTo})
                </h3>
              </div>

              {!data.wastage_by_reason?.length ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
                  ✓ No wastage logged in this date range.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                  {data.wastage_by_reason.map((w: any) => (
                    <div
                      key={w.reason}
                      style={{
                        padding: '18px',
                        borderRadius: '10px',
                        border: '1px solid #FECACA',
                        backgroundColor: '#FFF1F2',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: '#991B1B' }}>
                          {w.reason.replace('_', ' ')}
                        </span>
                        <span style={{ fontSize: '11px', color: '#E11D48', fontWeight: 600 }}>
                          {w.count} incidents
                        </span>
                      </div>
                      <div style={{ fontSize: '22px', fontWeight: 900, color: '#DC2626', marginTop: '10px' }}>
                        {formatPrice(w.total_loss)}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                        Total Quantity: {w.total_qty} units
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Category Valuation */}
          {tab === 'category' && (
            <div className="card" style={{ padding: '24px', borderRadius: '12px', border: '1px solid var(--border)', background: '#FFFFFF' }}>
              <div style={{ marginBottom: '18px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#0F172A' }}>
                  Inventory Assets Locked by Category
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                {data.category_valuation?.map((c: any) => (
                  <div
                    key={c.category}
                    style={{
                      padding: '18px',
                      borderRadius: '10px',
                      border: '1px solid var(--border)',
                      backgroundColor: '#F8FAFC',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
                        {c.category}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                        {c.items_count} ingredients
                      </div>
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#16A34A', marginTop: '12px' }}>
                      {formatPrice(c.total_value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </AdminContentWrapper>
  );
}

