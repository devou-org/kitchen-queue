'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import {
  Boxes,
  Search,
  Plus,
  Filter,
  X,
  Edit2,
  Check,
  AlertTriangle,
  ChevronRight,
  TrendingDown,
  Loader2,
  Building2,
  DollarSign,
  Layers,
  MapPin,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminContentWrapper } from '@/components/AdminContentWrapper';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { InventoryNav } from '@/components/modules/inventory/InventoryNav';
import { InventoryModal } from '@/components/modules/inventory/InventoryModal';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { inventoryService } from '@/app/services/inventory.api';
import { InventoryItem, InventoryCategory, InventoryUnit, Supplier } from '@/types/inventory';
import { formatPrice } from '@/lib/format';

export default function IngredientsPage() {
  const { slug } = useParams();
  const searchParams = useSearchParams();
  const slugStr = Array.isArray(slug) ? slug[0] : slug;

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>(searchParams.get('status') || '');

  // Add / Edit Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formUnit, setFormUnit] = useState('kg');
  const [formCurrentStock, setFormCurrentStock] = useState<number | string>(0);
  const [formMinStock, setFormMinStock] = useState<number | string>(0);
  const [formMaxStock, setFormMaxStock] = useState<number | string>('');
  const [formCostPerUnit, setFormCostPerUnit] = useState<number | string>(0);
  const [formSupplierId, setFormSupplierId] = useState('');
  const [formStorageLocation, setFormStorageLocation] = useState('');
  const [formTrackBatches, setFormTrackBatches] = useState(false);
  const [formTrackExpiry, setFormTrackExpiry] = useState(false);
  const [formIsActive, setFormIsActive] = useState(true);

  // Category creation quick popover
  const [newCatName, setNewCatName] = useState('');
  const [showAddCat, setShowAddCat] = useState(false);

  const fetchDependencies = async () => {
    try {
      const [catRes, unitRes, supRes] = await Promise.all([
        inventoryService.getCategories(),
        inventoryService.getUnits(),
        inventoryService.getSuppliers(),
      ]);
      if (catRes.success && catRes.data) setCategories(catRes.data);
      if (unitRes.success && unitRes.data) setUnits(unitRes.data);
      if (supRes.success && supRes.data) setSuppliers(supRes.data);
    } catch {
      console.error('Failed to load categories/units/suppliers');
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await inventoryService.getItems({
        category_id: selectedCategory || undefined,
        search: search.trim() || undefined,
        status: selectedStatus || undefined,
      });
      if (res.success && res.data) {
        setItems(res.data);
      } else {
        toast.error(res.error || 'Failed to load ingredients');
      }
    } catch {
      toast.error('Network error loading ingredients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDependencies();
  }, []);

  useEffect(() => {
    fetchItems();
  }, [selectedCategory, selectedStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchItems();
  };

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormName('');
    setFormCategory(categories[0]?.id || '');
    setFormUnit(units[0]?.short_code || 'kg');
    setFormCurrentStock(0);
    setFormMinStock(5);
    setFormMaxStock('');
    setFormCostPerUnit(0);
    setFormSupplierId('');
    setFormStorageLocation('');
    setFormTrackBatches(false);
    setFormTrackExpiry(false);
    setFormIsActive(true);
    setModalOpen(true);
  };

  const handleOpenEditModal = (item: InventoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingItem(item);
    setFormName(item.name);
    setFormCategory(item.category_id || '');
    setFormUnit(item.unit || 'kg');
    setFormCurrentStock(item.current_stock);
    setFormMinStock(item.min_stock);
    setFormMaxStock(item.max_stock !== undefined ? item.max_stock : '');
    setFormCostPerUnit(item.cost_per_unit);
    setFormSupplierId(item.supplier_id || '');
    setFormStorageLocation(item.storage_location || '');
    setFormTrackBatches(item.track_batches);
    setFormTrackExpiry(item.track_expiry);
    setFormIsActive(item.is_active);
    setModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Ingredient name is required');
      return;
    }

    setSaving(true);
    try {
      if (editingItem) {
        // Update
        const res = await inventoryService.updateItem(editingItem.id, {
          name: formName.trim(),
          category_id: formCategory || null,
          unit: formUnit,
          min_stock: Number(formMinStock || 0),
          max_stock: formMaxStock !== '' ? Number(formMaxStock) : null,
          cost_per_unit: Number(formCostPerUnit || 0),
          supplier_id: formSupplierId || null,
          storage_location: formStorageLocation.trim() || null,
          track_batches: formTrackBatches,
          track_expiry: formTrackExpiry,
          is_active: formIsActive,
        });
        if (res.success) {
          toast.success(`Updated ${formName}!`);
          setModalOpen(false);
          fetchItems();
        } else {
          toast.error(res.error || 'Failed to update ingredient');
        }
      } else {
        // Create
        const res = await inventoryService.createItem({
          name: formName.trim(),
          category_id: formCategory || undefined,
          unit: formUnit,
          current_stock: Number(formCurrentStock || 0),
          min_stock: Number(formMinStock || 0),
          max_stock: formMaxStock !== '' ? Number(formMaxStock) : undefined,
          cost_per_unit: Number(formCostPerUnit || 0),
          supplier_id: formSupplierId || undefined,
          storage_location: formStorageLocation.trim() || undefined,
          track_batches: formTrackBatches,
          track_expiry: formTrackExpiry,
        });
        if (res.success) {
          toast.success(`Added ${formName}!`);
          setModalOpen(false);
          fetchItems();
        } else {
          toast.error(res.error || 'Failed to create ingredient');
        }
      }
    } catch {
      toast.error('Network error saving ingredient');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickAddCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      const res = await inventoryService.createCategory(newCatName.trim());
      if (res.success && res.data) {
        toast.success(`Category "${newCatName}" added!`);
        setCategories((prev) => [...prev, res.data!]);
        setFormCategory(res.data.id);
        setNewCatName('');
        setShowAddCat(false);
      } else {
        toast.error(res.error || 'Failed to add category');
      }
    } catch {
      toast.error('Failed to add category');
    }
  };

  return (
    <AdminContentWrapper>
      <AdminPageHeader
        title="Ingredients Master"
        subtitle="Manage raw food materials, minimum stock alerts, suppliers, and portion units."
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
            <span>Add Ingredient</span>
          </button>
        }
      />

      <InventoryNav />

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        {/* Search */}
        <form
          onSubmit={handleSearchSubmit}
          style={{
            position: 'relative',
            width: '280px',
            maxWidth: '100%',
          }}
        >
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94A3B8',
            }}
          />
          <input
            type="text"
            placeholder="Search ingredients, storage..."
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
            }}
          />
        </form>

        {/* Filter Dropdowns */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Category */}
          <CustomSelect
            style={{ width: '190px' }}
            buttonStyle={{ height: '38px', borderRadius: '8px', fontSize: '13px' }}
            value={selectedCategory}
            onChange={(val) => setSelectedCategory(val)}
            options={[
              { value: '', label: 'All Categories' },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />

          {/* Stock Status */}
          <CustomSelect
            style={{ width: '170px' }}
            buttonStyle={{ height: '38px', borderRadius: '8px', fontSize: '13px' }}
            value={selectedStatus}
            onChange={(val) => setSelectedStatus(val)}
            options={[
              { value: '', label: 'All Stock Levels' },
              { value: 'IN_STOCK', label: 'In Stock' },
              { value: 'LOW_STOCK', label: 'Low Stock' },
              { value: 'OUT_OF_STOCK', label: 'Out of Stock' },
            ]}
          />

          {(search || selectedCategory || selectedStatus) && (
            <button
              onClick={() => {
                setSearch('');
                setSelectedCategory('');
                setSelectedStatus('');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                height: '38px',
                padding: '0 10px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#64748B',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              <X size={14} />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Ingredients Grid / Table */}
      {loading ? (
        <div style={{ padding: '80px', textAlign: 'center', color: '#94A3B8' }}>
          <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 10px' }} />
          Loading ingredients master...
        </div>
      ) : items.length === 0 ? (
        <div
          style={{
            padding: '60px 20px',
            textAlign: 'center',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px dashed #CBD5E1',
          }}
        >
          <Boxes size={40} style={{ margin: '0 auto 12px', color: '#94A3B8' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
            No ingredients found
          </h3>
          <p style={{ fontSize: '13px', color: '#64748B', marginTop: '6px' }}>
            Get started by clicking "+ Add Ingredient" to track raw food items.
          </p>
          <button
            onClick={handleOpenAddModal}
            style={{
              marginTop: '14px',
              padding: '8px 16px',
              borderRadius: '8px',
              background: 'var(--primary, #971345)',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            + Add First Ingredient
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '14px',
          }}
        >
          {items.map((item) => {
            const isOut = item.current_stock <= 0;
            const isLow = !isOut && item.current_stock <= item.min_stock;

            let badgeBg = '#F0FDF4';
            let badgeColor = '#16A34A';
            let badgeText = 'In Stock';

            if (isOut) {
              badgeBg = '#FEF2F2';
              badgeColor = '#DC2626';
              badgeText = 'Out of Stock';
            } else if (isLow) {
              badgeBg = '#FFFBEB';
              badgeColor = '#D97706';
              badgeText = 'Low Stock';
            }

            return (
              <Link
                key={item.id}
                href={`/${slugStr}/admin/inventory/ingredients/${item.id}`}
                prefetch={false}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '16px',
                  borderRadius: '12px',
                  border: isOut
                    ? '1px solid #FECACA'
                    : isLow
                    ? '1px solid #FED7AA'
                    : '1px solid var(--border)',
                  backgroundColor: '#FFFFFF',
                  textDecoration: 'none',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                <div>
                  {/* Top Bar: Name & Status */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                    <div>
                      <h4
                        style={{
                          fontSize: '15px',
                          fontWeight: 800,
                          color: '#0F172A',
                          margin: 0,
                        }}
                      >
                        {item.name}
                      </h4>
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: '#64748B',
                          marginTop: '3px',
                        }}
                      >
                        {item.category_name || 'Uncategorized'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          backgroundColor: badgeBg,
                          color: badgeColor,
                        }}
                      >
                        {badgeText}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleOpenEditModal(item, e)}
                        title="Edit Ingredient"
                        style={{
                          background: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                          padding: '5px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          color: '#64748B',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Edit2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Stock Metrics Details */}
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
                        Current Stock
                      </div>
                      <div
                        style={{
                          fontSize: '16px',
                          fontWeight: 800,
                          color: isOut ? '#DC2626' : isLow ? '#D97706' : '#0F172A',
                          marginTop: '2px',
                        }}
                      >
                        {item.current_stock} <span style={{ fontSize: '12px', fontWeight: 600 }}>{item.unit}</span>
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                        Min Threshold
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#475569', marginTop: '2px' }}>
                        {item.min_stock} <span style={{ fontSize: '12px', fontWeight: 600 }}>{item.unit}</span>
                      </div>
                    </div>
                  </div>

                  {/* Meta Specs */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: '#475569' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>Cost per {item.unit}:</span>
                      <span style={{ fontWeight: 700, color: '#0F172A' }}>{formatPrice(item.cost_per_unit)}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>Total Stock Value:</span>
                      <span style={{ fontWeight: 700, color: '#16A34A' }}>
                        {formatPrice(item.current_stock * item.cost_per_unit)}
                      </span>
                    </div>

                    {item.storage_location && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748B', marginTop: '2px' }}>
                        <MapPin size={12} />
                        <span>{item.storage_location}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom detail action link */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '4px',
                    paddingTop: '12px',
                    borderTop: '1px solid #F1F5F9',
                    marginTop: '12px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#2563EB',
                  }}
                >
                  <span>View Ledger & Batches</span>
                  <ChevronRight size={14} />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Add / Edit Ingredient Modal */}
      <InventoryModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? 'Edit Ingredient' : 'Add New Ingredient'}
        icon={<Boxes size={20} style={{ color: '#2563EB' }} />}
        maxWidth="600px"
      >
        <form onSubmit={handleSaveItem} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Ingredient Name */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Ingredient Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chicken Breast, Bun, Mozzarella, Olive Oil"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Category & Unit */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                      Category
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAddCat(!showAddCat)}
                      style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: '10px', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                    >
                      + New
                    </button>
                  </div>
                  <CustomSelect
                    buttonStyle={{ height: '38px', borderRadius: '8px', fontSize: '13px' }}
                    value={formCategory}
                    onChange={(val) => setFormCategory(val)}
                    placeholder="Select Category"
                    options={[
                      { value: '', label: 'Select Category' },
                      ...categories.map((c) => ({ value: c.id, label: c.name })),
                    ]}
                  />

                  {/* Inline quick create category */}
                  {showAddCat && (
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                      <input
                        type="text"
                        placeholder="Category Name"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        style={{ flex: 1, padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '11px' }}
                      />
                      <button
                        type="button"
                        onClick={handleQuickAddCategory}
                        style={{ padding: '6px 10px', background: '#2563EB', color: 'white', borderRadius: '6px', border: 'none', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Add
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Measurement Unit *
                  </label>
                  <CustomSelect
                    buttonStyle={{ height: '38px', borderRadius: '8px', fontSize: '13px' }}
                    value={formUnit}
                    onChange={(val) => setFormUnit(val)}
                    options={units.map((u) => ({
                      value: u.short_code,
                      label: `${u.name} (${u.short_code})`,
                    }))}
                  />
                </div>
              </div>

              {/* Stock Numbers: Current Stock (if new), Min Stock, Max Stock */}
              <div style={{ display: 'grid', gridTemplateColumns: editingItem ? '1fr 1fr' : '1fr 1fr 1fr', gap: '10px' }}>
                {!editingItem && (
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Initial Stock
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={formCurrentStock}
                      onChange={(e) => setFormCurrentStock(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        fontSize: '13px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Min Stock Threshold *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={formMinStock}
                    onChange={(e) => setFormMinStock(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Max Stock (Optional)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="e.g. 50"
                    value={formMaxStock}
                    onChange={(e) => setFormMaxStock(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Cost Per Unit & Supplier */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Cost Per Unit (₹) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={formCostPerUnit}
                    onChange={(e) => setFormCostPerUnit(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Preferred Supplier
                  </label>
                  <CustomSelect
                    buttonStyle={{ height: '38px', borderRadius: '8px', fontSize: '13px' }}
                    value={formSupplierId}
                    onChange={(val) => setFormSupplierId(val)}
                    placeholder="None / Multiple"
                    options={[
                      { value: '', label: 'None / Multiple' },
                      ...suppliers.map((s) => ({ value: s.id, label: s.name })),
                    ]}
                  />
                </div>
              </div>

              {/* Storage Location */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Storage Location (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Deep Freezer 1, Dry Storage Shelf A, Bar Chiller"
                  value={formStorageLocation}
                  onChange={(e) => setFormStorageLocation(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Tracking Flags */}
              <div
                style={{
                  display: 'flex',
                  gap: '20px',
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                }}
              >
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#0F172A', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formTrackBatches}
                    onChange={(e) => setFormTrackBatches(e.target.checked)}
                  />
                  Batch Tracking
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#0F172A', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formTrackExpiry}
                    onChange={(e) => setFormTrackExpiry(e.target.checked)}
                  />
                  Expiry Tracking
                </label>

                {editingItem && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#0F172A', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                    />
                    Active Item
                  </label>
                )}
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#64748B',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: 'var(--primary, #971345)',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  <span>{editingItem ? 'Save Changes' : 'Create Ingredient'}</span>
                </button>
              </div>
            </form>
      </InventoryModal>
    </AdminContentWrapper>
  );
}
