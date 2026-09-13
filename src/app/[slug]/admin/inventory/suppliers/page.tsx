'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Building2,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  Calendar,
  FileText,
  DollarSign,
  Edit2,
  Check,
  X,
  Loader2,
  ChevronRight,
  Boxes,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminContentWrapper } from '@/components/AdminContentWrapper';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { InventoryNav } from '@/components/modules/inventory/InventoryNav';
import { InventoryModal } from '@/components/modules/inventory/InventoryModal';
import { inventoryService } from '@/app/services/inventory.api';
import { Supplier } from '@/types/inventory';
import { formatPrice } from '@/lib/format';

export default function SuppliersPage() {
  const { slug } = useParams();
  const slugStr = Array.isArray(slug) ? slug[0] : slug;

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [outstanding, setOutstanding] = useState<number | string>(0);
  const [isActive, setIsActive] = useState(true);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await inventoryService.getSuppliers();
      if (res.success && res.data) {
        setSuppliers(res.data);
      } else {
        toast.error(res.error || 'Failed to load suppliers');
      }
    } catch {
      toast.error('Network error loading suppliers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleOpenAddModal = () => {
    setEditingSupplier(null);
    setName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setAddress('');
    setGstNumber('');
    setOutstanding(0);
    setIsActive(true);
    setModalOpen(true);
  };

  const handleOpenEditModal = (s: Supplier) => {
    setEditingSupplier(s);
    setName(s.name);
    setContactPerson(s.contact_person || '');
    setPhone(s.phone || '');
    setEmail(s.email || '');
    setAddress(s.address || '');
    setGstNumber(s.gst_number || '');
    setOutstanding(s.outstanding_balance);
    setIsActive(s.is_active);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Supplier name is required');
      return;
    }

    setSubmitting(true);
    try {
      if (editingSupplier) {
        const res = await inventoryService.updateSupplier(editingSupplier.id, {
          name: name.trim(),
          contact_person: contactPerson.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          address: address.trim() || undefined,
          gst_number: gstNumber.trim() || undefined,
          outstanding_balance: Number(outstanding || 0),
          is_active: isActive,
        });
        if (res.success) {
          toast.success(`Updated supplier ${name}!`);
          setModalOpen(false);
          fetchSuppliers();
        } else {
          toast.error(res.error || 'Failed to update supplier');
        }
      } else {
        const res = await inventoryService.createSupplier({
          name: name.trim(),
          contact_person: contactPerson.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          address: address.trim() || undefined,
          gst_number: gstNumber.trim() || undefined,
          outstanding_balance: Number(outstanding || 0),
        });
        if (res.success) {
          toast.success(`Created supplier ${name}!`);
          setModalOpen(false);
          fetchSuppliers();
        } else {
          toast.error(res.error || 'Failed to create supplier');
        }
      }
    } catch {
      toast.error('Network error saving supplier');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.contact_person && s.contact_person.toLowerCase().includes(search.toLowerCase())) ||
      (s.phone && s.phone.includes(search))
  );

  return (
    <AdminContentWrapper>
      <AdminPageHeader
        title="Suppliers Directory"
        subtitle="Manage food vendors, purchase histories, contact coordinates, and outstanding ledger balances."
        action={
          <button
            onClick={handleOpenAddModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              height: '38px',
              padding: '0 16px',
              borderRadius: '8px',
              background: 'var(--primary, #971345)',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Plus size={15} />
            <span>Add Supplier</span>
          </button>
        }
      />

      <InventoryNav />

      {/* Search Filter */}
      <div style={{ marginBottom: '20px', maxWidth: '320px' }}>
        <div style={{ position: 'relative' }}>
          <Search
            size={16}
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}
          />
          <input
            type="text"
            placeholder="Search suppliers, contact..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              height: '38px',
              padding: '0 12px 0 36px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: '#FFFFFF',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Suppliers Grid */}
      {loading ? (
        <div style={{ padding: '80px', textAlign: 'center', color: '#94A3B8' }}>
          <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 10px' }} />
          Loading suppliers...
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px dashed #CBD5E1' }}>
          <Building2 size={40} style={{ margin: '0 auto 10px', color: '#94A3B8' }} />
          <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#0F172A' }}>No suppliers found</h4>
          <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
            Click "+ Add Supplier" to register your vendor partners.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {filteredSuppliers.map((s) => (
            <div
              key={s.id}
              className="card"
              style={{
                padding: '18px',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                background: '#FFFFFF',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}
            >
              <div>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                      {s.name}
                    </h3>
                    {s.contact_person && (
                      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                        Contact: {s.contact_person}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleOpenEditModal(s)}
                    style={{
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      padding: '5px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      color: '#64748B',
                    }}
                  >
                    <Edit2 size={13} />
                  </button>
                </div>

                {/* Metrics Box */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '10px',
                    padding: '12px',
                    backgroundColor: '#F8FAFC',
                    borderRadius: '8px',
                    margin: '14px 0',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                      Products
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                      {s.products_count || 0} supplied
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                      Total Purchases
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#16A34A', marginTop: '2px' }}>
                      {formatPrice(s.total_purchases || 0)}
                    </div>
                  </div>
                </div>

                {/* Contact Coordinates */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: '#475569' }}>
                  {s.phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Phone size={13} style={{ color: '#94A3B8' }} />
                      <span>{s.phone}</span>
                    </div>
                  )}
                  {s.email && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Mail size={13} style={{ color: '#94A3B8' }} />
                      <span>{s.email}</span>
                    </div>
                  )}
                  {s.address && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPin size={13} style={{ color: '#94A3B8' }} />
                      <span>{s.address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom footer: Outstanding + Last purchase */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: '1px solid #F1F5F9',
                  paddingTop: '12px',
                  marginTop: '14px',
                  fontSize: '11px',
                }}
              >
                <span style={{ color: '#64748B' }}>
                  Last PO: {s.last_purchase_date || 'None'}
                </span>
                {Number(s.outstanding_balance) > 0 ? (
                  <span style={{ fontWeight: 700, color: '#DC2626' }}>
                    Outstanding: {formatPrice(s.outstanding_balance)}
                  </span>
                ) : (
                  <span style={{ fontWeight: 600, color: '#16A34A' }}>Settled (₹0)</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Supplier Modal */}
      <InventoryModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
        icon={<Building2 size={18} style={{ color: '#0F172A' }} />}
        maxWidth="500px"
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Company / Supplier Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Fresh Foods Ltd, Green Valley Farms"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Contact Person
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rahul Sharma"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. +91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="sales@vendor.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                    GSTIN Number
                  </label>
                  <input
                    type="text"
                    placeholder="32AAAAA0000A1Z5"
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Address / Warehouse Location
                </label>
                <input
                  type="text"
                  placeholder="Market Yard, Sector 4, Wholesale St."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Opening / Outstanding Balance (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  value={outstanding}
                  onChange={(e) => setOutstanding(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#64748B', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--primary, #971345)',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {submitting && <Loader2 size={13} className="animate-spin" />}
                  <span>{editingSupplier ? 'Save Changes' : 'Create Supplier'}</span>
                </button>
              </div>
            </form>
      </InventoryModal>
    </AdminContentWrapper>
  );
}

