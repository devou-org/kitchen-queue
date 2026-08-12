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

export interface BillRestaurantInfo {
  name: string;
  logo_url?: string;
  address?: string;
  phone?: string;
  gst_number?: string;
  primary_color?: string;
}

export interface BillProps {
  order: Order;
  restaurant: BillRestaurantInfo;
  onClose?: () => void;
}


function formatInvoiceDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  }).format(new Date(dateStr));
}

export default function BillTemplate({ order, restaurant, onClose }: BillProps) {
  const printRef = useRef<HTMLDivElement>(null);

  /**
   * Build the complete standalone HTML string for the bill.
   * Used by both print and PDF download.
   */
  const buildBillHTML = useCallback((content: string) => {
    const pc = restaurant.primary_color || '#971345';
    const ticketNum = String(order.ticket_number).padStart(3, '0');
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Bill #${ticketNum} - ${restaurant.name}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #1a1a1a; background: #fff; -webkit-font-smoothing: antialiased;
    }
    .bill-container { max-width: 380px; margin: 0 auto; padding: 28px 24px 20px; }
    @media print {
      body { background: #fff; }
      .bill-container { padding: 10px 12px; }
    }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;
  }, [order, restaurant]);

  const handlePrint = useCallback(() => {
    if (!printRef.current) return;
    const html = buildBillHTML(printRef.current.innerHTML);
    const printWindow = window.open('', '_blank', 'width=420,height=700');
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => setTimeout(() => printWindow.print(), 300);
  }, [buildBillHTML]);

  const handleDownloadPDF = useCallback(async () => {
    if (!printRef.current) return;
    try {
      const toastId = toast.loading('Generating PDF...', { icon: '⏳' });
      // Dynamically import html2pdf.js to avoid SSR issues
      const html2pdf = (await import('html2pdf.js')).default;
      
      const ticketNum = String(order.ticket_number).padStart(3, '0');
      const filename = `Bill_${ticketNum}_${restaurant.name.replace(/\s+/g, '_')}.pdf`;

      const opt = {
        margin:       [0.5, 0.5, 0.5, 0.5] as [number, number, number, number],
        filename:     filename,
        image:        { type: 'jpeg' as const, quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'in' as const, format: 'a4' as const, orientation: 'portrait' as const }
      };

      await html2pdf().set(opt).from(printRef.current).save();
      toast.success('PDF Downloaded!', { id: toastId });
    } catch (error) {
      console.error('PDF generation failed:', error);
      toast.error('Failed to generate PDF. Please use the Print button instead.');
    }
  }, [order, restaurant]);

  const invoiceDate = formatInvoiceDate(order.created_at);
  const items = order.items || [];
  const subtotal = items.reduce((s, item) => s + item.price_at_purchase * item.quantity, 0);
  const primaryColor = restaurant.primary_color || '#971345';

  // Determine order type label
  const getOrderTypeLabel = () => {
    if (order.table_number) return 'Dine-in';
    if ((order as any).order_type) return (order as any).order_type;
    return 'Dine-in';
  };

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
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 4px' }}>
          <div ref={printRef}>
            <div className="bill-container" style={{
              maxWidth: '380px',
              margin: '0 auto',
              padding: '28px 24px 20px',
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            }}>

              {/* Header: Logo + Restaurant Info */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '20px' }}>
                {restaurant.logo_url ? (
                  <img
                    src={restaurant.logo_url}
                    alt={restaurant.name}
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '10px',
                      objectFit: 'cover',
                      marginBottom: '8px',
                    }}
                  />
                ) : (
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '10px',
                    background: primaryColor,
                    color: '#fff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: '20px',
                    marginBottom: '8px',
                  }}>
                    {restaurant.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#1a1a1a', marginBottom: '2px' }}>
                  {restaurant.name}
                </h2>
                {(restaurant.address || restaurant.phone) && (
                  <p style={{ fontSize: '11px', color: '#6b7280', lineHeight: 1.5 }}>
                    {restaurant.address && <>{restaurant.address}<br /></>}
                    {restaurant.phone && <><br />Tel: {restaurant.phone}</>}
                    {restaurant.gst_number && <><br />GSTIN: <span style={{fontWeight: 700}}>{restaurant.gst_number}</span></>}
                  </p>
                )}
              </div>

              {/* Divider */}
              <hr style={{ border: 'none', borderTop: '2px solid #e5e7eb', margin: '14px 0' }} />

              {/* Order Meta */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', marginBottom: '4px' }}>
                <div>
                  <p style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Date & Time
                  </p>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{invoiceDate}</p>
                </div>
                <div>
                  <p style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Order Type
                  </p>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{getOrderTypeLabel()}</p>
                </div>
                {order.customer_name && (
                  <div>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Customer
                    </p>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{order.customer_name}</p>
                  </div>
                )}
                {order.table_number && (
                  <div>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Table No.
                    </p>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{order.table_number}</p>
                  </div>
                )}
                {!order.table_number && order.ticket_number && (
                  <div>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Token
                    </p>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                      #{String(order.ticket_number).padStart(3, '0')}
                    </p>
                  </div>
                )}
              </div>

              {/* Divider */}
              <hr style={{ border: 'none', borderTop: '1px dashed #d1d5db', margin: '14px 0' }} />

              {/* Itemized Table */}
              <div>
                {/* Header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 0.5fr 1fr 1fr',
                  gap: '8px',
                  padding: '8px 0',
                  borderBottom: '1px solid #e5e7eb',
                }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Item
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center' }}>
                    Qty
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>
                    Price
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>
                    Total
                  </span>
                </div>

                {/* Items */}
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 0.5fr 1fr 1fr',
                      gap: '8px',
                      padding: '8px 0',
                      borderBottom: '1px solid #f3f4f6',
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a' }}>
                      {item.product_name || 'Item'}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280', textAlign: 'center' }}>
                      {item.quantity}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280', textAlign: 'right' }}>
                      {formatPrice(item.price_at_purchase)}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a', textAlign: 'right' }}>
                      {formatPrice(item.price_at_purchase * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Divider */}
              <hr style={{ border: 'none', borderTop: '1px dashed #d1d5db', margin: '14px 0' }} />

              {/* Subtotal */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '4px 0',
              }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>Subtotal</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#374151' }}>{formatPrice(subtotal)}</span>
              </div>

              {/* GST Breakdown */}
              {(order as any).gst_type === 'REGULAR' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', color: '#4b5563' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500 }}>CGST {((order as any).gst_rate || 0) / 2}%</span>
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>{formatPrice(Math.round(((order as any).gst_amount || 0) / 2 * 100) / 100)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', color: '#4b5563' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500 }}>SGST {((order as any).gst_rate || 0) / 2}%</span>
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>{formatPrice(Math.round(((order as any).gst_amount || 0) / 2 * 100) / 100)}</span>
                  </div>
                  <hr style={{ border: 'none', borderTop: '1px dashed #d1d5db', margin: '4px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', color: '#1a1a1a' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>Total GST {((order as any).gst_rate || 0)}%</span>
                    <span style={{ fontSize: '13px', fontWeight: 700 }}>{formatPrice((order as any).gst_amount || 0)}</span>
                  </div>
                </>
              )}

              {/* Grand Total */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 0',
                marginTop: '4px',
                borderTop: `2px solid ${primaryColor}`,
              }}>
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#1a1a1a' }}>Grand Total</span>
                <span style={{ fontSize: '18px', fontWeight: 900, color: primaryColor }}>
                  {formatPrice(order.total_price)}
                </span>
              </div>

              {/* Footer */}
              <div style={{
                textAlign: 'center',
                marginTop: '20px',
                paddingTop: '16px',
                borderTop: '1px dashed #d1d5db',
              }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
                  Thank you for your visit!
                </p>
                <p style={{ fontSize: '11px', color: '#9ca3af', lineHeight: 1.6 }}>
                  We hope you enjoyed your meal.
                  <br />
                  Please visit us again!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
