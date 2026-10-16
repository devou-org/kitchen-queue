'use client';
import { useRef, useCallback } from 'react';
import { Order } from '@/types';
import { formatPrice } from '@/lib/format';
import { Printer, Download, X } from 'lucide-react';

import toast from 'react-hot-toast';

// ============================================
// BILL TEMPLATE — Single Source of Truth
// Every invoice across the application uses
// this component for a consistent layout.
// ============================================
import {
  BillRestaurantInfo,
  formatInvoiceDate,
  generateBillTemplateHTML,
  generateBillTemplateContentHTML,
  printBillTemplateDirectly,
} from '@/lib/bill-template-html';

export type { BillRestaurantInfo };
export {
  formatInvoiceDate,
  generateBillTemplateHTML,
  generateBillTemplateContentHTML,
  printBillTemplateDirectly,
};

export interface BillProps {
  order: Order;
  restaurant: BillRestaurantInfo;
  onClose?: () => void;
}

export default function BillTemplate({ order, restaurant, onClose }: BillProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useCallback(() => {
    try {
      printBillTemplateDirectly(order, restaurant);
    } catch (err) {
      console.error('Print bill error:', err);
      toast.error('Failed to open print dialog');
    }
  }, [order, restaurant]);

  const handleDownloadPDF = useCallback(async () => {
    if (!printRef.current) return;
    try {
      const toastId = toast.loading('Generating PDF...', { icon: '⏳' });
      const html2pdf = (await import('html2pdf.js')).default;

      const rawTicket = String(order.ticket_number ?? '');
      const ticketNum = /^\d+$/.test(rawTicket) ? rawTicket.padStart(3, '0') : (rawTicket || '001');
      const filename = `Bill_${ticketNum}_${(restaurant?.name || 'Restaurant').replace(/\s+/g, '_')}.pdf`;

      const opt = {
        margin: [0.3, 0.3, 0.3, 0.3] as [number, number, number, number],
        filename: filename,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in' as const, format: 'a4' as const, orientation: 'portrait' as const },
      };

      await html2pdf().set(opt).from(printRef.current).save();
      toast.success('PDF Downloaded!', { id: toastId });
    } catch (error) {
      console.error('PDF generation failed:', error);
      toast.error('Failed to generate PDF. Please use the Print button instead.');
    }
  }, [order, restaurant]);

  const billContentHtml = generateBillTemplateContentHTML(order, restaurant);
  const primaryColor = restaurant?.primary_color || '#059669';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        animation: 'fadeIn 0.2s ease',
        padding: '16px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '420px',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0,0,0,0.2)',
          animation: 'slideUp 0.3s ease',
        }}
      >
        {/* Action Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid #f3f4f6',
            flexShrink: 0,
          }}
        >
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#1a1a1a' }}>Invoice</h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={handleDownloadPDF}
              title="Save as PDF"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '99px',
                border: `1.5px solid ${primaryColor}`,
                background: 'transparent',
                color: primaryColor,
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <Download size={14} />
              PDF
            </button>
            <button
              onClick={handlePrint}
              title="Print Invoice"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '99px',
                border: 'none',
                background: primaryColor,
                color: 'white',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <Printer size={14} />
              Print
            </button>
            {onClose && (
              <button
                onClick={onClose}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: 'none',
                  background: '#f3f4f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#6b7280',
                  transition: 'all 0.2s ease',
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Bill Content */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 16px', background: '#f8fafc' }}>
          <div
            ref={printRef}
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
              overflow: 'hidden',
            }}
            dangerouslySetInnerHTML={{ __html: billContentHtml }}
          />
        </div>
      </div>
    </div>
  );
}

