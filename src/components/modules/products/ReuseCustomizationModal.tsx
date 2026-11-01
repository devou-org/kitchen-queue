'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Copy, Check, Loader2, Sparkles, Layers, Sliders } from 'lucide-react';
import { CustomizationGroup, Product } from '@/types';

interface ReusableGroupItem {
  group: CustomizationGroup;
  sourceProductName: string;
}

interface ReuseCustomizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGroup: (group: CustomizationGroup) => void;
  existingGroupNames?: string[];
  slug: string;
}

export function ReuseCustomizationModal({
  isOpen,
  onClose,
  onSelectGroup,
  existingGroupNames = [],
  slug,
}: ReuseCustomizationModalProps) {
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [availableGroups, setAvailableGroups] = useState<ReusableGroupItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetchGroups();
      setSearchQuery('');
    }
  }, [isOpen, slug]);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const cleanSlug = (Array.isArray(slug) ? slug[0] : (slug || '')).replace(/[\[\]'"]/g, '').trim();
      const res = await fetch(`/api/products?slug=${encodeURIComponent(cleanSlug)}`, {
        headers: {
          'x-restaurant-slug': cleanSlug,
          'Authorization': `Bearer ${localStorage.getItem('admin_token') || localStorage.getItem('staff_token') || localStorage.getItem('auth_token') || ''}`,
        },
        cache: 'no-store',
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const list: ReusableGroupItem[] = [];
        const seen = new Set<string>();

        data.data.forEach((prod: Product) => {
          if (Array.isArray(prod.customization_groups)) {
            prod.customization_groups.forEach((g) => {
              if (g && g.name && g.name.trim() && Array.isArray(g.options) && g.options.length > 0) {
                // Deduplicate groups by name + options signature
                const optionsSig = g.options.map(o => `${o.name}:${o.price}`).sort().join('|');
                const key = `${g.name.trim().toLowerCase()}__${optionsSig}`;
                if (!seen.has(key)) {
                  seen.add(key);
                  list.push({
                    group: g,
                    sourceProductName: prod.name || 'Unnamed Product',
                  });
                }
              }
            });
          }
        });

        setAvailableGroups(list);
      }
    } catch (err) {
      console.error('Failed to load reusable customization groups:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return availableGroups;

    return availableGroups.filter(item => {
      const matchName = item.group.name.toLowerCase().includes(q);
      const matchProduct = item.sourceProductName.toLowerCase().includes(q);
      const matchOption = item.group.options?.some(o => o.name.toLowerCase().includes(q));
      return matchName || matchProduct || matchOption;
    });
  }, [availableGroups, searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(8px, 2.5vw, 20px)',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '620px',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Copy size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Reuse Customization Group
              </h2>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                Copy crusts, toppings, spice levels from other products without retyping
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search Bar */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by group name, topping, or product..."
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 12px 8px 34px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                color: '#0f172a',
                backgroundColor: '#ffffff',
                outline: 'none',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Group List Area */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {loading ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
              <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 10px auto', color: '#2563eb' }} />
              <p style={{ fontSize: '13px', margin: 0 }}>Finding customization groups from your menu...</p>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div
              style={{
                padding: '36px 20px',
                textAlign: 'center',
                backgroundColor: '#f8fafc',
                borderRadius: '10px',
                border: '1px dashed #cbd5e1',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  backgroundColor: '#ffffff',
                  color: '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px auto',
                  border: '1px solid #e2e8f0',
                }}
              >
                <Sliders size={20} />
              </div>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#334155', margin: '0 0 6px 0' }}>
                {searchQuery ? 'No matching customization groups' : 'No customization groups found'}
              </h3>
              <p style={{ fontSize: '12.5px', color: '#64748b', maxWidth: '380px', margin: '0 auto' }}>
                {searchQuery
                  ? `No groups found matching "${searchQuery}". Try a different keyword.`
                  : 'Groups you add to any product (e.g., "Choose Crust", "Spice Level") will automatically appear here so you can reuse them on all your other items!'}
              </p>
            </div>
          ) : (
            filteredGroups.map((item, idx) => {
              const isAlreadyAdded = existingGroupNames.some(
                name => name.trim().toLowerCase() === item.group.name.trim().toLowerCase()
              );

              return (
                <div
                  key={`${item.group.name}-${idx}`}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '14px',
                    backgroundColor: '#ffffff',
                    transition: 'all 0.15s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '12px',
                      marginBottom: '10px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                          {item.group.name}
                        </h4>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 7px',
                            borderRadius: '4px',
                            backgroundColor: item.group.min_selection > 0 ? '#fef3c7' : '#f1f5f9',
                            color: item.group.min_selection > 0 ? '#92400e' : '#475569',
                          }}
                        >
                          {item.group.min_selection > 0
                            ? `Required (Min ${item.group.min_selection}, Max ${item.group.max_selection})`
                            : `Optional (Max ${item.group.max_selection})`}
                        </span>
                      </div>
                      <p style={{ fontSize: '11.5px', color: '#64748b', margin: '3px 0 0 0' }}>
                        Used in: <strong style={{ color: '#475569' }}>{item.sourceProductName}</strong> · {item.group.options.length} options
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectGroup(item.group)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: isAlreadyAdded ? '1px solid #cbd5e1' : 'none',
                        backgroundColor: isAlreadyAdded ? '#f8fafc' : '#2563eb',
                        color: isAlreadyAdded ? '#334155' : '#ffffff',
                        fontSize: '12.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        flexShrink: 0,
                      }}
                    >
                      {isAlreadyAdded ? (
                        <>
                          <Check size={14} style={{ color: '#16a34a' }} />
                          <span>Add Copy</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} />
                          <span>Use Group</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Options Chips Preview */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flexWrap: 'wrap',
                      paddingTop: '8px',
                      borderTop: '1px solid #f1f5f9',
                    }}
                  >
                    {item.group.options.map((opt, oIdx) => (
                      <span
                        key={opt.id || oIdx}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '5px',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          fontSize: '11.5px',
                          color: '#334155',
                        }}
                      >
                        <span>{opt.name}</span>
                        {opt.price > 0 ? (
                          <span style={{ fontWeight: 700, color: '#16a34a' }}>+₹{opt.price}</span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>Free</span>
                        )}
                        {opt.is_default && (
                          <span style={{ fontSize: '10px', color: '#2563eb', fontWeight: 700 }}>✓</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            {availableGroups.length} group{availableGroups.length === 1 ? '' : 's'} available to reuse
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#475569',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
