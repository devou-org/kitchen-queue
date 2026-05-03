import Link from 'next/link';
import BottomNav from '@/components/BottomNav';
import { getOrderByTicket } from '@/lib/db';
import LiveOrderStatus from './LiveOrderStatus';

export default async function OrderStatusTicketPage({ params }: { params: Promise<{ ticket: string }> }) {
  const { ticket } = await params;
  
  // 1. Fetch initial data on the server (No loading spinners on client!)
  const ticketNumber = parseInt(ticket);
  const initialOrder = isNaN(ticketNumber) ? null : await getOrderByTicket(ticketNumber);

  const renderHeader = () => (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '16px 20px',
      background: 'white',
      borderBottom: '1px solid rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <img
          src="https://ik.imagekit.io/j2q8x5lu0/Renjzkitchen/renjz.jpg"
          alt="Renjz Kitchen"
          style={{ width: '28px', height: '28px', borderRadius: '4px', objectFit: 'cover' }}
        />
        <span style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-primary)' }}>Renjz Kitchen</span>
      </div>
    </div>
  );

  if (!initialOrder) {
    return (
      <div style={{ background: 'linear-gradient(135deg, #FDF9FA 0%, #F8EDF0 100%)', minHeight: '100vh', color: 'var(--text-primary)' }}>
        {renderHeader()}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', textAlign: 'center' }} className="animate-fade-in">
          <div style={{ fontSize: '64px', marginBottom: '16px', opacity: 0.5 }}>🔍</div>
          <h2 style={{ fontWeight: 800, marginBottom: '8px', fontSize: '24px' }}>Ticket Not Found</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>The requested ticket could not be found or is invalid.</p>
          <Link href="/menu" prefetch={false} className="btn btn-primary btn-lg" style={{ width: '100%', maxWidth: '300px' }}>
            Go to Menu →
          </Link>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div style={{ background: 'linear-gradient(135deg, #FDF9FA 0%, #F8EDF0 100%)', minHeight: '100vh', color: 'var(--text-primary)' }}>
      {renderHeader()}
      
      {/* 2. Pass data to a focused Client Component for live Pusher updates */}
      <LiveOrderStatus initialOrder={initialOrder as any} ticket={ticket} />
      
      <BottomNav />
    </div>
  );
}
