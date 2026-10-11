import React from 'react';
import { TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { Pagination } from '@/components/ui/Pagination';

interface Transaction {
  id: string;
  transaction_type: string;
  amount: string;
  reference_id: string;
  description: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  created_at: string;
}

interface RecentBillingOperationsProps {
  transactions: Transaction[];
  totalTxs: number;
  txPage: number;
  setTxPage: (page: number | ((p: number) => number)) => void;
  txDateFrom: string;
  setTxDateFrom: (date: string) => void;
  txDateTo: string;
  setTxDateTo: (date: string) => void;
  txLoading: boolean;
}

export default function RecentBillingOperations({
  transactions,
  totalTxs,
  txPage,
  setTxPage,
  txDateFrom,
  setTxDateFrom,
  txDateTo,
  setTxDateTo,
  txLoading
}: RecentBillingOperationsProps) {
  
  const styles = {
    tableCard: { backgroundColor: 'white', borderRadius: 0, border: 'none', overflow: 'hidden' },
    tableHeader: { padding: '16px 20px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff' },
    tableTitle: { fontSize: '13px', fontWeight: 800, color: 'var(--text-primary, #0f172a)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
    table: { width: '100%', minWidth: '600px', borderCollapse: 'collapse' as const, textAlign: 'left' as const },
    trHead: { backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' },
    th: { padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
    thAlignRight: { padding: '12px 20px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.05em', textAlign: 'right' as const },
    tr: { borderBottom: '1px solid #f1f5f9' },
    td: { padding: '14px 16px', fontSize: '13px', color: '#475569', verticalAlign: 'middle' as const },
    tdAlignRight: { padding: '14px 20px', fontSize: '13px', color: '#1e293b', fontWeight: 600, textAlign: 'right' as const, verticalAlign: 'middle' as const },
    tdEmpty: { padding: '48px 20px', textAlign: 'center' as const, color: '#94a3b8', fontSize: '14px' },
  };

  return (
    <div style={styles.tableCard}>
      <div style={{...styles.tableHeader, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px'}}>
        <h3 style={styles.tableTitle}>
          <TrendingUp size={16} style={{ color: 'var(--primary, #971345)' }} />
          <span>Recent Billing Operations</span>
        </h3>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>From</span>
            <input
              type="date"
              value={txDateFrom}
              onChange={(e) => {
                setTxDateFrom(e.target.value);
                if (txDateTo && e.target.value > txDateTo) {
                  toast.error('From Date cannot be later than To Date');
                  setTxDateTo('');
                }
                setTxPage(1);
              }}
              style={{ height: '36px', padding: '0 8px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white', color: 'var(--text-primary)' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>To</span>
            <input
              type="date"
              value={txDateTo}
              min={txDateFrom}
              onChange={(e) => {
                if (txDateFrom && e.target.value < txDateFrom) {
                  toast.error('To Date cannot be earlier than From Date');
                  return;
                }
                setTxDateTo(e.target.value);
                setTxPage(1);
              }}
              style={{ height: '36px', padding: '0 8px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white', color: 'var(--text-primary)' }}
            />
          </div>
          {(txDateFrom || txDateTo) && (
            <button 
              onClick={() => { setTxDateFrom(''); setTxDateTo(''); setTxPage(1); }}
              style={{ height: '36px', padding: '0 12px', fontSize: '12px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', color: '#475569', fontWeight: 600 }}
            >
              Clear
            </button>
          )}
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.trHead}>
              <th style={{ ...styles.th, paddingLeft: '20px' }}>Date</th>
              <th style={styles.th}>Type</th>
              <th style={styles.th}>Description</th>
              <th style={styles.thAlignRight}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {txLoading ? (
              <tr>
                <td colSpan={4} style={styles.tdEmpty}>Loading transactions...</td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={4} style={styles.tdEmpty}>No transactions found for the selected criteria.</td>
              </tr>
            ) : (
              transactions.map(t => (
                <tr key={t.id} style={styles.tr}>
                  <td style={{ ...styles.td, paddingLeft: '20px' }}>{new Date(t.created_at).toLocaleDateString('en-IN')}</td>
                  <td style={styles.td}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 7px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: t.transaction_type === 'PAYMENT' ? '#ecfdf5' : '#f1f5f9',
                      color: t.transaction_type === 'PAYMENT' ? '#047857' : '#475569'
                    }}>
                      {t.transaction_type}
                    </span>
                  </td>
                  <td 
                    style={{ ...styles.td, maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={
                      t.transaction_type === 'OTP' && (t.customer_name || t.customer_phone)
                        ? `OTP SMS charge for ${t.customer_name || t.customer_phone}`
                        : t.description
                    }
                  >
                    {t.transaction_type === 'OTP' && (t.customer_name || t.customer_phone)
                      ? `OTP SMS charge for ${t.customer_name || t.customer_phone}`
                      : t.description}
                  </td>
                  <td style={styles.tdAlignRight}>₹{parseFloat(t.amount || '0').toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination Controls */}
      {totalTxs > 10 && (
        <Pagination
          currentPage={txPage}
          totalPages={Math.ceil(totalTxs / 10)}
          onPageChange={(page) => setTxPage(page)}
          totalRecords={totalTxs}
          pageSize={10}
        />
      )}
    </div>
  );
}
