'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUp, ArrowDown, Layers, X, Plus, Loader2, Check, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface CategoryItem {
  id: string;
  name: string;
  sort_order: number;
}

interface CategoryReorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  slug: string;
  onReordered?: () => void;
}

export function CategoryReorderModal({ isOpen, onClose, slug, onReordered }: CategoryReorderModalProps) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [addingCat, setAddingCat] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadCategories = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const res = await fetch('/api/categories', {
        headers: {
          'x-restaurant-slug': slug,
          'Authorization': `Bearer ${localStorage.getItem('admin_token') || localStorage.getItem('staff_token') || localStorage.getItem('auth_token') || ''}`,
        },
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setCategories(data.data);
        setIsDirty(false);
      }
    } catch {
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (isOpen) {
      loadCategories();
    }
  }, [isOpen, loadCategories]);

  // Local reordering without instant API call
  const handleMoveLocal = (index: number, direction: 'up' | 'down') => {
    const swapIdx = direction === 'up' ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= categories.length) return;

    const newCats = [...categories];
    const temp = newCats[index];
    newCats[index] = newCats[swapIdx];
    newCats[swapIdx] = temp;

    setCategories(newCats);
    setIsDirty(true);
  };

  const handleSaveAndClose = async () => {
    if (!isDirty) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      const orderedCategoryIds = categories.map((c) => c.id);
      const res = await fetch('/api/categories/reorder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-restaurant-slug': slug,
          'Authorization': `Bearer ${localStorage.getItem('admin_token') || localStorage.getItem('staff_token') || localStorage.getItem('auth_token') || ''}`,
        },
        body: JSON.stringify({ orderedCategoryIds }),
      });
      const data = await res.json();
      if (data.success) {
        if (Array.isArray(data.data)) {
          setCategories(data.data);
        }
        setIsDirty(false);
        if (onReordered) onReordered();
        toast.success('Category order saved');
        onClose();
      } else {
        toast.error(data.error || 'Failed to save category order');
      }
    } catch {
      toast.error('Error saving category order');
    } finally {
      setSaving(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed) return;

    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('Category already exists');
      return;
    }

    setAddingCat(true);
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-restaurant-slug': slug,
          'Authorization': `Bearer ${localStorage.getItem('admin_token') || localStorage.getItem('staff_token') || localStorage.getItem('auth_token') || ''}`,
        },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (data.success) {
        setNewCatName('');
        await loadCategories();
        if (onReordered) onReordered();
        toast.success('New category added to bottom of sequence');
      } else {
        toast.error(data.error || 'Failed to add category');
      }
    } catch {
      toast.error('Error adding category');
    } finally {
      setAddingCat(false);
    }
  };

  const handleDeleteCategory = async (cat: CategoryItem) => {
    if (!window.confirm(`Are you sure you want to delete category "${cat.name}"?`)) return;

    try {
      const res = await fetch('/api/categories', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-restaurant-slug': slug,
          'Authorization': `Bearer ${localStorage.getItem('admin_token') || localStorage.getItem('staff_token') || localStorage.getItem('auth_token') || ''}`,
        },
        body: JSON.stringify({ id: cat.id, name: cat.name }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Category "${cat.name}" deleted`);
        await loadCategories();
        if (onReordered) onReordered();
      } else {
        toast.error(data.error || 'Failed to delete category');
      }
    } catch {
      toast.error('Error deleting category');
    }
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      className="modal-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000000,
        padding: '16px',
      }}
    >
      <div
        className="modal-desktop animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '520px',
          width: '100%',
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          padding: '24px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            paddingBottom: '12px',
            borderBottom: '1px solid #E2E8F0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                backgroundColor: 'rgba(15, 23, 42, 0.08)',
                color: 'var(--primary, #0f172a)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Layers size={20} />
            </span>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#0F172A' }}>Reorder Food Categories</h2>
              <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>
                Set display order for Staff POS and Customer Menu
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#94A3B8',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Add Category Form */}
        <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <input
            type="text"
            placeholder="Add new category..."
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            style={{
              flex: 1,
              height: '38px',
              padding: '0 12px',
              fontSize: '13px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={addingCat || !newCatName.trim()}
            style={{
              height: '38px',
              padding: '0 14px',
              borderRadius: '8px',
              background: 'var(--primary, #0f172a)',
              color: '#FFFFFF',
              border: 'none',
              fontWeight: 600,
              fontSize: '13px',
              cursor: addingCat || !newCatName.trim() ? 'not-allowed' : 'pointer',
              opacity: addingCat || !newCatName.trim() ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {addingCat ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            <span>Add</span>
          </button>
        </form>

        {/* Categories List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            paddingRight: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
              <Loader2 size={24} style={{ margin: '0 auto 8px auto' }} className="animate-spin" />
              <p style={{ fontSize: '13px', margin: 0 }}>Loading categories...</p>
            </div>
          ) : categories.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
              <p style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>No categories found</p>
              <p style={{ fontSize: '12px', margin: '4px 0 0 0' }}>Add your first category above.</p>
            </div>
          ) : (
            categories.map((cat, index) => {
              const isFirst = index === 0;
              const isLast = index === categories.length - 1;

              return (
                <div
                  key={cat.id || cat.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        backgroundColor: '#E2E8F0',
                        color: '#475569',
                        fontSize: '12px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {index + 1}
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>
                      {cat.name}
                    </span>
                  </div>

                  {/* Move Up / Down Buttons (Local Reorder) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => handleMoveLocal(index, 'up')}
                      disabled={isFirst || saving}
                      title={isFirst ? 'Already at top' : 'Move Up'}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        backgroundColor: isFirst ? '#F1F5F9' : '#FFFFFF',
                        color: isFirst ? '#94A3B8' : '#0F172A',
                        cursor: isFirst || saving ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: isFirst ? 0.5 : 1,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveLocal(index, 'down')}
                      disabled={isLast || saving}
                      title={isLast ? 'Already at bottom' : 'Move Down'}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        backgroundColor: isLast ? '#F1F5F9' : '#FFFFFF',
                        color: isLast ? '#94A3B8' : '#0F172A',
                        cursor: isLast || saving ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: isLast ? 0.5 : 1,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <ArrowDown size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(cat)}
                      disabled={saving}
                      title={`Delete "${cat.name}"`}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        border: '1px solid #FECDD3',
                        backgroundColor: '#FFF1F2',
                        color: '#E11D48',
                        cursor: saving ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease',
                        marginLeft: '4px',
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: '#F1F5F9',
              color: '#475569',
              border: 'none',
              fontWeight: 600,
              fontSize: '13px',
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveAndClose}
            disabled={saving}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              background: 'var(--primary, #0f172a)',
              color: '#FFFFFF',
              border: 'none',
              fontWeight: 600,
              fontSize: '13px',
              cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            <span>{saving ? 'Saving...' : 'Done'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
