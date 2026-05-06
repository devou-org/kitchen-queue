interface CustomerDetailsProps {
  form: {
    customer_name: string;
    phone: string;
    party_size: string;
    notes: string;
  };
  setForm: React.Dispatch<React.SetStateAction<{
    customer_name: string;
    phone: string;
    party_size: string;
    notes: string;
  }>>;
  isVerified: boolean;
  loading: boolean;
  handleVerifyClick: () => Promise<void>;
  onSubmit: (e: React.FormEvent) => void;
}

export default function CustomerDetails({ 
  form, 
  setForm, 
  isVerified, 
  loading, 
  handleVerifyClick,
  onSubmit 
}: CustomerDetailsProps) {
  return (
    <form onSubmit={onSubmit} id="new-order-form">
      <div className="card">
        <h3 style={{ fontWeight: 700, marginBottom: '18px', fontSize: '16px' }}>👤 Your Details</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="label">Full Name *</label>
            <input
              type="text"
              className="input"
              placeholder="Enter your name"
              value={form.customer_name}
              onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
              maxLength={50}
              required
            />
          </div>
          <div>
            <label className="label">Phone Number *</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="tel"
                className="input"
                placeholder="+91 9xxxxxxxxx"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                style={{ flex: 1 }}
                required
              />
              {isVerified ? (
                <span style={{ 
                  color: '#10B981', background: 'rgba(16, 185, 129, 0.1)', 
                  padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 700 
                }}>
                  ✅ Verified
                </span>
              ) : (
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={handleVerifyClick}
                  disabled={loading || form.phone.replace(/\D/g, '').length < 10}
                  style={{ padding: '0 16px', height: '48px' }}
                >
                  Verify
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="label">Number of Persons *</label>
            <select
              className="select"
              value={form.party_size}
              onChange={e => setForm(f => ({ ...f, party_size: e.target.value }))}
              required
            >
              <option value="" disabled>Select persons</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                <option key={n} value={n}>{n} Party</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </form>
  );
}
