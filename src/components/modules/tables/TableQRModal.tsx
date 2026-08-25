import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { X, Printer, Download, ExternalLink } from 'lucide-react';
import { RestaurantTable } from '@/modules/tables/tables.repository';

interface TableQRModalProps {
  table: RestaurantTable | null;
  restaurantName?: string;
  restaurantLogo?: string;
  onClose: () => void;
  primaryColor?: string;
}

export function TableQRModal({ table, restaurantName = 'Qdine', restaurantLogo, onClose, primaryColor = '#059669' }: TableQRModalProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!table || !mounted) return null;

  const qrUrl = table.qr_code_url || `https://qdinetest.devou.in/demo/menu?table=${encodeURIComponent(table.table_number)}`;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Table ${table.table_number} QR Code - ${restaurantName}</title>
          <style>
            body { font-family: system-ui, sans-serif; text-align: center; padding: 40px; }
            .card { border: 2px solid #000; padding: 30px; border-radius: 16px; display: inline-block; max-width: 320px; }
            h1 { margin: 0 0 4px; font-size: 24px; }
            p { color: #666; font-size: 14px; margin: 0 0 20px; }
            .table-badge { background: #000; color: #fff; padding: 6px 16px; border-radius: 20px; font-weight: bold; display: inline-block; margin-bottom: 20px; font-size: 18px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>${restaurantName}</h1>
            <p>Scan to view Menu & Order directly</p>
            <div class="table-badge">TABLE #${table.table_number}</div>
            <br />
            ${qrRef.current?.innerHTML || ''}
            <p style="margin-top: 20px; font-size: 12px;">Capacity: ${table.capacity} Persons</p>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return createPortal(
    <div
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
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '380px',
          background: '#FFFFFF',
          borderRadius: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #F1F5F9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', margin: 0 }}>Table {table.table_number} QR Code</h3>
            <p style={{ fontSize: '11px', color: '#64748B', margin: '2px 0 0' }}>Scan to order directly at Table {table.table_number}</p>
          </div>
          <button
            onClick={onClose}
            style={{ border: 'none', background: '#F8FAFC', color: '#64748B', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* QR Code Container */}
        <div style={{ padding: '24px', textAlign: 'center', background: '#F8FAFC' }}>
          <div
            ref={qrRef}
            style={{
              background: '#FFFFFF',
              padding: '20px',
              borderRadius: '20px',
              border: '1px solid #E2E8F0',
              display: 'inline-block',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
            }}
          >
            <QRCodeSVG
              value={qrUrl}
              size={200}
              level="H"
              includeMargin={true}
              fgColor={primaryColor}
            />
          </div>

          <div style={{ marginTop: '16px' }}>
            <span style={{
              background: primaryColor,
              color: '#FFFFFF',
              padding: '4px 14px',
              borderRadius: '20px',
              fontWeight: 800,
              fontSize: '14px',
              letterSpacing: '0.04em'
            }}>
              TABLE #{table.table_number}
            </span>
            <p style={{ fontSize: '12px', color: '#64748B', marginTop: '8px' }}>
              Seating Capacity: <strong>{table.capacity} Persons</strong>
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid #F1F5F9', display: 'flex', gap: '10px' }}>
          <a
            href={qrUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '12px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#334155',
              fontWeight: 700,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              textDecoration: 'none'
            }}
          >
            <ExternalLink size={15} /> Test Link
          </a>
          <button
            onClick={handlePrint}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '12px',
              border: 'none',
              background: primaryColor,
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <Printer size={15} /> Print QR Code
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
