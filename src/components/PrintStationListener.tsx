'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { useRestaurant } from '@/hooks/useRestaurant';
import { pusherClient } from '@/lib/pusher-client';
import { printUnifiedThermalTicket, printUnifiedBill, tryAutoConnectBluetooth } from '@/lib/hardware-printer';
import { PrinterIllustration } from '@/components/ui/PrinterIllustration';
import { useKeepAwake } from '@/hooks/useKeepAwake';

/**
 * Global Print Station Listener
 * ============================================================
 * Mounted in AdminLayout & StaffLayout so that when a device is designated as
 * the "Print Station", it listens for and prints incoming KOTs and Bills
 * across all pages (Orders, POS, Tables, Menu, Settings, etc.)
 * including manual prints requested from waiters' phones.
 * ============================================================
 */
export function PrintStationListener() {
  const params = useParams();
  const slug = params?.slug as string;
  const { restaurant } = useRestaurant();

  const isPrintStation = typeof window !== 'undefined' ? (localStorage.getItem('qdine_is_print_station') === '1') : false;

  // Keep screen awake while this device is acting as the print station
  useKeepAwake(isPrintStation);

  // Attempt to reconnect to paired Bluetooth printer on station startup
  useEffect(() => {
    if (typeof window !== 'undefined' && isPrintStation) {
      tryAutoConnectBluetooth();
    }
  }, [isPrintStation]);

  useEffect(() => {
    if (!pusherClient || !restaurant) return;

    const channelName = restaurant.pusher_channel;
    const channel = pusherClient.subscribe(channelName);

    // 1. KOT Print Handler (Automatic order creation or Manual click from waiter/staff)
    const handleKotAutoPrint = async (data: any) => {
      // Ignore test prints on PrintStationListener — test prints are handled directly by the Settings UI initiator
      if (data.is_test || data.ticket_number === 999 || String(data.order_id || '').startsWith('test-')) {
        return;
      }

      // Check if this device is designated as the print station
      const currentIsStation = typeof window !== 'undefined' ? (localStorage.getItem('qdine_is_print_station') === '1') : false;
      if (!currentIsStation) {
        return;
      }

      // If it's an automatic order creation event, verify auto-print is enabled on this device.
      // On designated Print Station, default auto-print to enabled unless explicitly set to 'false'.
      const autoPrint = typeof window !== 'undefined' ? (localStorage.getItem('qdine_auto_print_kot') !== 'false') : true;
      if (!data.is_manual && !autoPrint) {
        return;
      }

      // Only filter if this station is an explicitly locked dedicated KDS station
      const dedicatedStation = typeof window !== 'undefined' ? (localStorage.getItem('qdine_dedicated_kds_station') || '') : '';
      if (dedicatedStation && dedicatedStation !== '' && dedicatedStation.toLowerCase() !== (data.counter_name || '').toLowerCase()) {
        console.log(`[Auto-Print] Station is dedicated to "${dedicatedStation}"; skipping "${data.counter_name}" slip.`);
        return;
      }

      console.time(`[Perf] KOT #${data.ticket_number} Total`);
      console.log(`[Perf] Pusher event received for ticket #${data.ticket_number} at ${new Date().toISOString()}`);

      const printLabel = data.is_manual ? 'Printing KOT' : 'Auto-printing KOT';
      toast(`${printLabel} #${String(data.ticket_number).padStart(3, '0')} (${data.counter_name})...`, {
        icon: <PrinterIllustration size={22} status="printing" />,
        duration: 3000,
      });

      try {
        let base64Bytes = data.base64Bytes;
        if (!base64Bytes && data.print_job_id) {
          try {
            const currentSlug = Array.isArray(slug) ? slug[0] : (slug || '');
            const jobRes = await fetch(`/api/print/agent?jobId=${data.print_job_id}&slug=${encodeURIComponent(currentSlug)}`);
            if (jobRes.ok) {
              const jobData = await jobRes.json();
              if (jobData.job?.raw_base64) {
                base64Bytes = jobData.job.raw_base64;
              }
            }
          } catch (fetchErr) {
            console.error('Failed to fetch large print job payload:', fetchErr);
          }
        }

        const localKotPrinter = typeof window !== 'undefined' ? localStorage.getItem('qdine_kot_printer_name') : null;
        const targetKotPrinter = (data.printer_name && data.printer_name !== 'POS-80C') ? data.printer_name : (localKotPrinter || data.printer_name || 'POS-80C');
        const result = await printUnifiedThermalTicket({
          base64Bytes,
          kotData: data.kotData,
          printerName: targetKotPrinter,
          printerAddress: data.printer_address,
          counterId: data.counter_id,
          counterName: data.counter_name,
          isAutoPrint: true, // Print Station must always print silently; never open browser print dialog
        });

        if (result.duplicate) {
          console.log(`[PrintStationListener] Duplicate suppressed for #${data.ticket_number}`);
          return;
        }

        const label = data.is_add_on ? `Add-on KOT (${data.counter_name || 'Counter'})` : (data.counter_name || 'KOT');
        if (result.success) {
          toast.success(`Printed: ${label} #${String(data.ticket_number).padStart(3, '0')} (${result.method})`, {
            icon: <PrinterIllustration size={22} status="success" />,
            id: data.is_add_on ? `print-${data.order_id}-${data.counter_name}-${Date.now()}` : `print-${data.order_id}-${data.counter_name}`,
          });
        } else {
          toast.error(result.message || '⚠️ Thermal printer not paired. Tap "Pair Printer" in Settings.', {
            id: `print-unpaired`,
            duration: 6000,
          });
        }
      } catch (err: any) {
        console.error('KOT print execution error:', err);
      } finally {
        console.timeEnd(`[Perf] KOT #${data.ticket_number} Total`);
      }
    };

    // 2. Bill Print Handler (Manual click from waiter/staff phone)
    const handleBillPrint = async (data: any) => {
      // Ignore test bills on PrintStationListener
      if (data.is_test || data.ticket_number === 999 || String(data.order_id || '').startsWith('test-')) {
        return;
      }

      const currentIsStation = typeof window !== 'undefined' ? (localStorage.getItem('qdine_is_print_station') === '1') : false;
      if (!currentIsStation) {
        return;
      }

      toast(`Printing Bill #${String(data.ticket_number).padStart(3, '0')}...`, {
        icon: <PrinterIllustration size={22} status="printing" />,
        duration: 3000,
      });

      try {
        const localBillType = typeof window !== 'undefined' ? localStorage.getItem('qdine_bill_printer_type') : null;
        const localBillPrinter = typeof window !== 'undefined' ? (localStorage.getItem('qdine_bill_printer_name') || localStorage.getItem('qdine_kot_printer_name')) : null;
        const localBillAddress = typeof window !== 'undefined' ? localStorage.getItem('qdine_bill_printer_address') : null;
        const targetBillPrinter = (data.printer_name && data.printer_name !== 'POS-80C') ? data.printer_name : (localBillPrinter || data.printer_name || 'POS-80C');

        const result = await printUnifiedBill({
          base64Bytes: data.base64Bytes,
          billData: data.billData,
          billHtml: data.billHtml,
          printerName: targetBillPrinter,
          printerType: localBillType || data.printer_type || 'DEFAULT',
          printerAddress: localBillAddress || data.printer_address,
          ticketNumber: data.ticket_number,
          counterId: 'bill_printer',
          counterName: 'Bill Printer',
          isAutoPrint: true, // Print Station must always print silently; never open browser print dialog
        });

        if (result.success) {
          toast.success(`Bill #${String(data.ticket_number).padStart(3, '0')} printed (${result.method})`, {
            icon: <PrinterIllustration size={22} status="success" />,
            id: `bill-${data.order_id}-${Date.now()}`,
          });
        } else {
          toast.error(result.message || '⚠️ Thermal printer not paired for Bill.', {
            id: `bill-unpaired`,
            duration: 6000,
          });
        }
      } catch (err: any) {
        console.error('Bill print execution error on station:', err);
      }
    };

    channel.bind('kot_auto_print', handleKotAutoPrint);
    channel.bind('bill_print', handleBillPrint);

    return () => {
      channel.unbind('kot_auto_print', handleKotAutoPrint);
      channel.unbind('bill_print', handleBillPrint);
    };
  }, [restaurant, slug]);

  return null;
}
