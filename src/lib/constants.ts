// ============================================
// CONSTANTS
// ============================================

export const ORDER_STATUSES = {
  PENDING: 'PENDING',
  PREPARING: 'PREPARING',
  READY: 'READY',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
} as const;

export const PRODUCT_STATUSES = {
  AVAILABLE: 'AVAILABLE',
  LOW_STOCK: 'LOW_STOCK',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
} as const;

export const STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['PREPARING', 'READY', 'PAID', 'CANCELLED', 'EXPIRED'],
  PREPARING: ['READY', 'PAID', 'CANCELLED', 'PENDING', 'EXPIRED'],
  READY: ['PAID', 'CANCELLED', 'PENDING', 'PREPARING', 'EXPIRED'],
  PAID: ['PENDING', 'CANCELLED', 'PREPARING', 'READY', 'EXPIRED'],
  CANCELLED: ['PENDING'],
  EXPIRED: ['PENDING'],
};

export const TAX_RATE = 0; // Tax removed

export const ITEMS_PER_PAGE = 20;
export const ORDERS_PER_PAGE = 50;

export const OTP_EXPIRY_SECONDS = 600; // 10 minutes
export const OTP_MAX_ATTEMPTS = 3;
export const OTP_RATE_LIMIT_SECONDS = 60;

export const JWT_CUSTOMER_EXPIRY = '7d';
export const JWT_ADMIN_EXPIRY = '8h';

export const CURRENCY_SYMBOL = '₹';

export const STATUS_COLORS: Record<string, string> = {
  PENDING: '#FFA500',
  PREPARING: '#3B82F6',
  READY: '#06A77D',
  PAID: '#6B7280',
  CANCELLED: '#C1272D',
  EXPIRED: '#6B7280',
  AVAILABLE: '#06A77D',
  LOW_STOCK: '#FFA500',
  OUT_OF_STOCK: '#C1272D',
};

export const STATUS_BG: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PREPARING: 'bg-blue-100 text-blue-800',
  READY: 'bg-green-100 text-green-800',
  PAID: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-800',
  EXPIRED: 'bg-gray-100 text-gray-600',
};

export interface CountryCodeItem {
  code: string;
  country: string;
  label: string;
}

const ISO_TO_CALLING_CODE: Record<string, string> = {
  IN: '+91',
  AE: '+971',
  US: '+1',
  CA: '+1',
  GB: '+44',
  UK: '+44',
  SA: '+966',
  QA: '+974',
  OM: '+968',
  KW: '+965',
  BH: '+973',
  SG: '+65',
  MY: '+60',
  AU: '+61',
  DE: '+49',
  FR: '+33',
  PH: '+63',
  PK: '+92',
  BD: '+880',
  LK: '+94',
  NP: '+977',
  TH: '+66',
  ID: '+62',
  NZ: '+64',
  ZA: '+27',
  EG: '+20',
  JP: '+81',
  KR: '+82',
  CN: '+86',
  HK: '+852',
  TW: '+886',
  VN: '+84',
  BR: '+55',
  MX: '+52',
  IT: '+39',
  ES: '+34',
  NL: '+31',
  BE: '+32',
  CH: '+41',
  SE: '+46',
  NO: '+47',
  DK: '+45',
  FI: '+358',
  IE: '+353',
  RU: '+7',
  TR: '+90'
};

export function getDefaultCallingCode(isoCode?: string | null, countryName?: string | null): string {
  if (isoCode) {
    const cleanIso = isoCode.trim().toUpperCase();
    if (ISO_TO_CALLING_CODE[cleanIso]) {
      return ISO_TO_CALLING_CODE[cleanIso];
    }
  }
  if (countryName) {
    const cleanName = countryName.trim().toLowerCase();
    const match = COUNTRY_CODES.find(c => 
      c.country.toLowerCase() === cleanName || 
      c.country.toLowerCase().includes(cleanName) || 
      cleanName.includes(c.country.toLowerCase())
    );
    if (match) {
      return match.code;
    }
  }
  return '+91';
}

export const COUNTRY_CODES: CountryCodeItem[] = [
  // Popular Regions
  { code: '+91', country: 'India', label: '+91' },
  { code: '+971', country: 'United Arab Emirates', label: '+971' },
  { code: '+1', country: 'USA & Canada', label: '+1' },
  { code: '+44', country: 'United Kingdom', label: '+44' },
  { code: '+966', country: 'Saudi Arabia', label: '+966' },
  { code: '+974', country: 'Qatar', label: '+974' },
  { code: '+968', country: 'Oman', label: '+968' },
  { code: '+965', country: 'Kuwait', label: '+965' },
  { code: '+973', country: 'Bahrain', label: '+973' },
  { code: '+65', country: 'Singapore', label: '+65' },
  { code: '+60', country: 'Malaysia', label: '+60' },
  { code: '+61', country: 'Australia', label: '+61' },
  { code: '+49', country: 'Germany', label: '+49' },
  { code: '+33', country: 'France', label: '+33' },
  // All Global Calling Codes (Alphabetical by Country)
  { code: '+93', country: 'Afghanistan', label: '+93' },
  { code: '+355', country: 'Albania', label: '+355' },
  { code: '+213', country: 'Algeria', label: '+213' },
  { code: '+376', country: 'Andorra', label: '+376' },
  { code: '+244', country: 'Angola', label: '+244' },
  { code: '+54', country: 'Argentina', label: '+54' },
  { code: '+374', country: 'Armenia', label: '+374' },
  { code: '+43', country: 'Austria', label: '+43' },
  { code: '+994', country: 'Azerbaijan', label: '+994' },
  { code: '+880', country: 'Bangladesh', label: '+880' },
  { code: '+375', country: 'Belarus', label: '+375' },
  { code: '+32', country: 'Belgium', label: '+32' },
  { code: '+501', country: 'Belize', label: '+501' },
  { code: '+229', country: 'Benin', label: '+229' },
  { code: '+975', country: 'Bhutan', label: '+975' },
  { code: '+591', country: 'Bolivia', label: '+591' },
  { code: '+387', country: 'Bosnia & Herzegovina', label: '+387' },
  { code: '+267', country: 'Botswana', label: '+267' },
  { code: '+55', country: 'Brazil', label: '+55' },
  { code: '+359', country: 'Bulgaria', label: '+359' },
  { code: '+855', country: 'Cambodia', label: '+855' },
  { code: '+237', country: 'Cameroon', label: '+237' },
  { code: '+56', country: 'Chile', label: '+56' },
  { code: '+86', country: 'China', label: '+86' },
  { code: '+57', country: 'Colombia', label: '+57' },
  { code: '+506', country: 'Costa Rica', label: '+506' },
  { code: '+385', country: 'Croatia', label: '+385' },
  { code: '+53', country: 'Cuba', label: '+53' },
  { code: '+357', country: 'Cyprus', label: '+357' },
  { code: '+420', country: 'Czech Republic', label: '+420' },
  { code: '+45', country: 'Denmark', label: '+45' },
  { code: '+593', country: 'Ecuador', label: '+593' },
  { code: '+20', country: 'Egypt', label: '+20' },
  { code: '+503', country: 'El Salvador', label: '+503' },
  { code: '+372', country: 'Estonia', label: '+372' },
  { code: '+251', country: 'Ethiopia', label: '+251' },
  { code: '+679', country: 'Fiji', label: '+679' },
  { code: '+358', country: 'Finland', label: '+358' },
  { code: '+995', country: 'Georgia', label: '+995' },
  { code: '+233', country: 'Ghana', label: '+233' },
  { code: '+30', country: 'Greece', label: '+30' },
  { code: '+502', country: 'Guatemala', label: '+502' },
  { code: '+852', country: 'Hong Kong', label: '+852' },
  { code: '+36', country: 'Hungary', label: '+36' },
  { code: '+354', country: 'Iceland', label: '+354' },
  { code: '+62', country: 'Indonesia', label: '+62' },
  { code: '+98', country: 'Iran', label: '+98' },
  { code: '+964', country: 'Iraq', label: '+964' },
  { code: '+353', country: 'Ireland', label: '+353' },
  { code: '+972', country: 'Israel', label: '+972' },
  { code: '+39', country: 'Italy', label: '+39' },
  { code: '+81', country: 'Japan', label: '+81' },
  { code: '+962', country: 'Jordan', label: '+962' },
  { code: '+7', country: 'Kazakhstan', label: '+7' },
  { code: '+254', country: 'Kenya', label: '+254' },
  { code: '+82', country: 'South Korea', label: '+82' },
  { code: '+856', country: 'Laos', label: '+856' },
  { code: '+371', country: 'Latvia', label: '+371' },
  { code: '+961', country: 'Lebanon', label: '+961' },
  { code: '+218', country: 'Libya', label: '+218' },
  { code: '+370', country: 'Lithuania', label: '+370' },
  { code: '+352', country: 'Luxembourg', label: '+352' },
  { code: '+853', country: 'Macau', label: '+853' },
  { code: '+389', country: 'Macedonia', label: '+389' },
  { code: '+261', country: 'Madagascar', label: '+261' },
  { code: '+960', country: 'Maldives', label: '+960' },
  { code: '+356', country: 'Malta', label: '+356' },
  { code: '+230', country: 'Mauritius', label: '+230' },
  { code: '+52', country: 'Mexico', label: '+52' },
  { code: '+373', country: 'Moldova', label: '+373' },
  { code: '+377', country: 'Monaco', label: '+377' },
  { code: '+976', country: 'Mongolia', label: '+976' },
  { code: '+382', country: 'Montenegro', label: '+382' },
  { code: '+212', country: 'Morocco', label: '+212' },
  { code: '+95', country: 'Myanmar', label: '+95' },
  { code: '+977', country: 'Nepal', label: '+977' },
  { code: '+31', country: 'Netherlands', label: '+31' },
  { code: '+64', country: 'New Zealand', label: '+64' },
  { code: '+505', country: 'Nicaragua', label: '+505' },
  { code: '+234', country: 'Nigeria', label: '+234' },
  { code: '+47', country: 'Norway', label: '+47' },
  { code: '+92', country: 'Pakistan', label: '+92' },
  { code: '+507', country: 'Panama', label: '+507' },
  { code: '+595', country: 'Paraguay', label: '+595' },
  { code: '+51', country: 'Peru', label: '+51' },
  { code: '+63', country: 'Philippines', label: '+63' },
  { code: '+48', country: 'Poland', label: '+48' },
  { code: '+351', country: 'Portugal', label: '+351' },
  { code: '+40', country: 'Romania', label: '+40' },
  { code: '+7', country: 'Russia', label: '+7' },
  { code: '+381', country: 'Serbia', label: '+381' },
  { code: '+421', country: 'Slovakia', label: '+421' },
  { code: '+386', country: 'Slovenia', label: '+386' },
  { code: '+27', country: 'South Africa', label: '+27' },
  { code: '+34', country: 'Spain', label: '+34' },
  { code: '+94', country: 'Sri Lanka', label: '+94' },
  { code: '+46', country: 'Sweden', label: '+46' },
  { code: '+41', country: 'Switzerland', label: '+41' },
  { code: '+886', country: 'Taiwan', label: '+886' },
  { code: '+255', country: 'Tanzania', label: '+255' },
  { code: '+66', country: 'Thailand', label: '+66' },
  { code: '+216', country: 'Tunisia', label: '+216' },
  { code: '+90', country: 'Turkey', label: '+90' },
  { code: '+380', country: 'Ukraine', label: '+380' },
  { code: '+598', country: 'Uruguay', label: '+598' },
  { code: '+998', country: 'Uzbekistan', label: '+998' },
  { code: '+58', country: 'Venezuela', label: '+58' },
  { code: '+84', country: 'Vietnam', label: '+84' },
  { code: '+967', country: 'Yemen', label: '+967' },
  { code: '+260', country: 'Zambia', label: '+260' },
  { code: '+263', country: 'Zimbabwe', label: '+263' },
];
