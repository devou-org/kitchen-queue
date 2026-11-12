export const TABLES_TOOLS_DECLARATIONS = [
  {
    name: 'getTableOccupancy',
    description: 'Returns table occupancy rate, total tables, occupied tables, and available tables for a date range.',
    parameters: {
      type: 'OBJECT',
      properties: {
        date_from: { type: 'STRING', description: 'YYYY-MM-DD start' },
        date_to: { type: 'STRING', description: 'YYYY-MM-DD end' }
      }
    }
  },
  {
    name: 'getTableTurnover',
    description: 'Returns table turnover rate, total completed table sessions, and average turn time in minutes.',
    parameters: {
      type: 'OBJECT',
      properties: {
        date_from: { type: 'STRING', description: 'YYYY-MM-DD start' },
        date_to: { type: 'STRING', description: 'YYYY-MM-DD end' }
      }
    }
  },
  {
    name: 'getAverageTableTurnTime',
    description: 'Returns average, fastest, and slowest table turn times in minutes for closed table sessions.',
    parameters: {
      type: 'OBJECT',
      properties: {
        date_from: { type: 'STRING', description: 'YYYY-MM-DD start' },
        date_to: { type: 'STRING', description: 'YYYY-MM-DD end' }
      }
    }
  },
  {
    name: 'getTableUtilization',
    description: 'Returns total available table hours, occupied table hours, and utilization percentage.',
    parameters: {
      type: 'OBJECT',
      properties: {
        date_from: { type: 'STRING', description: 'YYYY-MM-DD start' },
        date_to: { type: 'STRING', description: 'YYYY-MM-DD end' }
      }
    }
  },
  {
    name: 'getTableUsageByHour',
    description: 'Returns hourly breakdown (0-23) of table sessions and occupancy percentage.',
    parameters: {
      type: 'OBJECT',
      properties: {
        date_from: { type: 'STRING', description: 'YYYY-MM-DD start' },
        date_to: { type: 'STRING', description: 'YYYY-MM-DD end' }
      }
    }
  },
  {
    name: 'getTablePerformance',
    description: 'Returns table-by-table performance stats including sessions, revenue, party size, and turn time.',
    parameters: {
      type: 'OBJECT',
      properties: {
        date_from: { type: 'STRING', description: 'YYYY-MM-DD start' },
        date_to: { type: 'STRING', description: 'YYYY-MM-DD end' }
      }
    }
  },
  {
    name: 'getTopTablesByRevenue',
    description: 'Returns top tables ranked by revenue generated.',
    parameters: {
      type: 'OBJECT',
      properties: {
        date_from: { type: 'STRING', description: 'YYYY-MM-DD start' },
        date_to: { type: 'STRING', description: 'YYYY-MM-DD end' },
        limit: { type: 'NUMBER', description: 'Number of top tables to return' }
      }
    }
  },
  {
    name: 'getBottomTablesByRevenue',
    description: 'Returns lowest revenue-generating tables for optimization analysis.',
    parameters: {
      type: 'OBJECT',
      properties: {
        date_from: { type: 'STRING', description: 'YYYY-MM-DD start' },
        date_to: { type: 'STRING', description: 'YYYY-MM-DD end' },
        limit: { type: 'NUMBER', description: 'Number of bottom tables to return' }
      }
    }
  },
  {
    name: 'getTableCapacityPerformance',
    description: 'Returns seat utilization efficiency by comparing average party size to table capacity.',
    parameters: {
      type: 'OBJECT',
      properties: {
        date_from: { type: 'STRING', description: 'YYYY-MM-DD start' },
        date_to: { type: 'STRING', description: 'YYYY-MM-DD end' }
      }
    }
  },
  {
    name: 'getRevenuePerTableHour',
    description: 'Returns total table revenue, total occupied table hours, and revenue per table hour.',
    parameters: {
      type: 'OBJECT',
      properties: {
        date_from: { type: 'STRING', description: 'YYYY-MM-DD start' },
        date_to: { type: 'STRING', description: 'YYYY-MM-DD end' }
      }
    }
  }
];

