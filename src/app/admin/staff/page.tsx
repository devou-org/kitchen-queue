'use client';
import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, ShieldAlert } from 'lucide-react';

export default function StaffAdminPage() {
  const [staffs, setStaffs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'KITCHEN'
  });

  const fetchStaffs = async () => {
    try {
      const res = await fetch('/api/admin/staff');
      const data = await res.json();
      if (data.success) {
        setStaffs(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffs();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const isEdit = !!editingStaff;
    const url = isEdit ? `/api/admin/staff/${editingStaff.id}` : '/api/admin/staff';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (data.success) {
        setIsModalOpen(false);
        fetchStaffs();
      } else {
        setErrorMsg(data.error || 'Failed to save staff');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error occurred');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this staff member?')) return;
    try {
      const res = await fetch(`/api/admin/staff/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchStaffs();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openModal = (staff?: any) => {
    if (staff) {
      setEditingStaff(staff);
      setFormData({
        name: staff.name,
        email: staff.email,
        phone: staff.phone || '',
        password: '', // leave empty unless they want to change
        role: staff.role
      });
    } else {
      setEditingStaff(null);
      setFormData({ name: '', email: '', phone: '', password: '', role: 'KITCHEN' });
    }
    setErrorMsg('');
    setIsModalOpen(true);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Staff Management</h1>
        <button 
          className="btn btn-primary" 
          onClick={() => openModal()}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={18} /> Add Staff
        </button>
      </div>

      {loading ? (
        <div>Loading staffs...</div>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Name</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Email</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Role</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Status</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {staffs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No staff members found.
                  </td>
                </tr>
              ) : staffs.map(staff => (
                <tr key={staff.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: 600 }}>{staff.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{staff.phone}</div>
                  </td>
                  <td style={{ padding: '16px' }}>{staff.email}</td>
                  <td style={{ padding: '16px' }}>
                    <span className="badge" style={{ background: 'var(--primary)', color: '#fff' }}>
                      {staff.role}
                    </span>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{ color: staff.is_active ? 'var(--success)' : 'var(--text-secondary)' }}>
                      {staff.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    <button 
                      onClick={() => openModal(staff)} 
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', marginRight: '16px' }}
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(staff.id)} 
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '24px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>
              {editingStaff ? 'Edit Staff' : 'Add New Staff'}
            </h2>
            
            {errorMsg && (
              <div style={{ background: '#ef444420', color: '#ef4444', padding: '12px', borderRadius: '8px', marginBottom: '16px', display: 'flex', gap: '8px' }}>
                <ShieldAlert size={18} /> {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>Name</label>
                <input 
                  type="text" required
                  value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                  className="input"
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>Email</label>
                <input 
                  type="email" required
                  value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
                  className="input"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>Phone (Optional)</label>
                <input 
                  type="text"
                  value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}
                  className="input"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                  Password {editingStaff && '(Leave blank to keep current)'}
                </label>
                <input 
                  type="password" required={!editingStaff}
                  value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})}
                  className="input"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>Role</label>
                <select 
                  value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}
                  className="select"
                >
                  <option value="KITCHEN">Kitchen Staff</option>
                  <option value="CASHIER">Cashier / Waiter</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingStaff ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
