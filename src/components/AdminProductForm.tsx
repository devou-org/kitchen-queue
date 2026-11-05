'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Product, ProductVariant, CustomizationGroup, CustomizationOption } from '@/types';
import { InventoryItem } from '@/types/inventory';
import { inventoryService } from '@/app/services/inventory.api';
import { useRestaurant } from '@/hooks/useRestaurant';
import { X, UtensilsCrossed, ChefHat, Tag, Plus, Check, ImageIcon, Layers, ArrowLeft, ArrowUpDown, Loader2, Sliders, Trash2, Boxes, Copy } from 'lucide-react';
import Link from 'next/link';
import { CategoryReorderModal } from '@/components/modules/products/CategoryReorderModal';
import { ProductImageUploader } from '@/components/modules/products/ProductImageUploader';
import { ReuseCustomizationModal } from '@/components/modules/products/ReuseCustomizationModal';
import { CustomSelect } from '@/components/ui/CustomSelect';

interface Category {
  id: string;
  name: string;
}

interface AdminProductFormProps {
  initialData?: Product;
  onSuccess?: () => void;
  onCancel?: () => void;
  isModal?: boolean;
}

export default function AdminProductForm({ initialData, onSuccess, onCancel, isModal = false }: AdminProductFormProps) {
  const router = useRouter();
  const { slug } = useParams();
  const isEditing = !!initialData;
  const { restaurant } = useRestaurant();
  const showOnlineOrdering = restaurant?.modules?.ONLINE_ORDERING !== false;
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [counters, setCounters] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [showAddCounter, setShowAddCounter] = useState(false);
  const [newCounterName, setNewCounterName] = useState('');
  const [addingCounter, setAddingCounter] = useState(false);
  const [reorderModalOpen, setReorderModalOpen] = useState(false);
  const [reuseModalOpen, setReuseModalOpen] = useState(false);

  const [form, setForm] = useState({
    name: initialData?.name || '',
    description: initialData?.description || '',
    category: initialData?.category || '',
    price: initialData?.price?.toString() || '',
    stock_quantity: initialData?.stock_quantity?.toString() || '0',
    buffer_quantity: initialData?.buffer_quantity?.toString() || '0',
    image_url: initialData?.image_url || '',
    dietary_preference: initialData?.dietary_preference || 'NON_VEG',
    counter: initialData?.counter || '',
  });

  const [hasCustomizations, setHasCustomizations] = useState<boolean>(
    Boolean(
      initialData?.has_customizations ||
      (Array.isArray(initialData?.variants) && initialData.variants.length > 0) ||
      (Array.isArray(initialData?.customization_groups) && initialData.customization_groups.length > 0)
    )
  );

  const [variants, setVariants] = useState<ProductVariant[]>(
    Array.isArray(initialData?.variants) ? initialData.variants : []
  );

  const [customizationGroups, setCustomizationGroups] = useState<CustomizationGroup[]>(
    Array.isArray(initialData?.customization_groups) ? initialData.customization_groups : []
  );

  useEffect(() => {
    fetchCategories();
    fetchCounters();
    fetchInventoryItems();
  }, []);

  const fetchInventoryItems = async () => {
    try {
      const res = await inventoryService.getItems({ is_active: true });
      if (res.success && Array.isArray(res.data)) {
        setInventoryItems(res.data);
      }
    } catch (err) {
      console.error('Failed to load inventory items', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const currentSlug = (Array.isArray(slug) ? slug[0] : (slug || '')).replace(/[\[\]'"]/g, '').trim();
      const res = await fetch(`/api/categories?slug=${encodeURIComponent(currentSlug)}`, {
        headers: {
          'x-restaurant-slug': currentSlug,
          'Authorization': `Bearer ${localStorage.getItem('admin_token') || localStorage.getItem('staff_token') || localStorage.getItem('auth_token') || ''}`
        },
        cache: 'no-store'
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setCategories(data.data);
        // If the currently selected category was deleted, clear the selection
        // so the stale value cannot be written back to the DB on next save
        // and accidentally re-trigger the auto-sync that would resurrect it.
        setForm(prev => {
          const stillExists = (data.data as Array<{ id: string; name: string }>).some(
            (c) => c.name.toLowerCase() === prev.category.toLowerCase()
          );
          return stillExists ? prev : { ...prev, category: '' };
        });
      }
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  };

  const fetchCounters = async () => {
    try {
      const currentSlug = (Array.isArray(slug) ? slug[0] : (slug || '')).replace(/[\[\]'"]/g, '').trim();
      const res = await fetch('/api/counters', {
        headers: {
          'x-restaurant-slug': currentSlug,
          'Authorization': `Bearer ${localStorage.getItem('admin_token') || localStorage.getItem('staff_token') || ''}`
        }
      });
      const data = await res.json();
      if (data.success && data.data) {
        setCounters(data.data);
      }
    } catch (err) {
      console.error('Failed to load counters', err);
    }
  };

  const handleAddCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;

    if (categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('Category already exists');
      return;
    }

    setAddingCategory(true);
    try {
      const currentSlug = (Array.isArray(slug) ? slug[0] : (slug || '')).replace(/[\[\]'"]/g, '').trim();
      const res = await fetch(`/api/categories?slug=${encodeURIComponent(currentSlug)}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token') || localStorage.getItem('staff_token') || localStorage.getItem('auth_token') || ''}`,
          'x-restaurant-slug': currentSlug
        },
        body: JSON.stringify({ name: trimmed }),
        cache: 'no-store'
      });
      const data = await res.json();
      if (data.success) {
        await fetchCategories();
        setForm(f => ({ ...f, category: data.data?.name || trimmed }));
        setNewCategoryName('');
        setShowAddCategory(false);
        toast.success(`Category "${trimmed}" added`);
      } else {
        toast.error(data.error || 'Failed to add category');
      }
    } catch {
      toast.error('Error adding category');
    } finally {
      setAddingCategory(false);
    }
  };

  const handleAddCounter = async () => {
    const trimmed = newCounterName.trim();
    if (!trimmed) return;

    if (counters.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('Counter already exists');
      return;
    }

    setAddingCounter(true);
    try {
      const res = await fetch('/api/counters', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token') || localStorage.getItem('staff_token') || localStorage.getItem('auth_token')}`,
          'x-restaurant-slug': (Array.isArray(slug) ? slug[0] : (slug || '')) as string
        },
        body: JSON.stringify({ name: trimmed }),
        cache: 'no-store'
      });
      const data = await res.json();
      if (data.success) {
        setCounters(prev => [...prev, data.data].sort((a,b) => (a.name || '').localeCompare(b.name || '')));
        setForm(f => ({ ...f, counter: data.data.name }));
        setNewCounterName('');
        setShowAddCounter(false);
        toast.success('Counter added');
      } else {
        toast.error(data.error || 'Failed to add counter');
      }
    } catch {
      toast.error('Error adding counter');
    } finally {
      setAddingCounter(false);
    }
  };

  // --- Variant Handlers ---
  const handleAddVariant = () => {
    const defaultPrice = parseFloat(form.price) || 0;
    const newVariant: ProductVariant = {
      id: `var_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name: '',
      price: defaultPrice,
      stock_quantity: null,
      recipe_multiplier: 1.0,
      inventory_item_id: null,
      inventory_deduct_qty: null,
      is_default: variants.length === 0,
    };
    setVariants(prev => [...prev, newVariant]);
  };

  const handleUpdateVariant = (index: number, field: keyof ProductVariant, value: any) => {
    setVariants(prev => {
      const updated = [...prev];
      if (field === 'is_default' && value === true) {
        return updated.map((v, i) => ({
          ...v,
          is_default: i === index,
        }));
      }
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveVariant = (index: number) => {
    setVariants(prev => {
      const removed = prev[index];
      const next = prev.filter((_, i) => i !== index);
      if (removed?.is_default && next.length > 0) {
        next[0].is_default = true;
      }
      return next;
    });
  };

  // --- Customization Group Handlers ---
  const handleAddCustomizationGroup = () => {
    const newGroup: CustomizationGroup = {
      id: `grp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name: '',
      min_selection: 0,
      max_selection: 1,
      options: [
        {
          id: `opt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          name: '',
          price: 0,
          stock_quantity: null,
          inventory_item_id: null,
          inventory_deduct_qty: null,
          inventory_unit: null,
          is_default: false,
        },
      ],
    };
    setCustomizationGroups(prev => [...prev, newGroup]);
  };

  const handleUpdateGroup = (groupIndex: number, field: keyof CustomizationGroup, value: any) => {
    setCustomizationGroups(prev => {
      const updated = [...prev];
      updated[groupIndex] = { ...updated[groupIndex], [field]: value };
      return updated;
    });
  };

  const handleRemoveGroup = (groupIndex: number) => {
    setCustomizationGroups(prev => prev.filter((_, i) => i !== groupIndex));
  };

  const handleAddOption = (groupIndex: number) => {
    setCustomizationGroups(prev => {
      const updated = [...prev];
      const grp = updated[groupIndex];
      const newOption: CustomizationOption = {
        id: `opt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        name: '',
        price: 0,
        stock_quantity: null,
        inventory_item_id: null,
        inventory_deduct_qty: null,
        inventory_unit: null,
        is_default: false,
      };
      updated[groupIndex] = {
        ...grp,
        options: [...grp.options, newOption],
      };
      return updated;
    });
  };

  const handleUpdateOption = (groupIndex: number, optionIndex: number, field: keyof CustomizationOption, value: any) => {
    setCustomizationGroups(prev => {
      const updated = [...prev];
      const grp = updated[groupIndex];
      const updatedOptions = [...grp.options];
      updatedOptions[optionIndex] = { ...updatedOptions[optionIndex], [field]: value };
      updated[groupIndex] = { ...grp, options: updatedOptions };
      return updated;
    });
  };

  const handleRemoveOption = (groupIndex: number, optionIndex: number) => {
    setCustomizationGroups(prev => {
      const updated = [...prev];
      const grp = updated[groupIndex];
      updated[groupIndex] = {
        ...grp,
        options: grp.options.filter((_, i) => i !== optionIndex),
      };
      return updated;
    });
  };

  const handleReuseGroup = (templateGroup: CustomizationGroup) => {
    const newGroup: CustomizationGroup = {
      id: `grp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name: templateGroup.name,
      min_selection: templateGroup.min_selection,
      max_selection: templateGroup.max_selection,
      options: (templateGroup.options || []).map(opt => ({
        id: `opt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        name: opt.name,
        price: opt.price,
        stock_quantity: opt.stock_quantity !== undefined ? opt.stock_quantity : null,
        inventory_item_id: opt.inventory_item_id || null,
        inventory_deduct_qty: opt.inventory_deduct_qty ? Number(opt.inventory_deduct_qty) : null,
        inventory_unit: opt.inventory_unit || null,
        is_default: Boolean(opt.is_default),
      })),
    };

    setCustomizationGroups(prev => [...prev, newGroup]);
    setHasCustomizations(true);
    setReuseModalOpen(false);
    toast.success(`Imported group "${templateGroup.name}" with ${templateGroup.options.length} options!`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.price || !form.category) {
      return toast.error('Name, Category, and Price are required');
    }
    
    if (parseFloat(form.price) < 0) {
      return toast.error('Price cannot be negative');
    }

    if (hasCustomizations) {
      if (variants.length > 0) {
        for (let i = 0; i < variants.length; i++) {
          const v = variants[i];
          if (!v.name.trim()) {
            return toast.error(`Variant #${i + 1} requires a name`);
          }
          if (isNaN(Number(v.price)) || Number(v.price) < 0) {
            return toast.error(`Variant "${v.name}" price cannot be negative`);
          }
        }
      }

      if (customizationGroups.length > 0) {
        for (let i = 0; i < customizationGroups.length; i++) {
          const g = customizationGroups[i];
          if (!g.name.trim()) {
            return toast.error(`Customization Group #${i + 1} requires a name`);
          }
          if (!g.options || g.options.length === 0) {
            return toast.error(`Customization Group "${g.name}" must have at least one option`);
          }
          for (let j = 0; j < g.options.length; j++) {
            const opt = g.options[j];
            if (!opt.name.trim()) {
              return toast.error(`Group "${g.name}" Option #${j + 1} requires a name`);
            }
            if (isNaN(Number(opt.price)) || Number(opt.price) < 0) {
              return toast.error(`Option "${opt.name}" price cannot be negative`);
            }
          }
        }
      }
    }

    setLoading(true);
    const stockVal = parseInt(form.stock_quantity);
    const bufferVal = parseInt(form.buffer_quantity);

    const parsedPrice = parseFloat(form.price);
    const cleanPrice = isNaN(parsedPrice) ? 0 : Math.round(parsedPrice * 100) / 100;

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category,
      price: cleanPrice,
      stock_quantity: isNaN(stockVal) ? 0 : stockVal,
      buffer_quantity: isNaN(bufferVal) ? 0 : bufferVal,
      image_url: form.image_url.trim(),
      dietary_preference: form.dietary_preference,
      counter: form.counter.trim(),
      has_customizations: hasCustomizations,
      variants: hasCustomizations ? variants.map(v => ({
        id: v.id || `var_${Math.random().toString(36).slice(2, 8)}`,
        name: v.name.trim(),
        price: Number(v.price) || 0,
        stock_quantity: v.stock_quantity !== undefined && v.stock_quantity !== null && String(v.stock_quantity).trim() !== ''
          ? parseInt(String(v.stock_quantity))
          : null,
        recipe_multiplier: v.recipe_multiplier !== undefined && v.recipe_multiplier !== null && !isNaN(Number(v.recipe_multiplier)) && Number(v.recipe_multiplier) > 0
          ? Number(v.recipe_multiplier)
          : 1.0,
        inventory_item_id: v.inventory_item_id || null,
        inventory_deduct_qty: v.inventory_deduct_qty ? Number(v.inventory_deduct_qty) : null,
        is_default: Boolean(v.is_default),
      })) : [],
      customization_groups: hasCustomizations ? customizationGroups.map(g => ({
        id: g.id || `grp_${Math.random().toString(36).slice(2, 8)}`,
        name: g.name.trim(),
        min_selection: Number(g.min_selection) || 0,
        max_selection: Number(g.max_selection) || 1,
        options: (g.options || []).map(opt => ({
          id: opt.id || `opt_${Math.random().toString(36).slice(2, 8)}`,
          name: opt.name.trim(),
          price: Number(opt.price) || 0,
          stock_quantity: opt.stock_quantity !== undefined && opt.stock_quantity !== null && String(opt.stock_quantity).trim() !== ''
            ? parseInt(String(opt.stock_quantity))
            : null,
          inventory_item_id: opt.inventory_item_id || null,
          inventory_deduct_qty: opt.inventory_deduct_qty ? Number(opt.inventory_deduct_qty) : null,
          inventory_unit: opt.inventory_unit || null,
          is_default: Boolean(opt.is_default),
        })),
      })) : [],
    };

    try {
      const url = isEditing ? `/api/products/${initialData.id}` : '/api/products';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token') || localStorage.getItem('staff_token') || localStorage.getItem('auth_token')}`,
          'x-restaurant-slug': slug as string
        },
        body: JSON.stringify(payload),
        cache: 'no-store'
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Product ${isEditing ? 'updated' : 'created'} successfully!`);
        if (onSuccess) {
          onSuccess();
        } else {
          router.push(`/${slug}/admin/products`);
        }
      } else {
        toast.error(data.error || 'Failed to save product');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelClick = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.push(`/${slug}/admin/products`);
    }
  };

  // Stock status calculator
  const stockNum = parseInt(form.stock_quantity) || 0;
  const bufferNum = parseInt(form.buffer_quantity) || 0;
  const calculatedStatus = stockNum <= 0 ? 'OUT_OF_STOCK' : stockNum <= bufferNum ? 'LOW_STOCK' : 'AVAILABLE';

  return (
  <>
    <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        .product-form-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .form-col-left, .form-col-right {
          display: contents;
        }
        .form-card-basic { order: 1; }
        .form-card-customizations { order: 2; }
        .form-card-pricing { order: 3; }
        .form-card-inventory { order: 4; }

        /* Desktop grid columns */
        .variant-table-header {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 85px 80px 80px 72px 28px;
          gap: 8px;
          padding: 0 10px;
          border: 1.5px solid transparent;
          font-size: 11px;
          font-weight: 600;
          color: #64748b;
          box-sizing: border-box;
        }
        .variant-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 85px 80px 80px 72px 28px;
          align-items: center;
          gap: 8px;
          background-color: #ffffff;
          padding: 8px 10px;
          border-radius: 6px;
          box-sizing: border-box;
        }
        .variant-cell-name { min-width: 0; }
        .variant-cell-price { min-width: 0; }
        .variant-cell-stock { min-width: 0; }
        .variant-cell-bom { min-width: 0; }
        .variant-cell-default { min-width: 0; }
        .variant-cell-delete { min-width: 0; }

        .cust-option-row {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .cust-opt-top {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
        }
        .cust-opt-bottom {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          flex-wrap: wrap;
        }

        @media (min-width: 820px) {
          .product-form-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
            align-items: start;
          }
          .form-col-left {
            display: flex;
            flex-direction: column;
            gap: 24px;
          }
          .form-col-right {
            display: flex;
            flex-direction: column;
            gap: 24px;
          }
          .form-card-basic, .form-card-inventory, .form-card-pricing, .form-card-customizations {
            order: unset;
          }
        }

        @media (max-width: 640px) {
          .form-card-basic, .form-card-inventory, .form-card-pricing, .form-card-customizations {
            padding: 14px 12px !important;
          }
          .variant-section-container, .cust-section-container {
            padding: 12px 10px !important;
          }
          .cust-group-card {
            padding: 10px 8px !important;
          }
          .cust-options-list {
            padding: 8px 6px !important;
          }

          /* Hide desktop table header on phone */
          .variant-table-header {
            display: none !important;
          }
          .variant-scroll-wrapper {
            overflow-x: visible !important;
          }
          .variant-list-inner {
            min-width: 0 !important;
          }

          /* Transform variant row into mobile card */
          .variant-row {
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 8px !important;
            padding: 10px 8px !important;
          }
          .variant-cell-name {
            order: 1 !important;
            flex: 1 1 120px !important;
            width: calc(100% - 110px) !important;
          }
          .variant-cell-default {
            order: 2 !important;
            flex: 0 0 70px !important;
          }
          .variant-cell-delete {
            order: 3 !important;
            flex: 0 0 28px !important;
          }
          .variant-cell-price {
            order: 4 !important;
            flex: 1 1 calc(33.333% - 6px) !important;
            min-width: 75px !important;
          }
          .variant-cell-stock {
            order: 5 !important;
            flex: 1 1 calc(33.333% - 6px) !important;
            min-width: 65px !important;
          }
          .variant-cell-bom {
            order: 6 !important;
            flex: 1 1 calc(33.333% - 6px) !important;
            min-width: 65px !important;
          }

          /* Customization option row on phone */
          .cust-option-row {
            gap: 6px !important;
          }

          .form-header-actions {
            width: 100% !important;
            margin-left: 0 !important;
            justify-content: flex-end;
            gap: 8px !important;
          }

          .form-header-actions .form-cancel-btn {
            flex: 1 1 auto !important;
            min-width: 75px !important;
            padding: 0 12px !important;
            white-space: nowrap !important;
            justify-content: center !important;
          }

          .form-header-actions .form-submit-btn {
            flex: 2 1 auto !important;
            min-width: 120px !important;
            padding: 0 16px !important;
            white-space: nowrap !important;
            justify-content: center !important;
          }

          .form-header-actions .btn-close-modal {
            flex: 0 0 38px !important;
            width: 38px !important;
            min-width: 38px !important;
            margin-left: 0 !important;
          }
        }

        .form-header-actions button {
          white-space: nowrap !important;
        }
      `}</style>
      
      {/* Top Action Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', paddingBottom: '16px', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 240px', minWidth: 0 }}>
          {!isModal ? (
            <Link 
              prefetch={false} 
              href={`/${slug}/admin/products`}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', borderRadius: '8px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', color: '#475569', textDecoration: 'none', transition: 'all 0.2s ease', flexShrink: 0 }}
              title="Back to Products"
            >
              <ArrowLeft size={18} />
            </Link>
          ) : (
            <div style={{ width: '38px', height: '38px', borderRadius: '8px', backgroundColor: '#f1f5f9', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <UtensilsCrossed size={20} />
            </div>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: 0, wordBreak: 'break-word' }}>
              {isEditing ? `Edit Item: ${initialData.name}` : 'Add New Item'}
            </h1>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>
              Configure item information, pricing, dietary preference, and stock inventory.
            </p>
          </div>
        </div>

        <div className="form-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto', flexShrink: 0 }}>
          <button
            type="button"
            className="form-cancel-btn"
            onClick={handleCancelClick}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '38px',
              padding: '0 18px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#334155',
              fontWeight: 600,
              fontSize: '13px',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxSizing: 'border-box',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="form-submit-btn"
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              height: '38px',
              padding: '0 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'var(--primary, #0f172a)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '13px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.85 : 1,
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)',
              transition: 'all 0.2s ease',
              boxSizing: 'border-box',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {isEditing ? 'Update Item' : 'Save Item'}
          </button>

          {isModal && (
            <button
              type="button"
              className="btn-close-modal"
              onClick={handleCancelClick}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                backgroundColor: '#f1f5f9',
                border: '1px solid #cbd5e1',
                color: '#475569',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                marginLeft: '4px',
                flexShrink: 0,
              }}
              title="Close Modal"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Main Responsive Grid Layout */}
      <div className="product-form-container">
        
        {/* Left Column: Basic Details & Pricing */}
        <div className="form-col-left">
          {/* Card 1: Basic Information */}
        <div className="form-card-basic" style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#f1f5f9', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChefHat size={18} />
            </div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Basic Details</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Item Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Double Cheese Margherita Pizza"
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  color: '#0f172a',
                  backgroundColor: '#ffffff',
                  outline: 'none'
                }}
              />
            </div>

            {/* Small Product Image Uploader directly inside Basic Details */}
            <div>
              <ProductImageUploader
                value={form.image_url}
                onChange={(url) => setForm(f => ({ ...f, image_url: url }))}
                folder={slug ? `/products/${(Array.isArray(slug) ? slug[0] : slug).replace(/[\[\]'"]/g, '').trim()}` : '/products'}
                disabled={loading}
              />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                  Category <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setReorderModalOpen(true)}
                    title="Reorder Categories"
                    style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <ArrowUpDown size={14} /> Reorder
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddCategory(!showAddCategory)}
                    style={{ background: 'none', border: 'none', color: '#16a34a', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={14} /> Add Category
                  </button>
                </div>
              </div>

              <CustomSelect
                value={form.category}
                onChange={val => setForm(f => ({ ...f, category: val }))}
                options={[
                  ...(form.category && !categories.some(c => c.name.trim().toLowerCase() === form.category.trim().toLowerCase())
                    ? [{ value: form.category, label: form.category }]
                    : []),
                  ...categories.map(cat => ({ value: cat.name, label: cat.name }))
                ]}
                placeholder="Select a Category"
                buttonStyle={{
                  height: '42px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  color: '#0f172a',
                  backgroundColor: '#ffffff',
                }}
              />

              {showAddCategory && (
                <div style={{ marginTop: '10px', display: 'flex', gap: '8px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={e => setNewCategoryName(e.target.value)}
                    placeholder="New category name"
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddCategory())}
                  />
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    disabled={addingCategory}
                    style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', backgroundColor: '#16a34a', color: '#ffffff', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                  >
                    {addingCategory ? 'Adding...' : 'Save'}
                  </button>
                </div>
              )}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                  Counter Assignment
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddCounter(!showAddCounter)}
                  style={{ background: 'none', border: 'none', color: '#16a34a', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <Plus size={14} /> Add Counter
                </button>
              </div>

              <CustomSelect
                value={form.counter}
                onChange={val => setForm(f => ({ ...f, counter: val }))}
                options={[
                  { value: '', label: 'Unassigned' },
                  ...(form.counter && !counters.find(c => c.name === form.counter)
                    ? [{ value: form.counter, label: form.counter }]
                    : []),
                  ...counters.map(c => ({ value: c.name, label: c.name }))
                ]}
                placeholder="Unassigned"
                buttonStyle={{
                  height: '42px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  color: '#0f172a',
                  backgroundColor: '#ffffff',
                }}
              />

              {showAddCounter && (
                <div style={{ marginTop: '10px', display: 'flex', gap: '8px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                  <input
                    type="text"
                    value={newCounterName}
                    onChange={e => setNewCounterName(e.target.value)}
                    placeholder="New counter name (e.g. Counter 1, Bakery)"
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddCounter())}
                  />
                  <button
                    type="button"
                    onClick={handleAddCounter}
                    disabled={addingCounter}
                    style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', backgroundColor: '#16a34a', color: '#ffffff', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                  >
                    {addingCounter ? 'Adding...' : 'Save'}
                  </button>
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Description <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 400 }}>(Optional)</span>
              </label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Detailed description of ingredients, flavor profile, or portion size..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  color: '#0f172a',
                  backgroundColor: '#ffffff',
                  resize: 'vertical',
                  minHeight: '80px',
                  outline: 'none'
                }}
              />
            </div>
          </div>
        </div>

        {/* Card 4: Variants & Customizations */}
        <div className="form-card-customizations" style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#f1f5f9', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sliders size={18} />
              </div>
              <div>
                <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Variants & Customizations</h2>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>Portion sizes, add-ons, toppings, or spice levels</p>
              </div>
            </div>

            {/* Toggle switch */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: hasCustomizations ? '#0f172a' : '#64748b' }}>
                {hasCustomizations ? 'Enabled' : 'Disabled'}
              </span>
              <div
                onClick={() => setHasCustomizations(prev => !prev)}
                style={{
                  width: '42px',
                  height: '24px',
                  borderRadius: '12px',
                  backgroundColor: hasCustomizations ? '#16a34a' : '#cbd5e1',
                  position: 'relative',
                  transition: 'background-color 0.2s ease',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    backgroundColor: '#ffffff',
                    position: 'absolute',
                    top: '3px',
                    left: hasCustomizations ? '21px' : '3px',
                    transition: 'left 0.2s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }}
                />
              </div>
            </label>
          </div>

          {!hasCustomizations ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 10px 0' }}>
                This product does not have variants or custom add-ons. Enable to add sizes (e.g. Regular/Large) or custom choices (e.g. Extra Cheese).
              </p>
              <button
                type="button"
                onClick={() => setHasCustomizations(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  fontWeight: 600,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                }}
              >
                <Plus size={14} /> Enable Customizations
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                          {/* --- SECTION 1: VARIANTS --- */}
              <div className="variant-section-container" style={{ backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                      Portions & Variants <span style={{ fontSize: '12px', fontWeight: 400, color: '#64748b' }}>(Optional)</span>
                    </h3>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                      e.g., Half / Full, Small / Medium / Large. Sets the product base price.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddVariant}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      color: '#0f172a',
                      fontWeight: 600,
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    <Plus size={13} /> Add Variant
                  </button>
                </div>

                {variants.length === 0 ? (
                  <div style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '12.5px' }}>
                    No variants added. The standard price (₹{form.price || '0'}) will be used.
                  </div>
                ) : (
                    <div className="variant-scroll-wrapper" style={{ overflowX: 'auto', paddingBottom: '4px' }}>
                      <div className="variant-list-inner" style={{ minWidth: '480px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* Column Headers with exact matching widths and padding */}
                        <div className="variant-table-header">
                          <span>Variant Name</span>
                          <span style={{ textAlign: 'left', paddingLeft: '4px' }}>Price (₹)</span>
                          <span style={{ textAlign: 'left', paddingLeft: '4px' }}>Stock</span>
                          <span style={{ textAlign: 'left', paddingLeft: '4px' }} title="Recipe BOM scaling: e.g. 1.5x for Large, 0.7x for Small">BOM Scale</span>
                          <span style={{ textAlign: 'center' }}>Default</span>
                          <span></span>
                        </div>

                        {variants.map((v, idx) => (
                          <div
                            key={v.id || idx}
                            className="variant-row"
                            style={{
                              border: v.is_default ? '1.5px solid #2563eb' : '1.5px solid #e2e8f0',
                            }}
                          >
                            <div className="variant-cell-name">
                              <input
                                type="text"
                                value={v.name}
                                onChange={(e) => handleUpdateVariant(idx, 'name', e.target.value)}
                                placeholder="e.g. Regular, Large"
                                style={{
                                  width: '100%',
                                  minWidth: 0,
                                  boxSizing: 'border-box',
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '13px',
                                  color: '#0f172a',
                                  outline: 'none',
                                }}
                              />
                            </div>
                            <div className="variant-cell-price" style={{ position: 'relative', width: '100%', minWidth: 0 }}>
                              <span style={{ position: 'absolute', left: '7px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: '#64748b' }}>₹</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={v.price}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  handleUpdateVariant(idx, 'price', val);
                                  if (v.is_default) {
                                    setForm(f => ({ ...f, price: val.toString() }));
                                  }
                                }}
                                placeholder="Price"
                                style={{
                                  width: '100%',
                                  minWidth: 0,
                                  boxSizing: 'border-box',
                                  padding: '6px 6px 6px 18px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '13px',
                                  fontWeight: 600,
                                  color: '#0f172a',
                                  outline: 'none',
                                }}
                              />
                            </div>
                            <div className="variant-cell-stock" style={{ position: 'relative', width: '100%', minWidth: 0 }}>
                              <input
                                type="number"
                                min="0"
                                value={v.stock_quantity !== undefined && v.stock_quantity !== null ? v.stock_quantity : ''}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? null : Math.max(0, parseInt(e.target.value) || 0);
                                  handleUpdateVariant(idx, 'stock_quantity' as any, val);
                                }}
                                placeholder="Stock ∞"
                                title="Sellable portion stock quantity (leave empty for unlimited)"
                                style={{
                                  width: '100%',
                                  minWidth: 0,
                                  boxSizing: 'border-box',
                                  padding: '6px 6px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '12.5px',
                                  color: '#0f172a',
                                  outline: 'none',
                                }}
                              />
                            </div>
                            <div className="variant-cell-bom" style={{ position: 'relative', width: '100%', minWidth: 0 }}>
                              <span style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: '#94a3b8', pointerEvents: 'none' }}>×</span>
                              <input
                                type="number"
                                step="0.1"
                                min="0.1"
                                value={v.recipe_multiplier !== undefined && v.recipe_multiplier !== null ? v.recipe_multiplier : ''}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? null : Math.max(0.1, parseFloat(e.target.value) || 1.0);
                                  handleUpdateVariant(idx, 'recipe_multiplier' as any, val);
                                }}
                                placeholder="1.0"
                                title="Recipe BOM Multiplier: scales raw ingredient consumption from base recipe (e.g. 1.5 for Large)"
                                style={{
                                  width: '100%',
                                  minWidth: 0,
                                  boxSizing: 'border-box',
                                  padding: '6px 16px 6px 6px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '12px',
                                  color: '#0f172a',
                                  outline: 'none',
                                }}
                              />
                            </div>
                            <div className="variant-cell-default" style={{ width: '100%', minWidth: 0 }}>
                              <button
                                type="button"
                                onClick={() => {
                                  handleUpdateVariant(idx, 'is_default', true);
                                  setForm(f => ({ ...f, price: v.price.toString() }));
                                }}
                                style={{
                                  width: '100%',
                                  minWidth: 0,
                                  boxSizing: 'border-box',
                                  height: '31px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: '0 4px',
                                  borderRadius: '6px',
                                  border: v.is_default ? '1px solid #2563eb' : '1px solid #e2e8f0',
                                  backgroundColor: v.is_default ? '#eff6ff' : '#f8fafc',
                                  color: v.is_default ? '#2563eb' : '#64748b',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {v.is_default ? '✓ Default' : 'Default'}
                              </button>
                            </div>
                            <div className="variant-cell-delete">
                              <button
                                type="button"
                                onClick={() => handleRemoveVariant(idx)}
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  backgroundColor: 'transparent',
                                  color: '#ef4444',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  boxSizing: 'border-box',
                                }}
                                title="Remove variant"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                )}
              </div>

              {/* --- SECTION 2: CUSTOMIZATION GROUPS --- */}
              <div className="cust-section-container" style={{ backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', gap: '8px', flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                      Customization Groups <span style={{ fontSize: '12px', fontWeight: 400, color: '#64748b' }}>(Add-ons, Options)</span>
                    </h3>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                      e.g., &quot;Choose Crust&quot;, &quot;Add Extra Toppings&quot;, &quot;Spice Level&quot;
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setReuseModalOpen(true)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '5px 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        color: '#2563eb',
                        fontWeight: 600,
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                      title="Reuse groups configured on other products"
                    >
                      <Copy size={13} /> Reuse Group
                    </button>
                    <button
                      type="button"
                      onClick={handleAddCustomizationGroup}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '5px 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        color: '#0f172a',
                        fontWeight: 600,
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      <Plus size={13} /> Add Group
                    </button>
                  </div>
                </div>

                {customizationGroups.length === 0 ? (
                  <div style={{ padding: '20px 16px', textAlign: 'center', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                    <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 12px 0' }}>
                      No customization groups created yet. Create a new one or reuse one from other products!
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setReuseModalOpen(true)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '6px 14px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#eff6ff',
                          color: '#2563eb',
                          fontWeight: 600,
                          fontSize: '12.5px',
                          cursor: 'pointer',
                        }}
                      >
                        <Copy size={13} /> Reuse Existing Group
                      </button>
                      <button
                        type="button"
                        onClick={handleAddCustomizationGroup}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '6px 14px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#ffffff',
                          color: '#0f172a',
                          fontWeight: 600,
                          fontSize: '12.5px',
                          cursor: 'pointer',
                        }}
                      >
                        <Plus size={13} /> Add New Group
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {customizationGroups.map((group, gIdx) => (
                      <div
                        key={group.id || gIdx}
                        className="cust-group-card"
                        style={{
                          backgroundColor: '#ffffff',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          padding: '14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                        }}
                      >
                        {/* Group Header Row */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                          <div style={{ flex: '1 1 200px' }}>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '3px' }}>
                              Group Name
                            </label>
                            <input
                              type="text"
                              value={group.name}
                              onChange={(e) => handleUpdateGroup(gIdx, 'name', e.target.value)}
                              placeholder="e.g. Choose Crust or Extra Toppings"
                              style={{
                                width: '100%',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                fontSize: '13px',
                                fontWeight: 600,
                                color: '#0f172a',
                                outline: 'none',
                              }}
                            />
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '3px' }}>
                                Min Select
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={group.min_selection}
                                onChange={(e) => handleUpdateGroup(gIdx, 'min_selection', parseInt(e.target.value) || 0)}
                                style={{
                                  width: '65px',
                                  padding: '6px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '12.5px',
                                  outline: 'none',
                                }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '3px' }}>
                                Max Select
                              </label>
                              <input
                                type="number"
                                min="1"
                                value={group.max_selection}
                                onChange={(e) => handleUpdateGroup(gIdx, 'max_selection', parseInt(e.target.value) || 1)}
                                style={{
                                  width: '65px',
                                  padding: '6px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '12.5px',
                                  outline: 'none',
                                }}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveGroup(gIdx)}
                              style={{
                                width: '30px',
                                height: '30px',
                                marginTop: '16px',
                                borderRadius: '6px',
                                border: 'none',
                                backgroundColor: '#fee2e2',
                                color: '#ef4444',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                              }}
                              title="Delete group"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Options List */}
                        <div className="cust-options-list" style={{ backgroundColor: '#f8fafc', borderRadius: '6px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Options in this group:
                          </div>

                          {group.options.map((opt, oIdx) => (
                            <div
                              key={opt.id || oIdx}
                              className="cust-option-item"
                              style={{
                                backgroundColor: opt.inventory_item_id ? '#f0fdf4' : '#ffffff',
                                border: opt.inventory_item_id ? '1px solid #86efac' : '1px solid #e2e8f0',
                                borderRadius: '6px',
                                padding: '8px 10px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                              }}
                            >
                              <div className="cust-option-row">
                                {/* Top Tier: Option Name & Delete */}
                                <div className="cust-opt-top" style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <input
                                      type="text"
                                      value={opt.name}
                                      onChange={(e) => handleUpdateOption(gIdx, oIdx, 'name', e.target.value)}
                                      placeholder="Option name (e.g. Cheese Burst, Jalapeno)"
                                      style={{
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        padding: '6px 10px',
                                        borderRadius: '6px',
                                        border: '1px solid #cbd5e1',
                                        fontSize: '12.5px',
                                        outline: 'none',
                                      }}
                                    />
                                  </div>
                                  <div style={{ flexShrink: 0 }}>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveOption(gIdx, oIdx)}
                                      disabled={group.options.length <= 1}
                                      style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '6px',
                                        border: 'none',
                                        backgroundColor: 'transparent',
                                        color: group.options.length <= 1 ? '#cbd5e1' : '#ef4444',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: group.options.length <= 1 ? 'not-allowed' : 'pointer',
                                        boxSizing: 'border-box',
                                      }}
                                      title="Remove option"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>

                                {/* Bottom Tier: Price, Stock, Preselected */}
                                <div className="cust-opt-bottom" style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', flexWrap: 'wrap' }}>
                                  <div style={{ position: 'relative', flex: '1 1 95px', minWidth: '80px', maxWidth: '140px' }}>
                                    <span style={{ position: 'absolute', left: '7px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: '#64748b' }}>+₹</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={opt.price}
                                      onChange={(e) => handleUpdateOption(gIdx, oIdx, 'price', parseFloat(e.target.value) || 0)}
                                      placeholder="0"
                                      style={{
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        padding: '5px 6px 5px 22px',
                                        borderRadius: '6px',
                                        border: '1px solid #cbd5e1',
                                        fontSize: '12.5px',
                                        fontWeight: 600,
                                        outline: 'none',
                                      }}
                                    />
                                  </div>
                                  <div style={{ position: 'relative', flex: '1 1 85px', minWidth: '75px', maxWidth: '130px' }}>
                                    <input
                                      type="number"
                                      min="0"
                                      value={opt.stock_quantity !== undefined && opt.stock_quantity !== null ? opt.stock_quantity : ''}
                                      onChange={(e) => {
                                        const val = e.target.value === '' ? null : Math.max(0, parseInt(e.target.value) || 0);
                                        handleUpdateOption(gIdx, oIdx, 'stock_quantity' as any, val);
                                      }}
                                      placeholder="Stock ∞"
                                      title="Stock quantity (leave empty for unlimited)"
                                      style={{
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        padding: '5px 8px',
                                        borderRadius: '6px',
                                        border: '1px solid #cbd5e1',
                                        fontSize: '12px',
                                        color: '#0f172a',
                                        outline: 'none',
                                      }}
                                    />
                                  </div>
                                  <div style={{ flex: '0 0 auto', marginLeft: 'auto' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', color: '#475569', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}>
                                      <input
                                        type="checkbox"
                                        checked={Boolean(opt.is_default)}
                                        onChange={(e) => handleUpdateOption(gIdx, oIdx, 'is_default', e.target.checked)}
                                      />
                                      Preselected
                                    </label>
                                  </div>
                                </div>
                              </div>

                              {/* Raw Material Inventory Link */}
                              {inventoryItems.length > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11.5px', paddingTop: '2px', borderTop: opt.inventory_item_id ? '1px dashed #86efac' : 'none', flexWrap: 'wrap' }}>
                                  {opt.inventory_item_id ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', flexWrap: 'wrap' }}>
                                      <span style={{ color: '#15803d', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                                        <Boxes size={13} /> Raw Item:
                                      </span>
                                      <select
                                        value={opt.inventory_item_id}
                                        onChange={(e) => {
                                          const selectedItem = inventoryItems.find(i => i.id === e.target.value);
                                          handleUpdateOption(gIdx, oIdx, 'inventory_item_id' as any, e.target.value || null);
                                          if (selectedItem) {
                                            handleUpdateOption(gIdx, oIdx, 'inventory_unit' as any, selectedItem.unit);
                                          }
                                        }}
                                        style={{
                                          padding: '3px 8px',
                                          borderRadius: '5px',
                                          border: '1px solid #86efac',
                                          backgroundColor: '#ffffff',
                                          fontSize: '11.5px',
                                          color: '#0f172a',
                                          outline: 'none',
                                          maxWidth: '100%',
                                          flex: '1 1 120px',
                                        }}
                                      >
                                        {inventoryItems.map(item => (
                                          <option key={item.id} value={item.id}>
                                            {item.name} ({item.unit})
                                          </option>
                                        ))}
                                      </select>
                                      <span style={{ color: '#64748b', flexShrink: 0 }}>Deduct:</span>
                                      <input
                                        type="number"
                                        step="0.001"
                                        min="0.001"
                                        value={opt.inventory_deduct_qty ?? ''}
                                        onChange={(e) => {
                                          const val = e.target.value === '' ? null : parseFloat(e.target.value) || 0;
                                          handleUpdateOption(gIdx, oIdx, 'inventory_deduct_qty' as any, val);
                                        }}
                                        placeholder="0.05"
                                        style={{
                                          width: '55px',
                                          padding: '3px 6px',
                                          borderRadius: '5px',
                                          border: '1px solid #86efac',
                                          fontSize: '11.5px',
                                          outline: 'none',
                                        }}
                                      />
                                      <span style={{ color: '#166534', fontWeight: 600, flexShrink: 0 }}>{opt.inventory_unit || 'units'}</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleUpdateOption(gIdx, oIdx, 'inventory_item_id' as any, null);
                                          handleUpdateOption(gIdx, oIdx, 'inventory_deduct_qty' as any, null);
                                          handleUpdateOption(gIdx, oIdx, 'inventory_unit' as any, null);
                                        }}
                                        style={{
                                          background: 'none',
                                          border: 'none',
                                          color: '#dc2626',
                                          cursor: 'pointer',
                                          fontSize: '11px',
                                          marginLeft: 'auto',
                                          fontWeight: 600,
                                          textDecoration: 'underline',
                                          flexShrink: 0,
                                        }}
                                      >
                                        Unlink
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const firstItem = inventoryItems[0];
                                        handleUpdateOption(gIdx, oIdx, 'inventory_item_id' as any, firstItem?.id || null);
                                        handleUpdateOption(gIdx, oIdx, 'inventory_deduct_qty' as any, 1);
                                        handleUpdateOption(gIdx, oIdx, 'inventory_unit' as any, firstItem?.unit || 'pcs');
                                      }}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#2563eb',
                                        fontSize: '11px',
                                        cursor: 'pointer',
                                        padding: 0,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        fontWeight: 500,
                                      }}
                                    >
                                      <Boxes size={12} /> + Link Raw Material Stock (e.g. 50g Cheese)
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}

                          <button
                            type="button"
                            onClick={() => handleAddOption(gIdx)}
                            style={{
                              alignSelf: 'flex-start',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              border: '1px dashed #cbd5e1',
                              backgroundColor: '#ffffff',
                              color: '#2563eb',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              marginTop: '4px',
                            }}
                          >
                            <Plus size={12} /> Add Option
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Right Column: Pricing & Inventory */}
      <div className="form-col-right">
        {/* Card 2: Pricing & Dietary Classification */}
        <div className="form-card-pricing" style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#f1f5f9', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Tag size={18} />
            </div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Price & Dietary Type</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Product Price (₹) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '15px', fontWeight: 700, color: '#64748b' }}>₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  placeholder="0.00"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 32px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '15px',
                    fontWeight: 600,
                    color: '#0f172a',
                    backgroundColor: '#ffffff',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                Dietary Preference Classification
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                
                {/* VEG Card */}
                <div
                  onClick={() => setForm(f => ({ ...f, dietary_preference: 'VEG' }))}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: form.dietary_preference === 'VEG' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                    backgroundColor: form.dietary_preference === 'VEG' ? '#f0fdf4' : '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    transition: 'all 0.15s ease',
                    userSelect: 'none',
                    minWidth: 0,
                  }}
                >
                  <div style={{ width: '18px', height: '18px', minWidth: '18px', flexShrink: 0, borderRadius: '4px', border: '1.5px solid #16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16a34a' }} />
                  </div>
                  <div style={{ minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: form.dietary_preference === 'VEG' ? '#15803d' : '#334155', whiteSpace: 'nowrap' }}>
                      Vegetarian
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '1px' }}>
                      Plant-based & Dairy
                    </div>
                  </div>
                </div>

                {/* NON-VEG Card */}
                <div
                  onClick={() => setForm(f => ({ ...f, dietary_preference: 'NON_VEG' }))}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: form.dietary_preference === 'NON_VEG' ? '2px solid #dc2626' : '1px solid #cbd5e1',
                    backgroundColor: form.dietary_preference === 'NON_VEG' ? '#fef2f2' : '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    transition: 'all 0.15s ease',
                    userSelect: 'none',
                    minWidth: 0,
                  }}
                >
                  <div style={{ width: '18px', height: '18px', minWidth: '18px', flexShrink: 0, borderRadius: '4px', border: '1.5px solid #dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#dc2626' }} />
                  </div>
                  <div style={{ minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: form.dietary_preference === 'NON_VEG' ? '#b91c1c' : '#334155', whiteSpace: 'nowrap' }}>
                      Non-Veg
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '1px' }}>
                      Meat, Poultry, Egg
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Inventory & Stock Control */}
        {showOnlineOrdering && (
          <div className="form-card-inventory" style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#f1f5f9', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Layers size={18} />
                </div>
                <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Inventory Control</h2>
              </div>

              {/* Real-time Status Badge */}
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: 700,
                  backgroundColor: calculatedStatus === 'AVAILABLE' ? '#dcfce7' : calculatedStatus === 'LOW_STOCK' ? '#fef9c3' : '#fee2e2',
                  color: calculatedStatus === 'AVAILABLE' ? '#15803d' : calculatedStatus === 'LOW_STOCK' ? '#a16207' : '#b91c1c'
                }}
              >
                {calculatedStatus.replace('_', ' ')}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Stock Quantity
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.stock_quantity}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  onChange={e => setForm(f => ({ ...f, stock_quantity: e.target.value }))}
                  placeholder="0"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Buffer Threshold
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.buffer_quantity}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  onChange={e => setForm(f => ({ ...f, buffer_quantity: e.target.value }))}
                  placeholder="0"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  </form>

  <CategoryReorderModal
    isOpen={reorderModalOpen}
    onClose={() => {
      setReorderModalOpen(false);
      fetchCategories();
    }}
    slug={(Array.isArray(slug) ? slug[0] : (slug || '')).replace(/[\[\]'"]/g, '').trim()}
    onReordered={fetchCategories}
  />

  <ReuseCustomizationModal
    isOpen={reuseModalOpen}
    onClose={() => setReuseModalOpen(false)}
    onSelectGroup={handleReuseGroup}
    existingGroupNames={customizationGroups.map(g => g.name)}
    slug={(Array.isArray(slug) ? slug[0] : (slug || '')).replace(/[\[\]'"]/g, '').trim()}
  />
  </>
  );
}

