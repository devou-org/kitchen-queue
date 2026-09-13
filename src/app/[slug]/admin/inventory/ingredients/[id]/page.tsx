'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Boxes,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Clock,
  Layers,
  Building2,
  Trash2,
  Sliders,
  DollarSign,
  Calendar,
  Loader2,
  X,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminContentWrapper } from '@/components/AdminContentWrapper';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { InventoryNav } from '@/components/modules/inventory/InventoryNav';
import { InventoryModal } from '@/components/modules/inventory/InventoryModal';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { inventoryService } from '@/app/services/inventory.api';
import { InventoryItem, InventoryBatch, StockMovement } from '@/types/inventory';
import { formatPrice } from '@/lib/format';

export default function IngredientDetailPage() {
  const { slug, id } = useParams();
  const router = useRouter();
  const slugStr = (Array.isArray(slug) ? slug[0] : slug) || '';
  const itemId = (Array.isArray(id) ? id[0] : id) || '';

  const [item, setItem] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Quick Action Modals
  const [wastageModalOpen, setWastageModalOpen] = useState(false);
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Wastage Form
  const [wasteQty, setWasteQty] = useState('');
  const [wasteBatchId, setWasteBatchId] = useState('');
  const [wasteReason, setWasteReason] = useState('SPOILAGE');
  const [wasteNotes, setWasteNotes] = useState('');

  // Adjustment Form
  const [actualStock, setActualStock] = useState('');
  const [adjReason, setAdjReason] = useState('Physical stock count reconciliation');

  const fetchDetail = async () => {
    if (!itemId) return;
    setLoading(true);
    try {
      const res = await inventoryService.getItemDetail(itemId);
      if (res.success && res.data) {
        setItem(res.data);
        setActualStock(String(res.data.current_stock));
      } else {
        toast.error(res.error || 'Failed to load ingredient details');
      }
    } catch {
      toast.error('Network error loading ingredient details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (itemId) {
      fetchDetail();
    }
  }, [itemId]);

  const handleRecordWastage = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(wasteQty);
    if (!qty || qty <= 0) {
      toast.error('Please enter a valid wastage quantity');
      return;
    }

    setActionLoading(true);
    try {
      const res = await inventoryService.recordWastage({
        item_id: itemId,
        batch_id: wasteBatchId || undefined,
        quantity: qty,
        reason: wasteReason,
        notes: wasteNotes.trim() || undefined,
      });

      if (res.success) {
        toast.success(`Logged ${qty} ${item.unit} wastage!`);
        setWastageModalOpen(false);
        setWasteQty('');
        setWasteNotes('');
        fetchDetail();
      } else {
        toast.error(res.error || 'Failed to record wastage');
      }
    } catch {
      toast.error('Network error logging wastage');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    const phys = Number(actualStock);
    if (isNaN(phys) || phys < 0) {
      toast.error('Please enter a valid physical stock count');
      return;
    }

    setActionLoading(true);
    try {
      const res = await inventoryService.recordAdjustment({
        item_id: itemId,
        physical_stock: phys,
        reason: adjReason.trim() || 'Physical stock take',
      });

      if (res.success) {
        toast.success(`Stock adjusted to ${phys} ${item.unit}!`);
        setAdjustmentModalOpen(false);
        fetchDetail();
      } else {
        toast.error(res.error || 'Failed to adjust stock');
      }
    } catch {
      toast.error('Network error recording adjustment');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminContentWrapper>
        <InventoryNav />
        <div style={{ padding: '80px', textAlign: 'center', color: '#94A3B8' }}>
          <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 10px' }} />
          Loading ingredient history & ledger...
        </div>
      </AdminContentWrapper>
    );
  }

  if (!item) {
    return (
      <AdminContentWrapper>
        <InventoryNav />
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <h3>Ingredient Not Found</h3>
          <Link href={`/${slugStr}/admin/inventory/ingredients`} style={{ color: '#2563EB', fontWeight: 600 }}>
            ← Back to Ingredients
          </Link>
        </div>
      </AdminContentWrapper>
    );
  }

  const isOut = item.current_stock <= 0;
  const isLow = !isOut && item.current_stock <= item.min_stock;

  return (
    <AdminContentWrapper>
      {/* Top Breadcrumb & Actions */}
      <div style={{ marginBottom: '14px' }}>
        <Link
          href={`/${slugStr}/admin/inventory/ingredients`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            fontWeight: 700,
            color: '#64748B',
            textDecoration: 'none',
            marginBottom: '10px',
          }}
        >
          <ArrowLeft size={14} />
          <span>Back to Ingredients</span>
        </Link>
      </div>

      <AdminPageHeader
        title={item.name}
        subtitle={`Category: ${item.category_name || 'General'} • Storage: ${item.storage_location || 'Standard Pantry'}`}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setAdjustmentModalOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                height: '38px',
                padding: '0 14px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#0F172A',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Sliders size={14} />
              <span>Adjust Stock</span>
            </button>

            <button
              onClick={() => setWastageModalOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                height: '38px',
                padding: '0 14px',
                borderRadius: '8px',
                border: '1px solid #FECACA',
                background: '#FEF2F2',
                color: '#DC2626',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Trash2 size={14} />
              <span>Record Wastage</span>
            </button>
          </div>
        }
      />

      <InventoryNav />

      {/* Key Metrics Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '14px',
          marginBottom: '24px',
        }}
      >
        {/* Current Stock */}
        <div
          className="card"
          style={{
            padding: '16px 20px',
            borderRadius: '12px',
            border: isOut ? '1px solid #FECACA' : isLow ? '1px solid #FED7AA' : '1px solid var(--border)',
            background: isOut ? '#FEF2F2' : isLow ? '#FFFBEB' : '#FFFFFF',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
            Current Stock
          </div>
          <div
            style={{
              fontSize: '24px',
              fontWeight: 900,
              color: isOut ? '#DC2626' : isLow ? '#D97706' : '#0F172A',
              marginTop: '4px',
            }}
          >
            {item.current_stock} <span style={{ fontSize: '14px', fontWeight: 600 }}>{item.unit}</span>
          </div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: isOut ? '#DC2626' : isLow ? '#D97706' : '#16A34A', marginTop: '4px' }}>
            {item.stock_status === 'OUT_OF_STOCK'
              ? 'Out of Stock'
              : item.stock_status === 'LOW_STOCK'
              ? 'Low Stock Alert'
              : 'Adequate Stock'}
          </div>
        </div>

        {/* Current Valuation */}
        <div
          className="card"
          style={{
            padding: '16px 20px',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            background: '#FFFFFF',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
            Total Asset Value
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#16A34A', marginTop: '4px' }}>
            {formatPrice(item.total_value || 0)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
            Based on {formatPrice(item.cost_per_unit)}/{item.unit}
          </div>
        </div>

        {/* Minimum Threshold */}
        <div
          className="card"
          style={{
            padding: '16px 20px',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            background: '#FFFFFF',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
            Minimum Stock
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#475569', marginTop: '4px' }}>
            {item.min_stock} <span style={{ fontSize: '14px', fontWeight: 600 }}>{item.unit}</span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
            Reorder trigger limit
          </div>
        </div>

        {/* Maximum Threshold */}
        <div
          className="card"
          style={{
            padding: '16px 20px',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            background: '#FFFFFF',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
            Maximum Stock
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#475569', marginTop: '4px' }}>
            {item.max_stock ? `${item.max_stock} ${item.unit}` : 'Not Set'}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
            Storage ceiling capacity
          </div>
        </div>

        {/* Preferred Supplier */}
        <div
          className="card"
          style={{
            padding: '16px 20px',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            background: '#FFFFFF',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
            Supplier
          </div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>
            {item.supplier_name || 'Multiple / Unassigned'}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
            Default purchase partner
          </div>
        </div>
      </div>

      {/* Batches Table Section (if any batches) */}
      <div
        className="card"
        style={{
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          background: '#FFFFFF',
          marginBottom: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={17} style={{ color: '#2563EB' }} />
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Active Batches & Lots ({item.batches?.length || 0})
            </h3>
          </div>
          <span style={{ fontSize: '12px', color: '#64748B' }}>FIFO lot tracking</span>
        </div>

        {!item.batches?.length ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
            No specific active batches logged. Batches are automatically registered when receiving purchase orders.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: '#64748B', fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 12px' }}>Batch Number</th>
                  <th style={{ padding: '10px 12px' }}>Current Qty</th>
                  <th style={{ padding: '10px 12px' }}>Cost Per Unit</th>
                  <th style={{ padding: '10px 12px' }}>Received Date</th>
                  <th style={{ padding: '10px 12px' }}>Expiry Date</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {item.batches.map((b: InventoryBatch) => {
                  const isExpired = b.days_until_expiry !== undefined && b.days_until_expiry <= 0;
                  const isExpiringSoon = b.days_until_expiry !== undefined && b.days_until_expiry <= 7 && !isExpired;

                  return (
                    <tr key={b.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '12px', fontWeight: 700, color: '#0F172A' }}>{b.batch_number}</td>
                      <td style={{ padding: '12px', fontWeight: 800 }}>
                        {b.current_quantity} {item.unit}
                      </td>
                      <td style={{ padding: '12px', color: '#475569' }}>{formatPrice(b.cost_per_unit)}</td>
                      <td style={{ padding: '12px', color: '#64748B' }}>{b.received_date}</td>
                      <td style={{ padding: '12px' }}>
                        {b.expiry_date ? (
                          <span
                            style={{
                              fontWeight: 600,
                              color: isExpired ? '#DC2626' : isExpiringSoon ? '#D97706' : '#0F172A',
                            }}
                          >
                            {b.expiry_date}{' '}
                            {b.days_until_expiry !== undefined && (
                              <span style={{ fontSize: '11px', color: isExpired ? '#DC2626' : '#64748B' }}>
                                ({isExpired ? 'Expired' : `${b.days_until_expiry}d left`})
                              </span>
                            )}
                          </span>
                        ) : (
                          <span style={{ color: '#94A3B8' }}>No Expiry Set</span>
                        )}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '4px',
                            backgroundColor: isExpired ? '#FEE2E2' : '#EFF6FF',
                            color: isExpired ? '#DC2626' : '#2563EB',
                          }}
                        >
                          {isExpired ? 'EXPIRED' : b.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stock Movement Ledger Table */}
      <div
        className="card"
        style={{
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          background: '#FFFFFF',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Boxes size={17} style={{ color: '#0F172A' }} />
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Immutable Stock Movement Ledger
            </h3>
          </div>
          <span style={{ fontSize: '12px', color: '#64748B' }}>Audit trail of all mutations</span>
        </div>

        {!item.movements?.length ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
            No stock movements recorded yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: '#64748B', fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 12px' }}>Date & Time</th>
                  <th style={{ padding: '10px 12px' }}>Movement Type</th>
                  <th style={{ padding: '10px 12px' }}>Quantity</th>
                  <th style={{ padding: '10px 12px' }}>Balance After</th>
                  <th style={{ padding: '10px 12px' }}>Unit Cost</th>
                  <th style={{ padding: '10px 12px' }}>Total Cost</th>
                  <th style={{ padding: '10px 12px' }}>Reason / Ref</th>
                </tr>
              </thead>
              <tbody>
                {item.movements.map((m: StockMovement) => {
                  const isPositive = Number(m.quantity) > 0;
                  let badgeBg = '#F0FDF4';
                  let badgeColor = '#16A34A';

                  if (m.movement_type === 'CONSUMPTION') {
                    badgeBg = '#EFF6FF';
                    badgeColor = '#2563EB';
                  } else if (m.movement_type === 'WASTAGE') {
                    badgeBg = '#FEF2F2';
                    badgeColor = '#DC2626';
                  } else if (m.movement_type === 'ADJUSTMENT') {
                    badgeBg = '#FAF5FF';
                    badgeColor = '#9333EA';
                  }

                  const dt = new Date(m.created_at);
                  const formattedDate = dt.toLocaleDateString('en-IN', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr key={m.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '12px', color: '#64748B', whiteSpace: 'nowrap' }}>{formattedDate}</td>
                      <td style={{ padding: '12px' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: badgeBg,
                            color: badgeColor,
                            textTransform: 'uppercase',
                          }}
                        >
                          {m.movement_type}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: '12px',
                          fontWeight: 800,
                          color: isPositive ? '#16A34A' : '#DC2626',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {isPositive ? `+${m.quantity}` : m.quantity} {item.unit}
                      </td>
                      <td style={{ padding: '12px', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>
                        {m.balance_after} {item.unit}
                      </td>
                      <td style={{ padding: '12px', color: '#64748B' }}>{formatPrice(m.unit_cost)}</td>
                      <td style={{ padding: '12px', fontWeight: 600, color: '#0F172A' }}>
                        {formatPrice(m.total_cost)}
                      </td>
                      <td style={{ padding: '12px', color: '#475569' }}>
                        <div>{m.reason || '—'}</div>
                        {m.batch_number && (
                          <div style={{ fontSize: '10px', color: '#94A3B8' }}>Batch: {m.batch_number}</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Wastage Modal */}
      <InventoryModal
        isOpen={wastageModalOpen}
        onClose={() => setWastageModalOpen(false)}
        title={`Record Wastage: ${item?.name || ''}`}
        icon={<Trash2 size={18} style={{ color: '#DC2626' }} />}
        maxWidth="480px"
      >
        <form onSubmit={handleRecordWastage} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Quantity Lost ({item.unit}) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  max={item.current_stock}
                  value={wasteQty}
                  onChange={(e) => setWasteQty(e.target.value)}
                  placeholder={`Available: ${item.current_stock} ${item.unit}`}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Optional Batch */}
              {item.batches?.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Deduct from Batch (Optional)
                  </label>
                  <CustomSelect
                    buttonStyle={{ height: '38px', borderRadius: '8px', fontSize: '13px' }}
                    value={wasteBatchId}
                    onChange={(val) => setWasteBatchId(val)}
                    placeholder="General Stock"
                    options={[
                      { value: '', label: 'General Stock' },
                      ...item.batches.map((b: InventoryBatch) => ({
                        value: b.id,
                        label: `${b.batch_number} (Qty: ${b.current_quantity} ${item.unit})`,
                      })),
                    ]}
                  />
                </div>
              )}

              {/* Reason */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Reason for Loss *
                </label>
                <CustomSelect
                  buttonStyle={{ height: '38px', borderRadius: '8px', fontSize: '13px' }}
                  value={wasteReason}
                  onChange={(val) => setWasteReason(val)}
                  options={[
                    { value: 'SPOILAGE', label: 'Spoiled / Rotting' },
                    { value: 'EXPIRED', label: 'Expired Past Best-Before' },
                    { value: 'DAMAGED', label: 'Damaged in Transit / Kitchen' },
                    { value: 'OVERPRODUCTION', label: 'Overproduction / Leftover' },
                    { value: 'WRONG_PREPARATION', label: 'Wrong Preparation / Burnt' },
                    { value: 'STAFF_CONSUMPTION', label: 'Staff Food Consumption' },
                    { value: 'OTHER', label: 'Other Reason' },
                  ]}
                />
              </div>

              {/* Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Notes / Explanation
                </label>
                <textarea
                  rows={2}
                  placeholder="Explain incident or cause..."
                  value={wasteNotes}
                  onChange={(e) => setWasteNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Financial loss preview */}
              {Number(wasteQty) > 0 && (
                <div
                  style={{
                    padding: '10px',
                    backgroundColor: '#FEF2F2',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#991B1B',
                    fontWeight: 600,
                  }}
                >
                  Calculated Financial Loss: {formatPrice(Number(wasteQty) * item.cost_per_unit)}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setWastageModalOpen(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#64748B',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#DC2626',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {actionLoading && <Loader2 size={13} className="animate-spin" />}
                  <span>Confirm Wastage</span>
                </button>
              </div>
            </form>
      </InventoryModal>

      {/* Adjust Stock (Stock Take) Modal */}
      <InventoryModal
        isOpen={adjustmentModalOpen}
        onClose={() => setAdjustmentModalOpen(false)}
        title={`Physical Stock Count: ${item?.name || ''}`}
        icon={<Sliders size={18} style={{ color: '#2563EB' }} />}
        maxWidth="480px"
      >
        <form onSubmit={handleRecordAdjustment} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ padding: '10px 12px', backgroundColor: '#F8FAFC', borderRadius: '8px', fontSize: '12px', color: '#475569' }}>
                <div>System Current Stock: <strong>{item.current_stock} {item.unit}</strong></div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Actual Physical Count ({item.unit}) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={actualStock}
                  onChange={(e) => setActualStock(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Variance indicator */}
              {actualStock !== '' && !isNaN(Number(actualStock)) && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    backgroundColor: Number(actualStock) - item.current_stock < 0 ? '#FEF2F2' : Number(actualStock) - item.current_stock > 0 ? '#F0FDF4' : '#F1F5F9',
                    color: Number(actualStock) - item.current_stock < 0 ? '#DC2626' : Number(actualStock) - item.current_stock > 0 ? '#16A34A' : '#64748B',
                  }}
                >
                  Adjustment Delta:{' '}
                  {Number(actualStock) - item.current_stock > 0
                    ? `+${(Number(actualStock) - item.current_stock).toFixed(3)} ${item.unit} (Surplus)`
                    : Number(actualStock) - item.current_stock < 0
                    ? `${(Number(actualStock) - item.current_stock).toFixed(3)} ${item.unit} (Shortage)`
                    : 'No difference'}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Reason for Adjustment *
                </label>
                <input
                  type="text"
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  required
                  placeholder="e.g. Physical stock count mismatch, scale calibration"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setAdjustmentModalOpen(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#64748B',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--primary, #971345)',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {actionLoading && <Loader2 size={13} className="animate-spin" />}
                  <span>Save Adjustment</span>
                </button>
              </div>
            </form>
      </InventoryModal>
    </AdminContentWrapper>
  );
}

