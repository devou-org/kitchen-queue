import { pool } from '@/lib/db';

export interface FinanceTransaction {
  id: string;
  restaurant_id: string;
  entry_type: 'INCOME' | 'EXPENSE';
  source: 'POS_SALES' | 'INVENTORY_PURCHASE' | 'PETTY_CASH' | 'OVERHEAD' | 'OTHER';
  reference_id?: string | null;
  reference_number?: string | null;
  category: string;
  amount: number;
  tax_amount: number;
  net_amount: number;
  payment_method: string;
  description?: string | null;
  receipt_url?: string | null;
  created_by?: string | null;
  transaction_date: string;
  created_at: string;
  updated_at: string;
}

export interface TillReconciliation {
  id: string;
  restaurant_id: string;
  business_date: string;
  opening_cash: number;
  system_cash_sales: number;
  cash_expenses: number;
  expected_drawer_cash: number;
  actual_counted_cash: number;
  discrepancy: number;
  status: 'BALANCED' | 'SHORT' | 'OVER';
  notes?: string | null;
  closed_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceSummary {
  totalRevenue: number;
  cogsExpenses: number;
  operatingExpenses: number;
  totalExpenses: number;
  netProfit: number;
  profitMarginPercent: number;
  taxCollected: number; // Output GST
  taxPaid: number;      // Input GST
  netTaxLiability: number;
  paymentMethodBreakdown: { method: string; total: number; count: number }[];
  expenseCategoryBreakdown: { category: string; total: number }[];
  dailyTrends: {
    date: string;
    revenue: number;
    expenses: number;
    profit: number;
  }[];
}

export class FinanceService {
  /**
   * Check if Finance Management module is enabled for this restaurant.
   * Super Admin has master toggle control via `restaurant_modules`.
   * Rule: If NOT enabled, NO data is ever added to tables.
   */
  static async isModuleActive(restaurantId: string): Promise<boolean> {
    try {
      const res = await pool.query(
        `SELECT is_enabled FROM restaurant_modules 
         WHERE restaurant_id = $1 AND module_name = 'FINANCE_MANAGEMENT' 
         LIMIT 1`,
        [restaurantId]
      );
      return res.rows.length > 0 && res.rows[0].is_enabled === true;
    } catch (err) {
      console.error('Error checking FINANCE_MANAGEMENT module:', err);
      return false;
    }
  }

  /**
   * Automated Data Stream: POS Income Entry
   * Triggered when an order is CLOSED or marked PAID.
   */
  static async recordPosIncome(orderId: string): Promise<void> {
    try {
      const orderRes = await pool.query(
        `SELECT id, restaurant_id, total_price, status, payment_status, payment_method, payment_split, created_at, customer_name, table_number
         FROM orders WHERE id = $1 LIMIT 1`,
        [orderId]
      );

      if (orderRes.rows.length === 0) return;
      const order = orderRes.rows[0];

      // Strict Module Active Gating: Do nothing if module is turned off
      const active = await this.isModuleActive(order.restaurant_id);
      if (!active) return;

      const isOrderPaid =
        order.status === 'CLOSED' ||
        order.payment_status === 'PAID' ||
        (order.payment_status && String(order.payment_status).toUpperCase() === 'PAID');

      // If order was cancelled or voided, remove income transaction
      if (order.status === 'CANCELLED' || !isOrderPaid) {
        await pool.query(
          `DELETE FROM finance_transactions WHERE reference_id = $1 AND source = 'POS_SALES'`,
          [order.id]
        );
        const txDate = new Date(order.created_at).toISOString().split('T')[0];
        await this.syncDailySummary(order.restaurant_id, txDate);
        return;
      }

      const totalAmount = Number(order.total_price) || 0;
      if (totalAmount <= 0) return;

      // Calculate GST / tax component if configured for the restaurant
      const restRes = await pool.query(
        `SELECT gst_type, gst_rate FROM restaurants WHERE id = $1 LIMIT 1`,
        [order.restaurant_id]
      );
      const rest = restRes.rows[0];
      let taxAmount = 0;
      let netAmount = totalAmount;

      if (rest && rest.gst_type && rest.gst_type !== 'NONE' && Number(rest.gst_rate) > 0) {
        const rate = Number(rest.gst_rate);
        if (rest.gst_type === 'INCLUSIVE') {
          taxAmount = Math.round((totalAmount - totalAmount / (1 + rate / 100)) * 100) / 100;
          netAmount = Math.round((totalAmount - taxAmount) * 100) / 100;
        } else {
          // EXCLUSIVE
          taxAmount = Math.round(((totalAmount * rate) / 100) * 100) / 100;
          netAmount = totalAmount;
        }
      }

      const txDate = new Date(order.created_at).toISOString().split('T')[0];
      const pMethod = order.payment_method ? String(order.payment_method).toUpperCase() : 'UPI';
      const refNumber = `Order #${order.id.slice(0, 8).toUpperCase()}${order.table_number ? ` (T${order.table_number})` : ''}`;

      // Clean existing transaction for this order to prevent duplicates
      await pool.query(
        `DELETE FROM finance_transactions WHERE reference_id = $1 AND source = 'POS_SALES'`,
        [order.id]
      );

      // Insert fresh transaction
      await pool.query(
        `INSERT INTO finance_transactions (
          restaurant_id, entry_type, source, reference_id, reference_number,
          category, amount, tax_amount, net_amount, payment_method,
          description, transaction_date
        ) VALUES ($1, 'INCOME', 'POS_SALES', $2, $3, 'Sales Revenue', $4, $5, $6, $7, $8, $9)`,
        [
          order.restaurant_id,
          order.id,
          refNumber,
          totalAmount,
          taxAmount,
          netAmount,
          pMethod,
          `POS Order ${order.table_number ? `Table ${order.table_number}` : 'Counter'}`,
          txDate,
        ]
      );

      await this.syncDailySummary(order.restaurant_id, txDate);
    } catch (err) {
      console.error('Error in recordPosIncome:', err);
    }
  }

  /**
   * Automated Data Stream: Daily Purchase Entry
   * Triggered when an inventory purchase invoice/order is marked as 'PAID'.
   */
  static async recordPurchaseExpense(purchaseOrderId: string): Promise<void> {
    try {
      const poRes = await pool.query(
        `SELECT po.id, po.restaurant_id, po.po_number, po.invoice_number, po.received_date,
                po.subtotal, po.tax_amount, po.total_amount, po.payment_status, po.status,
                s.name as supplier_name, po.created_at
         FROM purchase_orders po
         LEFT JOIN suppliers s ON s.id = po.supplier_id
         WHERE po.id = $1 LIMIT 1`,
        [purchaseOrderId]
      );

      if (poRes.rows.length === 0) return;
      const po = poRes.rows[0];

      // Strict Module Active Gating
      const active = await this.isModuleActive(po.restaurant_id);
      if (!active) return;

      const isPaid = po.payment_status === 'PAID';

      // If not paid or cancelled, remove any previous expense record
      if (!isPaid || po.status === 'CANCELLED') {
        await pool.query(
          `DELETE FROM finance_transactions WHERE reference_id = $1 AND source = 'INVENTORY_PURCHASE'`,
          [po.id]
        );
        const txDate = po.received_date
          ? new Date(po.received_date).toISOString().split('T')[0]
          : new Date(po.created_at).toISOString().split('T')[0];
        await this.syncDailySummary(po.restaurant_id, txDate);
        return;
      }

      const totalAmount = Number(po.total_amount) || 0;
      const taxAmount = Number(po.tax_amount) || 0;
      const netAmount = Number(po.subtotal) || (totalAmount - taxAmount);
      const txDate = po.received_date
        ? new Date(po.received_date).toISOString().split('T')[0]
        : new Date(po.created_at).toISOString().split('T')[0];
      const refNumber = po.invoice_number || po.po_number || `PO-${po.id.slice(0, 8).toUpperCase()}`;

      // Clean existing
      await pool.query(
        `DELETE FROM finance_transactions WHERE reference_id = $1 AND source = 'INVENTORY_PURCHASE'`,
        [po.id]
      );

      // Insert purchase expense
      await pool.query(
        `INSERT INTO finance_transactions (
          restaurant_id, entry_type, source, reference_id, reference_number,
          category, amount, tax_amount, net_amount, payment_method,
          description, transaction_date
        ) VALUES ($1, 'EXPENSE', 'INVENTORY_PURCHASE', $2, $3, 'Cost of Goods Sold (Raw Materials)', $4, $5, $6, 'BANK_TRANSFER', $7, $8)`,
        [
          po.restaurant_id,
          po.id,
          refNumber,
          totalAmount,
          taxAmount,
          netAmount,
          `Inventory Purchase - Supplier: ${po.supplier_name || 'Direct Vendor'}`,
          txDate,
        ]
      );

      await this.syncDailySummary(po.restaurant_id, txDate);
    } catch (err) {
      console.error('Error in recordPurchaseExpense:', err);
    }
  }

  /**
   * Manual Entry: Petty Cash & Overheads
   */
  static async createExpense(data: {
    restaurantId: string;
    category: string;
    amount: number;
    taxAmount?: number;
    paymentMethod?: string;
    description?: string;
    receiptUrl?: string;
    createdBy?: string;
    transactionDate?: string;
    referenceNumber?: string;
  }): Promise<FinanceTransaction> {
    const active = await this.isModuleActive(data.restaurantId);
    if (!active) {
      throw new Error('Finance module is disabled by Super Admin.');
    }

    const amount = Number(data.amount) || 0;
    const taxAmount = Number(data.taxAmount) || 0;
    const netAmount = Math.max(0, amount - taxAmount);
    const date = data.transactionDate || new Date().toISOString().split('T')[0];
    const pMethod = data.paymentMethod || 'UPI';

    const res = await pool.query(
      `INSERT INTO finance_transactions (
        restaurant_id, entry_type, source, reference_number,
        category, amount, tax_amount, net_amount, payment_method,
        description, receipt_url, created_by, transaction_date
      ) VALUES ($1, 'EXPENSE', 'PETTY_CASH', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        data.restaurantId,
        data.referenceNumber || null,
        data.category || 'Operating Overhead',
        amount,
        taxAmount,
        netAmount,
        pMethod,
        data.description || null,
        data.receiptUrl || null,
        data.createdBy || null,
        date,
      ]
    );

    await this.syncDailySummary(data.restaurantId, date);
    return res.rows[0];
  }

  /**
   * Delete Manual Expense Entry
   */
  static async deleteExpense(id: string, restaurantId: string): Promise<boolean> {
    const txRes = await pool.query(
      `SELECT transaction_date FROM finance_transactions 
       WHERE id = $1 AND restaurant_id = $2 AND source IN ('PETTY_CASH', 'OVERHEAD', 'OTHER')`,
      [id, restaurantId]
    );

    if (txRes.rows.length === 0) return false;
    const txDate = txRes.rows[0].transaction_date;

    await pool.query(
      `DELETE FROM finance_transactions WHERE id = $1 AND restaurant_id = $2`,
      [id, restaurantId]
    );

    await this.syncDailySummary(restaurantId, txDate);
    return true;
  }

  /**
   * Till Reconciliation (End of Day Cash Drawer)
   */
  static async reconcileTill(data: {
    restaurantId: string;
    businessDate: string;
    openingCash: number;
    actualCountedCash: number;
    notes?: string;
    closedBy?: string;
  }): Promise<TillReconciliation> {
    const active = await this.isModuleActive(data.restaurantId);
    if (!active) {
      throw new Error('Finance module is disabled by Super Admin.');
    }

    const { restaurantId, businessDate } = data;
    const openingCash = Number(data.openingCash) || 0;
    const actualCountedCash = Number(data.actualCountedCash) || 0;

    // Fetch system cash sales for this date
    const cashSalesRes = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total_cash_sales
       FROM finance_transactions
       WHERE restaurant_id = $1 
         AND transaction_date = $2 
         AND entry_type = 'INCOME'
         AND (payment_method = 'CASH' OR payment_method ILIKE '%CASH%')`,
      [restaurantId, businessDate]
    );
    const systemCashSales = Number(cashSalesRes.rows[0]?.total_cash_sales) || 0;

    // Fetch cash expenses (petty cash paid from cash drawer on that date)
    const cashExpensesRes = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total_cash_expenses
       FROM finance_transactions
       WHERE restaurant_id = $1 
         AND transaction_date = $2 
         AND entry_type = 'EXPENSE'
         AND (payment_method = 'CASH' OR payment_method ILIKE '%CASH%')`,
      [restaurantId, businessDate]
    );
    const cashExpenses = Number(cashExpensesRes.rows[0]?.total_cash_expenses) || 0;

    const expectedDrawerCash = openingCash + systemCashSales - cashExpenses;
    const discrepancy = actualCountedCash - expectedDrawerCash;
    const status = Math.abs(discrepancy) < 0.01 ? 'BALANCED' : discrepancy < 0 ? 'SHORT' : 'OVER';

    const res = await pool.query(
      `INSERT INTO finance_till_reconciliations (
        restaurant_id, business_date, opening_cash, system_cash_sales,
        cash_expenses, expected_drawer_cash, actual_counted_cash,
        discrepancy, status, notes, closed_by, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      ON CONFLICT (restaurant_id, business_date)
      DO UPDATE SET
        opening_cash = EXCLUDED.opening_cash,
        system_cash_sales = EXCLUDED.system_cash_sales,
        cash_expenses = EXCLUDED.cash_expenses,
        expected_drawer_cash = EXCLUDED.expected_drawer_cash,
        actual_counted_cash = EXCLUDED.actual_counted_cash,
        discrepancy = EXCLUDED.discrepancy,
        status = EXCLUDED.status,
        notes = EXCLUDED.notes,
        closed_by = EXCLUDED.closed_by,
        updated_at = NOW()
      RETURNING *`,
      [
        restaurantId,
        businessDate,
        openingCash,
        systemCashSales,
        cashExpenses,
        expectedDrawerCash,
        actualCountedCash,
        discrepancy,
        status,
        data.notes || null,
        data.closedBy || null,
      ]
    );

    return res.rows[0];
  }

  /**
   * Get Till Reconciliation Data for a specific date (live or stored)
   */
  static async getTillReconciliation(restaurantId: string, businessDate: string) {
    const existing = await pool.query(
      `SELECT * FROM finance_till_reconciliations 
       WHERE restaurant_id = $1 AND business_date = $2 LIMIT 1`,
      [restaurantId, businessDate]
    );

    // Live query for current day's cash movements
    const cashSalesRes = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total_cash_sales
       FROM finance_transactions
       WHERE restaurant_id = $1 
         AND transaction_date = $2 
         AND entry_type = 'INCOME'
         AND (payment_method = 'CASH' OR payment_method ILIKE '%CASH%')`,
      [restaurantId, businessDate]
    );

    const cashExpensesRes = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total_cash_expenses
       FROM finance_transactions
       WHERE restaurant_id = $1 
         AND transaction_date = $2 
         AND entry_type = 'EXPENSE'
         AND (payment_method = 'CASH' OR payment_method ILIKE '%CASH%')`,
      [restaurantId, businessDate]
    );

    const liveCashSales = Number(cashSalesRes.rows[0]?.total_cash_sales) || 0;
    const liveCashExpenses = Number(cashExpensesRes.rows[0]?.total_cash_expenses) || 0;

    return {
      stored: existing.rows[0] || null,
      live: {
        system_cash_sales: liveCashSales,
        cash_expenses: liveCashExpenses,
      },
    };
  }

  /**
   * Get Till Reconciliation History
   */
  static async getTillHistory(restaurantId: string, limit = 30) {
    const res = await pool.query(
      `SELECT * FROM finance_till_reconciliations 
       WHERE restaurant_id = $1 
       ORDER BY business_date DESC 
       LIMIT $2`,
      [restaurantId, limit]
    );
    return res.rows;
  }

  /**
   * P&L Summary & Tax Calculation
   */
  static async getSummary(
    restaurantId: string,
    startDate?: string,
    endDate?: string
  ): Promise<FinanceSummary> {
    const sDate = startDate || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const eDate = endDate || new Date().toISOString().split('T')[0];

    // Totals query
    const totalsRes = await pool.query(
      `SELECT 
        COALESCE(SUM(amount) FILTER (WHERE entry_type = 'INCOME'), 0) as total_revenue,
        COALESCE(SUM(amount) FILTER (WHERE entry_type = 'EXPENSE' AND source = 'INVENTORY_PURCHASE'), 0) as cogs_expenses,
        COALESCE(SUM(amount) FILTER (WHERE entry_type = 'EXPENSE' AND source != 'INVENTORY_PURCHASE'), 0) as operating_expenses,
        COALESCE(SUM(tax_amount) FILTER (WHERE entry_type = 'INCOME'), 0) as tax_collected,
        COALESCE(SUM(tax_amount) FILTER (WHERE entry_type = 'EXPENSE'), 0) as tax_paid
       FROM finance_transactions
       WHERE restaurant_id = $1 
         AND transaction_date >= $2 
         AND transaction_date <= $3`,
      [restaurantId, sDate, eDate]
    );

    const row = totalsRes.rows[0];
    const totalRevenue = Number(row?.total_revenue) || 0;
    const cogsExpenses = Number(row?.cogs_expenses) || 0;
    const operatingExpenses = Number(row?.operating_expenses) || 0;
    const totalExpenses = cogsExpenses + operatingExpenses;
    const netProfit = totalRevenue - totalExpenses;
    const profitMarginPercent = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 1000) / 10 : 0;
    const taxCollected = Number(row?.tax_collected) || 0;
    const taxPaid = Number(row?.tax_paid) || 0;
    const netTaxLiability = taxCollected - taxPaid;

    // Payment method breakdown
    const pmRes = await pool.query(
      `SELECT 
        payment_method, 
        SUM(amount) as total,
        COUNT(*) as count
       FROM finance_transactions
       WHERE restaurant_id = $1 
         AND entry_type = 'INCOME'
         AND transaction_date >= $2 
         AND transaction_date <= $3
       GROUP BY payment_method
       ORDER BY total DESC`,
      [restaurantId, sDate, eDate]
    );

    const paymentMethodBreakdown = pmRes.rows.map(r => ({
      method: r.payment_method || 'UPI',
      total: Number(r.total) || 0,
      count: Number(r.count) || 0,
    }));

    // Expense category breakdown
    const catRes = await pool.query(
      `SELECT 
        category, 
        SUM(amount) as total
       FROM finance_transactions
       WHERE restaurant_id = $1 
         AND entry_type = 'EXPENSE'
         AND transaction_date >= $2 
         AND transaction_date <= $3
       GROUP BY category
       ORDER BY total DESC`,
      [restaurantId, sDate, eDate]
    );

    const expenseCategoryBreakdown = catRes.rows.map(r => ({
      category: r.category || 'General',
      total: Number(r.total) || 0,
    }));

    // Daily trends query
    const dailyRes = await pool.query(
      `SELECT 
        transaction_date::text as date,
        COALESCE(SUM(amount) FILTER (WHERE entry_type = 'INCOME'), 0) as revenue,
        COALESCE(SUM(amount) FILTER (WHERE entry_type = 'EXPENSE'), 0) as expenses
       FROM finance_transactions
       WHERE restaurant_id = $1 
         AND transaction_date >= $2 
         AND transaction_date <= $3
       GROUP BY transaction_date
       ORDER BY transaction_date ASC`,
      [restaurantId, sDate, eDate]
    );

    const dailyTrends = dailyRes.rows.map(r => ({
      date: r.date,
      revenue: Number(r.revenue) || 0,
      expenses: Number(r.expenses) || 0,
      profit: (Number(r.revenue) || 0) - (Number(r.expenses) || 0),
    }));

    return {
      totalRevenue,
      cogsExpenses,
      operatingExpenses,
      totalExpenses,
      netProfit,
      profitMarginPercent,
      taxCollected,
      taxPaid,
      netTaxLiability,
      paymentMethodBreakdown,
      expenseCategoryBreakdown,
      dailyTrends,
    };
  }

  /**
   * Get Transactions List with filters & pagination
   */
  static async getTransactions(
    restaurantId: string,
    options: {
      startDate?: string;
      endDate?: string;
      entryType?: string;
      source?: string;
      category?: string;
      paymentMethod?: string;
      search?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const page = options.page || 1;
    const limit = options.limit || 50;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['restaurant_id = $1'];
    const values: any[] = [restaurantId];
    let paramIndex = 2;

    if (options.startDate) {
      conditions.push(`transaction_date >= $${paramIndex}`);
      values.push(options.startDate);
      paramIndex++;
    }

    if (options.endDate) {
      conditions.push(`transaction_date <= $${paramIndex}`);
      values.push(options.endDate);
      paramIndex++;
    }

    if (options.entryType && options.entryType !== 'ALL') {
      conditions.push(`entry_type = $${paramIndex}`);
      values.push(options.entryType);
      paramIndex++;
    }

    if (options.source && options.source !== 'ALL') {
      conditions.push(`source = $${paramIndex}`);
      values.push(options.source);
      paramIndex++;
    }

    if (options.category && options.category !== 'ALL') {
      conditions.push(`category = $${paramIndex}`);
      values.push(options.category);
      paramIndex++;
    }

    if (options.paymentMethod && options.paymentMethod !== 'ALL') {
      conditions.push(`payment_method = $${paramIndex}`);
      values.push(options.paymentMethod);
      paramIndex++;
    }

    if (options.search) {
      conditions.push(`(
        reference_number ILIKE $${paramIndex} OR 
        category ILIKE $${paramIndex} OR 
        description ILIKE $${paramIndex}
      )`);
      values.push(`%${options.search}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM finance_transactions WHERE ${whereClause}`,
      values
    );
    const totalCount = parseInt(countRes.rows[0].count, 10);

    const listRes = await pool.query(
      `SELECT * FROM finance_transactions 
       WHERE ${whereClause} 
       ORDER BY transaction_date DESC, created_at DESC 
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, limit, offset]
    );

    return {
      transactions: listRes.rows,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }

  /**
   * Internal helper: Sync daily summary cache table
   */
  private static async syncDailySummary(restaurantId: string, businessDate: string) {
    try {
      await pool.query(
        `INSERT INTO finance_daily_summaries (
          restaurant_id, business_date, total_revenue, cogs_expenses,
          operating_expenses, tax_collected, tax_paid, net_profit, updated_at
        )
        SELECT 
          $1, 
          $2::date,
          COALESCE(SUM(amount) FILTER (WHERE entry_type = 'INCOME'), 0),
          COALESCE(SUM(amount) FILTER (WHERE entry_type = 'EXPENSE' AND source = 'INVENTORY_PURCHASE'), 0),
          COALESCE(SUM(amount) FILTER (WHERE entry_type = 'EXPENSE' AND source != 'INVENTORY_PURCHASE'), 0),
          COALESCE(SUM(tax_amount) FILTER (WHERE entry_type = 'INCOME'), 0),
          COALESCE(SUM(tax_amount) FILTER (WHERE entry_type = 'EXPENSE'), 0),
          COALESCE(SUM(amount) FILTER (WHERE entry_type = 'INCOME'), 0) - COALESCE(SUM(amount) FILTER (WHERE entry_type = 'EXPENSE'), 0),
          NOW()
        FROM finance_transactions
        WHERE restaurant_id = $1 AND transaction_date = $2::date
        ON CONFLICT (restaurant_id, business_date)
        DO UPDATE SET
          total_revenue = EXCLUDED.total_revenue,
          cogs_expenses = EXCLUDED.cogs_expenses,
          operating_expenses = EXCLUDED.operating_expenses,
          tax_collected = EXCLUDED.tax_collected,
          tax_paid = EXCLUDED.tax_paid,
          net_profit = EXCLUDED.net_profit,
          updated_at = NOW()`,
        [restaurantId, businessDate]
      );
    } catch (err) {
      console.error('Error syncing daily finance summary:', err);
    }
  }
}
