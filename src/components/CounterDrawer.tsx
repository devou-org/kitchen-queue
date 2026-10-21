'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Plus,
  Edit2,
  Trash2,
  Check,
  Loader2,
  Store,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Counter } from '@/types';

interface CounterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  slug: string;
  onCountersChange?: () => void;
}

export function CounterDrawer({ isOpen, onClose, slug, onCountersChange }: CounterDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [loading, setLoading] = useState(false);

  // New counter state
  const [newCounterName, setNewCounterName] = useState('');
  const [adding, setAdding] = useState(false);

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingActive, setEditingActive] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getHeaders = useCallback(() => {
    const token = typeof window !== 'undefined'
      ? (localStorage.getItem('admin_token') || localStorage.getItem('staff_token') || '')
      : '';
    return {
      'Content-Type': 'application/json',
      'x-restaurant-slug': slug,
      'Authorization': `Bearer ${token}`
    };
  }, [slug]);

  const fetchCounters = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/counters', {
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setCounters(data.data);
      }
    } catch {
      toast.error('Failed to load counters');
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    if (isOpen) {
      fetchCounters();
      setEditingId(null);
      setNewCounterName('');
    }
  }, [isOpen, fetchCounters]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCounterName.trim();
    if (!trimmed) {
      toast.error('Counter name is required');
      return;
    }

    if (counters.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('Counter with this name already exists');
      return;
    }

    setAdding(true);
    try {
      const res = await fetch('/api/counters', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          name: trimmed,
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Counter "${trimmed}" created!`);
        setNewCounterName('');
        await fetchCounters();
        onCountersChange?.();
      } else {
        toast.error(data.error || 'Failed to add counter');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setAdding(false);
    }
  };

  const handleStartEdit = (counter: Counter) => {
    setEditingId(counter.id);
    setEditingName(counter.name);
    setEditingActive(counter.is_active !== false);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleSaveEdit = async (id: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) {
      toast.error('Counter name cannot be empty');
      return;
    }

    setSavingEdit(true);
    try {
      const res = await fetch(`/api/counters/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          name: trimmed,
          is_active: editingActive
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Counter updated successfully');
        setEditingId(null);
        await fetchCounters();
        onCountersChange?.();
      } else {
        toast.error(data.error || 'Failed to update counter');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? Products assigned to it will remain unassigned.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/counters/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Counter deleted');
        await fetchCounters();
        onCountersChange?.();
      } else {
        toast.error(data.error || 'Failed to delete counter');
      }
    } catch {
      toast.error('Network error');
    }
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999 }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(2px)',
          transition: 'opacity 0.2s ease',
        }}
      />

      {/* Slide-over Drawer Panel */}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '540px',
          maxWidth: '100vw',
          height: '100vh',
          background: '#FFFFFF',
          boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.16)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 100000,
          boxSizing: 'border-box',
          animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
        `}</style>

        {/* 1. Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border, #E2E8F0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#FFFFFF',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: '#EFF6FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563EB',
                border: '1px solid #DBEAFE',
              }}
            >
              <Store size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Kitchen Counters
              </h2>
              <p style={{ fontSize: '12px', color: '#64748B', margin: '3px 0 0 0' }}>
                Manage counters for food preparation and item routing
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              padding: '8px',
              borderRadius: '8px',
              cursor: 'pointer',
              color: '#64748B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#F8FAFC',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* 2. Add Counter Section */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border, #E2E8F0)', backgroundColor: '#FFFFFF' }}>
          <form onSubmit={handleAdd}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
              Add New Kitchen Counter
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="e.g. Main Kitchen, Bar Counter, Grill, Dessert"
                value={newCounterName}
                onChange={e => setNewCounterName(e.target.value)}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  outline: 'none',
                  backgroundColor: '#FFFFFF',
                  color: '#0F172A'
                }}
              />
              <button
                type="submit"
                disabled={adding || !newCounterName.trim()}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--primary, #971345)',
                  color: '#FFFFFF',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: adding || !newCounterName.trim() ? 'not-allowed' : 'pointer',
                  opacity: adding || !newCounterName.trim() ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap'
                }}
              >
                {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Add Counter
              </button>
            </div>
          </form>
        </div>

        {/* 3. Counters List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', backgroundColor: '#F8FAFC' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94A3B8', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Configured Counters ({counters.length})</span>
          </div>

          {loading ? (
            <div style={{ padding: '60px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <Loader2 size={28} className="animate-spin" style={{ color: '#94A3B8' }} />
            </div>
          ) : counters.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 24px', color: '#94A3B8', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px dashed #CBD5E1' }}>
              <Store size={32} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#475569' }}>No counters added yet</div>
              <p style={{ fontSize: '12px', margin: '6px 0 0 0' }}>Add your first kitchen counter above to assign menu items.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {counters.map(counter => {
                const isEditing = editingId === counter.id;

                if (isEditing) {
                  return (
                    <div
                      key={counter.id}
                      style={{
                        padding: '16px',
                        borderRadius: '10px',
                        border: '2px solid #2563EB',
                        backgroundColor: '#FFFFFF',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.08)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Edit Counter
                        </span>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={editingActive}
                            onChange={e => setEditingActive(e.target.checked)}
                          />
                          Active Counter
                        </label>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                          Counter Name
                        </label>
                        <input
                          type="text"
                          value={editingName}
                          onChange={e => setEditingName(e.target.value)}
                          autoFocus
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: '1px solid #CBD5E1',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#0F172A',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #F1F5F9', paddingTop: '10px' }}>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          style={{
                            padding: '7px 14px',
                            borderRadius: '6px',
                            border: '1px solid #CBD5E1',
                            backgroundColor: '#FFFFFF',
                            color: '#64748B',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(counter.id)}
                          disabled={savingEdit}
                          style={{
                            padding: '7px 16px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: '#16A34A',
                            color: '#FFFFFF',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          {savingEdit ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                          Save Changes
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={counter.id}
                    style={{
                      padding: '14px 16px',
                      borderRadius: '10px',
                      border: '1px solid #E2E8F0',
                      backgroundColor: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                      transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                    }}
                  >
                    {/* Left: Indicator & Counter Name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span
                        style={{
                          width: '9px',
                          height: '9px',
                          borderRadius: '50%',
                          backgroundColor: counter.is_active !== false ? '#10B981' : '#94A3B8',
                          display: 'inline-block',
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                        {counter.name}
                      </span>
                      {counter.is_active === false && (
                        <span style={{ fontSize: '10px', color: '#EF4444', fontWeight: 700, background: '#FEE2E2', padding: '1px 6px', borderRadius: '4px' }}>
                          Inactive
                        </span>
                      )}
                    </div>

                    {/* Right: Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => handleStartEdit(counter)}
                        title="Edit Counter"
                        style={{
                          background: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          color: '#475569',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        <Edit2 size={12} />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(counter.id, counter.name)}
                        title="Delete Counter"
                        style={{
                          background: '#FEF2F2',
                          border: '1px solid #FEE2E2',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          color: '#EF4444',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </div>,
    document.body
  );
}
