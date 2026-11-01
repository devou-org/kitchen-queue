'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Minus, Check, UtensilsCrossed, AlertCircle } from 'lucide-react';
import {
  Product,
  ProductVariant,
  CustomizationGroup,
  CustomizationOption,
  SelectedVariantSnapshot,
  SelectedCustomizationSnapshot,
} from '@/types';
import { formatPrice } from '@/lib/format';
import { useRestaurant } from '@/hooks/useRestaurant';

export interface ProductCustomizationResult {
  product: Product;
  quantity: number;
  selected_variant: SelectedVariantSnapshot | null;
  selected_customizations: SelectedCustomizationSnapshot[];
  customization_summary: string | null;
  total_unit_price: number;
  notes?: string;
}

export interface ProductCustomizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  initialQuantity?: number;
  onConfirm: (result: ProductCustomizationResult) => void;
}

export function ProductCustomizationModal({
  isOpen,
  onClose,
  product,
  initialQuantity = 1,
  onConfirm,
}: ProductCustomizationModalProps) {
  const { restaurant } = useRestaurant();
  const primaryColor = restaurant?.primary_color || 'var(--primary, #059669)';

  const primarySoftBg = useMemo(() => {
    if (!restaurant?.primary_color) return 'rgba(5, 150, 105, 0.08)';
    let c = restaurant.primary_color.replace('#', '').trim();
    if (c.length === 3) c = c.split('').map((x) => x + x).join('');
    if (c.length === 6) {
      const num = parseInt(c, 16);
      return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, 0.08)`;
    }
    return 'rgba(5, 150, 105, 0.08)';
  }, [restaurant?.primary_color]);

  const [mounted, setMounted] = useState(false);
  const [quantity, setQuantity] = useState(initialQuantity);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedOptionsByGroup, setSelectedOptionsByGroup] = useState<Record<string, CustomizationOption[]>>({});
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Initialize or reset selections when modal opens or product changes
  useEffect(() => {
    if (!product || !isOpen) return;

    setQuantity(initialQuantity > 0 ? initialQuantity : 1);
    setNotes('');

    // 1. Pick default variant or first variant
    const variants = Array.isArray(product.variants) ? product.variants : [];
    if (variants.length > 0) {
      const inStockVariants = variants.filter(v => v.stock_quantity === undefined || v.stock_quantity === null || v.stock_quantity > 0);
      const defaultVar = inStockVariants.find((v) => v.is_default) || inStockVariants[0] || variants[0];
      setSelectedVariant(defaultVar);
    } else {
      setSelectedVariant(null);
    }

    // 2. Pick default customization options per group (skipping sold out options)
    const initialGroupSelections: Record<string, CustomizationOption[]> = {};
    const groups = Array.isArray(product.customization_groups) ? product.customization_groups : [];

    groups.forEach((grp) => {
      const inStockOpts = (grp.options || []).filter(o => o.stock_quantity === undefined || o.stock_quantity === null || o.stock_quantity > 0);
      const defaultOpts = inStockOpts.filter((o) => o.is_default);
      if (defaultOpts.length > 0) {
        // Enforce max_selection constraint on initial defaults
        const max = grp.max_selection > 0 ? grp.max_selection : 1;
        initialGroupSelections[grp.id] = defaultOpts.slice(0, max);
      } else if (grp.min_selection > 0 && inStockOpts.length > 0) {
        // If required and no explicit default, preselect the first available in-stock option
        initialGroupSelections[grp.id] = [inStockOpts[0]];
      } else {
        initialGroupSelections[grp.id] = [];
      }
    });

    setSelectedOptionsByGroup(initialGroupSelections);
  }, [product, isOpen, initialQuantity]);

  // Variant change handler
  const handleSelectVariant = (v: ProductVariant) => {
    if (v.stock_quantity !== undefined && v.stock_quantity !== null && v.stock_quantity <= 0) return;
    setSelectedVariant(v);
  };

  // Option selection handler for a group
  const handleToggleOption = (group: CustomizationGroup, option: CustomizationOption) => {
    if (option.stock_quantity !== undefined && option.stock_quantity !== null && option.stock_quantity <= 0) return;
    const groupId = group.id;
    const current = selectedOptionsByGroup[groupId] || [];
    const isAlreadySelected = current.some((o) => o.id === option.id);

    if (group.max_selection === 1) {
      // Single choice (radio-style behavior)
      if (isAlreadySelected && group.min_selection === 0) {
        // Allowed to deselect if optional
        setSelectedOptionsByGroup((prev) => ({
          ...prev,
          [groupId]: [],
        }));
      } else {
        setSelectedOptionsByGroup((prev) => ({
          ...prev,
          [groupId]: [option],
        }));
      }
    } else {
      // Multiple choice (checkbox-style behavior)
      if (isAlreadySelected) {
        setSelectedOptionsByGroup((prev) => ({
          ...prev,
          [groupId]: current.filter((o) => o.id !== option.id),
        }));
      } else {
        if (group.max_selection > 0 && current.length >= group.max_selection) {
          // If already reached max, do not add more
          return;
        }
        setSelectedOptionsByGroup((prev) => ({
          ...prev,
          [groupId]: [...current, option],
        }));
      }
    }
  };

  // Validation: Check if every group satisfies min_selection
  const validationErrors = useMemo(() => {
    if (!product) return [];
    const errors: string[] = [];
    const groups = Array.isArray(product.customization_groups) ? product.customization_groups : [];

    groups.forEach((grp) => {
      const selected = selectedOptionsByGroup[grp.id] || [];
      if (grp.min_selection > 0 && selected.length < grp.min_selection) {
        errors.push(`Please select at least ${grp.min_selection} option for "${grp.name}"`);
      }
    });

    if (selectedVariant && typeof selectedVariant.stock_quantity === 'number') {
      if (selectedVariant.stock_quantity <= 0) {
        errors.push(`"${selectedVariant.name}" is sold out`);
      } else if (quantity > selectedVariant.stock_quantity) {
        errors.push(`Only ${selectedVariant.stock_quantity} available for "${selectedVariant.name}"`);
      }
    }

    return errors;
  }, [product, selectedOptionsByGroup, selectedVariant, quantity]);

  // Unit price calculation (variant or base product price + all selected options)
  const unitPrice = useMemo(() => {
    if (!product) return 0;
    const base = selectedVariant ? Number(selectedVariant.price) : Number(product.price);
    let addonsTotal = 0;

    Object.values(selectedOptionsByGroup).forEach((opts) => {
      opts.forEach((o) => {
        addonsTotal += Number(o.price) || 0;
      });
    });

    return Math.round((base + addonsTotal) * 100) / 100;
  }, [product, selectedVariant, selectedOptionsByGroup]);

  const totalPrice = Math.round(unitPrice * quantity * 100) / 100;

  // Build summary text (options/add-ons only; variant is tracked separately in selected_variant)
  const customizationSummary = useMemo(() => {
    const allSelectedOpts: string[] = [];
    Object.values(selectedOptionsByGroup).forEach((opts) => {
      opts.forEach((o) => {
        allSelectedOpts.push(o.name);
      });
    });
    return allSelectedOpts.length > 0 ? allSelectedOpts.join(', ') : null;
  }, [selectedOptionsByGroup]);

  const handleConfirm = () => {
    if (!product) return;
    if (validationErrors.length > 0) return;

    const variantSnapshot: SelectedVariantSnapshot | null = selectedVariant
      ? {
          id: selectedVariant.id,
          name: selectedVariant.name,
          price: Number(selectedVariant.price),
        }
      : null;

    const selectedCustomizationsSnapshot: SelectedCustomizationSnapshot[] = [];
    const groups = Array.isArray(product.customization_groups) ? product.customization_groups : [];

    groups.forEach((grp) => {
      const opts = selectedOptionsByGroup[grp.id] || [];
      opts.forEach((o) => {
        selectedCustomizationsSnapshot.push({
          group_id: grp.id,
          group_name: grp.name,
          option_id: o.id,
          option_name: o.name,
          price: Number(o.price),
        });
      });
    });

    onConfirm({
      product,
      quantity,
      selected_variant: variantSnapshot,
      selected_customizations: selectedCustomizationsSnapshot,
      customization_summary: customizationSummary,
      total_unit_price: unitPrice,
      notes: notes.trim() || undefined,
    });

    onClose();
  };

  if (!isOpen || !product || !mounted) return null;

  const variants = Array.isArray(product.variants) ? product.variants : [];
  const groups = Array.isArray(product.customization_groups) ? product.customization_groups : [];

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: 0,
        transition: 'opacity 0.2s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '88vh',
          backgroundColor: '#ffffff',
          borderRadius: '16px 16px 0 0',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <style>{`
          @keyframes slideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
          @media (min-width: 640px) {
            .customization-modal-box {
              border-radius: 12px !important;
              margin-bottom: 24px !important;
            }
          }
        `}</style>

        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#ffffff',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            {product.dietary_preference && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '18px',
                  height: '18px',
                  borderRadius: '4px',
                  border: `1.5px solid ${product.dietary_preference === 'VEG' ? '#16a34a' : '#dc2626'}`,
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: product.dietary_preference === 'VEG' ? '#16a34a' : '#dc2626',
                  }}
                />
              </span>
            )}
            <div style={{ minWidth: 0 }}>
              <h2
                style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  color: '#0f172a',
                  margin: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {product.name}
              </h2>
              <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                Base {formatPrice(Number(product.price))}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#f1f5f9',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body - Scrollable */}
        <div
          style={{
            padding: '18px 20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {/* Section 1: Variants (Sizes / Portions) */}
          {variants.length > 0 && (
            <div>
              <div style={{ marginBottom: '10px' }}>
                <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a' }}>
                  Choose Size / Portion
                </span>
                <span style={{ fontSize: '11.5px', color: '#ef4444', marginLeft: '6px', fontWeight: 600 }}>
                  * Required
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
                {variants.map((v) => {
                  const isSelected = selectedVariant?.id === v.id;
                  const isOutOfStock = v.stock_quantity !== undefined && v.stock_quantity !== null && v.stock_quantity <= 0;
                  const isLowStock = v.stock_quantity !== undefined && v.stock_quantity !== null && v.stock_quantity > 0 && v.stock_quantity <= 5;

                  return (
                    <div
                      key={v.id}
                      onClick={() => !isOutOfStock && handleSelectVariant(v)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: isSelected ? `2px solid ${primaryColor}` : '1px solid #e2e8f0',
                        backgroundColor: isSelected ? primarySoftBg : isOutOfStock ? '#f8fafc' : '#ffffff',
                        cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                        opacity: isOutOfStock ? 0.55 : 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: isSelected ? primaryColor : '#0f172a' }}>
                          {v.name}
                        </span>
                        {isOutOfStock ? (
                          <span style={{ fontSize: '9.5px', color: '#ef4444', fontWeight: 700, backgroundColor: '#fef2f2', border: '1px solid #fecaca', padding: '1px 5px', borderRadius: '4px' }}>
                            Sold Out
                          </span>
                        ) : (
                          <div
                            style={{
                              width: '16px',
                              height: '16px',
                              borderRadius: '50%',
                              border: isSelected ? `5px solid ${primaryColor}` : '1.5px solid #cbd5e1',
                              backgroundColor: '#ffffff',
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                        <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#475569' }}>
                          {formatPrice(Number(v.price))}
                        </span>
                        {isLowStock && (
                          <span style={{ fontSize: '10px', color: '#d97706', fontWeight: 700, backgroundColor: '#fffbeb', padding: '1px 4px', borderRadius: '3px' }}>
                            {v.stock_quantity} left
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 2: Customization Groups */}
          {groups.map((group) => {
            const selectedOpts = selectedOptionsByGroup[group.id] || [];
            const isSingle = group.max_selection === 1;
            const isRequired = group.min_selection > 0;
            const reachedMax = group.max_selection > 0 && selectedOpts.length >= group.max_selection;

            let ruleText = '';
            if (isRequired && isSingle) ruleText = 'Choose 1 (Required)';
            else if (!isRequired && isSingle) ruleText = 'Choose up to 1 (Optional)';
            else if (isRequired && group.max_selection > 1) ruleText = `Choose ${group.min_selection} - ${group.max_selection}`;
            else if (!isRequired && group.max_selection > 1) ruleText = `Choose up to ${group.max_selection}`;

            return (
              <div
                key={group.id}
                style={{
                  borderTop: '1px solid #f1f5f9',
                  paddingTop: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div>
                    <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a' }}>
                      {group.name}
                    </span>
                    {isRequired && (
                      <span style={{ fontSize: '11.5px', color: '#ef4444', marginLeft: '6px', fontWeight: 600 }}>
                        *
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: isRequired && selectedOpts.length < group.min_selection ? '#d97706' : '#64748b',
                      backgroundColor: isRequired && selectedOpts.length < group.min_selection ? '#fef3c7' : '#f1f5f9',
                      padding: '2px 8px',
                      borderRadius: '12px',
                    }}
                  >
                    {ruleText}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {(group.options || []).map((opt) => {
                    const isSelected = selectedOpts.some((o) => o.id === opt.id);
                    const isOutOfStock = opt.stock_quantity !== undefined && opt.stock_quantity !== null && opt.stock_quantity <= 0;
                    const isLowStock = opt.stock_quantity !== undefined && opt.stock_quantity !== null && opt.stock_quantity > 0 && opt.stock_quantity <= 5;
                    const isDisabled = isOutOfStock || (!isSingle && !isSelected && reachedMax);

                    return (
                      <div
                        key={opt.id}
                        onClick={() => !isOutOfStock && (!isDisabled || isSingle) && handleToggleOption(group, opt)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: isSelected ? `1.5px solid ${primaryColor}` : '1px solid #e2e8f0',
                          backgroundColor: isSelected ? primarySoftBg : isDisabled ? '#f8fafc' : '#ffffff',
                          cursor: isDisabled ? 'not-allowed' : 'pointer',
                          opacity: isDisabled ? 0.6 : 1,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: isSingle ? '50%' : '4px',
                              border: isSelected ? 'none' : '1.5px solid #cbd5e1',
                              backgroundColor: isSelected ? primaryColor : '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#ffffff',
                              flexShrink: 0,
                            }}
                          >
                            {isSelected && <Check size={12} strokeWidth={3} />}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '13px', fontWeight: isSelected ? 700 : 500, color: isSelected ? primaryColor : '#0f172a' }}>
                              {opt.name}
                            </span>
                            {isOutOfStock && (
                              <span style={{ fontSize: '9.5px', color: '#ef4444', fontWeight: 700, backgroundColor: '#fef2f2', border: '1px solid #fecaca', padding: '1px 5px', borderRadius: '4px' }}>
                                Sold Out
                              </span>
                            )}
                            {isLowStock && (
                              <span style={{ fontSize: '10px', color: '#d97706', fontWeight: 700, backgroundColor: '#fffbeb', padding: '1px 4px', borderRadius: '3px' }}>
                                ({opt.stock_quantity} left)
                              </span>
                            )}
                          </div>
                        </div>

                        <span style={{ fontSize: '12.5px', fontWeight: 600, color: Number(opt.price) > 0 ? primaryColor : '#16a34a' }}>
                          {Number(opt.price) > 0 ? `+${formatPrice(Number(opt.price))}` : 'Free'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Section 3: Item Note */}
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
              Special Kitchen Instructions <span style={{ fontWeight: 400, color: '#94a3b8' }}>(Optional)</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Extra spicy, no onions, sauce on the side..."
                maxLength={100}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  color: '#0f172a',
                  outline: 'none',
                }}
              />
            </div>
          </div>
        </div>

        {/* Modal Sticky Footer */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexShrink: 0,
          }}
        >
          {/* Quantity Stepper */}
          {(() => {
            const maxAllowed = typeof selectedVariant?.stock_quantity === 'number'
              ? Math.max(0, selectedVariant.stock_quantity)
              : 50;
            const isVariantSoldOut = typeof selectedVariant?.stock_quantity === 'number' && selectedVariant.stock_quantity <= 0;

            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1 || isVariantSoldOut}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: quantity <= 1 || isVariantSoldOut ? '#f8fafc' : '#ffffff',
                    color: quantity <= 1 || isVariantSoldOut ? '#cbd5e1' : '#0f172a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: quantity <= 1 || isVariantSoldOut ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Minus size={14} />
                </button>
                <span style={{ fontSize: '14px', fontWeight: 700, minWidth: '24px', textAlign: 'center' }}>
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(maxAllowed, q + 1))}
                  disabled={quantity >= maxAllowed || isVariantSoldOut}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: quantity >= maxAllowed || isVariantSoldOut ? '#f8fafc' : '#ffffff',
                    color: quantity >= maxAllowed || isVariantSoldOut ? '#cbd5e1' : '#0f172a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: quantity >= maxAllowed || isVariantSoldOut ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Plus size={14} />
                </button>
              </div>
            );
          })()}

          {/* Confirm Button */}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={validationErrors.length > 0}
            style={{
              flex: 1,
              height: '42px',
              padding: '0 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: validationErrors.length > 0 ? '#94a3b8' : primaryColor,
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '13.5px',
              cursor: validationErrors.length > 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)',
              transition: 'all 0.2s ease',
            }}
          >
            <span>Add to Cart</span>
            <span>{formatPrice(totalPrice)}</span>
          </button>
        </div>

        {/* Validation Warning Alert if any group constraint violated */}
        {validationErrors.length > 0 && (
          <div
            style={{
              padding: '6px 20px',
              backgroundColor: '#fef2f2',
              color: '#b91c1c',
              fontSize: '11.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderTop: '1px solid #fee2e2',
            }}
          >
            <AlertCircle size={13} style={{ flexShrink: 0 }} />
            <span>{validationErrors[0]}</span>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
