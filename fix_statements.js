const fs = require('fs');
let code = fs.readFileSync('src/app/[slug]/admin/statements/page.tsx', 'utf8');

const newCode = `  const { totalRevenue, totalPaidRevenue, orderCount, paidCount, totalRegularSubtotal, totalRegularGst, totalCompositionRevenue, totalCompositionGst, totalNoneRevenue } = stats as any;

  const actualRevenue = (totalRegularSubtotal || 0) + (totalCompositionRevenue || 0) + (totalNoneRevenue || 0) || totalRevenue;
  const gstCollected = totalRegularGst || 0;
  const gstPayable = totalCompositionGst || 0;
  const netRevenue = actualRevenue - gstPayable;

  const allStatuses = ['PENDING', 'PREPARING', 'READY', 'PAID', 'CANCELLED'];

  const [expiring, setExpiring] = useState(false);
  const handleExpireOldOrders = async () => {
    if (!window.confirm('Are you sure you want to expire all unfulfilled orders from PREVIOUS days? This will restore their stock items back to inventory.')) return;

    setExpiring(true);
    try {
      const res = await fetch('/api/cron/expire-orders');
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Expired orders successfully');
        fetchOrders(true);
      } else {
        toast.error(data.error || 'Failed to expire orders');
      }
    } catch {
      toast.error('Network error while expiring orders');
    } finally {
      setExpiring(false);
    }
  };

  return (
    <>
      <AdminContentWrapper>
        <AdminPageHeader
          title="Financial Statements"
          description="Analyze revenue and historical orders. Click any record to view or edit details."
        />

        {/* Date Range Filter */}
        <div className="card" style={{ marginBottom: '20px', display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label className="label">From</label>
            <input type="date" className="input" value={dateFrom} max={dateTo} onChange={e => setDateFrom(e.target.value)} style={{ width: '160px' }} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className="input" value={dateTo} min={dateFrom} onChange={e => setDateTo(e.target.value)} style={{ width: '160px' }} />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: '160px' }}>
              <option value="">All Statuses</option>
              {allStatuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={exportCSV} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#059669', background: 'rgba(5, 150, 105, 0.1)' }}>
              <Download size={16} /> Export (CSV)
            </button>
            <button
              className="btn btn-ghost"
              onClick={handleExpireOldOrders}
              disabled={expiring}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#DC2626', background: 'rgba(220, 38, 38, 0.1)' }}
            >
              <Clock size={16} /> {expiring ? 'Expiring...' : 'Expire Old'}
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div className="stat-card">
            <p className="stat-label">Revenue</p>
            <h3 className="stat-value" style={{ color: 'var(--primary)' }}>{formatPrice(actualRevenue)}</h3>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Excluding Cancelled</p>
          </div>
          
          {restaurant?.gst_type === 'REGULAR' && (
            <div className="stat-card" style={{ borderLeftColor: '#059669' }}>
              <p className="stat-label">GST Collected</p>
              <h3 className="stat-value" style={{ color: '#059669' }}>{formatPrice(gstCollected)}</h3>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>On behalf of Govt</p>
            </div>
          )}

          {restaurant?.gst_type === 'COMPOSITION' && (
            <div className="stat-card" style={{ borderLeftColor: '#EAB308' }}>
              <p className="stat-label">GST Payable</p>
              <h3 className="stat-value" style={{ color: '#EAB308' }}>{formatPrice(gstPayable)}</h3>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Deducted from Revenue</p>
            </div>
          )}

          {restaurant?.gst_type === 'NONE' && (
            <div className="stat-card" style={{ borderLeftColor: '#6B7280' }}>
              <p className="stat-label">GST</p>
              <h3 className="stat-value" style={{ color: '#6B7280' }}>{formatPrice(0)}</h3>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>No GST applicable</p>
            </div>
          )}

          <div className="stat-card" style={{ borderLeftColor: 'var(--text-primary)' }}>
            <p className="stat-label">Net Revenue</p>
            <h3 className="stat-value" style={{ color: 'var(--text-primary)' }}>{formatPrice(netRevenue)}</h3>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Final retained earnings</p>
          </div>
        </div>`;

code = code.replace(/const \{ totalRevenue, totalPaidRevenue, orderCount, paidCount \} = stats;[\s\S]*?<\/div>\s*<\/div>/, newCode);
fs.writeFileSync('src/app/[slug]/admin/statements/page.tsx', code);
