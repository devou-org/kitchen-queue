import SwipeButton from '@/components/SwipeButton';
import { formatPrice } from '@/lib/format';

interface CheckoutActionsProps {
  addToMode: boolean;
  loading: boolean;
  isVerified: boolean;
  itemsCount: number;
  total: number;
  ticketNumber?: string | number;
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
  hasActiveOrder = false,
  onAddToOrder,
  onSubmitNewOrder
}: CheckoutActionsProps) {
  
  const handleConfirm = () => {
    if (addToMode) {
      return onAddToOrder();
    } else {
      const form = document.getElementById('new-order-form') as HTMLFormElement;
      if (form) {
        if (!form.checkValidity()) {
          form.reportValidity();
          return false;
        }
        if (typeof form.requestSubmit === 'function') {
          form.requestSubmit();
        } else {
          form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
      }
    }
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 'calc(24px + env(safe-area-inset-bottom))',
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
        <SwipeButton 
          onConfirm={handleConfirm}
          disabled={loading || itemsCount === 0}
          loading={loading}
          text={
            <>
              <span>Add to Order #{String(ticketNumber || '').padStart(3, '0')}</span>
              <span style={{ fontWeight: 800, marginLeft: '8px' }}>{formatPrice(total)}</span>
            </>
          }
        />
      ) : (
        <SwipeButton
          onConfirm={handleConfirm}
          disabled={loading || !isVerified || hasActiveOrder}
          loading={loading}
          text={
            !isVerified ? (
              <span>⚠️ Verify Phone to Order</span>
            ) : (
              <>
                <span>Slide to Place Order</span>
                <span style={{ fontWeight: 800, marginLeft: '8px' }}>{formatPrice(total)}</span>
              </>
            )
          }
        />
      )}
      <div style={{ height: '32px' }} aria-hidden="true" />
    </div>
  );
}
