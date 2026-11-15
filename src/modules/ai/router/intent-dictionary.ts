import { AIModuleName } from '../modules/ai-module.interface';

export interface ModuleKeywordRule {
  module: AIModuleName;
  priority: number;
  keywords: string[];
  patterns: RegExp[];
}

export const MODULE_INTENT_RULES: ModuleKeywordRule[] = [
  {
    module: 'tables',
    priority: 10,
    keywords: [
      'table', 'tables', 'seating', 'seat', 'seats', 'occupancy', 'occupied',
      'vacant', 'turnover', 'turn time', 'turn-time', 'turntime', 'table session',
      'table utilization', 'table usage', 'party size', 'table capacity',
      'table revenue', 'table hour', 'dine-in table', 'dine in table'
    ],
    patterns: [
      /\btables?\b/i,
      /\boccupan(cy|t)\b/i,
      /\bturn\s*over\b/i,
      /\bturn\s*time\b/i,
      /\butilization\b/i,
      /\bseat(s|ing)?\b/i,
      /\bparty\s*size\b/i,
      /\brevenue\s*per\s*table\b/i
    ]
  },
  {
    module: 'inventory',
    priority: 10,
    keywords: [
      'inventory', 'stock', 'stocks', 'ingredient', 'ingredients', 'raw material',
      'materials', 'low stock', 'out of stock', 'stockout', 'reorder level',
      'buffer quantity', 'remaining stock', 'stock quantity'
    ],
    patterns: [
      /\binventor(y|ies)\b/i,
      /\blow\s*stock\b/i,
      /\bout\s*of\s*stock\b/i,
      /\bstock\s*(level|quantity|count)\b/i,
      /\bingredients?\b/i,
      /\braw\s*material\b/i
    ]
  },
  {
    module: 'knowledge',
    priority: 8,
    keywords: [
      'staff', 'employee', 'employees', 'waiter', 'waiters', 'chef', 'chefs',
      'operating hours', 'opening hour', 'closing hour', 'open time', 'close time',
      'timing', 'timings', 'store config', 'restaurant config', 'active staff',
      'category list', 'categories list', 'menu sections', 'operating time'
    ],
    patterns: [
      /\bstaff\b/i,
      /\bemployees?\b/i,
      /\bwaiters?\b/i,
      /\bchefs?\b/i,
      /\boperating\s*hours?\b/i,
      /\bopening\s*(time|hour)\b/i,
      /\bclosing\s*(time|hour)\b/i,
      /\bactive\s*staff\b/i
    ]
  },
  {
    module: 'external',
    priority: 9,
    keywords: [
      'weather', 'rain', 'raining', 'rainy', 'monsoon', 'temperature', 'forecast',
      'sunny', 'cloudy', 'holiday', 'holidays', 'festival', 'festivals',
      'public holiday', 'diwali', 'eid', 'christmas', 'new year', 'national holiday'
    ],
    patterns: [
      /\bweather\b/i,
      /\brain(y|fall|ing)?\b/i,
      /\btemperature\b/i,
      /\bforecast\b/i,
      /\bholidays?\b/i,
      /\bfestivals?\b/i,
      /\bpublic\s*holiday\b/i
    ]
  },
  {
    module: 'sales',
    priority: 5,
    keywords: [
      'sale', 'sales', 'revenue', 'income', 'earning', 'earnings', 'gross', 'net',
      'profit', 'aov', 'average order value', 'average ticket', 'order count',
      'orders', 'collection', 'gst', 'tax', 'cash', 'upi', 'card', 'payment',
      'cancellation', 'cancelled', 'top product', 'top products', 'best seller',
      'bestseller', 'bottom product', 'bottom products', 'worst seller', 'slow moving',
      'category performance', 'category sales', 'hourly sales', 'rush', 'peak hour',
      'peak rush', 'trend', 'comparison', 'compare', 'variance', 'business date'
    ],
    patterns: [
      /\bsales?\b/i,
      /\brevenues?\b/i,
      /\bearning(s)?\b/i,
      /\bgross\b/i,
      /\baov\b/i,
      /\baverage\s*order\b/i,
      /\border(s)?\b/i,
      /\bpayment(s)?\b/i,
      /\bcancell(ed|ation)\b/i,
      /\btop\s*(item|product|dish|seller)s?\b/i,
      /\bbest\s*seller(s)?\b/i,
      /\bbottom\s*(item|product|dish|seller)s?\b/i,
      /\bhourly\b/i,
      /\bpeak\s*(hour|rush)\b/i,
      /\bgst\b/i
    ]
  }
];

export const CROSS_MODULE_COMPOUND_TRIGGERS: Array<{
  modules: AIModuleName[];
  pattern: RegExp;
}> = [
  {
    // Demand forecasting / prep planning -> sales + external
    modules: ['sales', 'external'],
    pattern: /\b(forecast|predict|prep\s*(target|plan|list)|demand|tomorrow\s*(sales|rush|prep))\b/i
  },
  {
    // Revenue per table / table financial performance -> tables + sales
    modules: ['tables', 'sales'],
    pattern: /\b(table\s*revenue|revenue\s*per\s*table|most\s*profitable\s*table|top\s*tables?\s*by\s*revenue)\b/i
  },
  {
    // Prep list / dish stock planning -> inventory + sales
    modules: ['inventory', 'sales'],
    pattern: /\b(prep\s*ingredients|stock\s*needed|ingredient\s*usage|inventory\s*for\s*orders)\b/i
  }
];

export const FOLLOW_UP_PATTERNS: RegExp[] = [
  /\bwhat\s*about\b/i,
  /\bhow\s*about\b/i,
  /\band\s*(yesterday|tomorrow|last\s*week|last\s*month)\b/i,
  /\bcompare\s*that\b/i,
  /\bshow\s*more\b/i,
  /\bbreak\s*that\s*down\b/i,
  /\bwhy\s*(is\s*that|did\s*that\s*happen)\b/i,
  /\bfor\s*yesterday\b/i,
  /\bfor\s*last\s*week\b/i
];

