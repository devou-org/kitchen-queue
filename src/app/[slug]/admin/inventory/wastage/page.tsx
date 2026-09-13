'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Trash2,
  Sliders,
  Plus,
  AlertTriangle,
  Clock,
  TrendingDown,
  DollarSign,
  Boxes,
  Loader2,
  X,
  Check,
  Calendar,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminContentWrapper } from '@/components/AdminContentWrapper';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { InventoryNav } from '@/components/modules/inventory/InventoryNav';
import { InventoryModal } from '@/components/modules/inventory/InventoryModal';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { inventoryService } from '@/app/services/inventory.api';
import { WastageRecord, StockAdjustment, InventoryItem, WastageReason } from '@/types/inventory';
import { formatPrice } from '@/lib/format';

export default function WastageAndAdjustmentsPage() {
  const { slug } = useParams();
  const [tab, setTab] = useState<'wastage' | 'adjustments'>('wastage');
  const [wastages, setWastages] = useState<WastageRecord[]>([]);
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Wastage Modal
  const [wastageModalOpen, setWastageModalOpen] = useState(false);
  const [wasteItemId, setWasteItemId] = useState('');
  const [wasteQty, setWasteQty] = useState('');
  const [wasteReason, setWasteReason] = useState<WastageReason>('SPOILAGE');
  const [wasteNotes, setWasteNotes] = useState('');

  // Adjustment Modal
  const [adjModalOpen, setAdjModalOpen] = useState(false);
  const [adjItemId, setAdjItemId] = useState('');
  const [physicalCount, setPhysicalCount] = useState('');
  const [adjReason, setAdjReason] = useState('Physical stock count discrepancy');

  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [wRes, aRes, iRes] = await Promise.all([
        inventoryService.getWastageRecords(),
        inventoryService.getAdjustments(),
        inventoryService.getItems({ is_active: true }),
      ]);
      if (wRes.success && wRes.data) setWastages(wRes.data);
      if (aRes.success && aRes.data) setAdjustments(aRes.data);
      if (iRes.success && iRes.data) setItems(iRes.data);
    } catch {
      toast.error('Network error loading wastage & adjustments data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const selectedWasteItem = items.find((i) => i.id === wasteItemId);
  const selectedAdjItem = items.find((i) => i.id === adjItemId);

  const handleRecordWastage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wasteItemId || !Number(wasteQty) || Number(wasteQty) <= 0) {
      toast.error('Please choose an item and enter valid wastage quantity');
      return;
    }

    setSubmitting(true);
    try {
      const res = await inventoryService.recordWastage({
        item_id: wasteItemId,
        quantity: Number(wasteQty),
        reason: wasteReason,
        notes: wasteNotes.trim() || undefined,
      });

      if (res.success) {
        toast.success(`Wastage of ${wasteQty} logged and stock updated!`);
        setWastageModalOpen(false);
        setWasteQty('');
        setWasteNotes('');
        fetchData();
      } else {
        toast.error(res.error || 'Failed to record wastage');
      }
    } catch {
      toast.error('Network error recording wastage');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjItemId || physicalCount === '' || isNaN(Number(physicalCount))) {
      toast.error('Please choose an item and enter physical count');
      return;
    }

    setSubmitting(true);
    try {
      const res = await inventoryService.recordAdjustment({
        item_id: adjItemId,
        physical_stock: Number(physicalCount),
        reason: adjReason.trim() || 'Physical stock count',
      });

      if (res.success) {
        toast.success('Stock count reconciled and audit ledger updated!');
        setAdjModalOpen(false);
        setPhysicalCount('');
        fetchData();
      } else {
        toast.error(res.error || 'Failed to reconcile stock');
      }
    } catch {
      toast.error('Network error reconciling stock');
    } finally {
      setSubmitting(false);
    }
  };

  // Aggregated wastage loss
  const totalWastageLoss = wastages.reduce((sum, w) => sum + (w.total_cost || 0), 0);

  return (
    <AdminContentWrapper>
      <AdminPageHeader
        title="Wastage & Stock Adjustments"
        subtitle="Record food waste, spoilage, damaged ingredients, and physical inventory stock count reconciliations."
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => {
                setAdjItemId(items[0]?.id || '');
                setPhysicalCount('');
                setAdjModalOpen(true);
              }}
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
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Sliders size={14} />
              <span>Stock Take Count</span>
            </button>

            <button
              onClick={() => {
                setWasteItemId(items[0]?.id || '');
                setWasteQty('');
                setWastageModalOpen(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                height: '38px',
                padding: '0 14px',
                borderRadius: '8px',
                border: 'none',
                background: '#DC2626',
                color: '#FFFFFF',
                fontSize: '13px',
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

      {/* Sub tabs: Wastage vs Adjustments */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
        <button
          onClick={() => setTab('wastage')}
          style={{
            padding: '8px 18px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: tab === 'wastage' ? 800 : 600,
            border: tab === 'wastage' ? '2px solid #DC2626' : '1px solid #E2E8F0',
            backgroundColor: tab === 'wastage' ? '#FEF2F2' : '#FFFFFF',
            color: tab === 'wastage' ? '#DC2626' : '#64748B',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Trash2 size={14} />
          <span>Wastage Log ({wastages.length})</span>
        </button>

        <button
          onClick={() => setTab('adjustments')}
          style={{
            padding: '8px 18px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: tab === 'adjustments' ? 800 : 600,
            border: tab === 'adjustments' ? '2px solid #2563EB' : '1px solid #E2E8F0',
            backgroundColor: tab === 'adjustments' ? '#EFF6FF' : '#FFFFFF',
            color: tab === 'adjustments' ? '#2563EB' : '#64748B',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Sliders size={14} />
          <span>Stock Adjustments ({adjustments.length})</span>
        </button>

        {tab === 'wastage' && totalWastageLoss > 0 && (
          <div style={{ marginLeft: 'auto', fontSize: '13px', color: '#64748B', fontWeight: 600 }}>
            Total Wastage Financial Loss:{' '}
            <strong style={{ color: '#DC2626' }}>{formatPrice(totalWastageLoss)}</strong>
          </div>
        )}
      </div>

      {/* Tab 1: Wastage Log */}
      {tab === 'wastage' && (
        <div
          className="card"
          style={{
            borderRadius: '12px',
            border: '1px solid var(--border)',
            background: '#FFFFFF',
            padding: 0,
            overflow: 'hidden',
          }}
        >
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#94A3B8' }}>
              <Loader2 size={30} className="animate-spin" style={{ margin: '0 auto 10px' }} />
              Loading wastage records...
            </div>
          ) : wastages.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <Trash2 size={38} style={{ margin: '0 auto 10px', color: '#94A3B8' }} />
              <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#0F172A' }}>
                No wastage recorded
              </h4>
              <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
                Spoilage, expired ingredients, and kitchen mishaps logged here automatically calculate cost.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: '#64748B', fontSize: '11px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px 16px' }}>Date & Time</th>
                    <th style={{ padding: '12px 16px' }}>Ingredient</th>
                    <th style={{ padding: '12px 16px' }}>Quantity Lost</th>
                    <th style={{ padding: '12px 16px' }}>Reason</th>
                    <th style={{ padding: '12px 16px' }}>Financial Loss</th>
                    <th style={{ padding: '12px 16px' }}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {wastages.map((w) => {
                    const dt = new Date(w.logged_at);
                    return (
                      <tr key={w.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '14px 16px', color: '#64748B', whiteSpace: 'nowrap' }}>
                          {dt.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 800, color: '#0F172A' }}>
                          <div>{w.item_name}</div>
                          {w.batch_number && (
                            <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 500 }}>
                              Batch: {w.batch_number}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 800, color: '#DC2626' }}>
                          -{w.quantity} {w.unit}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: '4px',
                              backgroundColor: '#FEF2F2',
                              color: '#DC2626',
                              textTransform: 'uppercase',
                            }}
                          >
                            {w.reason.replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 700, color: '#DC2626' }}>
                          {formatPrice(w.total_cost)}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#64748B' }}>
                          {w.notes || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Stock Adjustments */}
      {tab === 'adjustments' && (
        <div
          className="card"
          style={{
            borderRadius: '12px',
            border: '1px solid var(--border)',
            background: '#FFFFFF',
            padding: 0,
            overflow: 'hidden',
          }}
        >
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#94A3B8' }}>
              <Loader2 size={30} className="animate-spin" style={{ margin: '0 auto 10px' }} />
              Loading stock adjustment records...
            </div>
          ) : adjustments.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <Sliders size={38} style={{ margin: '0 auto 10px', color: '#94A3B8' }} />
              <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#0F172A' }}>
                No stock adjustments logged
              </h4>
              <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
                Use "Stock Take Count" whenever physical pantry counts deviate from the system balance.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: '#64748B', fontSize: '11px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px 16px' }}>Date</th>
                    <th style={{ padding: '12px 16px' }}>Ingredient</th>
                    <th style={{ padding: '12px 16px' }}>System Prior</th>
                    <th style={{ padding: '12px 16px' }}>Physical Count</th>
                    <th style={{ padding: '12px 16px' }}>Adjustment Delta</th>
                    <th style={{ padding: '12px 16px' }}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {adjustments.map((a) => {
                    const isSurplus = a.adjusted_quantity > 0;
                    const dt = new Date(a.adjusted_at);
                    return (
                      <tr key={a.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '14px 16px', color: '#64748B', whiteSpace: 'nowrap' }}>
                          {dt.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 800, color: '#0F172A' }}>
                          {a.item_name}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#64748B' }}>
                          {a.system_stock} {a.unit}
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 700, color: '#0F172A' }}>
                          {a.physical_stock} {a.unit}
                        </td>
                        <td
                          style={{
                            padding: '14px 16px',
                            fontWeight: 800,
                            color: isSurplus ? '#16A34A' : '#DC2626',
                          }}
                        >
                          {isSurplus ? `+${a.adjusted_quantity}` : a.adjusted_quantity} {a.unit}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#475569' }}>
                          {a.reason}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Record Wastage Modal */}
      <InventoryModal
        isOpen={wastageModalOpen}
        onClose={() => setWastageModalOpen(false)}
        title="Record Food Wastage"
        icon={<Trash2 size={18} style={{ color: '#DC2626' }} />}
        maxWidth="480px"
      >
        <form onSubmit={handleRecordWastage} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Select Ingredient *
                </label>
                <CustomSelect
                  buttonStyle={{ height: '38px', borderRadius: '8px', fontSize: '13px' }}
                  value={wasteItemId}
                  onChange={(val) => setWasteItemId(val)}
                  placeholder="Select Item"
                  options={[
                    { value: '', label: 'Select Item' },
                    ...items.map((it) => ({
                      value: it.id,
                      label: `${it.name} (Available: ${it.current_stock} ${it.unit})`,
                    })),
                  ]}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Quantity Lost {selectedWasteItem ? `(${selectedWasteItem.unit})` : ''} *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  placeholder="e.g. 2"
                  value={wasteQty}
                  onChange={(e) => setWasteQty(e.target.value)}
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Reason for Wastage *
                </label>
                <CustomSelect
                  buttonStyle={{ height: '38px', borderRadius: '8px', fontSize: '13px' }}
                  value={wasteReason}
                  onChange={(val) => setWasteReason(val as any)}
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

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Notes / Explanation
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional incident details..."
                  value={wasteNotes}
                  onChange={(e) => setWasteNotes(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              {selectedWasteItem && Number(wasteQty) > 0 && (
                <div style={{ padding: '10px', backgroundColor: '#FEF2F2', borderRadius: '8px', fontSize: '12px', color: '#991B1B', fontWeight: 600 }}>
                  Financial Loss: {formatPrice(Number(wasteQty) * selectedWasteItem.cost_per_unit)}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setWastageModalOpen(false)}
                  style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#64748B', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#DC2626',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {submitting && <Loader2 size={13} className="animate-spin" />}
                  <span>Confirm Wastage</span>
                </button>
              </div>
            </form>
      </InventoryModal>

      {/* Stock Take Count Modal */}
      <InventoryModal
        isOpen={adjModalOpen}
        onClose={() => setAdjModalOpen(false)}
        title="Stock Take Count Reconciliation"
        icon={<Sliders size={18} style={{ color: '#2563EB' }} />}
        maxWidth="480px"
      >
        <form onSubmit={handleRecordAdjustment} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Select Ingredient *
                </label>
                <CustomSelect
                  buttonStyle={{ height: '38px', borderRadius: '8px', fontSize: '13px' }}
                  value={adjItemId}
                  onChange={(val) => {
                    setAdjItemId(val);
                    const it = items.find((x) => x.id === val);
                    if (it) setPhysicalCount(String(it.current_stock));
                  }}
                  placeholder="Select Item"
                  options={[
                    { value: '', label: 'Select Item' },
                    ...items.map((it) => ({
                      value: it.id,
                      label: `${it.name} (Current: ${it.current_stock} ${it.unit})`,
                    })),
                  ]}
                />
              </div>

              {selectedAdjItem && (
                <div style={{ padding: '8px 12px', backgroundColor: '#F8FAFC', borderRadius: '6px', fontSize: '12px', color: '#64748B' }}>
                  System recorded balance: <strong>{selectedAdjItem.current_stock} {selectedAdjItem.unit}</strong>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Physical Measured Count {selectedAdjItem ? `(${selectedAdjItem.unit})` : ''} *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={physicalCount}
                  onChange={(e) => setPhysicalCount(e.target.value)}
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              {/* Difference Delta */}
              {selectedAdjItem && physicalCount !== '' && !isNaN(Number(physicalCount)) && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    backgroundColor: Number(physicalCount) - selectedAdjItem.current_stock < 0 ? '#FEF2F2' : Number(physicalCount) - selectedAdjItem.current_stock > 0 ? '#F0FDF4' : '#F1F5F9',
                    color: Number(physicalCount) - selectedAdjItem.current_stock < 0 ? '#DC2626' : Number(physicalCount) - selectedAdjItem.current_stock > 0 ? '#16A34A' : '#64748B',
                  }}
                >
                  Adjustment:{' '}
                  {Number(physicalCount) - selectedAdjItem.current_stock > 0
                    ? `+${(Number(physicalCount) - selectedAdjItem.current_stock).toFixed(3)} ${selectedAdjItem.unit} (Surplus)`
                    : Number(physicalCount) - selectedAdjItem.current_stock < 0
                    ? `${(Number(physicalCount) - selectedAdjItem.current_stock).toFixed(3)} ${selectedAdjItem.unit} (Shortage)`
                    : 'Count matches system'}
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
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setAdjModalOpen(false)}
                  style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#64748B', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--primary, #971345)',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {submitting && <Loader2 size={13} className="animate-spin" />}
                  <span>Save Stock Adjustment</span>
                </button>
              </div>
            </form>
      </InventoryModal>
    </AdminContentWrapper>
  );
}

