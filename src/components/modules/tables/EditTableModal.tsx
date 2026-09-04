import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { RestaurantTable } from '@/modules/tables/tables.repository';
import toast from 'react-hot-toast';
import { Edit2, Users, Hash, X } from 'lucide-react';

interface EditTableModalProps {
  isOpen: boolean;
  table: RestaurantTable | null;
  onClose: () => void;
  onSuccess: () => void;
  primaryColor?: string;
}

export function EditTableModal({
  isOpen,
  table,
  onClose,
  onSuccess,
  primaryColor = '#059669',
}: EditTableModalProps) {
  const [tableNumber, setTableNumber] = useState('');
  const [capacity, setCapacity] = useState('4');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (table) {
      setTableNumber(table.table_number || '');
      setCapacity(String(table.capacity || 4));
    }
  }, [table]);

  if (!isOpen || !table || !mounted) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNumber = tableNumber.trim();
    const numCapacity = parseInt(capacity, 10);

    if (!cleanNumber) {
      toast.error('Table name / number is required');
      return;
    }

    if (isNaN(numCapacity) || numCapacity < 1) {
      toast.error('Capacity must be at least 1');
      return;
    }

    setLoading(true);
    try {
      const slug = window.location.pathname.split('/')[1] || 'demo';
      const res = await fetch(`/api/tables/${table.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-restaurant-slug': slug,
        },
        body: JSON.stringify({
          table_number: cleanNumber,
          capacity: numCapacity,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Table updated successfully!');
        onSuccess();
        onClose();
      } else {
        toast.error(data.error || 'Failed to update table');
      }
    } catch {
      toast.error('Network error. Failed to update table.');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '440px',
          background: '#FFFFFF',
          borderRadius: '20px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out',
          padding: '24px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: `${primaryColor}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: primaryColor,
              }}
            >
              <Edit2 size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Edit Table #{table.table_number}
              </h3>
              <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0' }}>
                Update table name and seating capacity
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: '#F8FAFC',
              color: '#64748B',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              <Hash size={13} style={{ display: 'inline', marginRight: '4px' }} /> Table Name / Number
            </label>
            <input
              type="text"
              className="input"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              placeholder="e.g. 1 or T-1 or Patio 2"
              required
              disabled={loading}
              style={{ height: '42px', width: '100%' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              <Users size={13} style={{ display: 'inline', marginRight: '4px' }} /> Physical Seating Capacity
            </label>
            <input
              type="number"
              className="input"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              min="1"
              max="50"
              required
              disabled={loading}
              style={{ height: '42px', width: '100%' }}
            />
            <p style={{ fontSize: '11px', color: '#64748B', marginTop: '6px', lineHeight: 1.4 }}>
              Note: Single parties can exceed this capacity if table is empty. Multiple parties share up to this capacity.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
              style={{ flex: 1 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ flex: 1, background: primaryColor, borderColor: primaryColor }}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
