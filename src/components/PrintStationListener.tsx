'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { useRestaurant } from '@/hooks/useRestaurant';
import { pusherClient } from '@/lib/pusher-client';
import {
  printUnifiedThermalTicket,
  printUnifiedBill,
  tryAutoConnectBluetooth,
} from '@/lib/hardware-printer';
import { isQzConnected, connectQzTray } from '@/lib/qz-printer';
import { PrinterIllustration } from '@/components/ui/PrinterIllustration';
import { useKeepAwake } from '@/hooks/useKeepAwake';

/**
 * Check if the current browser/device is acting as the Print Station / Hub.
 * Automatically true on desktop PCs running QZ Tray or designated in settings ('qdine_is_print_station' === '1').
 * Guards against waiter mobile phones hijacking station print traffic.
 */
export function isDevicePrintStation(): boolean {
  if (typeof window === 'undefined') return false;
  const explicit = localStorage.getItem('qdine_is_print_station');
  if (explicit === '1') return true;
  if (explicit === '0') return false;

  // If QZ Tray is active or previously connected on this desktop PC, it IS the print station
  if (isQzConnected() || localStorage.getItem('qdine_qz_active') === '1') {
    return true;
  }

  // Desktop PCs default to true, while mobile phones default to false
  const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
  return !isMobile;
}

function getAuthHeaders(currentSlug: string) {
  const token = typeof window !== 'undefined'
    ? (localStorage.getItem('admin_token') || localStorage.getItem('staff_token') || '')
    : '';
  return {
    'Content-Type': 'application/json',
    'x-restaurant-slug': currentSlug,
    'Authorization': `Bearer ${token}`,
  };
}

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
  const [stationActive, setStationActive] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isAndroid = /android/i.test(navigator.userAgent);
      if (!isAndroid) {
        // Automatically connect to local QZ Tray on desktop so incoming orders can print immediately
        connectQzTray(1)
          .then((res) => {
            if (res.success) {
              localStorage.setItem('qdine_qz_active', '1');
              localStorage.setItem('qdine_is_print_station', '1');
              setStationActive(true);
            }
          })
          .catch(() => { });
      }

      const isStation = isDevicePrintStation();
      setStationActive(isStation);
      if (isStation) {
        // Default auto-print to enabled on hub if not explicitly disabled
        if (localStorage.getItem('qdine_auto_print_kot') === null) {
          localStorage.setItem('qdine_auto_print_kot', 'true');
        }
        if (localStorage.getItem('qdine_auto_print_bill') === null) {
          localStorage.setItem('qdine_auto_print_bill', 'true');
        }
        tryAutoConnectBluetooth();
      }
    }
  }, []);

  // Keep screen awake while this device is acting as the print station
  useKeepAwake(stationActive);

  useEffect(() => {
    if (!pusherClient || !restaurant) return;

    // Subscribe to standard channel pattern, ignoring deprecated pusher_channel column
    const channelName = `queue-channel-${restaurant.id}`;
    const channel = pusherClient.subscribe(channelName);

    // 1. KOT Print Handler (Automatic order creation or Manual click from waiter/staff)
    const handleKotAutoPrint = async (data: any) => {
      // Ignore test prints on PrintStationListener — test prints are handled directly by Settings UI
      if (data.is_test || data.ticket_number === 999 || String(data.order_id || '').startsWith('test-')) {
        return;
      }

      // Check if this device is designated as the print station
      const currentIsStation = isDevicePrintStation();
      if (!currentIsStation) {
        console.warn(`[PrintStationListener] Ignored KOT #${data.ticket_number} (${data.counter_name}): device is not registered as print station (qdine_is_print_station=${localStorage.getItem('qdine_is_print_station')})`);
        return;
      }

      // If it's an automatic order creation event, verify auto-print is enabled on this device.
      // If manual print request from waiter/staff (data.is_manual), ALWAYS PRINT regardless of auto-print toggle.
      const autoPrint = typeof window !== 'undefined' ? (localStorage.getItem('qdine_auto_print_kot') !== 'false') : true;
      if (!data.is_manual && !autoPrint) {
        console.warn(`[PrintStationListener] Ignored KOT #${data.ticket_number}: auto-print disabled (qdine_auto_print_kot=${localStorage.getItem('qdine_auto_print_kot')})`);
        return;
      }

      // Only filter if this station is an explicitly locked dedicated KDS station
      const dedicatedStation = typeof window !== 'undefined' ? (localStorage.getItem('qdine_dedicated_kds_station') || '') : '';
      if (dedicatedStation && dedicatedStation !== '' && dedicatedStation.toLowerCase() !== (data.counter_name || '').toLowerCase()) {
        console.log(`[Auto-Print] Station is dedicated to "${dedicatedStation}"; skipping "${data.counter_name}" slip.`);
        return;
      }

      console.time(`[Perf] KOT #${data.ticket_number} Total`);
      console.log(`[Perf] Pusher event received for ticket #${data.ticket_number} at ${new Date().toISOString()}`, data);

      const printLabel = data.is_manual ? 'Printing KOT' : 'Auto-printing KOT';
      toast(`${printLabel} #${String(data.ticket_number).padStart(3, '0')} (${data.counter_name})...`, {
        icon: <PrinterIllustration size={22} status="printing" />,
        duration: 3000,
      });

      const currentSlug = Array.isArray(slug) ? slug[0] : (slug || '');

      try {
        let base64Bytes = data.base64Bytes;
        if (!base64Bytes && data.print_job_id) {
          try {
            const jobRes = await fetch(`/api/print/agent?jobId=${data.print_job_id}&slug=${encodeURIComponent(currentSlug)}`, {
              headers: getAuthHeaders(currentSlug),
            });
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

        // If payload is still missing, notify and return
        if (!base64Bytes && !data.kotData) {
          toast.error('Could not load print data');
          return;
        }

        const localKotPrinter = typeof window !== 'undefined' ? (localStorage.getItem('qdine_kot_printer_name') || localStorage.getItem('qdine_bt_printer_name')) : null;
        const counterSavedDev = (typeof window !== 'undefined' && data.counter_name)
          ? localStorage.getItem(`qdine_bt_counter_${data.counter_name.trim().toLowerCase()}`)
          : null;
        const isMasterKot = !data.counter_name || data.counter_name.trim().toUpperCase() === 'ALL' || data.counter_name.trim().toUpperCase() === 'ALL ITEMS' || data.counter_name.trim().toUpperCase() === 'MASTER';

        let targetKotPrinter = counterSavedDev || (data.printer_name && data.printer_name !== 'POS-80C' ? data.printer_name : null) || localKotPrinter;

        if (!targetKotPrinter && isMasterKot && typeof window !== 'undefined') {
          targetKotPrinter = localStorage.getItem('qdine_bill_printer_name');
          if (!targetKotPrinter) {
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (k && k.startsWith('qdine_bt_counter_')) {
                const val = localStorage.getItem(k)?.trim();
                if (val && val.toUpperCase() !== 'POS-80C') {
                  targetKotPrinter = val;
                  break;
                }
              }
            }
          }
        }
        if (!targetKotPrinter) targetKotPrinter = 'POS-80C';
        const result = await printUnifiedThermalTicket({
          base64Bytes,
          kotData: data.kotData,
          printerName: targetKotPrinter,
          printerAddress: data.printer_address,
          printerType: data.printer_type,
          counterId: data.counter_id,
          counterName: data.counter_name,
          isAutoPrint: true, // Print Station must always print silently; never open browser print dialog
          skipDuplicateCheck: true, // PrintStationListener already deduplicated at entry!
        });

        const label = data.is_add_on ? `Add-on KOT (${data.counter_name || 'Counter'})` : (data.counter_name || 'KOT');
        if (result.success) {
          toast.success(`Printed: ${label} #${String(data.ticket_number).padStart(3, '0')} (${result.method})`, {
            icon: <PrinterIllustration size={22} status="success" />,
            id: data.is_add_on ? `print-${data.order_id}-${data.counter_name}-${Date.now()}` : `print-${data.order_id}-${data.counter_name}`,
          });

          // Fire-and-forget mark print job complete on server
          if (data.print_job_id) {
            fetch('/api/print/agent', {
              method: 'POST',
              headers: getAuthHeaders(currentSlug),
              body: JSON.stringify({ slug: currentSlug, action: 'complete', jobId: data.print_job_id }),
            }).catch((err) => console.warn('Failed to mark print job complete:', err));
          }
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

      const currentIsStation = isDevicePrintStation();
      if (!currentIsStation) {
        console.warn(`[PrintStationListener] Ignored Bill #${data.ticket_number}: device is not registered as print station (qdine_is_print_station=${localStorage.getItem('qdine_is_print_station')})`);
        return;
      }

      toast(`Printing Bill #${String(data.ticket_number).padStart(3, '0')}...`, {
        icon: <PrinterIllustration size={22} status="printing" />,
        duration: 3000,
      });

      try {
        const localBillType = typeof window !== 'undefined' ? localStorage.getItem('qdine_bill_printer_type') : null;
        const localBillPrinter = typeof window !== 'undefined' ? localStorage.getItem('qdine_bill_printer_name') : null;
        const localBillAddress = typeof window !== 'undefined' ? localStorage.getItem('qdine_bill_printer_address') : null;
        const targetBillPrinter = (data.printer_name && data.printer_name !== 'POS-80C') ? data.printer_name : (localBillPrinter || 'POS-80C');

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
          skipDuplicateCheck: true, // PrintStationListener already deduplicated at entry!
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

    // 3. Missed Print Recovery: Check for unprinted jobs on tab focus or Pusher reconnect
    const recoverMissedPrints = async () => {
      if (!isDevicePrintStation()) return;
      try {
        const currentSlug = Array.isArray(slug) ? slug[0] : (slug || '');
        const res = await fetch(`/api/print/agent?mode=pending&slug=${encodeURIComponent(currentSlug)}`, {
          headers: getAuthHeaders(currentSlug),
        });
        if (!res.ok) return;
        const resData = await res.json();
        const pendingJobs = resData.jobs || [];
        const tenMinutesAgo = Date.now() - 10 * 60 * 1000;

        const validJobs = pendingJobs
          .filter((j: any) => {
            const created = new Date(j.created_at).getTime();
            return !isNaN(created) && created > tenMinutesAgo;
          })
          .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        for (const job of validJobs) {
          const ticketNo = job.ticket_number;

          const localKotPrinter = typeof window !== 'undefined' ? (localStorage.getItem('qdine_kot_printer_name') || localStorage.getItem('qdine_bt_printer_name')) : null;
          const counterSavedDev = (typeof window !== 'undefined' && job.counter_name)
            ? localStorage.getItem(`qdine_bt_counter_${job.counter_name.trim().toLowerCase()}`)
            : null;
          const targetKotPrinter = counterSavedDev || (job.printer_name && job.printer_name !== 'POS-80C' ? job.printer_name : null) || localKotPrinter || 'POS-80C';

          const result = await printUnifiedThermalTicket({
            base64Bytes: job.raw_base64,
            kotData: { ticketNumber: ticketNo, counterName: job.counter_name } as any,
            printerName: targetKotPrinter,
            printerType: job.printer_type,
            counterName: job.counter_name,
            isAutoPrint: true,
            skipDuplicateCheck: true,
          });

          if (result.success) {
            fetch('/api/print/agent', {
              method: 'POST',
              headers: getAuthHeaders(currentSlug),
              body: JSON.stringify({ slug: currentSlug, action: 'complete', jobId: job.id }),
            }).catch(() => { });
          }
        }
      } catch (err) {
        console.warn('Missed print recovery check failed:', err);
      }
    };

    // Direct Pusher event bindings
    channel.bind('kot_auto_print', handleKotAutoPrint);
    channel.bind('bill_print', handleBillPrint);

    // Reconnection & visibility handlers for missed prints
    pusherClient?.connection?.bind('connected', recoverMissedPrints);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        recoverMissedPrints();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      channel.unbind('kot_auto_print', handleKotAutoPrint);
      channel.unbind('bill_print', handleBillPrint);
      pusherClient?.connection?.unbind('connected', recoverMissedPrints);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [restaurant, slug]);

  return null;
}
