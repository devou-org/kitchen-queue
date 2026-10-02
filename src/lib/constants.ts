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

export const COUNTRY_CODES: CountryCodeItem[] = [
  // Popular Regions
  { code: '+91', country: 'India', label: '+91 (India)' },
  { code: '+971', country: 'United Arab Emirates', label: '+971 (UAE)' },
  { code: '+1', country: 'USA & Canada', label: '+1 (USA/Canada)' },
  { code: '+44', country: 'United Kingdom', label: '+44 (UK)' },
  { code: '+966', country: 'Saudi Arabia', label: '+966 (Saudi Arabia)' },
  { code: '+974', country: 'Qatar', label: '+974 (Qatar)' },
  { code: '+968', country: 'Oman', label: '+968 (Oman)' },
  { code: '+965', country: 'Kuwait', label: '+965 (Kuwait)' },
  { code: '+973', country: 'Bahrain', label: '+973 (Bahrain)' },
  { code: '+65', country: 'Singapore', label: '+65 (Singapore)' },
  { code: '+60', country: 'Malaysia', label: '+60 (Malaysia)' },
  { code: '+61', country: 'Australia', label: '+61 (Australia)' },
  { code: '+49', country: 'Germany', label: '+49 (Germany)' },
  { code: '+33', country: 'France', label: '+33 (France)' },
  // All Global Calling Codes (Alphabetical by Country)
  { code: '+93', country: 'Afghanistan', label: '+93 (Afghanistan)' },
  { code: '+355', country: 'Albania', label: '+355 (Albania)' },
  { code: '+213', country: 'Algeria', label: '+213 (Algeria)' },
  { code: '+376', country: 'Andorra', label: '+376 (Andorra)' },
  { code: '+244', country: 'Angola', label: '+244 (Angola)' },
  { code: '+54', country: 'Argentina', label: '+54 (Argentina)' },
  { code: '+374', country: 'Armenia', label: '+374 (Armenia)' },
  { code: '+43', country: 'Austria', label: '+43 (Austria)' },
  { code: '+994', country: 'Azerbaijan', label: '+994 (Azerbaijan)' },
  { code: '+880', country: 'Bangladesh', label: '+880 (Bangladesh)' },
  { code: '+375', country: 'Belarus', label: '+375 (Belarus)' },
  { code: '+32', country: 'Belgium', label: '+32 (Belgium)' },
  { code: '+501', country: 'Belize', label: '+501 (Belize)' },
  { code: '+229', country: 'Benin', label: '+229 (Benin)' },
  { code: '+975', country: 'Bhutan', label: '+975 (Bhutan)' },
  { code: '+591', country: 'Bolivia', label: '+591 (Bolivia)' },
  { code: '+387', country: 'Bosnia & Herzegovina', label: '+387 (Bosnia)' },
  { code: '+267', country: 'Botswana', label: '+267 (Botswana)' },
  { code: '+55', country: 'Brazil', label: '+55 (Brazil)' },
  { code: '+359', country: 'Bulgaria', label: '+359 (Bulgaria)' },
  { code: '+855', country: 'Cambodia', label: '+855 (Cambodia)' },
  { code: '+237', country: 'Cameroon', label: '+237 (Cameroon)' },
  { code: '+56', country: 'Chile', label: '+56 (Chile)' },
  { code: '+86', country: 'China', label: '+86 (China)' },
  { code: '+57', country: 'Colombia', label: '+57 (Colombia)' },
  { code: '+506', country: 'Costa Rica', label: '+506 (Costa Rica)' },
  { code: '+385', country: 'Croatia', label: '+385 (Croatia)' },
  { code: '+53', country: 'Cuba', label: '+53 (Cuba)' },
  { code: '+357', country: 'Cyprus', label: '+357 (Cyprus)' },
  { code: '+420', country: 'Czech Republic', label: '+420 (Czech Rep)' },
  { code: '+45', country: 'Denmark', label: '+45 (Denmark)' },
  { code: '+593', country: 'Ecuador', label: '+593 (Ecuador)' },
  { code: '+20', country: 'Egypt', label: '+20 (Egypt)' },
  { code: '+503', country: 'El Salvador', label: '+503 (El Salvador)' },
  { code: '+372', country: 'Estonia', label: '+372 (Estonia)' },
  { code: '+251', country: 'Ethiopia', label: '+251 (Ethiopia)' },
  { code: '+679', country: 'Fiji', label: '+679 (Fiji)' },
  { code: '+358', country: 'Finland', label: '+358 (Finland)' },
  { code: '+995', country: 'Georgia', label: '+995 (Georgia)' },
  { code: '+233', country: 'Ghana', label: '+233 (Ghana)' },
  { code: '+30', country: 'Greece', label: '+30 (Greece)' },
  { code: '+502', country: 'Guatemala', label: '+502 (Guatemala)' },
  { code: '+852', country: 'Hong Kong', label: '+852 (Hong Kong)' },
  { code: '+36', country: 'Hungary', label: '+36 (Hungary)' },
  { code: '+354', country: 'Iceland', label: '+354 (Iceland)' },
  { code: '+62', country: 'Indonesia', label: '+62 (Indonesia)' },
  { code: '+98', country: 'Iran', label: '+98 (Iran)' },
  { code: '+964', country: 'Iraq', label: '+964 (Iraq)' },
  { code: '+353', country: 'Ireland', label: '+353 (Ireland)' },
  { code: '+972', country: 'Israel', label: '+972 (Israel)' },
  { code: '+39', country: 'Italy', label: '+39 (Italy)' },
  { code: '+81', country: 'Japan', label: '+81 (Japan)' },
  { code: '+962', country: 'Jordan', label: '+962 (Jordan)' },
  { code: '+7', country: 'Kazakhstan', label: '+7 (Kazakhstan)' },
  { code: '+254', country: 'Kenya', label: '+254 (Kenya)' },
  { code: '+82', country: 'South Korea', label: '+82 (South Korea)' },
  { code: '+856', country: 'Laos', label: '+856 (Laos)' },
  { code: '+371', country: 'Latvia', label: '+371 (Latvia)' },
  { code: '+961', country: 'Lebanon', label: '+961 (Lebanon)' },
  { code: '+218', country: 'Libya', label: '+218 (Libya)' },
  { code: '+370', country: 'Lithuania', label: '+370 (Lithuania)' },
  { code: '+352', country: 'Luxembourg', label: '+352 (Luxembourg)' },
  { code: '+853', country: 'Macau', label: '+853 (Macau)' },
  { code: '+389', country: 'Macedonia', label: '+389 (Macedonia)' },
  { code: '+261', country: 'Madagascar', label: '+261 (Madagascar)' },
  { code: '+960', country: 'Maldives', label: '+960 (Maldives)' },
  { code: '+356', country: 'Malta', label: '+356 (Malta)' },
  { code: '+230', country: 'Mauritius', label: '+230 (Mauritius)' },
  { code: '+52', country: 'Mexico', label: '+52 (Mexico)' },
  { code: '+373', country: 'Moldova', label: '+373 (Moldova)' },
  { code: '+377', country: 'Monaco', label: '+377 (Monaco)' },
  { code: '+976', country: 'Mongolia', label: '+976 (Mongolia)' },
  { code: '+382', country: 'Montenegro', label: '+382 (Montenegro)' },
  { code: '+212', country: 'Morocco', label: '+212 (Morocco)' },
  { code: '+95', country: 'Myanmar', label: '+95 (Myanmar)' },
  { code: '+977', country: 'Nepal', label: '+977 (Nepal)' },
  { code: '+31', country: 'Netherlands', label: '+31 (Netherlands)' },
  { code: '+64', country: 'New Zealand', label: '+64 (New Zealand)' },
  { code: '+505', country: 'Nicaragua', label: '+505 (Nicaragua)' },
  { code: '+234', country: 'Nigeria', label: '+234 (Nigeria)' },
  { code: '+47', country: 'Norway', label: '+47 (Norway)' },
  { code: '+92', country: 'Pakistan', label: '+92 (Pakistan)' },
  { code: '+507', country: 'Panama', label: '+507 (Panama)' },
  { code: '+595', country: 'Paraguay', label: '+595 (Paraguay)' },
  { code: '+51', country: 'Peru', label: '+51 (Peru)' },
  { code: '+63', country: 'Philippines', label: '+63 (Philippines)' },
  { code: '+48', country: 'Poland', label: '+48 (Poland)' },
  { code: '+351', country: 'Portugal', label: '+351 (Portugal)' },
  { code: '+40', country: 'Romania', label: '+40 (Romania)' },
  { code: '+7', country: 'Russia', label: '+7 (Russia)' },
  { code: '+381', country: 'Serbia', label: '+381 (Serbia)' },
  { code: '+421', country: 'Slovakia', label: '+421 (Slovakia)' },
  { code: '+386', country: 'Slovenia', label: '+386 (Slovenia)' },
  { code: '+27', country: 'South Africa', label: '+27 (South Africa)' },
  { code: '+34', country: 'Spain', label: '+34 (Spain)' },
  { code: '+94', country: 'Sri Lanka', label: '+94 (Sri Lanka)' },
  { code: '+46', country: 'Sweden', label: '+46 (Sweden)' },
  { code: '+41', country: 'Switzerland', label: '+41 (Switzerland)' },
  { code: '+886', country: 'Taiwan', label: '+886 (Taiwan)' },
  { code: '+255', country: 'Tanzania', label: '+255 (Tanzania)' },
  { code: '+66', country: 'Thailand', label: '+66 (Thailand)' },
  { code: '+216', country: 'Tunisia', label: '+216 (Tunisia)' },
  { code: '+90', country: 'Turkey', label: '+90 (Turkey)' },
  { code: '+380', country: 'Ukraine', label: '+380 (Ukraine)' },
  { code: '+598', country: 'Uruguay', label: '+598 (Uruguay)' },
  { code: '+998', country: 'Uzbekistan', label: '+998 (Uzbekistan)' },
  { code: '+58', country: 'Venezuela', label: '+58 (Venezuela)' },
  { code: '+84', country: 'Vietnam', label: '+84 (Vietnam)' },
  { code: '+967', country: 'Yemen', label: '+967 (Yemen)' },
  { code: '+260', country: 'Zambia', label: '+260 (Zambia)' },
  { code: '+263', country: 'Zimbabwe', label: '+263 (Zimbabwe)' },
];
