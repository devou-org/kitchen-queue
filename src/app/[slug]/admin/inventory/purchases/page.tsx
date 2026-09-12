'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Truck,
  Plus,
  Search,
  Calendar,
  Layers,
  Building2,
  Trash2,
  DollarSign,
  CheckCircle2,
  Loader2,
  X,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminContentWrapper } from '@/components/AdminContentWrapper';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { InventoryNav } from '@/components/modules/inventory/InventoryNav';
import { inventoryService } from '@/app/services/inventory.api';
import { PurchaseOrder, Supplier, InventoryItem } from '@/types/inventory';
import { formatPrice } from '@/lib/format';

interface ReceivingLine {
  item_id: string;
  quantity: number | string;
  unit: string;
  unit_price: number | string;
  tax_rate: number | string;
  batch_number: string;
  expiry_date: string;
}

export default function PurchasesPage() {
  const { slug } = useParams();
  const slugStr = Array.isArray(slug) ? slug[0] : slug;

  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Receive Stock Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formSupplierId, setFormSupplierId] = useState('');
  const [formInvoiceNumber, setFormInvoiceNumber] = useState('');
  const [formReceivedDate, setFormReceivedDate] = useState(new Date().toISOString().split('T')[0]);
  const [formPaymentStatus, setFormPaymentStatus] = useState<'PAID' | 'PARTIAL' | 'UNPAID'>('PAID');
  const [formNotes, setFormNotes] = useState('');
  const [lines, setLines] = useState<ReceivingLine[]>([
    {
      item_id: '',
      quantity: '',
      unit: 'kg',
      unit_price: '',
      tax_rate: '0',
      batch_number: '',
      expiry_date: '',
    },
  ]);

  // Expanded PO row for line details
  const [expandedPoId, setExpandedPoId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [poRes, supRes, itemRes] = await Promise.all([
        inventoryService.getPurchases(),
        inventoryService.getSuppliers(),
        inventoryService.getItems({ is_active: true }),
      ]);
      if (poRes.success && poRes.data) setPurchases(poRes.data);
      if (supRes.success && supRes.data) setSuppliers(supRes.data);
      if (itemRes.success && itemRes.data) setItems(itemRes.data);
    } catch {
      toast.error('Network error loading purchase orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenReceiveModal = () => {
    setFormSupplierId(suppliers[0]?.id || '');
    setFormInvoiceNumber('');
    setFormReceivedDate(new Date().toISOString().split('T')[0]);
    setFormPaymentStatus('PAID');
    setFormNotes('');
    setLines([
      {
        item_id: items[0]?.id || '',
        quantity: '',
        unit: items[0]?.unit || 'kg',
        unit_price: items[0]?.cost_per_unit || '',
        tax_rate: '0',
        batch_number: `B-${Date.now().toString().slice(-4)}`,
        expiry_date: '',
      },
    ]);
    setModalOpen(true);
  };

  const handleItemSelect = (index: number, itemId: string) => {
    const selected = items.find((i) => i.id === itemId);
    const updated = [...lines];
    updated[index].item_id = itemId;
    if (selected) {
      updated[index].unit = selected.unit;
      updated[index].unit_price = selected.cost_per_unit || '';
    }
    setLines(updated);
  };

  const handleLineChange = (index: number, field: keyof ReceivingLine, value: any) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };
    setLines(updated);
  };

  const handleAddLine = () => {
    setLines([
      ...lines,
      {
        item_id: items[0]?.id || '',
        quantity: '',
        unit: items[0]?.unit || 'kg',
        unit_price: items[0]?.cost_per_unit || '',
        tax_rate: '0',
        batch_number: `B-${Date.now().toString().slice(-4)}`,
        expiry_date: '',
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  // Calculate totals
  const subtotal = lines.reduce((sum, l) => {
    const q = Number(l.quantity) || 0;
    const p = Number(l.unit_price) || 0;
    return sum + q * p;
  }, 0);

  const taxTotal = lines.reduce((sum, l) => {
    const q = Number(l.quantity) || 0;
    const p = Number(l.unit_price) || 0;
    const t = Number(l.tax_rate) || 0;
    return sum + q * p * (t / 100);
  }, 0);

  const grandTotal = subtotal + taxTotal;

  const handleSubmitReceive = async (e: React.FormEvent) => {
    e.preventDefault();

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.item_id) {
        toast.error(`Please select an ingredient for line #${i + 1}`);
        return;
      }
      if (!Number(l.quantity) || Number(l.quantity) <= 0) {
        toast.error(`Please enter a valid quantity for line #${i + 1}`);
        return;
      }
      if (Number(l.unit_price) < 0) {
        toast.error(`Unit price cannot be negative for line #${i + 1}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await inventoryService.receiveStock({
        supplier_id: formSupplierId || undefined,
        invoice_number: formInvoiceNumber.trim() || undefined,
        received_date: formReceivedDate,
        payment_status: formPaymentStatus,
        notes: formNotes.trim() || undefined,
        items: lines.map((l) => ({
          item_id: l.item_id,
          quantity: Number(l.quantity),
          unit: l.unit,
          unit_price: Number(l.unit_price),
          tax_rate: Number(l.tax_rate || 0),
          batch_number: l.batch_number?.trim() || undefined,
          expiry_date: l.expiry_date || undefined,
        })),
      });

      if (res.success) {
        toast.success('Stock received and inventory increased!');
        setModalOpen(false);
        fetchData();
      } else {
        toast.error(res.error || 'Failed to receive stock');
      }
    } catch {
      toast.error('Network error receiving stock');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminContentWrapper>
      <AdminPageHeader
        title="Purchases & Stock Receiving"
        subtitle="Log goods received from suppliers to atomically update stock levels, batches, and audit ledgers."
        action={
          <button
            onClick={handleOpenReceiveModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              height: '38px',
              padding: '0 16px',
              borderRadius: '8px',
              background: '#0F172A',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Truck size={15} />
            <span>Receive Stock</span>
          </button>
        }
      />

      <InventoryNav />

      {/* Purchases List */}
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
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: '#0F172A' }}>
            Goods Received History ({purchases.length})
          </h3>
        </div>

        {loading ? (
          <div style={{ padding: '80px', textAlign: 'center', color: '#94A3B8' }}>
            <Loader2 size={30} className="animate-spin" style={{ margin: '0 auto 10px' }} />
            Loading purchase receipts...
          </div>
        ) : purchases.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <Truck size={40} style={{ margin: '0 auto 10px', color: '#94A3B8' }} />
            <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#0F172A' }}>
              No purchase orders recorded yet
            </h4>
            <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
              Click "Receive Stock" to record your first food delivery invoice.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: '#64748B', fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>PO / Invoice #</th>
                  <th style={{ padding: '12px 16px' }}>Supplier</th>
                  <th style={{ padding: '12px 16px' }}>Received Date</th>
                  <th style={{ padding: '12px 16px' }}>Items Received</th>
                  <th style={{ padding: '12px 16px' }}>Total Amount</th>
                  <th style={{ padding: '12px 16px' }}>Payment Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((po) => {
                  const isExpanded = expandedPoId === po.id;
                  return (
                    <React.Fragment key={po.id}>
                      <tr
                        style={{
                          borderBottom: '1px solid #F1F5F9',
                          backgroundColor: isExpanded ? '#F8FAFC' : '#FFFFFF',
                          cursor: 'pointer',
                        }}
                        onClick={() => setExpandedPoId(isExpanded ? null : po.id)}
                      >
                        <td style={{ padding: '14px 16px', fontWeight: 800, color: '#0F172A' }}>
                          <div>{po.po_number}</div>
                          {po.invoice_number && (
                            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>
                              Inv: {po.invoice_number}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                          {po.supplier_name || 'Unassigned Supplier'}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#64748B' }}>{po.received_date}</td>
                        <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                          {po.items?.length || 0} ingredients
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 800, color: '#16A34A' }}>
                          {formatPrice(po.total_amount)}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: '4px',
                              backgroundColor: po.payment_status === 'PAID' ? '#F0FDF4' : '#FFFBEB',
                              color: po.payment_status === 'PAID' ? '#16A34A' : '#D97706',
                              textTransform: 'uppercase',
                            }}
                          >
                            {po.payment_status}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedPoId(isExpanded ? null : po.id);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: '#2563EB',
                              fontWeight: 600,
                              fontSize: '12px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <span>{isExpanded ? 'Hide' : 'Details'}</span>
                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Line Items */}
                      {isExpanded && po.items && (
                        <tr style={{ backgroundColor: '#F8FAFC' }}>
                          <td colSpan={7} style={{ padding: '12px 24px 20px 24px' }}>
                            <div
                              style={{
                                padding: '14px',
                                borderRadius: '8px',
                                border: '1px solid #E2E8F0',
                                backgroundColor: '#FFFFFF',
                              }}
                            >
                              <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: '8px' }}>
                                Received Line Items
                              </div>
                              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B', textAlign: 'left' }}>
                                    <th style={{ padding: '6px' }}>Ingredient</th>
                                    <th style={{ padding: '6px' }}>Quantity</th>
                                    <th style={{ padding: '6px' }}>Unit Price</th>
                                    <th style={{ padding: '6px' }}>Tax Rate</th>
                                    <th style={{ padding: '6px' }}>Line Total</th>
                                    <th style={{ padding: '6px' }}>Batch Number</th>
                                    <th style={{ padding: '6px' }}>Expiry Date</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {po.items.map((line: any, idx: number) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                      <td style={{ padding: '8px 6px', fontWeight: 700, color: '#0F172A' }}>
                                        {line.item_name}
                                      </td>
                                      <td style={{ padding: '8px 6px', fontWeight: 700 }}>
                                        {line.quantity} {line.unit}
                                      </td>
                                      <td style={{ padding: '8px 6px' }}>{formatPrice(line.unit_price)}</td>
                                      <td style={{ padding: '8px 6px' }}>{line.tax_rate}%</td>
                                      <td style={{ padding: '8px 6px', fontWeight: 700 }}>
                                        {formatPrice(line.total_price)}
                                      </td>
                                      <td style={{ padding: '8px 6px', color: '#64748B' }}>
                                        {line.batch_number || '—'}
                                      </td>
                                      <td style={{ padding: '8px 6px', color: '#64748B' }}>
                                        {line.expiry_date || '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Receive Stock Modal */}
      {modalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            className="card"
            style={{
              width: '740px',
              maxWidth: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              borderRadius: '16px',
              background: '#FFFFFF',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Truck size={20} style={{ color: '#0F172A' }} />
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#0F172A' }}>
                  Receive Stock Delivery
                </h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitReceive} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Header Info */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Supplier
                  </label>
                  <select
                    value={formSupplierId}
                    onChange={(e) => setFormSupplierId(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', backgroundColor: '#FFFFFF' }}
                  >
                    <option value="">Direct / Walk-in Market</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Invoice / Bill #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. INV-8921"
                    value={formInvoiceNumber}
                    onChange={(e) => setFormInvoiceNumber(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Received Date
                  </label>
                  <input
                    type="date"
                    value={formReceivedDate}
                    onChange={(e) => setFormReceivedDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Payment Status
                  </label>
                  <select
                    value={formPaymentStatus}
                    onChange={(e) => setFormPaymentStatus(e.target.value as any)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', backgroundColor: '#FFFFFF' }}
                  >
                    <option value="PAID">Paid in Full</option>
                    <option value="UNPAID">Unpaid (Add to Outstanding)</option>
                    <option value="PARTIAL">Partial</option>
                  </select>
                </div>
              </div>

              {/* Line Items */}
              <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A', textTransform: 'uppercase' }}>
                    Delivered Items & Batches ({lines.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      background: '#EFF6FF',
                      color: '#2563EB',
                      border: '1px solid #DBEAFE',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <Plus size={12} />
                    <span>Add Item</span>
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {lines.map((line, idx) => {
                    const lineTotal = (Number(line.quantity) || 0) * (Number(line.unit_price) || 0);
                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto',
                          gap: '8px',
                          alignItems: 'center',
                          padding: '10px',
                          backgroundColor: '#F8FAFC',
                          borderRadius: '8px',
                          border: '1px solid #E2E8F0',
                        }}
                      >
                        {/* Ingredient */}
                        <div>
                          <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748B' }}>Ingredient</label>
                          <select
                            value={line.item_id}
                            onChange={(e) => handleItemSelect(idx, e.target.value)}
                            required
                            style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px', backgroundColor: '#FFFFFF' }}
                          >
                            <option value="">Select Item</option>
                            {items.map((it) => (
                              <option key={it.id} value={it.id}>
                                {it.name} ({it.unit})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Quantity */}
                        <div>
                          <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748B' }}>
                            Qty ({line.unit})
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0.01"
                            placeholder="Qty"
                            value={line.quantity}
                            onChange={(e) => handleLineChange(idx, 'quantity', e.target.value)}
                            required
                            style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px', boxSizing: 'border-box' }}
                          />
                        </div>

                        {/* Unit Price */}
                        <div>
                          <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748B' }}>Rate (₹)</label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            placeholder="Price"
                            value={line.unit_price}
                            onChange={(e) => handleLineChange(idx, 'unit_price', e.target.value)}
                            required
                            style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px', boxSizing: 'border-box' }}
                          />
                        </div>

                        {/* Batch Number */}
                        <div>
                          <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748B' }}>Batch #</label>
                          <input
                            type="text"
                            placeholder="Lot/Batch"
                            value={line.batch_number}
                            onChange={(e) => handleLineChange(idx, 'batch_number', e.target.value)}
                            style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px', boxSizing: 'border-box' }}
                          />
                        </div>

                        {/* Expiry Date */}
                        <div>
                          <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748B' }}>Expiry</label>
                          <input
                            type="date"
                            value={line.expiry_date}
                            onChange={(e) => handleLineChange(idx, 'expiry_date', e.target.value)}
                            style={{ width: '100%', padding: '6px 4px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '11px', boxSizing: 'border-box' }}
                          />
                        </div>

                        {/* Delete button */}
                        <div>
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(idx)}
                            disabled={lines.length <= 1}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: lines.length <= 1 ? '#CBD5E1' : '#EF4444',
                              cursor: lines.length <= 1 ? 'not-allowed' : 'pointer',
                              padding: '6px 2px',
                              marginTop: '14px',
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Total Calculation Summary */}
              <div
                style={{
                  padding: '14px 16px',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>Subtotal: {formatPrice(subtotal)}</span>
                  {taxTotal > 0 && (
                    <span style={{ fontSize: '12px', color: '#64748B', marginLeft: '14px' }}>
                      Tax: {formatPrice(taxTotal)}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: '#0F172A' }}>
                  Total: {formatPrice(grandTotal)}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#64748B',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '9px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#0F172A',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  <span>Receive & Update Stock</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminContentWrapper>
  );
}

