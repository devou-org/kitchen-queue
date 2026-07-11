'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Plus, Trash2, Edit2, ShieldAlert, Key, UserCheck, UserX, Smartphone, Mail, Shield } from 'lucide-react';
import { AdminContentWrapper } from '@/components/AdminContentWrapper';
import { AdminPageHeader } from '@/components/AdminPageHeader';

export default function StaffAdminPage() {
  const { slug } = useParams();
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
    role: 'STAFF',
    is_active: true
  });

  const fetchStaffs = async () => {
    try {
      const res = await fetch('/api/admin/staff', {
        headers: { 'x-restaurant-slug': slug as string }
      });
      const data = await res.json();
      if (data.success) {
        setStaffs(data.data);
      }
    } catch (err) {
      console.error('Error fetching staff:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (slug) {
      fetchStaffs();
    }
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const isEdit = !!editingStaff;
    const url = isEdit ? `/api/admin/staff/${editingStaff.id}` : '/api/admin/staff';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'x-restaurant-slug': slug as string
        },
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
      const res = await fetch(`/api/admin/staff/${id}`, { 
        method: 'DELETE',
        headers: { 'x-restaurant-slug': slug as string }
      });
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
        role: staff.role || 'STAFF',
        is_active: staff.is_active !== false
      });
    } else {
      setEditingStaff(null);
      setFormData({ name: '', email: '', phone: '', password: '', role: 'STAFF', is_active: true });
    }
    setErrorMsg('');
    setIsModalOpen(true);
  };

  return (
    <AdminContentWrapper>
      <AdminPageHeader
        title="Staff Management"
        description="Manage your kitchen staff, waiters, and general restaurant operators."
        action={
          <button
            className="btn btn-primary"
            onClick={() => openModal()}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontWeight: 600 }}
          >
            <Plus size={18} /> Add Staff
          </button>
        }
      />

      {loading ? (
        <div style={{ padding: '60px', display: 'flex', justifyContent: 'center' }}><div className="loader" /></div>
      ) : (
        <div className="card" style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border)', background: 'white' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: '#F9FAFB' }}>
                <th style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px' }}>Name</th>
                <th style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px' }}>Email</th>
                <th style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px' }}>Role</th>
                <th style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px' }}>Status</th>
                <th style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {staffs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No staff members found. Add your first team member!
                  </td>
                </tr>
              ) : staffs.map(staff => (
                <tr key={staff.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{staff.name}</div>
                    {staff.phone && (
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                        <Smartphone size={12} /> {staff.phone}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '16px', color: 'var(--text-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Mail size={14} style={{ color: 'var(--text-secondary)' }} />
                      {staff.email}
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{ 
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px', 
                      borderRadius: '6px', 
                      fontSize: '12px', 
                      fontWeight: 600,
                      background: staff.role === 'ADMIN' ? '#EEF2FF' : staff.role === 'KITCHEN' ? '#FEF3C7' : '#ECFDF5', 
                      color: staff.role === 'ADMIN' ? '#4F46E5' : staff.role === 'KITCHEN' ? '#D97706' : '#059669'
                    }}>
                      <Shield size={12} />
                      {staff.role}
                    </span>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '6px',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: staff.is_active ? 'var(--success)' : 'var(--text-secondary)'
                    }}>
                      {staff.is_active ? <UserCheck size={16} /> : <UserX size={16} />}
                      {staff.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    <button
                      onClick={() => openModal(staff)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', marginRight: '16px', padding: '4px' }}
                      title="Edit Staff"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(staff.id)}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                      title="Delete Staff"
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
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          backdropFilter: 'blur(4px)'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '24px', borderRadius: '16px', background: 'white', border: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>
              {editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}
            </h2>

            {errorMsg && (
              <div style={{ background: '#ef444415', color: '#ef4444', padding: '12px', borderRadius: '8px', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center', fontSize: '14px' }}>
                <ShieldAlert size={18} /> {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Full Name</label>
                <input
                  type="text" required
                  value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="e.g. John Doe"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Email Address</label>
                <input
                  type="email" required
                  value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="input"
                  placeholder="e.g. john@restaurant.com"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Phone Number (Optional)</label>
                <input
                  type="text"
                  value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className="input"
                  placeholder="e.g. +919876543210"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Password {editingStaff ? '(Leave blank to keep current)' : ''}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="password" required={!editingStaff}
                    value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })}
                    className="input"
                    placeholder={editingStaff ? '••••••••' : 'Password'}
                    style={{ width: '100%', padding: '10px 10px 10px 32px', borderRadius: '8px', border: '1px solid var(--border)' }}
                  />
                  <Key size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                </div>
              </div>



              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="is_active" style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', cursor: 'pointer' }}>
                  Active Account (Allows logging in)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)} style={{ padding: '10px 16px', borderRadius: '8px' }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ padding: '10px 16px', borderRadius: '8px', fontWeight: 600 }}>
                  {editingStaff ? 'Save Changes' : 'Create Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminContentWrapper>
  );
}
