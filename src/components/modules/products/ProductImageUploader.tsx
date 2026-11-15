'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, X, Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { imageKitService, MAX_IMAGE_SIZE_LABEL } from '@/app/services/imagekit.service';

interface ProductImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  folder?: string;
  disabled?: boolean;
}

export function ProductImageUploader({
  value,
  onChange,
  folder,
  disabled = false,
}: ProductImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setErrorMsg(null);

    // Client-side validation: Max 250 KB
    const validation = imageKitService.validateImage(file);
    if (!validation.valid) {
      const err = validation.error || 'Invalid image file';
      setErrorMsg(err);
      toast.error(err, { duration: 5000 });
      return;
    }

    setUploading(true);
    const toastId = toast.loading(`Uploading "${file.name}"...`);

    try {
      const res = await imageKitService.uploadImage(file, folder);
      if (res.success && res.data?.url) {
        onChange(res.data.url);
        toast.success('Image uploaded successfully!', { id: toastId });
        setErrorMsg(null);
      } else {
        const errorText = res.error || 'Failed to upload image';
        setErrorMsg(errorText);
        toast.error(errorText, { id: toastId });
      }
    } catch (err: any) {
      const msg = err?.message || 'Error uploading file';
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

  const handleRemoveImage = () => {
    onChange('');
    setErrorMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <style>{`
        .product-image-uploaded-card {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px;
          background-color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.03);
          flex-wrap: wrap;
        }
        .product-image-uploaded-info {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }
        .product-image-uploaded-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-left: auto;
        }
        @media (max-width: 440px) {
          .product-image-uploaded-actions {
            width: 100%;
            justify-content: flex-end;
            padding-top: 8px;
            border-top: 1px dashed #f1f5f9;
          }
        }
      `}</style>

      {/* Label and size notice */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
        <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', margin: 0 }}>
          Product Image <span style={{ fontWeight: 400, color: '#64748b', fontSize: '12px' }}>(Optional)</span>
        </label>
        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
          Max {MAX_IMAGE_SIZE_LABEL}
        </span>
      </div>

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={onFileInputChange}
        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
        style={{ display: 'none' }}
        disabled={disabled || uploading}
      />

      {/* Current Image View */}
      {value ? (
        <div className="product-image-uploaded-card" style={{ padding: '8px 12px' }}>
          <div className="product-image-uploaded-info" style={{ gap: '10px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '6px',
                overflow: 'hidden',
                backgroundColor: '#f1f5f9',
                border: '1px solid #cbd5e1',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                src={value}
                alt="Product thumbnail"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <CheckCircle2 size={14} style={{ color: '#16a34a', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>
                  Photo attached
                </span>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>
                Visible on customer menu
              </div>
            </div>
          </div>

          <div className="product-image-uploaded-actions" style={{ gap: '6px' }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || uploading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#f8fafc',
                color: '#334155',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'background-color 0.15s ease',
              }}
            >
              {uploading ? (
                <>
                  <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <RefreshCw size={12} />
                  <span>Replace</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleRemoveImage}
              disabled={disabled || uploading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                border: '1px solid #fee2e2',
                backgroundColor: '#fff5f5',
                color: '#dc2626',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              title="Remove image"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      ) : (
        /* Compact Horizontal Upload Dropzone */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !uploading && !disabled && fileInputRef.current?.click()}
          style={{
            border: `1.5px dashed ${dragOver ? '#0f172a' : errorMsg ? '#ef4444' : '#cbd5e1'}`,
            borderRadius: '8px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: dragOver ? '#f1f5f9' : uploading ? '#f8fafc' : '#ffffff',
            cursor: disabled || uploading ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '6px',
              backgroundColor: uploading ? '#e2e8f0' : '#f1f5f9',
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {uploading ? (
              <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <UploadCloud size={20} />
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', lineHeight: 1.3 }}>
              {uploading ? 'Uploading image...' : 'Upload product photo'}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              JPG, PNG, WebP • Under {MAX_IMAGE_SIZE_LABEL}
            </div>
          </div>

          <button
            type="button"
            disabled={disabled || uploading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 14px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#f8fafc',
              color: '#334155',
              fontSize: '12px',
              fontWeight: 600,
              cursor: disabled || uploading ? 'not-allowed' : 'pointer',
              flexShrink: 0,
            }}
          >
            Browse
          </button>
        </div>
      )}

      {/* Error message alert banner if any */}
      {errorMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            borderRadius: '6px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            fontSize: '12px',
          }}
        >
          <AlertCircle size={15} style={{ flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
