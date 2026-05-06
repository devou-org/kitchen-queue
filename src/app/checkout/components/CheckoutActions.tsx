import { formatPrice } from '@/lib/format';

interface CheckoutActionsProps {
  addToMode: boolean;
  loading: boolean;
  isVerified: boolean;
  itemsCount: number;
  total: number;
  ticketNumber?: string | number;
  onAddToOrder: () => Promise<void>;
  onSubmitNewOrder: (e: React.FormEvent) => Promise<void>;
}

export default function CheckoutActions({
  addToMode,
  loading,
  isVerified,
  itemsCount,
  total,
  ticketNumber,
  onAddToOrder,
  onSubmitNewOrder
}: CheckoutActionsProps) {
  return (
    <div style={{
      position: 'fixed', bottom: 64, left: 0, right: 0,
      background: 'white', borderTop: '1px solid var(--border)',
      padding: '16px',
      boxShadow: '0 -4px 10px rgba(0,0,0,0.05)',
      zIndex: 100,
    }}>
      {addToMode ? (
        <button
          type="button"
          className="btn btn-primary btn-lg"
          style={{ width: '100%' }}
          disabled={loading || itemsCount === 0}
          onClick={onAddToOrder}
        >
          {loading ? (
            <><span className="loader" style={{ width: 18, height: 18, borderWidth: 2 }} /> Adding Items...</>
          ) : (
            <>➕ Add to Order #{String(ticketNumber || '').padStart(3, '0')} – {formatPrice(total)}</>
          )}
        </button>
      ) : (
        <button
          type="submit"
          form="new-order-form"
          className="btn btn-primary btn-lg"
          style={{ width: '100%' }}
          disabled={loading || !isVerified}
        >
          {loading ? (
            <><span className="loader" style={{ width: 18, height: 18, borderWidth: 2 }} /> Processing...</>
          ) : !isVerified ? (
            <>⚠️ Verify Phone to Order</>
          ) : (
            <>🎉 Place Order – {formatPrice(total)}</>
          )}
        </button>
      )}
    </div>
  );
}
