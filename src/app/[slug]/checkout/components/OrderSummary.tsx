import { formatPrice } from '@/lib/format';
import { CartItem, Order } from '@/types';
import { ClipboardList } from 'lucide-react';

interface OrderSummaryProps {
  items: CartItem[];
  subtotal: number;
  gstAmount?: number;
  gstRate?: number | string;
  gstType?: string;
  discountAmount?: number;
  appliedRewardName?: string;
  freeRewardName?: string;
  freeRewardProductId?: string;
  total: number;
  addToMode: boolean;
  activeOrder: Order | null;
}

export default function OrderSummary({ 
  items, 
  subtotal, 
  gstAmount, 
  gstRate, 
  gstType, 
  discountAmount = 0,
  appliedRewardName,
  freeRewardName,
  freeRewardProductId,
  total, 
  addToMode, 
  activeOrder 
}: OrderSummaryProps) {
  const halfGst = (gstAmount || 0) / 2;
  const splitGst = Math.round(halfGst * 100) / 100;
  const halfRate = gstRate ? Number(gstRate) / 2 : undefined;

  const finalTotal = Math.max(0, total - discountAmount);

  return (
    <div className="card" style={{ marginBottom: '16px' }}>
      <h3 style={{ fontWeight: 700, marginBottom: '14px', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ClipboardList size={18} />
        Order Summary
      </h3>
      {items.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Your cart is empty. Go back to the menu to add items.</p>
      ) : (
        <>
          {items.map(item => {
            const isFreeReward = Boolean(freeRewardName && freeRewardProductId && item.product_id === freeRewardProductId);
            const displayQty = isFreeReward ? Math.max(0, item.quantity - 1) : item.quantity;
            if (displayQty === 0) return null;
            return (
              <div key={item.product_id} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '14px',
              }}>
                <span>{item.name} × {displayQty}</span>
                <span style={{ fontWeight: 600 }}>{formatPrice(item.price * displayQty)}</span>
              </div>
            );
          })}
          {freeRewardName && (
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '14px',
              color: '#059669', fontWeight: 600,
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {freeRewardName} × 1
                <span style={{ fontSize: '10px', background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                  FREE GIFT
                </span>
              </span>
              <span style={{ fontWeight: 700 }}>₹0.00</span>
            </div>
          )}
          {addToMode && activeOrder && (
            <div style={{
              marginTop: '10px', padding: '8px 10px',
              background: 'rgba(151,19,69,0.04)', borderRadius: '8px',
              border: '1px dashed rgba(151,19,69,0.2)',
            }}>
              <p style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 600 }}>
                + {(activeOrder.items || []).length} existing item(s) from order #{String(activeOrder.ticket_number).padStart(3, '0')}
              </p>
            </div>
          )}
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <span>Subtotal (new items)</span><span>{formatPrice(subtotal)}</span>
            </div>
            {gstType === 'REGULAR' && gstAmount !== undefined && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <span>CGST {halfRate !== undefined ? `(${halfRate}%)` : ''}</span>
                  <span>{formatPrice(splitGst)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <span>SGST {halfRate !== undefined ? `(${halfRate}%)` : ''}</span>
                  <span>{formatPrice(splitGst)}</span>
                </div>
              </>
            )}
            {discountAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#16a34a', fontWeight: 700 }}>
                <span>Loyalty Reward ({appliedRewardName || 'Discount'})</span>
                <span>-{formatPrice(discountAmount)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '18px', paddingTop: '8px', borderTop: '2px solid var(--border)' }}>
              <span>Total</span>
              <span style={{ color: 'var(--primary)' }}>{formatPrice(finalTotal)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
