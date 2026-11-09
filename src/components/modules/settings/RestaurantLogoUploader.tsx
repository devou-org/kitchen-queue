'use client';

import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  X, 
  Loader2, 
  CheckCircle2, 
  Store, 
  RefreshCw, 
  Link as LinkIcon,
  Image as ImageIcon
} from 'lucide-react';
import toast from 'react-hot-toast';
import { imageKitService, MAX_IMAGE_SIZE_LABEL } from '@/app/services/imagekit.service';

interface RestaurantLogoUploaderProps {
  value: string;
  onChange: (url: string) => void;
  restaurantName?: string;
  primaryColor?: string;
  disabled?: boolean;
}

export function RestaurantLogoUploader({
  value,
  onChange,
  restaurantName = '',
  primaryColor = '#971345',
  disabled = false,
}: RestaurantLogoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setErrorMsg(null);

    // Validate size and format
    const validation = imageKitService.validateImage(file);
    if (!validation.valid) {
      const err = validation.error || 'Invalid image file';
      setErrorMsg(err);
      toast.error(err, { duration: 5000 });
      return;
    }

    setUploading(true);
    const toastId = toast.loading(`Uploading "${file.name}" to ImageKit...`);

    try {
      const res = await imageKitService.uploadImage(file, '/logos');
      if (res.success && res.data?.url) {
        onChange(res.data.url);
        toast.success('Restaurant logo uploaded successfully!', { id: toastId });
        setErrorMsg(null);
      } else {
        const errorText = res.error || 'Failed to upload logo';
        setErrorMsg(errorText);
        toast.error(errorText, { id: toastId });
      }
    } catch (err: any) {
      const msg = err?.message || 'Error uploading logo to ImageKit';
      setErrorMsg(msg);
      toast.error(msg, { id: toastId });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (disabled || uploading) return;

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !uploading) {
      setDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleRemove = () => {
    onChange('');
    setErrorMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={onFileInputChange}
        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
        style={{ display: 'none' }}
        disabled={disabled || uploading}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ImageIcon size={15} style={{ color: '#059669' }} />
          Restaurant Brand Logo
        </label>
        <button
          type="button"
          onClick={() => setManualMode(!manualMode)}
          style={{
            background: 'none',
            border: 'none',
            color: '#64748b',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            textDecoration: 'underline'
          }}
        >
          <LinkIcon size={11} />
          {manualMode ? 'Switch to Upload' : 'Enter URL instead'}
        </button>
      </div>

      {manualMode ? (
        /* Manual URL input fallback */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <input
            type="url"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="https://ik.imagekit.io/... or https://..."
            disabled={disabled}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box',
              backgroundColor: '#ffffff'
            }}
          />
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            Paste any direct image URL or ImageKit CDN link.
          </span>
        </div>
      ) : (
        /* ImageKit Upload UI */
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Logo Preview Avatar */}
          <div
            style={{
              width: '74px',
              height: '74px',
              borderRadius: '12px',
              backgroundColor: '#f1f5f9',
              border: '2px dashed #cbd5e1',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
              position: 'relative'
            }}
          >
            {value ? (
              <img
                src={value}
                alt={restaurantName || 'Restaurant Logo'}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div style={{
                width: '100%',
                height: '100%',
                backgroundColor: primaryColor,
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '26px'
              }}>
                {restaurantName ? restaurantName.charAt(0).toUpperCase() : <Store size={28} />}
              </div>
            )}
          </div>

          {/* Upload Drag & Drop Box */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            style={{
              flex: 1,
              minWidth: '220px',
              border: dragOver ? '2px dashed #059669' : '1px dashed #cbd5e1',
              backgroundColor: dragOver ? '#ecfdf5' : '#f8fafc',
              borderRadius: '10px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              transition: 'all 0.15s ease'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {value ? (
                  <CheckCircle2 size={15} style={{ color: '#059669' }} />
                ) : (
                  <UploadCloud size={16} style={{ color: '#059669' }} />
                )}
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                  {value ? 'Logo Uploaded' : 'Upload Logo via ImageKit'}
                </span>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  backgroundColor: '#ecfdf5',
                  color: '#059669',
                  padding: '1px 6px',
                  borderRadius: '4px'
                }}>
                  Max {MAX_IMAGE_SIZE_LABEL}
                </span>
              </div>
              <p style={{ fontSize: '11px', color: '#64748b', margin: '3px 0 0 0' }}>
                PNG, JPG, WEBP, SVG • Auto-optimized with ImageKit CDN
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || uploading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: disabled || uploading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                }}
              >
                {uploading ? (
                  <>
                    <Loader2 size={13} className="animate-spin" style={{ color: '#059669' }} />
                    <span>Uploading...</span>
                  </>
                ) : value ? (
                  <>
                    <RefreshCw size={12} />
                    <span>Replace</span>
                  </>
                ) : (
                  <>
                    <UploadCloud size={13} style={{ color: '#059669' }} />
                    <span>Browse</span>
                  </>
                )}
              </button>

              {value && (
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={disabled || uploading}
                  title="Remove logo"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '30px',
                    height: '30px',
                    borderRadius: '6px',
                    border: '1px solid #fecaca',
                    backgroundColor: '#fef2f2',
                    color: '#dc2626',
                    cursor: 'pointer'
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {errorMsg && (
        <div style={{ fontSize: '12px', color: '#dc2626', fontWeight: 600, marginTop: '2px' }}>
          {errorMsg}
        </div>
      )}
    </div>
  );
}
