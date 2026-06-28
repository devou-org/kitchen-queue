import React from 'react';
import { TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';

interface Transaction {
  id: string;
  transaction_type: string;
  amount: string;
  reference_id: string;
  description: string;
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
    tableCard: { backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' },
    tableHeader: { padding: '20px 24px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff' },
    tableTitle: { fontSize: '15px', fontWeight: 700, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center' },
    table: { width: '100%', borderCollapse: 'collapse' as const, textAlign: 'left' as const },
    trHead: { backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' },
    th: { padding: '12px 24px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
    thAlignRight: { padding: '12px 24px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.05em', textAlign: 'right' as const },
    tr: { borderBottom: '1px solid #f1f5f9' },
    td: { padding: '16px 24px', fontSize: '13px', color: '#475569', verticalAlign: 'middle' as const },
    tdAlignRight: { padding: '16px 24px', fontSize: '13px', color: '#1e293b', fontWeight: 600, textAlign: 'right' as const, verticalAlign: 'middle' as const },
    tdEmpty: { padding: '32px', textAlign: 'center' as const, color: '#94a3b8', fontSize: '14px' },
  };

  return (
    <div style={styles.tableCard}>
      <div style={{...styles.tableHeader, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px'}}>
        <h3 style={styles.tableTitle}>
          <TrendingUp size={16} style={{ marginRight: '6px' }} />
          Recent Billing Operations
        </h3>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
            style={{ padding: '6px 10px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
          />
          <span style={{ fontSize: '12px', color: '#64748b' }}>to</span>
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
            style={{ padding: '6px 10px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
          />
          {(txDateFrom || txDateTo) && (
            <button 
              onClick={() => { setTxDateFrom(''); setTxDateTo(''); setTxPage(1); }}
              style={{ padding: '6px 10px', fontSize: '12px', background: '#f1f5f9', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#475569' }}
            >
              Clear
            </button>
          )}
        </div>
      </div>
      <div style={{ overflowX: 'auto', maxHeight: '420px' }}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.trHead}>
              <th style={styles.th}>Date</th>
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
                  <td style={styles.td}>{new Date(t.created_at).toLocaleDateString('en-IN')}</td>
                  <td style={styles.td}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 700,
                      backgroundColor: t.transaction_type === 'PAYMENT' ? '#ecfdf5' : '#f1f5f9',
                      color: t.transaction_type === 'PAYMENT' ? '#047857' : '#475569'
                    }}>
                      {t.transaction_type}
                    </span>
                  </td>
                  <td style={{ ...styles.td, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.description}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Showing {(txPage - 1) * 10 + 1} to {Math.min(txPage * 10, totalTxs)} of {totalTxs}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => setTxPage(p => Math.max(1, p - 1))}
              disabled={txPage === 1}
              style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: txPage === 1 ? '#e2e8f0' : '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: txPage === 1 ? 'not-allowed' : 'pointer' }}
            >
              Prev
            </button>
            <button 
              onClick={() => setTxPage(p => Math.min(Math.ceil(totalTxs / 10), p + 1))}
              disabled={txPage >= Math.ceil(totalTxs / 10)}
              style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: txPage >= Math.ceil(totalTxs / 10) ? '#e2e8f0' : '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: txPage >= Math.ceil(totalTxs / 10) ? 'not-allowed' : 'pointer' }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
