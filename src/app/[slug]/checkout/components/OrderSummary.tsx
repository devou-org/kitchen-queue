import { formatPrice } from '@/lib/format';
import { CartItem, Order } from '@/types';
import { ClipboardList } from 'lucide-react';

interface OrderSummaryProps {
  items: CartItem[];
  subtotal: number;
  total: number;
  addToMode: boolean;
  activeOrder: Order | null;
}

export default function OrderSummary({ items, subtotal, total, addToMode, activeOrder }: OrderSummaryProps) {
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
          {items.map(item => (
            <div key={item.product_id} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '14px',
            }}>
              <span>{item.name} × {item.quantity}</span>
              <span style={{ fontWeight: 600 }}>{formatPrice(item.price * item.quantity)}</span>
            </div>
          ))}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '18px', paddingTop: '8px', borderTop: '2px solid var(--border)' }}>
              <span>Total</span>
              <span style={{ color: 'var(--primary)' }}>{formatPrice(total)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
