'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';
import { 
  ArrowLeft, 
  Sparkles, 
  Plus, 
  Edit3, 
  Trash2, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  Layers, 
  X, 
  Eye, 
  EyeOff,
  RefreshCw
} from 'lucide-react';

interface SystemUpdate {
  id: string;
  version_tag: string | null;
  title: string;
  description: string;
  learn_more_url: string | null;
  is_published: boolean;
  published_at: string;
  created_at: string;
  updated_at: string;
}

const EMPTY_UPDATE_FORM = {
  version_tag: '',
  title: '',
  description: '',
  learn_more_url: '',
  is_published: true,
};

export default function SuperAdminUpdatesPage() {
  const router = useRouter();
  const [updates, setUpdates] = useState<SystemUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SystemUpdate | null>(null);
  const [form, setForm] = useState(EMPTY_UPDATE_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchUpdates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/super-admin/updates', { credentials: 'include' });
      if (res.status === 401) {
        router.push('/super-admin/login');
        return;
      }
      const data = await res.json();
      if (data.success) {
        setUpdates(data.data || []);
      } else {
        toast.error(data.error || 'Failed to load updates');
      }
    } catch {
      toast.error('Network error loading updates');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchUpdates();
  }, [fetchUpdates]);

  const openCreateModal = () => {
    setEditingItem(null);
    setForm(EMPTY_UPDATE_FORM);
    setModalOpen(true);
  };

  const openEditModal = (item: SystemUpdate) => {
    setEditingItem(item);
    setForm({
      version_tag: item.version_tag || '',
      title: item.title,
      description: item.description,
      learn_more_url: item.learn_more_url || '',
      is_published: item.is_published,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!form.description.trim()) {
      toast.error('Description is required');
      return;
    }

    setSaving(true);
    try {
      const url = editingItem
        ? `/api/super-admin/updates/${editingItem.id}`
        : '/api/super-admin/updates';
      const method = editingItem ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(editingItem ? 'Update saved!' : 'Update published!');
        setModalOpen(false);
        fetchUpdates();
      } else {
        toast.error(data.error || 'Failed to save update');
      }
    } catch {
      toast.error('Network error saving update');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this patch update?')) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/super-admin/updates/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Update deleted');
        setUpdates(prev => prev.filter(u => u.id !== id));
      } else {
        toast.error(data.error || 'Failed to delete');
      }
    } catch {
      toast.error('Network error deleting update');
    } finally {
      setDeletingId(null);
    }
  };

  const handleTogglePublish = async (item: SystemUpdate) => {
    try {
      const nextStatus = !item.is_published;
      const res = await fetch(`/api/super-admin/updates/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: item.title,
          version_tag: item.version_tag,
          description: item.description,
          learn_more_url: item.learn_more_url,
          is_published: nextStatus,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(nextStatus ? 'Update published to all restaurants' : 'Update reverted to draft');
        setUpdates(prev => prev.map(u => u.id === item.id ? { ...u, is_published: nextStatus } : u));
      } else {
        toast.error(data.error || 'Failed to toggle status');
      }
    } catch {
      toast.error('Network error');
    }
  };

  const publishedCount = updates.filter(u => u.is_published).length;
  const draftCount = updates.length - publishedCount;

  return (
    <div style={styles.page}>
      <Toaster position="top-right" />

      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button 
            type="button" 
            onClick={() => router.push('/super-admin')}
            style={styles.backBtn}
            title="Back to Dashboard"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Sparkles size={18} />
              </div>
              <h1 style={styles.headerTitle}>Updates & Patches</h1>
            </div>
            <p style={styles.headerSub}>Manage changelogs and system patch notes displayed to restaurant admins</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button 
            type="button" 
            onClick={fetchUpdates} 
            disabled={loading}
            style={styles.refreshBtn}
            title="Refresh list"
          >
            <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <button 
            type="button" 
            onClick={openCreateModal}
            style={styles.createBtn}
          >
            <Plus size={16} /> New Patch Note
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, background: '#EFF6FF', color: '#2563EB' }}>
            <Layers size={22} />
          </div>
          <div>
            <div style={styles.statValue}>{updates.length}</div>
            <div style={styles.statLabel}>Total Patches</div>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, background: '#ECFDF5', color: '#059669' }}>
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div style={styles.statValue}>{publishedCount}</div>
            <div style={styles.statLabel}>Live / Published</div>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, background: '#FFFBEB', color: '#D97706' }}>
            <Clock size={22} />
          </div>
          <div>
            <div style={styles.statValue}>{draftCount}</div>
            <div style={styles.statLabel}>Drafts</div>
          </div>
        </div>
      </div>

      {/* List */}
      <div style={styles.cardContainer}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748B' }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
            <p style={{ margin: 0, fontWeight: 600 }}>Loading system updates...</p>
          </div>
        ) : updates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748B' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#F1F5F9', color: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Sparkles size={28} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: '0 0 6px' }}>No updates published yet</h3>
            <p style={{ fontSize: '13px', color: '#64748B', maxWidth: '380px', margin: '0 auto 20px' }}>
              Create your first update note. It will instantly show up under "Updates and Patches" in every restaurant's Settings page.
            </p>
            <button onClick={openCreateModal} style={styles.createBtn}>
              <Plus size={16} /> Create First Update
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {updates.map(item => (
              <div 
                key={item.id} 
                style={{
                  ...styles.updateRow,
                  borderLeft: item.is_published ? '4px solid #10B981' : '4px solid #F59E0B'
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    {item.version_tag && (
                      <span style={styles.versionBadge}>
                        {item.version_tag}
                      </span>
                    )}
                    <h3 style={styles.updateTitle}>{item.title}</h3>
                    <span style={item.is_published ? styles.liveBadge : styles.draftBadge}>
                      {item.is_published ? 'Published' : 'Draft'}
                    </span>
                    <span style={styles.dateLabel}>
                      {new Date(item.published_at || item.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </div>

                  <div style={styles.descriptionBox}>
                    {item.description.split('\n').map((line, idx) => (
                      <p key={idx} style={{ margin: '3px 0', lineHeight: 1.5 }}>
                        {line}
                      </p>
                    ))}
                  </div>

                  {item.learn_more_url && (
                    <div style={{ marginTop: '10px' }}>
                      <a 
                        href={item.learn_more_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={styles.learnMoreLink}
                      >
                        Learn more <ExternalLink size={13} />
                      </a>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={styles.actionCol}>
                  <button
                    type="button"
                    onClick={() => handleTogglePublish(item)}
                    style={{
                      ...styles.actionBtn,
                      color: item.is_published ? '#D97706' : '#059669',
                      backgroundColor: item.is_published ? '#FEF3C7' : '#ECFDF5'
                    }}
                    title={item.is_published ? 'Unpublish (hide from restaurants)' : 'Publish (make visible)'}
                  >
                    {item.is_published ? <EyeOff size={15} /> : <Eye size={15} />}
                    <span>{item.is_published ? 'Unpublish' : 'Publish'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openEditModal(item)}
                    style={{ ...styles.actionBtn, color: '#334155', backgroundColor: '#F1F5F9' }}
                    title="Edit Update"
                  >
                    <Edit3 size={15} />
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                    style={{ ...styles.actionBtn, color: '#DC2626', backgroundColor: '#FEE2E2' }}
                    title="Delete Update"
                  >
                    <Trash2 size={15} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalBox}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: '#EFF6FF',
                  color: '#2563EB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Sparkles size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>
                  {editingItem ? 'Edit Patch Update' : 'New System Update'}
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setModalOpen(false)}
                style={styles.closeBtn}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '12px' }}>
                <div>
                  <label style={styles.inputLabel}>Version (e.g. v1.2.5)</label>
                  <input
                    type="text"
                    placeholder="v1.2.5"
                    value={form.version_tag}
                    onChange={e => setForm(f => ({ ...f, version_tag: e.target.value }))}
                    style={styles.inputField}
                  />
                </div>
                <div>
                  <label style={styles.inputLabel}>Update Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. October Maintenance & KOT Stability"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    style={styles.inputField}
                  />
                </div>
              </div>

              <div>
                <label style={styles.inputLabel}>
                  Changelog / Description * (Supports bullet points or paragraphs)
                </label>
                <textarea
                  required
                  rows={6}
                  placeholder={`- All bug fixes\n- Faster Bluetooth auto-printing\n- Upgraded order flow and UI responsiveness\n- Added loyalty free items breakdown`}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  style={{ ...styles.inputField, resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>

              <div>
                <label style={styles.inputLabel}>Learn More Link (Optional Hyperlink)</label>
                <input
                  type="url"
                  placeholder="https://getqdine.com/updates/v1-2-5"
                  value={form.learn_more_url}
                  onChange={e => setForm(f => ({ ...f, learn_more_url: e.target.value }))}
                  style={styles.inputField}
                />
                <span style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', display: 'block' }}>
                  Restaurants will see a clickable "Learn more ↗" link leading to this URL.
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '4px' }}>
                <input
                  type="checkbox"
                  id="is_published"
                  checked={form.is_published}
                  onChange={e => setForm(f => ({ ...f, is_published: e.target.checked }))}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#2563EB' }}
                />
                <label htmlFor="is_published" style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A', cursor: 'pointer' }}>
                  Publish immediately (Visible in Restaurant Admin Settings)
                </label>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={styles.cancelBtn}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={styles.submitBtn}
                >
                  {saving ? 'Saving...' : editingItem ? 'Save Changes' : 'Publish Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#F8FAFC',
    fontFamily: "'Inter', sans-serif",
    padding: '32px 40px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '28px',
    flexWrap: 'wrap',
    gap: '16px',
  },
  backBtn: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    border: '1px solid #E2E8F0',
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  headerTitle: {
    fontSize: '24px',
    fontWeight: 800,
    color: '#0F172A',
    margin: 0,
    letterSpacing: '-0.02em',
  },
  headerSub: {
    fontSize: '13px',
    color: '#64748B',
    margin: '4px 0 0 0',
  },
  refreshBtn: {
    height: '40px',
    width: '40px',
    borderRadius: '10px',
    border: '1px solid #E2E8F0',
    backgroundColor: '#FFFFFF',
    color: '#475569',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  createBtn: {
    height: '40px',
    padding: '0 18px',
    borderRadius: '10px',
    backgroundColor: '#0F172A',
    color: '#FFFFFF',
    fontSize: '13px',
    fontWeight: 700,
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(15, 23, 42, 0.15)',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
    marginBottom: '28px',
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '14px',
    padding: '18px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
  },
  statIcon: {
    width: '46px',
    height: '46px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statValue: {
    fontSize: '22px',
    fontWeight: 800,
    color: '#0F172A',
  },
  statLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#64748B',
    marginTop: '2px',
  },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.03)',
  },
  updateRow: {
    padding: '20px',
    borderRadius: '12px',
    backgroundColor: '#F8FAFC',
    border: '1px solid #E2E8F0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '20px',
    flexWrap: 'wrap',
  },
  versionBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    fontSize: '11px',
    fontWeight: 800,
    borderRadius: '6px',
    backgroundColor: '#DBEAFE',
    color: '#1E40AF',
    letterSpacing: '0.02em',
  },
  updateTitle: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#0F172A',
    margin: 0,
  },
  liveBadge: {
    padding: '2px 8px',
    fontSize: '11px',
    fontWeight: 700,
    borderRadius: '12px',
    backgroundColor: '#DCFCE7',
    color: '#15803D',
  },
  draftBadge: {
    padding: '2px 8px',
    fontSize: '11px',
    fontWeight: 700,
    borderRadius: '12px',
    backgroundColor: '#FEF3C7',
    color: '#B45309',
  },
  dateLabel: {
    fontSize: '12px',
    color: '#94A3B8',
    fontWeight: 500,
  },
  descriptionBox: {
    fontSize: '13px',
    color: '#334155',
    marginTop: '6px',
  },
  learnMoreLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    fontWeight: 700,
    color: '#2563EB',
    textDecoration: 'none',
  },
  actionCol: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexShrink: 0,
  },
  actionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '8px',
    border: 'none',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '20px',
  },
  modalBox: {
    width: '100%',
    maxWidth: '560px',
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
    overflow: 'hidden',
    animation: 'fadeIn 0.15s ease-out',
  },
  modalHeader: {
    padding: '18px 24px',
    borderBottom: '1px solid #E2E8F0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#64748B',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px',
    borderRadius: '6px',
  },
  inputLabel: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 700,
    color: '#334155',
    marginBottom: '6px',
  },
  inputField: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #CBD5E1',
    fontSize: '13px',
    color: '#0F172A',
    outline: 'none',
    boxSizing: 'border-box',
  },
  cancelBtn: {
    padding: '10px 18px',
    borderRadius: '8px',
    border: '1px solid #CBD5E1',
    backgroundColor: '#FFFFFF',
    color: '#334155',
    fontWeight: 700,
    fontSize: '13px',
    cursor: 'pointer',
  },
  submitBtn: {
    padding: '10px 22px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#0F172A',
    color: '#FFFFFF',
    fontWeight: 700,
    fontSize: '13px',
    cursor: 'pointer',
  },
};

