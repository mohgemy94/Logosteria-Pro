export interface CountryOption {
  code: string;       // ISO 2-letter or 3-letter (e.g. 'SA' or 'KSA')
  iso3: string;       // ISO 3-letter (e.g. 'SAU' or 'KSA')
  nameAr: string;     // الاسم بالعربية
  nameEn: string;     // Name in English
  dialCode: string;   // مفتاح الاتصال
  flag: string;       // Emoji flag
}

export const COUNTRIES_LIST: CountryOption[] = [
  { code: 'SA', iso3: 'KSA', nameAr: 'المملكة العربية السعودية', nameEn: 'Saudi Arabia', dialCode: '+966', flag: '🇸🇦' },
  { code: 'AE', iso3: 'ARE', nameAr: 'الإمارات العربية المتحدة', nameEn: 'United Arab Emirates', dialCode: '+971', flag: '🇦🇪' },
  { code: 'KW', iso3: 'KWT', nameAr: 'الكويت', nameEn: 'Kuwait', dialCode: '+965', flag: '🇰🇼' },
  { code: 'BH', iso3: 'BHR', nameAr: 'البحرين', nameEn: 'Bahrain', dialCode: '+973', flag: '🇧🇭' },
  { code: 'OM', iso3: 'OMN', nameAr: 'سلطنة عُمان', nameEn: 'Oman', dialCode: '+968', flag: '🇴🇲' },
  { code: 'QA', iso3: 'QAT', nameAr: 'قطر', nameEn: 'Qatar', dialCode: '+974', flag: '🇶🇦' },
  { code: 'EG', iso3: 'EGY', nameAr: 'مصر', nameEn: 'Egypt', dialCode: '+20', flag: '🇪🇬' },
  { code: 'JO', iso3: 'JOR', nameAr: 'الأردن', nameEn: 'Jordan', dialCode: '+962', flag: '🇯🇴' },
  { code: 'IQ', iso3: 'IRQ', nameAr: 'العراق', nameEn: 'Iraq', dialCode: '+964', flag: '🇮🇶' },
  { code: 'YE', iso3: 'YEM', nameAr: 'اليمن', nameEn: 'Yemen', dialCode: '+967', flag: '🇾🇪' },
  { code: 'LB', iso3: 'LBN', nameAr: 'لبنان', nameEn: 'Lebanon', dialCode: '+961', flag: '🇱🇧' },
  { code: 'SY', iso3: 'SYR', nameAr: 'سوريا', nameEn: 'Syria', dialCode: '+963', flag: '🇸🇾' },
  { code: 'PS', iso3: 'PSE', nameAr: 'فلسطين', nameEn: 'Palestine', dialCode: '+970', flag: '🇵🇸' },
  { code: 'SD', iso3: 'SDN', nameAr: 'السودان', nameEn: 'Sudan', dialCode: '+249', flag: '🇸🇩' },
  { code: 'LY', iso3: 'LBY', nameAr: 'ليبيا', nameEn: 'Libya', dialCode: '+218', flag: '🇱🇾' },
  { code: 'TN', iso3: 'TUN', nameAr: 'تونس', nameEn: 'Tunisia', dialCode: '+216', flag: '🇹🇳' },
  { code: 'DZ', iso3: 'DZA', nameAr: 'الجزائر', nameEn: 'Algeria', dialCode: '+213', flag: '🇩🇿' },
  { code: 'MA', iso3: 'MAR', nameAr: 'المغرب', nameEn: 'Morocco', dialCode: '+212', flag: '🇲🇦' },
  { code: 'TR', iso3: 'TUR', nameAr: 'تركيا', nameEn: 'Turkey', dialCode: '+90', flag: '🇹🇷' },
  { code: 'US', iso3: 'USA', nameAr: 'الولايات المتحدة', nameEn: 'United States', dialCode: '+1', flag: '🇺🇸' },
  { code: 'GB', iso3: 'GBR', nameAr: 'المملكة المتحدة', nameEn: 'United Kingdom', dialCode: '+44', flag: '🇬🇧' },
  { code: 'DE', iso3: 'DEU', nameAr: 'ألمانيا', nameEn: 'Germany', dialCode: '+49', flag: '🇩🇪' },
  { code: 'FR', iso3: 'FRA', nameAr: 'فرنسا', nameEn: 'France', dialCode: '+33', flag: '🇫🇷' },
  { code: 'CN', iso3: 'CHN', nameAr: 'الصين', nameEn: 'China', dialCode: '+86', flag: '🇨🇳' },
  { code: 'IN', iso3: 'IND', nameAr: 'الهند', nameEn: 'India', dialCode: '+91', flag: '🇮🇳' },
];

export function getCountryByCodeOrName(val?: string): CountryOption {
  const defaultCountry: CountryOption = COUNTRIES_LIST[0] || {
    code: 'SA',
    iso3: 'KSA',
    nameAr: 'المملكة العربية السعودية',
    nameEn: 'Saudi Arabia',
    dialCode: '+966',
    flag: '🇸🇦'
  };

  if (!val) return defaultCountry;
  const normalized = val.trim().toLowerCase();
  const found = COUNTRIES_LIST.find(
    c =>
      c.code.toLowerCase() === normalized ||
      c.iso3.toLowerCase() === normalized ||
      c.nameAr.toLowerCase() === normalized ||
      c.nameEn.toLowerCase() === normalized
  );
  return found || {
    code: val,
    iso3: val,
    nameAr: val,
    nameEn: val,
    dialCode: '',
    flag: '🌐'
  };
}
