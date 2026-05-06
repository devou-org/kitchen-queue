interface OtpModalProps {
  phone: string;
  otpCode: string;
  setOtpCode: (code: string) => void;
  verifyingOtp: boolean;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  onClose: () => void;
}

export default function OtpModal({ 
  phone, 
  otpCode, 
  setOtpCode, 
  verifyingOtp, 
  loading, 
  onSubmit, 
  onClose 
}: OtpModalProps) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 999,
      padding: '20px'
    }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px', animation: 'scaleIn 0.2s ease-out' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '8px', fontSize: '18px' }}>Verify your phone</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
          We sent a 6-digit code to <span style={{ fontWeight: 600 }}>{phone}</span>
        </p>
        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <input
              type="text"
              className="input"
              placeholder="Enter 6-digit code"
              value={otpCode}
              onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              style={{ textAlign: 'center', fontSize: '24px', letterSpacing: '4px', fontWeight: 600 }}
              maxLength={6}
              autoFocus
              required
            />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              style={{ flex: 1 }}
              disabled={verifyingOtp || loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ flex: 2 }}
              disabled={verifyingOtp || otpCode.length !== 6 || loading}
            >
              {verifyingOtp || loading ? (
                <><span className="loader" style={{ width: 16, height: 16, borderWidth: 2 }} /> Verifying...</>
              ) : 'Verify'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
