'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { 
  Plus, Trash2, Edit2, ShieldAlert, Key, UserCheck, UserX, 
  Smartphone, Mail, Shield, CheckSquare, Square, Store, ClipboardList, 
  LayoutGrid, UtensilsCrossed, Boxes, BarChart3, Users, Receipt, Settings,
  CheckCircle2, Info
} from 'lucide-react';
import { AdminContentWrapper } from '@/components/AdminContentWrapper';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { ADMIN_MODULES } from '@/lib/admin-modules';
import toast from 'react-hot-toast';

const MODULE_ICONS: Record<string, any> = {
  pos: Store,
  orders: ClipboardList,
  tables: LayoutGrid,
  products: UtensilsCrossed,
  inventory: Boxes,
  analytics: BarChart3,
  staff: Users,
  billing: Receipt,
  settings: Settings,
};

export default function StaffAdminPage() {
  const { slug } = useParams();
  const [activeTab, setActiveTab] = useState<'staff' | 'roles'>('staff');
  
  // Staff state
  const [staffs, setStaffs] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [staffErrorMsg, setStaffErrorMsg] = useState('');
  const [staffFormData, setStaffFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role_id: '',
    role: 'STAFF',
    is_active: true
  });

  // Role state
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<any>(null);
  const [roleErrorMsg, setRoleErrorMsg] = useState('');
  const [roleFormData, setRoleFormData] = useState({
    name: '',
    description: '',
    permissions: [] as string[]
  });

  const fetchData = async () => {
    try {
      const [staffRes, rolesRes] = await Promise.all([
        fetch('/api/admin/staff', { headers: { 'x-restaurant-slug': slug as string } }),
        fetch('/api/admin/roles', { headers: { 'x-restaurant-slug': slug as string } })
      ]);

      const staffData = await staffRes.json();
      const rolesData = await rolesRes.json();

      if (staffData.success) {
        setStaffs(staffData.data || []);
      }
      if (rolesData.success) {
        setRoles(rolesData.data || []);
      }
    } catch (err) {
      console.error('Error fetching staff and roles data:', err);
      toast.error('Failed to load staff and roles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (slug) {
      fetchData();
    }
  }, [slug]);

  // ============================================
  // STAFF HANDLERS
  // ============================================

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffErrorMsg('');
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
        body: JSON.stringify(staffFormData)
      });
      const data = await res.json();

      if (data.success) {
        toast.success(isEdit ? 'Staff member updated' : 'Staff member created');
        setIsStaffModalOpen(false);
        fetchData();
      } else {
        setStaffErrorMsg(data.error || 'Failed to save staff member');
      }
    } catch (err: any) {
      setStaffErrorMsg(err.message || 'Network error occurred');
    }
  };

  const handleStaffDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this staff member?')) return;
    try {
      const res = await fetch(`/api/admin/staff/${id}`, { 
        method: 'DELETE',
        headers: { 'x-restaurant-slug': slug as string }
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Staff member deleted');
        fetchData();
      } else {
        toast.error(data.error || 'Failed to delete staff member');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error occurred');
    }
  };

  const openStaffModal = (staff?: any) => {
    if (staff) {
      setEditingStaff(staff);
      setStaffFormData({
        name: staff.name,
        email: staff.email,
        phone: staff.phone || '',
        password: '',
        role_id: staff.role_id || '',
        role: staff.role || 'STAFF',
        is_active: staff.is_active !== false
      });
    } else {
      setEditingStaff(null);
      const defaultRole = roles.find(r => r.name.toLowerCase().includes('waiter')) || roles[0];
      setStaffFormData({ 
        name: '', 
        email: '', 
        phone: '', 
        password: '', 
        role_id: defaultRole ? defaultRole.id : '',
        role: defaultRole ? defaultRole.name : 'STAFF', 
        is_active: true 
      });
    }
    setStaffErrorMsg('');
    setIsStaffModalOpen(true);
  };

  // ============================================
  // ROLE HANDLERS
  // ============================================

  const handleRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRoleErrorMsg('');
    if (!roleFormData.name.trim()) {
      setRoleErrorMsg('Role name is required');
      return;
    }
    if (roleFormData.permissions.length === 0) {
      setRoleErrorMsg('Select at least one module permission for this role');
      return;
    }

    const isEdit = !!editingRole;
    const url = isEdit ? `/api/admin/roles/${editingRole.id}` : '/api/admin/roles';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-restaurant-slug': slug as string
        },
        body: JSON.stringify(roleFormData)
      });
      const data = await res.json();

      if (data.success) {
        toast.success(isEdit ? 'Role updated successfully' : 'New role created');
        setIsRoleModalOpen(false);
        fetchData();
      } else {
        setRoleErrorMsg(data.error || 'Failed to save role');
      }
    } catch (err: any) {
      setRoleErrorMsg(err.message || 'Network error occurred');
    }
  };

  const handleRoleDelete = async (role: any) => {
    if (role.staff_count > 0) {
      alert(`Cannot delete role "${role.name}" because ${role.staff_count} staff member(s) are currently assigned to it. Please reassign them first.`);
      return;
    }
    if (!confirm(`Are you sure you want to delete the role "${role.name}"?`)) return;

    try {
      const res = await fetch(`/api/admin/roles/${role.id}`, {
        method: 'DELETE',
        headers: { 'x-restaurant-slug': slug as string }
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Role deleted successfully');
        fetchData();
      } else {
        toast.error(data.error || 'Failed to delete role');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error occurred');
    }
  };

  const openRoleModal = (role?: any) => {
    if (role) {
      setEditingRole(role);
      let perms: string[] = [];
      if (Array.isArray(role.permissions)) {
        perms = role.permissions;
      } else if (typeof role.permissions === 'string') {
        try { perms = JSON.parse(role.permissions); } catch (e) { perms = []; }
      }
      setRoleFormData({
        name: role.name,
        description: role.description || '',
        permissions: perms
      });
    } else {
      setEditingRole(null);
      setRoleFormData({
        name: '',
        description: '',
        permissions: ['pos', 'orders', 'tables']
      });
    }
    setRoleErrorMsg('');
    setIsRoleModalOpen(true);
  };

  const togglePermission = (moduleKey: string) => {
    setRoleFormData(prev => {
      const exists = prev.permissions.includes(moduleKey);
      if (exists) {
        return { ...prev, permissions: prev.permissions.filter(k => k !== moduleKey) };
      } else {
        return { ...prev, permissions: [...prev.permissions, moduleKey] };
      }
    });
  };

  const selectAllPermissions = () => {
    setRoleFormData(prev => ({
      ...prev,
      permissions: ADMIN_MODULES.map(m => m.key)
    }));
  };

  const clearAllPermissions = () => {
    setRoleFormData(prev => ({ ...prev, permissions: [] }));
  };

  // Find currently selected role in staff modal to preview permissions
  const selectedStaffRole = roles.find(r => r.id === staffFormData.role_id);
  const selectedRolePermissions: string[] = selectedStaffRole
    ? (Array.isArray(selectedStaffRole.permissions)
      ? selectedStaffRole.permissions
      : typeof selectedStaffRole.permissions === 'string'
        ? JSON.parse(selectedStaffRole.permissions || '[]')
        : [])
    : [];

  return (
    <>
      <AdminContentWrapper>
        {/* Header with Sub-tab Switcher and Action Button */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Staff & Roles Management
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
                Control team access, configure custom roles, and assign granular module permissions.
              </p>
            </div>

            {activeTab === 'staff' ? (
              <button
                className="btn btn-primary"
                onClick={() => openStaffModal()}
                disabled={staffs.length >= 6}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  fontWeight: 600,
                  borderRadius: '12px',
                  opacity: staffs.length >= 6 ? 0.5 : 1,
                  cursor: staffs.length >= 6 ? 'not-allowed' : 'pointer'
                }}
                title={staffs.length >= 6 ? 'Maximum staff limit reached (6 max)' : 'Add Staff'}
              >
                <Plus size={18} /> Add Staff Member
              </button>
            ) : (
              <button
                className="btn btn-primary"
                onClick={() => openRoleModal()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  fontWeight: 600,
                  borderRadius: '12px'
                }}
              >
                <Plus size={18} /> Create New Role
              </button>
            )}
          </div>

          {/* Sub Navigation Tabs */}
          <div style={{
            display: 'inline-flex',
            background: '#F1F5F9',
            padding: '4px',
            borderRadius: '12px',
            alignSelf: 'flex-start',
            gap: '4px'
          }}>
            <button
              onClick={() => setActiveTab('staff')}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'staff' ? 'white' : 'transparent',
                color: activeTab === 'staff' ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: activeTab === 'staff' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.15s ease'
              }}
            >
              <Users size={16} /> Staff Members
              <span style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '999px',
                background: activeTab === 'staff' ? '#EEF2FF' : '#E2E8F0',
                color: activeTab === 'staff' ? '#4F46E5' : '#64748B'
              }}>
                {staffs.length}/6
              </span>
            </button>

            <button
              onClick={() => setActiveTab('roles')}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'roles' ? 'white' : 'transparent',
                color: activeTab === 'roles' ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: activeTab === 'roles' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.15s ease'
              }}
            >
              <Shield size={16} /> Roles & Permissions
              <span style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '999px',
                background: activeTab === 'roles' ? '#EEF2FF' : '#E2E8F0',
                color: activeTab === 'roles' ? '#4F46E5' : '#64748B'
              }}>
                {roles.length}
              </span>
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '80px', display: 'flex', justifyContent: 'center' }}>
            <div className="loader" />
          </div>
        ) : activeTab === 'staff' ? (
          /* ============================================
             STAFF MEMBERS TAB
             ============================================ */
          <div className="card" style={{ overflowX: 'auto', borderRadius: '14px', border: '1px solid var(--border)', background: 'white' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: '#F9FAFB' }}>
                  <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px' }}>Member Name</th>
                  <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px' }}>Email</th>
                  <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px' }}>Assigned Role</th>
                  <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px' }}>Allowed Modules</th>
                  <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px' }}>Status</th>
                  <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px', textAlign: 'center', width: '110px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {staffs.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No staff members found. Add your first team member to grant access!
                    </td>
                  </tr>
                ) : staffs.map(staff => {
                  let perms: string[] = [];
                  if (staff.role_permissions) {
                    perms = Array.isArray(staff.role_permissions)
                      ? staff.role_permissions
                      : typeof staff.role_permissions === 'string'
                        ? JSON.parse(staff.role_permissions)
                        : [];
                  } else if (staff.role === 'KITCHEN') {
                    perms = ['orders'];
                  } else {
                    perms = ['pos', 'orders', 'tables'];
                  }

                  const displayRole = staff.role_name || staff.role || 'Staff';

                  return (
                    <tr key={staff.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}>
                      <td style={{ padding: '16px 18px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>{staff.name}</div>
                        {staff.phone && (
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
                            <Smartphone size={12} /> {staff.phone}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '16px 18px', color: 'var(--text-primary)', fontSize: '13px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Mail size={14} style={{ color: 'var(--text-secondary)' }} />
                          {staff.email}
                        </div>
                      </td>
                      <td style={{ padding: '16px 18px' }}>
                        <span style={{ 
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '4px 10px', 
                          borderRadius: '8px', 
                          fontSize: '12px', 
                          fontWeight: 600,
                          background: displayRole.toLowerCase().includes('admin') ? '#EEF2FF' : displayRole.toLowerCase().includes('kitchen') ? '#FEF3C7' : '#ECFDF5', 
                          color: displayRole.toLowerCase().includes('admin') ? '#4F46E5' : displayRole.toLowerCase().includes('kitchen') ? '#D97706' : '#059669'
                        }}>
                          <Shield size={12} />
                          {displayRole}
                        </span>
                      </td>
                      <td style={{ padding: '16px 18px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '300px' }}>
                          {perms.map(p => {
                            const mod = ADMIN_MODULES.find(m => m.key === p);
                            return (
                              <span key={p} style={{
                                fontSize: '11px',
                                padding: '2px 7px',
                                borderRadius: '6px',
                                background: '#F1F5F9',
                                color: '#475569',
                                fontWeight: 500
                              }}>
                                {mod?.name || p}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td style={{ padding: '16px 18px' }}>
                        <span style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '6px',
                          fontSize: '13px',
                          fontWeight: 500,
                          color: staff.is_active ? '#059669' : 'var(--text-secondary)'
                        }}>
                          {staff.is_active ? <UserCheck size={16} /> : <UserX size={16} />}
                          {staff.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '16px 18px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                          <button
                            onClick={() => openStaffModal(staff)}
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              background: '#F8FAFC',
                              border: '1px solid #E2E8F0',
                              color: 'var(--text-primary)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              padding: 0,
                              transition: 'all 0.15s ease'
                            }}
                            title="Edit Staff Member"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => handleStaffDelete(staff.id)}
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              background: '#FEF2F2',
                              border: '1px solid #FEE2E2',
                              color: '#DC2626',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              padding: 0,
                              transition: 'all 0.15s ease'
                            }}
                            title="Delete Staff Member"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* ============================================
             ROLES & PERMISSIONS TAB (TABLE FORMAT)
             ============================================ */
          <div className="card" style={{ overflowX: 'auto', borderRadius: '14px', border: '1px solid var(--border)', background: 'white' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: '#F9FAFB' }}>
                  <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px', width: '22%' }}>Role</th>
                  <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px', width: '28%' }}>Description</th>
                  <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px', width: '32%' }}>Allowed Modules</th>
                  <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px', width: '10%' }}>Assigned</th>
                  <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px', textAlign: 'center', width: '110px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No roles configured yet. Click "Create New Role" to add one!
                    </td>
                  </tr>
                ) : roles.map(role => {
                  let perms: string[] = [];
                  if (Array.isArray(role.permissions)) {
                    perms = role.permissions;
                  } else if (typeof role.permissions === 'string') {
                    try { perms = JSON.parse(role.permissions); } catch (e) { perms = []; }
                  }

                  return (
                    <tr key={role.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}>
                      <td style={{ padding: '16px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '28px', height: '28px',
                            borderRadius: '6px',
                            background: '#EEF2FF',
                            color: '#4F46E5',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <Shield size={15} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>
                              {role.name}
                            </div>
                            {role.is_default && (
                              <span style={{ fontSize: '10px', color: '#4F46E5', fontWeight: 600, background: '#EEF2FF', padding: '1px 6px', borderRadius: '4px' }}>
                                System Default
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '16px 18px', color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.4 }}>
                        {role.description || '—'}
                      </td>

                      <td style={{ padding: '16px 18px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {perms.length === 0 ? (
                            <span style={{ fontSize: '12px', color: '#94A3B8', fontStyle: 'italic' }}>No modules granted</span>
                          ) : perms.map(key => {
                            const mod = ADMIN_MODULES.find(m => m.key === key);
                            const IconComp = MODULE_ICONS[key] || Shield;
                            return (
                              <span key={key} style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '11px',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                background: '#F1F5F9',
                                border: '1px solid #E2E8F0',
                                color: '#334155',
                                fontWeight: 500,
                                whiteSpace: 'nowrap'
                              }}>
                                <IconComp size={11} style={{ color: 'var(--primary)' }} />
                                {mod?.name || key}
                              </span>
                            );
                          })}
                        </div>
                      </td>

                      <td style={{ padding: '16px 18px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 600,
                          background: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap'
                        }}>
                          <Users size={12} style={{ color: 'var(--text-secondary)' }} />
                          {role.staff_count || 0} active
                        </span>
                      </td>

                      <td style={{ padding: '16px 18px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                          <button
                            onClick={() => openRoleModal(role)}
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              background: '#F8FAFC',
                              border: '1px solid #E2E8F0',
                              color: 'var(--text-primary)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              padding: 0,
                              transition: 'all 0.15s ease'
                            }}
                            title="Edit Role"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => handleRoleDelete(role)}
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              background: '#FEF2F2',
                              border: '1px solid #FEE2E2',
                              color: '#DC2626',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              padding: 0,
                              transition: 'all 0.15s ease'
                            }}
                            title="Delete Role"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AdminContentWrapper>

      {/* ============================================
         ADD / EDIT STAFF MODAL
         ============================================ */}
      {isStaffModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          zIndex: 100,
          backdropFilter: 'blur(4px)',
          overflowY: 'auto'
        }}>
          <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div className="card" style={{ width: '100%', maxWidth: '520px', padding: '26px', borderRadius: '18px', background: 'white', border: '1px solid var(--border)', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
                {editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '18px' }}>
                Staff members can log directly into this Admin Portal and will only see the tabs permitted by their assigned role.
              </p>

              {staffErrorMsg && (
                <div style={{ background: '#ef444415', color: '#ef4444', padding: '12px', borderRadius: '10px', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center', fontSize: '14px' }}>
                  <ShieldAlert size={18} /> {staffErrorMsg}
                </div>
              )}

              <form onSubmit={handleStaffSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Full Name</label>
                  <input
                    type="text" required
                    value={staffFormData.name} 
                    onChange={e => setStaffFormData({ ...staffFormData, name: e.target.value })}
                    className="input"
                    placeholder="e.g. Rahul Sharma"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Email Address (Login Username)</label>
                  <input
                    type="email" required
                    value={staffFormData.email} 
                    onChange={e => setStaffFormData({ ...staffFormData, email: e.target.value })}
                    className="input"
                    placeholder="e.g. rahul@restaurant.com"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Phone Number (Optional)</label>
                  <input
                    type="text"
                    value={staffFormData.phone} 
                    onChange={e => setStaffFormData({ ...staffFormData, phone: e.target.value })}
                    className="input"
                    placeholder="e.g. +919876543210"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Password {editingStaff ? '(Leave blank to keep current)' : ''}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="password" required={!editingStaff}
                      value={staffFormData.password} 
                      onChange={e => setStaffFormData({ ...staffFormData, password: e.target.value })}
                      className="input"
                      placeholder={editingStaff ? '••••••••' : 'Enter login password'}
                      style={{ width: '100%', padding: '10px 12px 10px 34px', borderRadius: '10px', border: '1px solid var(--border)' }}
                    />
                    <Key size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  </div>
                </div>

                {/* Role Selector Dropdown */}
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Assign Role & Module Permissions
                  </label>
                  <select
                    className="input"
                    value={staffFormData.role_id}
                    onChange={e => {
                      const selRole = roles.find(r => r.id === e.target.value);
                      setStaffFormData({
                        ...staffFormData,
                        role_id: e.target.value,
                        role: selRole ? selRole.name : 'STAFF'
                      });
                    }}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'white' }}
                  >
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>

                  {/* Interactive Preview of Granted Modules */}
                  {selectedRolePermissions.length > 0 && (
                    <div style={{
                      marginTop: '10px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0'
                    }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Info size={13} /> Modules accessible by this role:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {selectedRolePermissions.map(key => {
                          const mod = ADMIN_MODULES.find(m => m.key === key);
                          return (
                            <span key={key} style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: '#E2E8F0',
                              color: '#1E293B',
                              fontWeight: 500
                            }}>
                              {mod?.name || key}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <input
                    type="checkbox"
                    id="staff_is_active"
                    checked={staffFormData.is_active}
                    onChange={e => setStaffFormData({ ...staffFormData, is_active: e.target.checked })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label htmlFor="staff_is_active" style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', cursor: 'pointer' }}>
                    Active Account (Allows logging in)
                  </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '14px' }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setIsStaffModalOpen(false)} style={{ padding: '10px 16px', borderRadius: '10px' }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ padding: '10px 20px', borderRadius: '10px', fontWeight: 600 }}>
                    {editingStaff ? 'Save Changes' : 'Create Staff Member'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ============================================
         ADD / EDIT ROLE MODAL (COMPACT)
         ============================================ */}
      {isRoleModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          zIndex: 100,
          backdropFilter: 'blur(4px)',
          overflowY: 'auto'
        }}>
          <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
            <div className="card" style={{ width: '100%', maxWidth: '460px', padding: '22px', borderRadius: '16px', background: 'white', border: '1px solid var(--border)', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  {editingRole ? 'Edit Role & Permissions' : 'Create Custom Role'}
                </h2>
                <button
                  type="button"
                  onClick={() => setIsRoleModalOpen(false)}
                  style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--text-secondary)', lineHeight: 1, padding: '4px' }}
                >
                  ✕
                </button>
              </div>

              {roleErrorMsg && (
                <div style={{ background: '#ef444415', color: '#ef4444', padding: '10px 12px', borderRadius: '8px', marginBottom: '12px', display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px' }}>
                  <ShieldAlert size={16} /> {roleErrorMsg}
                </div>
              )}

              <form onSubmit={handleRoleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Role Name
                  </label>
                  <input
                    type="text" required
                    value={roleFormData.name}
                    onChange={e => setRoleFormData({ ...roleFormData, name: e.target.value })}
                    className="input"
                    placeholder="e.g. Waiter, Barista, Captain, Cashier"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={roleFormData.description}
                    onChange={e => setRoleFormData({ ...roleFormData, description: e.target.value })}
                    className="input"
                    placeholder="e.g. Handles customer table orders and billing"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}
                  />
                </div>

                {/* Module Permissions Checkbox Grid - Clean & Compact */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                      Permissions ({roleFormData.permissions.length}/{ADMIN_MODULES.length})
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={selectAllPermissions}
                        style={{ fontSize: '11.5px', color: 'var(--primary)', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Select All
                      </button>
                      <span style={{ color: '#CBD5E1', fontSize: '11px' }}>•</span>
                      <button
                        type="button"
                        onClick={clearAllPermissions}
                        style={{ fontSize: '11.5px', color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                    {ADMIN_MODULES.map(mod => {
                      const isChecked = roleFormData.permissions.includes(mod.key);
                      const IconComp = MODULE_ICONS[mod.key] || Shield;

                      return (
                        <div
                          key={mod.key}
                          onClick={() => togglePermission(mod.key)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: `1.5px solid ${isChecked ? 'var(--primary)' : '#E2E8F0'}`,
                            background: isChecked ? 'rgba(var(--primary-rgb, 79, 70, 229), 0.05)' : '#FAFAFA',
                            cursor: 'pointer',
                            userSelect: 'none',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ color: isChecked ? 'var(--primary)' : '#94A3B8', display: 'flex', alignItems: 'center' }}>
                            {isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                          </div>
                          <IconComp size={14} style={{ color: isChecked ? 'var(--primary)' : 'var(--text-secondary)', flexShrink: 0 }} />
                          <span style={{
                            fontWeight: isChecked ? 600 : 500,
                            fontSize: '12px',
                            color: isChecked ? 'var(--text-primary)' : '#475569',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {mod.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setIsRoleModalOpen(false)} style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '13px' }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ padding: '8px 18px', borderRadius: '8px', fontWeight: 600, fontSize: '13px' }}>
                    {editingRole ? 'Save Changes' : 'Create Role'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
