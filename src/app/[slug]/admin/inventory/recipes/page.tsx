'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  ChefHat,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Trash2,
  Loader2,
  X,
  Boxes,
  UtensilsCrossed,
  DollarSign,
  Layers,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminContentWrapper } from '@/components/AdminContentWrapper';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { InventoryNav } from '@/components/modules/inventory/InventoryNav';
import { InventoryModal } from '@/components/modules/inventory/InventoryModal';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { inventoryService } from '@/app/services/inventory.api';
import { productService } from '@/app/services/products.api';
import { Product } from '@/types';
import { Recipe, InventoryItem, RecipeItem } from '@/types/inventory';
import { formatPrice } from '@/lib/format';

interface RecipeLineItem {
  item_id: string;
  quantity: number | string;
  unit: string;
  notes?: string;
}

export default function RecipesPage() {
  const { slug } = useParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [servings, setServings] = useState<number | string>(1);
  const [instructions, setInstructions] = useState('');
  const [lines, setLines] = useState<RecipeLineItem[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodRes, recRes, ingRes] = await Promise.all([
        productService.getAllProductsAdmin(),
        inventoryService.getRecipes(),
        inventoryService.getItems({ is_active: true }),
      ]);
      if (prodRes.success && prodRes.data) setProducts(prodRes.data);
      if (recRes.success && recRes.data) setRecipes(recRes.data);
      if (ingRes.success && ingRes.data) setIngredients(ingRes.data);
    } catch {
      toast.error('Network error loading recipes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const recipeMap = new Map<string, Recipe>();
  recipes.forEach((r) => recipeMap.set(r.product_id, r));

  const handleOpenConfigure = (product: Product) => {
    setSelectedProduct(product);
    const existing = recipeMap.get(product.id);

    if (existing) {
      setServings(existing.yield_servings || 1);
      setInstructions(existing.instructions || '');
      setLines(
        existing.items.map((it) => ({
          item_id: it.item_id,
          quantity: it.quantity,
          unit: it.unit || 'kg',
          notes: it.notes || '',
        }))
      );
    } else {
      setServings(1);
      setInstructions('');
      setLines([
        {
          item_id: ingredients[0]?.id || '',
          quantity: 1,
          unit: ingredients[0]?.unit || 'kg',
          notes: '',
        },
      ]);
    }
    setModalOpen(true);
  };

  const handleItemSelect = (index: number, itemId: string) => {
    const ing = ingredients.find((i) => i.id === itemId);
    const updated = [...lines];
    updated[index].item_id = itemId;
    if (ing) updated[index].unit = ing.unit;
    setLines(updated);
  };

  const handleAddLine = () => {
    setLines([
      ...lines,
      {
        item_id: ingredients[0]?.id || '',
        quantity: 1,
        unit: ingredients[0]?.unit || 'kg',
        notes: '',
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, field: keyof RecipeLineItem, val: any) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: val };
    setLines(updated);
  };

  // Recipe cost calculation
  const computedRecipeCost = lines.reduce((sum, l) => {
    const ing = ingredients.find((i) => i.id === l.item_id);
    const qty = Number(l.quantity) || 0;
    const cost = ing?.cost_per_unit || 0;
    return sum + qty * cost;
  }, 0);

  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.item_id) {
        toast.error(`Please pick an ingredient for ingredient line #${i + 1}`);
        return;
      }
      if (!Number(l.quantity) || Number(l.quantity) <= 0) {
        toast.error(`Please enter valid portion quantity for line #${i + 1}`);
        return;
      }
    }

    setSaving(true);
    try {
      const res = await inventoryService.upsertRecipe({
        product_id: selectedProduct.id,
        instructions: instructions.trim() || undefined,
        yield_servings: Number(servings || 1),
        items: lines.map((l) => ({
          item_id: l.item_id,
          quantity: Number(l.quantity),
          unit: l.unit,
          notes: l.notes?.trim() || undefined,
        })),
      });

      if (res.success) {
        toast.success(`Recipe saved for ${selectedProduct.name}!`);
        setModalOpen(false);
        fetchData();
      } else {
        toast.error(res.error || 'Failed to save recipe');
      }
    } catch {
      toast.error('Network error saving recipe');
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminContentWrapper>
      <AdminPageHeader
        title="Recipe / Bill of Materials (BOM)"
        subtitle="Map Menu Products to exact inventory portions. When orders are placed or prepared, inventory is deducted automatically."
      />

      <InventoryNav />

      {/* Search & Stats */}
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
        <div style={{ position: 'relative', width: '300px', maxWidth: '100%' }}>
          <Search
            size={16}
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}
          />
          <input
            type="text"
            placeholder="Search menu items..."
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '13px', color: '#64748B' }}>
          <span>
            Recipes Configured: <strong style={{ color: '#16A34A' }}>{recipes.length}</strong> / {products.length}
          </span>
        </div>
      </div>

      {/* Menu Products & Recipes List */}
      {loading ? (
        <div style={{ padding: '80px', textAlign: 'center', color: '#94A3B8' }}>
          <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 10px' }} />
          Loading menu recipes...
        </div>
      ) : filteredProducts.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px dashed #CBD5E1' }}>
          <UtensilsCrossed size={40} style={{ margin: '0 auto 10px', color: '#94A3B8' }} />
          <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#0F172A' }}>No menu products found</h4>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {filteredProducts.map((p) => {
            const recipe = recipeMap.get(p.id);
            const isConfigured = Boolean(recipe && recipe.items.length > 0);

            return (
              <div
                key={p.id}
                className="card"
                style={{
                  padding: '18px',
                  borderRadius: '12px',
                  border: isConfigured ? '1px solid #BBF7D0' : '1px solid var(--border)',
                  backgroundColor: '#FFFFFF',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                }}
              >
                <div>
                  {/* Top: Menu Name & Price */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                    <div>
                      <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                        {p.name}
                      </h4>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#16A34A', marginTop: '2px' }}>
                        Selling Price: {formatPrice(p.price)}
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        backgroundColor: isConfigured ? '#F0FDF4' : '#FFFBEB',
                        color: isConfigured ? '#16A34A' : '#D97706',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {isConfigured ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                      <span>{isConfigured ? 'Recipe Active' : 'No Recipe'}</span>
                    </span>
                  </div>

                  {/* Ingredient Portions preview */}
                  <div
                    style={{
                      padding: '10px 12px',
                      backgroundColor: '#F8FAFC',
                      borderRadius: '8px',
                      margin: '12px 0',
                      minHeight: '64px',
                    }}
                  >
                    {!isConfigured ? (
                      <div style={{ fontSize: '12px', color: '#94A3B8', fontStyle: 'italic', paddingTop: '10px' }}>
                        No ingredients linked. Order placements will not deduct raw stock.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '2px' }}>
                          Portions per serving:
                        </div>
                        {recipe!.items.slice(0, 4).map((it: RecipeItem, idx: number) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#334155' }}>
                            <span>• {it.item_name}</span>
                            <span style={{ fontWeight: 700 }}>
                              {it.quantity} {it.unit}
                            </span>
                          </div>
                        ))}
                        {recipe!.items.length > 4 && (
                          <div style={{ fontSize: '11px', color: '#2563EB', fontWeight: 600 }}>
                            +{recipe!.items.length - 4} more ingredients...
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Food Cost Margin */}
                  {isConfigured && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: '#64748B', marginBottom: '10px' }}>
                      <span>Raw Ingredient Cost:</span>
                      <span style={{ fontWeight: 700, color: '#0F172A' }}>
                        {formatPrice(recipe!.total_cost || 0)}
                        {p.price > 0 && recipe!.total_cost ? (
                          <span style={{ fontSize: '10px', color: '#16A34A', marginLeft: '6px' }}>
                            ({Math.round(((recipe!.total_cost || 0) / p.price) * 100)}% food cost)
                          </span>
                        ) : null}
                      </span>
                    </div>
                  )}
                </div>

                {/* Configure Button */}
                <button
                  type="button"
                  onClick={() => handleOpenConfigure(p)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: isConfigured ? '1px solid #CBD5E1' : 'none',
                    background: isConfigured ? '#FFFFFF' : 'var(--primary, #971345)',
                    color: isConfigured ? '#0F172A' : '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <ChefHat size={14} />
                  <span>{isConfigured ? 'Edit Recipe Ingredients' : 'Configure Recipe'}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Configure Recipe Modal */}
      <InventoryModal
        isOpen={modalOpen && Boolean(selectedProduct)}
        onClose={() => setModalOpen(false)}
        title={`Recipe BOM: ${selectedProduct?.name || ''}`}
        subtitle="Define portions deducted per order of this dish."
        icon={<ChefHat size={20} style={{ color: '#0F172A' }} />}
        maxWidth="720px"
      >
        <form onSubmit={handleSaveRecipe} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Servings */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Yield Servings
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={servings}
                    onChange={(e) => setServings(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Prep / Chef Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Grill patty 4 mins per side, toast bun"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Recipe Lines */}
              <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A', textTransform: 'uppercase' }}>
                    Ingredients List ({lines.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      background: '#EFF6FF',
                      color: '#2563EB',
                      border: '1px solid #DBEAFE',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <Plus size={12} />
                    <span>Add Ingredient</span>
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {lines.map((line, idx) => {
                    const ing = ingredients.find((i) => i.id === line.item_id);
                    const lineCost = (Number(line.quantity) || 0) * (ing?.cost_per_unit || 0);

                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '2fr 1fr 1fr 1.5fr auto',
                          gap: '8px',
                          alignItems: 'center',
                          padding: '10px',
                          backgroundColor: '#F8FAFC',
                          borderRadius: '8px',
                          border: '1px solid #E2E8F0',
                        }}
                      >
                        {/* Ingredient Select */}
                        <div>
                          <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748B' }}>Ingredient</label>
                          <CustomSelect
                            buttonStyle={{ height: '36px', borderRadius: '6px', fontSize: '12px' }}
                            value={line.item_id}
                            onChange={(val) => handleItemSelect(idx, val)}
                            placeholder="Select Ingredient"
                            options={[
                              { value: '', label: 'Select Ingredient' },
                              ...ingredients.map((it) => ({
                                value: it.id,
                                label: `${it.name} (${it.unit})`,
                              })),
                            ]}
                          />
                        </div>

                        {/* Quantity */}
                        <div>
                          <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748B' }}>
                            Portion ({line.unit})
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0.001"
                            placeholder="Qty"
                            value={line.quantity}
                            onChange={(e) => handleLineChange(idx, 'quantity', e.target.value)}
                            required
                            style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px', boxSizing: 'border-box' }}
                          />
                        </div>

                        {/* Cost */}
                        <div>
                          <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748B' }}>Cost</label>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', paddingTop: '6px' }}>
                            {formatPrice(lineCost)}
                          </div>
                        </div>

                        {/* Notes */}
                        <div>
                          <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748B' }}>Notes</label>
                          <input
                            type="text"
                            placeholder="e.g. Sliced, minced"
                            value={line.notes || ''}
                            onChange={(e) => handleLineChange(idx, 'notes', e.target.value)}
                            style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px', boxSizing: 'border-box' }}
                          />
                        </div>

                        {/* Delete button */}
                        <div>
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(idx)}
                            disabled={lines.length <= 1}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: lines.length <= 1 ? '#CBD5E1' : '#EF4444',
                              cursor: lines.length <= 1 ? 'not-allowed' : 'pointer',
                              padding: '6px 2px',
                              marginTop: '14px',
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Total Recipe Cost Summary */}
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>
                    Menu Selling Price: {formatPrice(selectedProduct.price)}
                  </div>
                  <div style={{ fontSize: '11px', color: '#16A34A', fontWeight: 600 }}>
                    Estimated Margin: {formatPrice(Math.max(0, selectedProduct.price - computedRecipeCost))}
                  </div>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 900, color: '#0F172A' }}>
                  Total Ingredient Cost: {formatPrice(computedRecipeCost)}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
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
                    padding: '9px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--primary, #971345)',
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
                  <span>Save Recipe & Link Inventory</span>
                </button>
              </div>
            </form>
      </InventoryModal>
    </AdminContentWrapper>
  );
}

