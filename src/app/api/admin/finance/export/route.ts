import { NextRequest, NextResponse } from 'next/server';
import { getRestaurantBySlug } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { FinanceService } from '@/modules/finance/finance.service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const slug = request.nextUrl.searchParams.get('slug') || request.headers.get('x-restaurant-slug') || 'demo';
    const restaurant = await getRestaurantBySlug(slug);

    if (!restaurant) {
      return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const startDate = request.nextUrl.searchParams.get('startDate') || undefined;
    const endDate = request.nextUrl.searchParams.get('endDate') || undefined;

    const summary = await FinanceService.getSummary(restaurant.id, startDate, endDate);
    const txData = await FinanceService.getTransactions(restaurant.id, {
      startDate,
      endDate,
      limit: 1000,
    });

    // Build clean CSV content
    const csvRows: string[] = [];
    csvRows.push(`QDINE RESTAURANT FINANCE STATEMENT`);
    csvRows.push(`Restaurant:,"${restaurant.name}"`);
    csvRows.push(`Period:,${startDate || 'All Time'} to ${endDate || 'Today'}`);
    csvRows.push(`Generated At:,${new Date().toLocaleString('en-IN')}`);
    csvRows.push('');
    csvRows.push('PROFIT & LOSS OVERVIEW');
    csvRows.push(`Total Revenue (Sales),${summary.totalRevenue.toFixed(2)}`);
    csvRows.push(`COGS (Inventory Purchases),${summary.cogsExpenses.toFixed(2)}`);
    csvRows.push(`Operating Expenses (Petty Cash & Overheads),${summary.operatingExpenses.toFixed(2)}`);
    csvRows.push(`Total Expenses,${summary.totalExpenses.toFixed(2)}`);
    csvRows.push(`Net Profit / (Loss),${summary.netProfit.toFixed(2)}`);
    csvRows.push(`Net Margin %,${summary.profitMarginPercent}%`);
    csvRows.push('');
    csvRows.push('TAX & GST COMPLIANCE');
    csvRows.push(`Output Tax Collected,${summary.taxCollected.toFixed(2)}`);
    csvRows.push(`Input Tax Credit Paid,${summary.taxPaid.toFixed(2)}`);
    csvRows.push(`Net Tax Liability,${summary.netTaxLiability.toFixed(2)}`);
    csvRows.push('');
    csvRows.push('TRANSACTIONS LEDGER');
    csvRows.push('Date,Type,Source,Reference Number,Category,Gross Amount,Tax Amount,Net Amount,Payment Method,Description');

    for (const tx of txData.transactions) {
      const row = [
        tx.transaction_date,
        tx.entry_type,
        tx.source,
        `"${(tx.reference_number || '').replace(/"/g, '""')}"`,
        `"${(tx.category || '').replace(/"/g, '""')}"`,
        Number(tx.amount || 0).toFixed(2),
        Number(tx.tax_amount || 0).toFixed(2),
        Number(tx.net_amount || 0).toFixed(2),
        tx.payment_method || 'UPI',
        `"${(tx.description || '').replace(/"/g, '""')}"`,
      ];
      csvRows.push(row.join(','));
    }

    const csvContent = csvRows.join('\n');
    const filename = `Finance_Report_${restaurant.slug}_${startDate || 'all'}_${endDate || 'all'}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Error generating finance export:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
