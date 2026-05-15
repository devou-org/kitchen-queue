import { formatPrice } from '@/lib/format';

interface CheckoutActionsProps {
  addToMode: boolean;
  loading: boolean;
  isVerified: boolean;
  itemsCount: number;
  total: number;
  ticketNumber?: string | number;
  isPartySizeValid?: boolean;
  hasActiveOrder?: boolean;
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
  isPartySizeValid = true,
  hasActiveOrder = false,
  onAddToOrder,
  onSubmitNewOrder
}: CheckoutActionsProps) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 'calc(100px + env(safe-area-inset-bottom))',
      left: 0,
      right: 0,
      margin: '0 auto',
      maxWidth: '480px',
      padding: '0 16px',
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}>
      {addToMode ? (
        <button
          type="button"
          className="btn btn-primary btn-lg"
          style={{ 
            width: '100%', 
            borderRadius: '999px',
            background: '#800020',
            color: 'white',
            boxShadow: '0 8px 20px rgba(128,0,32,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '16px',
            height: '56px',
            border: 'none'
          }}
          disabled={loading || itemsCount === 0}
          onClick={onAddToOrder}
        >
          {loading ? (
            <span style={{ fontWeight: 700, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="loader" style={{ width: 18, height: 18, borderWidth: 2 }} /> Adding...
            </span>
          ) : (
            <span style={{ fontWeight: 700, fontSize: '16px' }}>Add to Order #{String(ticketNumber || '').padStart(3, '0')}</span>
          )}
          <span style={{ fontWeight: 800, fontSize: '16px' }}>{formatPrice(total)}</span>
        </button>
      ) : (
        <button
          type="submit"
          form="new-order-form"
          className="btn btn-primary btn-lg"
          style={{ 
            width: '100%', 
            borderRadius: '999px',
            background: '#800020',
            color: 'white',
            opacity: (!isVerified || loading || !isPartySizeValid || hasActiveOrder) ? 0.6 : 1,
            boxShadow: '0 8px 20px rgba(128,0,32,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '16px',
            height: '56px',
            border: 'none'
          }}
          disabled={loading || !isVerified || !isPartySizeValid || hasActiveOrder}
        >
          {loading ? (
            <span style={{ fontWeight: 700, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="loader" style={{ width: 18, height: 18, borderWidth: 2 }} /> Processing...
            </span>
          ) : !isVerified ? (
            <span style={{ fontWeight: 700, fontSize: '16px' }}>⚠️ Verify Phone to Order</span>
          ) : (
            <span style={{ fontWeight: 700, fontSize: '16px' }}>Place Order →</span>
          )}

          <span style={{ fontWeight: 800, fontSize: '16px' }}>{formatPrice(total)}</span>
        </button>
      )}
    </div>
  );
}
