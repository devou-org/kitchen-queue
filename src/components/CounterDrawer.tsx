'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Edit2, Trash2, Check, Loader2, Store, Printer, ChevronDown, ChevronUp, Radio } from 'lucide-react';
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
  const [newPrinterName, setNewPrinterName] = useState('POS-80C');
  const [newPrinterType, setNewPrinterType] = useState('DEFAULT');
  const [newPrinterAddress, setNewPrinterAddress] = useState('');
  const [showPrinterSettings, setShowPrinterSettings] = useState(false);
  const [adding, setAdding] = useState(false);

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingPrinterName, setEditingPrinterName] = useState('POS-80C');
  const [editingPrinterType, setEditingPrinterType] = useState('DEFAULT');
  const [editingPrinterAddress, setEditingPrinterAddress] = useState('');
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
      setNewPrinterName('POS-80C');
      setNewPrinterType('DEFAULT');
      setNewPrinterAddress('');
      setShowPrinterSettings(false);
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
          printer_name: newPrinterName.trim() || 'POS-80C',
          printer_type: newPrinterType,
          printer_address: newPrinterAddress.trim() || null,
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Counter "${trimmed}" created!`);
        setNewCounterName('');
        setNewPrinterName('POS-80C');
        setNewPrinterType('DEFAULT');
        setNewPrinterAddress('');
        setShowPrinterSettings(false);
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
    setEditingPrinterName(counter.printer_name || 'POS-80C');
    setEditingPrinterType(counter.printer_type || 'DEFAULT');
    setEditingPrinterAddress(counter.printer_address || '');
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
          printer_name: editingPrinterName.trim() || 'POS-80C',
          printer_type: editingPrinterType,
          printer_address: editingPrinterAddress.trim() || null,
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
          width: '460px',
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
            padding: '18px 20px',
            borderBottom: '1px solid var(--border, #E2E8F0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#FFFFFF',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'var(--primary-subtle, #F1F5F9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary, #0F172A)',
              }}
            >
              <Store size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Kitchen Counters & Hardware
              </h2>
              <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
                Configure counters and route tickets to specific thermal printers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              padding: '6px',
              borderRadius: '6px',
              cursor: 'pointer',
              color: '#64748B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* 2. Add Counter Card */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border, #E2E8F0)', backgroundColor: '#F8FAFC' }}>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                Add New Counter
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="e.g. Kitchen, Bar Counter, Grill, Dessert"
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
                    padding: '9px 16px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--primary, #0F172A)',
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
                  Add
                </button>
              </div>
            </div>

            {/* Optional Printer Device Settings Toggle */}
            <div>
              <button
                type="button"
                onClick={() => setShowPrinterSettings(!showPrinterSettings)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--primary, #2563eb)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Printer size={13} />
                <span>{showPrinterSettings ? 'Hide Printer Configuration' : 'Configure Printer for this Counter'}</span>
                {showPrinterSettings ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>

              {showPrinterSettings && (
                <div style={{ marginTop: '10px', padding: '12px', background: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '3px' }}>
                        Printer Name / Model
                      </label>
                      <input
                        type="text"
                        value={newPrinterName}
                        onChange={e => setNewPrinterName(e.target.value)}
                        placeholder="POS-80C, Bar-Printer"
                        style={{
                          width: '100%',
                          padding: '7px 10px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          fontSize: '12px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '3px' }}>
                        Connection Type
                      </label>
                      <select
                        value={newPrinterType}
                        onChange={e => setNewPrinterType(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '7px 10px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          fontSize: '12px',
                          backgroundColor: '#FFFFFF',
                          boxSizing: 'border-box',
                        }}
                      >
                        <option value="DEFAULT">Default / System</option>
                        <option value="USB">USB Cable</option>
                        <option value="BLUETOOTH">Bluetooth (Wireless)</option>
                        <option value="NETWORK">Network (LAN / Wi-Fi)</option>
                      </select>
                    </div>
                  </div>

                  {newPrinterType === 'NETWORK' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '3px' }}>
                        Network IP Address (e.g. 192.168.1.150)
                      </label>
                      <input
                        type="text"
                        value={newPrinterAddress}
                        onChange={e => setNewPrinterAddress(e.target.value)}
                        placeholder="192.168.1.150:9100"
                        style={{
                          width: '100%',
                          padding: '7px 10px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          fontSize: '12px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </form>
        </div>

        {/* 3. Counters List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94A3B8', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Configured Counters ({counters.length})</span>
          </div>

          {loading ? (
            <div style={{ padding: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <Loader2 size={24} className="animate-spin" style={{ color: '#94A3B8' }} />
            </div>
          ) : counters.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94A3B8', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px dashed #E2E8F0' }}>
              <Store size={28} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>No counters added yet</div>
              <p style={{ fontSize: '12px', margin: '4px 0 0 0' }}>Add your first counter above to assign products and configure printers.</p>
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
                        padding: '14px',
                        borderRadius: '10px',
                        border: '2px solid var(--primary, #0F172A)',
                        backgroundColor: '#FFFFFF',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                      }}
                    >
                      <div>
                        <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '3px' }}>
                          Counter Name
                        </label>
                        <input
                          type="text"
                          value={editingName}
                          onChange={e => setEditingName(e.target.value)}
                          autoFocus
                          style={{
                            width: '100%',
                            padding: '8px 10px',
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

                      {/* Printer Details in Edit Mode */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '3px' }}>
                            Printer Device Name
                          </label>
                          <input
                            type="text"
                            value={editingPrinterName}
                            onChange={e => setEditingPrinterName(e.target.value)}
                            placeholder="POS-80C, Bar-Printer"
                            style={{
                              width: '100%',
                              padding: '7px 10px',
                              borderRadius: '6px',
                              border: '1px solid #CBD5E1',
                              fontSize: '12px',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '3px' }}>
                            Connection Type
                          </label>
                          <select
                            value={editingPrinterType}
                            onChange={e => setEditingPrinterType(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '7px 10px',
                              borderRadius: '6px',
                              border: '1px solid #CBD5E1',
                              fontSize: '12px',
                              backgroundColor: '#FFFFFF',
                              boxSizing: 'border-box'
                            }}
                          >
                            <option value="DEFAULT">Default / System</option>
                            <option value="USB">USB Cable</option>
                            <option value="BLUETOOTH">Bluetooth (Wireless)</option>
                            <option value="NETWORK">Network (LAN / Wi-Fi)</option>
                          </select>
                        </div>
                      </div>

                      {editingPrinterType === 'NETWORK' && (
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '3px' }}>
                            Network IP / Address
                          </label>
                          <input
                            type="text"
                            value={editingPrinterAddress}
                            onChange={e => setEditingPrinterAddress(e.target.value)}
                            placeholder="192.168.1.150:9100"
                            style={{
                              width: '100%',
                              padding: '7px 10px',
                              borderRadius: '6px',
                              border: '1px solid #CBD5E1',
                              fontSize: '12px',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={editingActive}
                            onChange={e => setEditingActive(e.target.checked)}
                          />
                          Active Counter
                        </label>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            style={{
                              padding: '6px 12px',
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
                              padding: '6px 14px',
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
                            {savingEdit ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={counter.id}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '8px',
                      border: '1px solid var(--border, #E2E8F0)',
                      backgroundColor: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'border-color 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: counter.is_active !== false ? '#10B981' : '#94A3B8',
                          display: 'inline-block',
                          flexShrink: 0,
                          marginTop: '5px',
                        }}
                      />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {counter.name}
                          {counter.is_active === false && (
                            <span style={{ fontSize: '10px', color: '#EF4444', fontWeight: 600, background: '#FEE2E2', padding: '1px 5px', borderRadius: '4px' }}>
                              Inactive
                            </span>
                          )}
                        </div>

                        {/* Configured Printer Badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              color: '#475569',
                              backgroundColor: '#F1F5F9',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              fontWeight: 600,
                            }}
                          >
                            <Printer size={11} style={{ color: '#2563EB' }} />
                            <span>{counter.printer_name || 'POS-80C'}</span>
                            <span style={{ fontSize: '10px', color: '#94A3B8' }}>
                              ({counter.printer_type || 'DEFAULT'})
                            </span>
                          </span>

                          {counter.printer_address && (
                            <span style={{ fontSize: '10px', color: '#64748B', fontFamily: 'monospace' }}>
                              {counter.printer_address}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={() => handleStartEdit(counter)}
                        title="Configure Counter & Printer"
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '6px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          color: '#64748B',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'color 0.15s ease'
                        }}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(counter.id, counter.name)}
                        title="Delete Counter"
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '6px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          color: '#EF4444',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'color 0.15s ease'
                        }}
                      >
                        <Trash2 size={14} />
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
