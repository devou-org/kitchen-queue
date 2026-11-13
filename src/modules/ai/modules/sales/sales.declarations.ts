export const SALES_TOOLS_DECLARATIONS = [
  {
    name: 'getSalesSummary',
    description: 'Returns gross & paid revenue, order counts, subtotal, GST (collected for REGULAR or payable for COMPOSITION depending on restaurant setup), AOV, cancellation rate, and payment method breakdown (CASH, UPI, CARD, etc.).',
    parameters: {
      type: 'OBJECT',
      properties: {
        date_from: { type: 'STRING', description: 'YYYY-MM-DD start date' },
        date_to: { type: 'STRING', description: 'YYYY-MM-DD end date' }
      }
    }
  },
  {
    name: 'getSalesTrend',
    description: 'Returns daily/weekly/monthly sales trend, order counts, and revenue breakdown.',
    parameters: {
      type: 'OBJECT',
      properties: {
        period: { type: 'STRING', enum: ['daily', 'weekly', 'monthly'], description: 'Trend granularity' },
        date_from: { type: 'STRING', description: 'YYYY-MM-DD start' },
        date_to: { type: 'STRING', description: 'YYYY-MM-DD end' }
      }
    }
  },
  {
    name: 'getHourlySales',
    description: 'Returns hourly sales and order counts (0-23) for peak rush analysis.',
    parameters: {
      type: 'OBJECT',
      properties: {
        date_from: { type: 'STRING', description: 'YYYY-MM-DD start' },
        date_to: { type: 'STRING', description: 'YYYY-MM-DD end' }
      }
    }
  },
  {
    name: 'getTopProducts',
    description: 'Returns highest performing products by quantity sold and revenue.',
    parameters: {
      type: 'OBJECT',
      properties: {
        date_from: { type: 'STRING', description: 'YYYY-MM-DD start' },
        date_to: { type: 'STRING', description: 'YYYY-MM-DD end' },
        limit: { type: 'INTEGER', description: 'Max items to return (default 10)' }
      }
    }
  },
  {
    name: 'getBottomProducts',
    description: 'Returns lowest performing menu items or zero sales items.',
    parameters: {
      type: 'OBJECT',
      properties: {
        date_from: { type: 'STRING', description: 'YYYY-MM-DD start' },
        date_to: { type: 'STRING', description: 'YYYY-MM-DD end' },
        limit: { type: 'INTEGER', description: 'Max items to return (default 10)' }
      }
    }
  },
  {
    name: 'getCategoryPerformance',
    description: 'Returns sales breakdown by menu section/category.',
    parameters: {
      type: 'OBJECT',
      properties: {
        date_from: { type: 'STRING', description: 'YYYY-MM-DD start' },
        date_to: { type: 'STRING', description: 'YYYY-MM-DD end' }
      }
    }
  },
  {
    name: 'getAverageOrderValue',
    description: 'Returns Average Order Value (AOV) and revenue over a date range.',
    parameters: {
      type: 'OBJECT',
      properties: {
        date_from: { type: 'STRING', description: 'YYYY-MM-DD start' },
        date_to: { type: 'STRING', description: 'YYYY-MM-DD end' }
      }
    }
  },
  {
    name: 'getCancellationRate',
    description: 'Returns cancellation stats, cancelled order count, % and revenue lost. Defaults to today date if date_from and date_to are omitted.',
    parameters: {
      type: 'OBJECT',
      properties: {
        date_from: { type: 'STRING', description: 'YYYY-MM-DD start date (optional, defaults to today)' },
        date_to: { type: 'STRING', description: 'YYYY-MM-DD end date (optional, defaults to today)' }
      }
    }
  },
  {
    name: 'comparePeriods',
    description: 'Compares revenue, order volume, AOV between two date ranges with variance %.',
    parameters: {
      type: 'OBJECT',
      properties: {
        period1_from: { type: 'STRING', description: 'Period 1 YYYY-MM-DD start' },
        period1_to: { type: 'STRING', description: 'Period 1 YYYY-MM-DD end' },
        period2_from: { type: 'STRING', description: 'Period 2 YYYY-MM-DD start' },
        period2_to: { type: 'STRING', description: 'Period 2 YYYY-MM-DD end' }
      },
      required: ['period1_from', 'period1_to', 'period2_from', 'period2_to']
    }
  }
];

