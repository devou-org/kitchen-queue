export const EXTERNAL_TOOLS_DECLARATIONS = [
  {
    name: 'getHolidays',
    description: 'Returns public, national, and state holidays within date range.',
    parameters: {
      type: 'OBJECT',
      properties: {
        startDate: { type: 'STRING', description: 'YYYY-MM-DD start' },
        endDate: { type: 'STRING', description: 'YYYY-MM-DD end' }
      },
      required: ['startDate', 'endDate']
    }
  },
  {
    name: 'getWeather',
    description: 'Returns weather metrics (temperature, rainfall, conditions) using Open-Meteo.',
    parameters: {
      type: 'OBJECT',
      properties: {
        startDate: { type: 'STRING', description: 'YYYY-MM-DD start' },
        endDate: { type: 'STRING', description: 'YYYY-MM-DD end' },
        includeHourly: { type: 'BOOLEAN', description: 'True for hourly weather breakdown.' }
      },
      required: ['startDate', 'endDate']
    }
  }
];

