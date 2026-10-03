'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { 
  Plus, Trash2, Edit2, ShieldAlert, Key, UserCheck, UserX, 
  Smartphone, Mail, Shield, CheckSquare, Square, Store, ClipboardList, 
  LayoutGrid, UtensilsCrossed, Boxes, BarChart3, Users, Receipt, Settings,
  CheckCircle2, Info, Search, X
} from 'lucide-react';
import { AdminContentWrapper } from '@/components/AdminContentWrapper';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { LayoutMaximizeToggle } from '@/components/LayoutMaximizeToggle';
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
  const [searchQuery, setSearchQuery] = useState('');
  
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

    const payload = { ...staffFormData };
    if (isEdit && !payload.password?.trim()) {
      delete (payload as any).password;
    }

    try {
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'x-restaurant-slug': slug as string
        },
        body: JSON.stringify(payload)
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

  const filteredStaffs = staffs.filter(staff => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = (staff.name || '').toLowerCase();
    const email = (staff.email || '').toLowerCase();
    const phone = (staff.phone || '').toLowerCase();
    const role = (staff.role_name || staff.role || '').toLowerCase();
    return name.includes(q) || email.includes(q) || phone.includes(q) || role.includes(q);
  });

  const filteredRoles = roles.filter(role => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = (role.name || '').toLowerCase();
    const desc = (role.description || '').toLowerCase();
    return name.includes(q) || desc.includes(q);
  });

  return (
    <>
      <AdminContentWrapper fullWidth style={{ paddingTop: 0, paddingLeft: 0, paddingRight: 0, maxWidth: '100%' }}>
        <style>{`
          .staff-page-header,
          .staff-page-header.admin-page-header-container {
            height: 68px !important;
            min-height: 68px !important;
            display: flex !important;
            align-items: stretch !important;
            margin: 0 !important;
            padding: 0 20px 0 0 !important;
            border-bottom: 1px solid var(--border) !important;
            background: #FFFFFF !important;
            box-sizing: border-box !important;
            position: relative !important;
          }

          .staff-page-header .admin-page-header-container {
            height: 68px !important;
            min-height: 68px !important;
            display: flex !important;
            align-items: stretch !important;
            margin: 0 !important;
            padding: 0 !important;
            gap: 12px !important;
            width: 100% !important;
          }

          .staff-page-header .admin-header-left,
          .staff-page-header .admin-header-search {
            height: 68px !important;
            display: flex !important;
            align-items: stretch !important;
            flex-wrap: nowrap !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .staff-toolbar {
            display: flex !important;
            flex-wrap: nowrap !important;
            align-items: stretch !important;
            justify-content: space-between !important;
            gap: 12px !important;
            width: 100% !important;
            height: 68px !important;
            min-width: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .staff-tabs-wrapper {
            display: flex !important;
            align-items: stretch !important;
            height: 68px !important;
            min-height: 68px !important;
            padding-top: 10px !important;
            padding-right: 0 !important;
            padding-bottom: 0 !important;
            padding-left: 0 !important;
            box-sizing: border-box !important;
            flex-shrink: 0 !important;
            margin: 0 !important;
          }

          .staff-nav-scroll {
            display: flex;
            align-items: stretch;
            gap: 0;
            overflow-x: auto;
            overscroll-behavior-x: contain;
            -webkit-overflow-scrolling: touch;
            touch-action: pan-x;
            border-top: none;
            height: 100%;
            min-height: auto;
            padding: 0;
            margin: 0;
            scrollbar-width: none;
            -ms-overflow-style: none;
            box-sizing: border-box;
            position: relative;
          }
          .staff-nav-scroll::-webkit-scrollbar {
            display: none;
          }

          .staff-nav-item {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            height: 100%;
            min-height: auto;
            box-sizing: border-box;
            padding: 0 24px;
            border-radius: 0;
            font-size: 14.5px;
            font-weight: 500;
            color: #475569;
            text-decoration: none;
            white-space: nowrap;
            flex-shrink: 0;
            cursor: pointer;
            user-select: none;
            touch-action: manipulation;
            -webkit-tap-highlight-color: transparent;
            border: none;
            border-top: 3.5px solid transparent;
            margin-top: 0;
            background-color: transparent;
            transition: all 0.15s ease-in-out;
          }
          .staff-nav-item:hover:not(.staff-nav-item--active) {
            color: #0F172A;
            background-color: rgba(0, 0, 0, 0.035);
          }
          .staff-nav-item--active {
            font-weight: 600;
            color: var(--primary, #971345);
            background-color: rgba(151, 19, 69, 0.08);
            background-color: color-mix(in srgb, var(--primary, #971345) 9%, transparent);
            border-top: 3.5px solid var(--primary, #971345);
          }

          .staff-nav-badge {
            font-size: 11px;
            font-weight: 700;
            padding: 1px 7px;
            border-radius: 999px;
            background: #F1F5F9;
            color: #64748B;
            transition: all 0.15s ease;
          }
          .staff-nav-item--active .staff-nav-badge {
            background: color-mix(in srgb, var(--primary, #971345) 16%, transparent);
            color: var(--primary, #971345);
          }

          .staff-actions {
            display: flex !important;
            flex-wrap: nowrap !important;
            align-items: center !important;
            gap: 10px !important;
            margin-left: auto !important;
            flex-shrink: 0 !important;
            height: 68px !important;
          }

          .staff-search-control {
            position: relative;
            width: 220px;
            min-width: 140px;
            max-width: 280px;
            flex-shrink: 0;
          }

          .staff-table {
            width: 100%;
            border-collapse: collapse;
            min-width: 680px;
          }

          .roles-table {
            width: 100%;
            border-collapse: collapse;
            min-width: 640px;
          }

          @media (max-width: 768px) {
            .staff-page-header,
            .staff-page-header.admin-page-header-container {
              height: auto !important;
              min-height: auto !important;
              padding: 0 !important;
              margin: 0 !important;
              display: flex !important;
              flex-direction: column !important;
              align-items: stretch !important;
              border-bottom: 1px solid var(--border) !important;
              background: #FFFFFF !important;
            }

            .staff-page-header .admin-page-header-container,
            .staff-page-header .admin-header-left,
            .staff-page-header .admin-header-search {
              height: auto !important;
              min-height: auto !important;
              width: 100% !important;
              display: flex !important;
              flex-direction: column !important;
              align-items: stretch !important;
              padding: 0 !important;
              margin: 0 !important;
            }

            .staff-toolbar {
              flex-direction: column !important;
              align-items: stretch !important;
              gap: 0 !important;
              height: auto !important;
              min-height: auto !important;
              width: 100% !important;
              padding: 0 !important;
              margin: 0 !important;
            }

            .staff-tabs-wrapper {
              width: 100% !important;
              height: 44px !important;
              min-height: 44px !important;
              padding: 0 !important;
              border-bottom: 1px solid var(--border) !important;
              box-sizing: border-box !important;
              background: #FFFFFF !important;
              overflow-x: auto !important;
            }

            .staff-nav-scroll {
              height: 44px !important;
              min-height: 44px !important;
              width: 100% !important;
            }

            .staff-nav-item {
              height: 44px !important;
              min-height: 44px !important;
              padding: 0 16px !important;
              font-size: 13px !important;
            }

            .staff-actions {
              width: 100% !important;
              height: auto !important;
              min-height: auto !important;
              margin-left: 0 !important;
              padding: 10px 14px !important;
              background: #F8FAFC !important;
              border-bottom: 1px solid var(--border) !important;
              box-sizing: border-box !important;
              display: flex !important;
              flex-direction: column !important;
              align-items: stretch !important;
              gap: 8px !important;
            }

            .staff-search-control {
              width: 100% !important;
              max-width: 100% !important;
              min-width: 0 !important;
            }

            .staff-actions button[type="button"] {
              width: 100% !important;
              justify-content: center !important;
              height: 38px !important;
            }

            .staff-maximize-wrapper {
              display: none !important;
            }

            .staff-table {
              min-width: 600px !important;
            }

            .roles-table {
              min-width: 580px !important;
            }

            .staff-table th,
            .staff-table td,
            .roles-table th,
            .roles-table td {
              padding: 12px 12px !important;
            }

            .table-wrapper {
              overflow-x: auto !important;
              -webkit-overflow-scrolling: touch !important;
              width: 100% !important;
              max-width: 100% !important;
            }
          }
        `}</style>
        <AdminPageHeader
          className="staff-page-header"
          style={{ paddingTop: 0, marginBottom: 0 }}
          hideMaximize={true}
          search={
            <div className="staff-toolbar">
              {/* Left Side (Starting): Tabs starting flush from left */}
              <div className="staff-tabs-wrapper">
                <div className="staff-nav-scroll">
                  <button
                    type="button"
                    onClick={() => setActiveTab('staff')}
                    className={`staff-nav-item ${activeTab === 'staff' ? 'staff-nav-item--active' : ''}`}
                  >
                    <span>Staff Members</span>
                    <span className="staff-nav-badge">{staffs.length}/6</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('roles')}
                    className={`staff-nav-item ${activeTab === 'roles' ? 'staff-nav-item--active' : ''}`}
                  >
                    <span>Roles & Permissions</span>
                    <span className="staff-nav-badge">{roles.length}</span>
                  </button>
                </div>
              </div>

              {/* Right Side: Search + Add Action + Maximize Toggle */}
              <div className="staff-actions">
                <div className="staff-search-control">
                  <Search
                    size={14}
                    style={{
                      position: 'absolute',
                      left: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#94A3B8',
                      pointerEvents: 'none',
                    }}
                  />
                  <input
                    type="text"
                    placeholder={activeTab === 'staff' ? 'Search staff name, email...' : 'Search roles...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      height: '38px',
                      paddingLeft: '30px',
                      paddingRight: searchQuery ? '26px' : '8px',
                      fontSize: '12px',
                      borderRadius: '8px',
                      background: 'white',
                      border: '1px solid var(--border)',
                      width: '100%',
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                      outline: 'none',
                      color: 'var(--text-primary)',
                      boxSizing: 'border-box',
                    }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      style={{
                        position: 'absolute',
                        right: '6px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#94A3B8',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {activeTab === 'staff' ? (
                  <button
                    type="button"
                    onClick={() => openStaffModal()}
                    disabled={staffs.length >= 6}
                    style={{
                      height: '38px',
                      padding: '0 14px',
                      borderRadius: '8px',
                      background: 'var(--primary, #971345)',
                      color: '#FFFFFF',
                      fontSize: '12px',
                      fontWeight: 700,
                      border: 'none',
                      cursor: staffs.length >= 6 ? 'not-allowed' : 'pointer',
                      opacity: staffs.length >= 6 ? 0.5 : 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease',
                    }}
                    title={staffs.length >= 6 ? 'Maximum staff limit reached (6 max)' : 'Add Staff Member'}
                  >
                    <Plus size={15} />
                    <span>Add Staff Member</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => openRoleModal()}
                    style={{
                      height: '38px',
                      padding: '0 14px',
                      borderRadius: '8px',
                      background: 'var(--primary, #971345)',
                      color: '#FFFFFF',
                      fontSize: '12px',
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Plus size={15} />
                    <span>Create New Role</span>
                  </button>
                )}

                <div className="staff-maximize-wrapper" style={{ borderLeft: '1px solid #E2E8F0', paddingLeft: '8px', display: 'flex', alignItems: 'center', height: '32px' }}>
                  <LayoutMaximizeToggle />
                </div>
              </div>
            </div>
          }
        />

        <div style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', margin: 0, padding: 0 }}>
          {loading ? (
            <div style={{ padding: '80px', display: 'flex', justifyContent: 'center' }}>
              <div className="loader" />
            </div>
          ) : activeTab === 'staff' ? (
            /* ============================================
               STAFF MEMBERS TAB
               ============================================ */
            <div style={{ width: '100%', background: '#FFFFFF', borderBottom: '1px solid var(--border)', overflowX: 'auto', borderRadius: 0, margin: 0, padding: 0 }}>
              <div className="table-wrapper" style={{ border: 'none', borderRadius: 0, overflowX: 'auto', width: '100%' }}>
                <table className="staff-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ paddingLeft: '20px' }}>Member Name</th>
                      <th>Email</th>
                      <th>Assigned Role</th>
                      <th>Allowed Modules</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'center', width: '110px', paddingRight: '20px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStaffs.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          {searchQuery ? 'No staff members match your search criteria.' : 'No staff members found. Add your first team member to grant access!'}
                        </td>
                      </tr>
                    ) : (
                      filteredStaffs.map(staff => {
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
                          <tr key={staff.id}>
                            <td style={{ paddingLeft: '20px' }}>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>{staff.name}</div>
                              {staff.phone && (
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                  <Smartphone size={11} /> {staff.phone}
                                </div>
                              )}
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-primary)' }}>
                                <Mail size={13} style={{ color: 'var(--text-secondary)' }} />
                                <span>{staff.email}</span>
                              </div>
                            </td>
                            <td>
                              <span style={{ 
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 8px', 
                                borderRadius: '6px', 
                                fontSize: '11px', 
                                fontWeight: 700,
                                background: displayRole.toLowerCase().includes('admin') ? '#EEF2FF' : displayRole.toLowerCase().includes('kitchen') ? '#FEF3C7' : '#ECFDF5', 
                                color: displayRole.toLowerCase().includes('admin') ? '#4F46E5' : displayRole.toLowerCase().includes('kitchen') ? '#D97706' : '#059669'
                              }}>
                                <Shield size={11} />
                                <span>{displayRole}</span>
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '320px' }}>
                                {perms.map(p => {
                                  const mod = ADMIN_MODULES.find(m => m.key === p);
                                  const IconComp = MODULE_ICONS[p] || Shield;
                                  return (
                                    <span key={p} style={{
                                      fontSize: '11px',
                                      padding: '2px 7px',
                                      borderRadius: '6px',
                                      background: '#F1F5F9',
                                      border: '1px solid #E2E8F0',
                                      color: '#475569',
                                      fontWeight: 500,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      whiteSpace: 'nowrap'
                                    }}>
                                      <IconComp size={10} style={{ color: 'var(--primary, #971345)' }} />
                                      <span>{mod?.name || p}</span>
                                    </span>
                                  );
                                })}
                              </div>
                            </td>
                            <td>
                              <span style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '4px',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 700,
                                background: staff.is_active ? '#ECFDF5' : '#FEF2F2',
                                color: staff.is_active ? '#059669' : '#DC2626'
                              }}>
                                {staff.is_active ? <UserCheck size={12} /> : <UserX size={12} />}
                                <span>{staff.is_active ? 'Active' : 'Inactive'}</span>
                              </span>
                            </td>
                            <td style={{ textAlign: 'center', paddingRight: '20px' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                <button
                                  type="button"
                                  onClick={() => openStaffModal(staff)}
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    background: '#F8FAFC',
                                    border: '1px solid #E2E8F0',
                                    color: '#475569',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    padding: 0,
                                    transition: 'all 0.15s ease'
                                  }}
                                  title="Edit Staff Member"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  type="button"
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
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* ============================================
               ROLES & PERMISSIONS TAB (TABLE FORMAT)
               ============================================ */
            <div style={{ width: '100%', background: '#FFFFFF', borderBottom: '1px solid var(--border)', overflowX: 'auto', borderRadius: 0, margin: 0, padding: 0 }}>
              <div className="table-wrapper" style={{ border: 'none', borderRadius: 0, overflowX: 'auto', width: '100%' }}>
                <table className="roles-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ width: '22%', paddingLeft: '20px' }}>Role</th>
                      <th style={{ width: '28%' }}>Description</th>
                      <th style={{ width: '32%' }}>Allowed Modules</th>
                      <th style={{ width: '10%' }}>Assigned</th>
                      <th style={{ textAlign: 'center', width: '110px', paddingRight: '20px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRoles.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          {searchQuery ? 'No roles match your search criteria.' : 'No roles configured yet. Click "Create New Role" to add one!'}
                        </td>
                      </tr>
                    ) : (
                      filteredRoles.map(role => {
                        let perms: string[] = [];
                        if (Array.isArray(role.permissions)) {
                          perms = role.permissions;
                        } else if (typeof role.permissions === 'string') {
                          try { perms = JSON.parse(role.permissions); } catch (e) { perms = []; }
                        }

                        return (
                          <tr key={role.id}>
                            <td style={{ paddingLeft: '20px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{
                                  width: '28px', height: '28px',
                                  borderRadius: '6px',
                                  background: '#EEF2FF',
                                  color: '#4F46E5',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  flexShrink: 0
                                }}>
                                  <Shield size={14} />
                                </div>
                                <div>
                                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
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

                            <td style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.4 }}>
                              {role.description || '—'}
                            </td>

                            <td>
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
                                      padding: '2px 7px',
                                      borderRadius: '6px',
                                      background: '#F1F5F9',
                                      border: '1px solid #E2E8F0',
                                      color: '#334155',
                                      fontWeight: 500,
                                      whiteSpace: 'nowrap'
                                    }}>
                                      <IconComp size={10} style={{ color: 'var(--primary, #971345)' }} />
                                      <span>{mod?.name || key}</span>
                                    </span>
                                  );
                                })}
                              </div>
                            </td>

                            <td>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 600,
                                background: '#F8FAFC',
                                border: '1px solid #E2E8F0',
                                color: 'var(--text-primary)',
                                whiteSpace: 'nowrap'
                              }}>
                                <Users size={12} style={{ color: 'var(--text-secondary)' }} />
                                <span>{role.staff_count || 0} active</span>
                              </span>
                            </td>

                            <td style={{ textAlign: 'center', paddingRight: '20px' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                <button
                                  type="button"
                                  onClick={() => openRoleModal(role)}
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    background: '#F8FAFC',
                                    border: '1px solid #E2E8F0',
                                    color: '#475569',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    padding: 0,
                                    transition: 'all 0.15s ease'
                                  }}
                                  title="Edit Role"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  type="button"
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
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </AdminContentWrapper>

      {/* ============================================
         ADD / EDIT STAFF MODAL (COMPACT)
         ============================================ */}
      {isStaffModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          zIndex: 100,
          backdropFilter: 'blur(4px)',
          overflowY: 'auto'
        }}>
          <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
            <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '18px 20px', borderRadius: '14px', background: 'white', border: '1px solid var(--border)', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  {editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}
                </h2>
                <button
                  type="button"
                  onClick={() => setIsStaffModalOpen(false)}
                  style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--text-secondary)', lineHeight: 1, padding: '4px' }}
                >
                  ✕
                </button>
              </div>
              <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: '0 0 12px 0', lineHeight: 1.35 }}>
                Staff members can log directly into this Admin Portal with their assigned role permissions.
              </p>

              {staffErrorMsg && (
                <div style={{ background: '#ef444415', color: '#ef4444', padding: '8px 10px', borderRadius: '8px', marginBottom: '10px', display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px' }}>
                  <ShieldAlert size={15} /> {staffErrorMsg}
                </div>
              )}

              <form onSubmit={handleStaffSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '3px', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-primary)' }}>Full Name</label>
                  <input
                    type="text" required
                    value={staffFormData.name} 
                    onChange={e => setStaffFormData({ ...staffFormData, name: e.target.value })}
                    className="input"
                    placeholder="e.g. Rahul Sharma"
                    style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12.5px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '3px', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-primary)' }}>Email Address (Login Username)</label>
                  <input
                    type="email" required
                    value={staffFormData.email} 
                    onChange={e => setStaffFormData({ ...staffFormData, email: e.target.value })}
                    className="input"
                    placeholder="e.g. rahul@restaurant.com"
                    style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12.5px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '3px', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-primary)' }}>Phone Number (Optional)</label>
                  <input
                    type="text"
                    value={staffFormData.phone} 
                    onChange={e => setStaffFormData({ ...staffFormData, phone: e.target.value })}
                    className="input"
                    placeholder="e.g. +919876543210"
                    style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12.5px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '3px', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Password {editingStaff ? '(Leave blank to keep current)' : ''}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="password" required={!editingStaff}
                      value={staffFormData.password} 
                      onChange={e => setStaffFormData({ ...staffFormData, password: e.target.value })}
                      className="input"
                      placeholder={editingStaff ? '••••••••' : 'Enter login password'}
                      style={{ width: '100%', height: '34px', padding: '0 10px 0 28px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12.5px', boxSizing: 'border-box' }}
                    />
                    <Key size={14} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  </div>
                </div>

                {/* Role Selector Dropdown */}
                <div>
                  <label style={{ display: 'block', marginBottom: '3px', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
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
                    style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', fontSize: '12.5px', boxSizing: 'border-box' }}
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
                      marginTop: '6px',
                      padding: '7px 9px',
                      borderRadius: '8px',
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0'
                    }}>
                      <div style={{ fontSize: '10.5px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Info size={12} /> Modules accessible:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                        {selectedRolePermissions.map(key => {
                          const mod = ADMIN_MODULES.find(m => m.key === key);
                          return (
                            <span key={key} style={{
                              fontSize: '10px',
                              padding: '1px 6px',
                              borderRadius: '4px',
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

                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '2px' }}>
                  <input
                    type="checkbox"
                    id="staff_is_active"
                    checked={staffFormData.is_active}
                    onChange={e => setStaffFormData({ ...staffFormData, is_active: e.target.checked })}
                    style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                  />
                  <label htmlFor="staff_is_active" style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', cursor: 'pointer' }}>
                    Active Account (Allows logging in)
                  </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setIsStaffModalOpen(false)} style={{ height: '34px', padding: '0 14px', borderRadius: '8px', fontSize: '12.5px' }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ height: '34px', padding: '0 16px', borderRadius: '8px', fontWeight: 600, fontSize: '12.5px' }}>
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
