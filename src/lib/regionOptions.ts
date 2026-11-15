import { APP_LOCALE, getString } from "./i18n/index";

const ENGLISH_REGION_OPTIONS = [
  { value: 'AUTO', label: 'Automatic (no country limit)' },
  { value: 'DZ', label: 'Algeria' }, { value: 'AR', label: 'Argentina' }, { value: 'AU', label: 'Australia' },
  { value: 'AT', label: 'Austria' }, { value: 'AZ', label: 'Azerbaijan' }, { value: 'BH', label: 'Bahrain' },
  { value: 'BD', label: 'Bangladesh' }, { value: 'BY', label: 'Belarus' }, { value: 'BE', label: 'Belgium' },
  { value: 'BO', label: 'Bolivia' }, { value: 'BA', label: 'Bosnia and Herzegovina' }, { value: 'BR', label: 'Brazil' },
  { value: 'BG', label: 'Bulgaria' }, { value: 'CA', label: 'Canada' }, { value: 'CL', label: 'Chile' },
  { value: 'CO', label: 'Colombia' }, { value: 'CR', label: 'Costa Rica' }, { value: 'HR', label: 'Croatia' },
  { value: 'CY', label: 'Cyprus' }, { value: 'CZ', label: 'Czechia' }, { value: 'DK', label: 'Denmark' },
  { value: 'DO', label: 'Dominican Republic' }, { value: 'EC', label: 'Ecuador' }, { value: 'EG', label: 'Egypt' },
  { value: 'SV', label: 'El Salvador' }, { value: 'EE', label: 'Estonia' }, { value: 'FI', label: 'Finland' },
  { value: 'FR', label: 'France' }, { value: 'GE', label: 'Georgia' }, { value: 'DE', label: 'Germany' },
  { value: 'GH', label: 'Ghana' }, { value: 'GR', label: 'Greece' }, { value: 'GT', label: 'Guatemala' },
  { value: 'HN', label: 'Honduras' }, { value: 'HK', label: 'Hong Kong' }, { value: 'HU', label: 'Hungary' },
  { value: 'IS', label: 'Iceland' }, { value: 'IN', label: 'India' }, { value: 'ID', label: 'Indonesia' },
  { value: 'IQ', label: 'Iraq' }, { value: 'IE', label: 'Ireland' }, { value: 'IL', label: 'Israel' },
  { value: 'IT', label: 'Italy' }, { value: 'JM', label: 'Jamaica' }, { value: 'JP', label: 'Japan' },
  { value: 'JO', label: 'Jordan' }, { value: 'KZ', label: 'Kazakhstan' }, { value: 'KE', label: 'Kenya' },
  { value: 'KW', label: 'Kuwait' }, { value: 'LV', label: 'Latvia' }, { value: 'LB', label: 'Lebanon' },
  { value: 'LY', label: 'Libya' }, { value: 'LI', label: 'Liechtenstein' }, { value: 'LT', label: 'Lithuania' },
  { value: 'LU', label: 'Luxembourg' }, { value: 'MY', label: 'Malaysia' }, { value: 'MT', label: 'Malta' },
  { value: 'MX', label: 'Mexico' }, { value: 'ME', label: 'Montenegro' }, { value: 'MA', label: 'Morocco' },
  { value: 'NP', label: 'Nepal' }, { value: 'NL', label: 'Netherlands' }, { value: 'NZ', label: 'New Zealand' },
  { value: 'NI', label: 'Nicaragua' }, { value: 'NG', label: 'Nigeria' }, { value: 'MK', label: 'North Macedonia' },
  { value: 'NO', label: 'Norway' }, { value: 'OM', label: 'Oman' }, { value: 'PK', label: 'Pakistan' },
  { value: 'PA', label: 'Panama' }, { value: 'PG', label: 'Papua New Guinea' }, { value: 'PY', label: 'Paraguay' },
  { value: 'PE', label: 'Peru' }, { value: 'PH', label: 'Philippines' }, { value: 'PL', label: 'Poland' },
  { value: 'PT', label: 'Portugal' }, { value: 'PR', label: 'Puerto Rico' }, { value: 'QA', label: 'Qatar' },
  { value: 'RO', label: 'Romania' }, { value: 'RU', label: 'Russia' }, { value: 'SA', label: 'Saudi Arabia' },
  { value: 'SN', label: 'Senegal' }, { value: 'RS', label: 'Serbia' }, { value: 'SG', label: 'Singapore' },
  { value: 'SK', label: 'Slovakia' }, { value: 'SI', label: 'Slovenia' }, { value: 'ZA', label: 'South Africa' },
  { value: 'KR', label: 'South Korea' }, { value: 'ES', label: 'Spain' }, { value: 'LK', label: 'Sri Lanka' },
  { value: 'SE', label: 'Sweden' }, { value: 'CH', label: 'Switzerland' }, { value: 'TW', label: 'Taiwan' },
  { value: 'TZ', label: 'Tanzania' }, { value: 'TH', label: 'Thailand' }, { value: 'TN', label: 'Tunisia' },
  { value: 'TR', label: 'Turkey' }, { value: 'UG', label: 'Uganda' }, { value: 'UA', label: 'Ukraine' },
  { value: 'AE', label: 'United Arab Emirates' }, { value: 'GB', label: 'United Kingdom' },
  { value: 'US', label: 'United States' }, { value: 'UY', label: 'Uruguay' }, { value: 'UZ', label: 'Uzbekistan (no country limit)' }, { value: 'VE', label: 'Venezuela' },
  { value: 'VN', label: 'Vietnam' }, { value: 'YE', label: 'Yemen' }, { value: 'ZW', label: 'Zimbabwe' },
];

let cachedLocale = '';
let cachedOptions: { value: string; label: string }[] = [];

/**
 * The regions by name in the interface language (the browser's own region names), with English as the fallback.
 * "Automatic" and Uzbekistan have their own wording.
 */
export function regionOptions(): { value: string; label: string }[] {
  if (cachedLocale === APP_LOCALE && cachedOptions.length > 0) return cachedOptions;
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([APP_LOCALE], { type: 'region' });
  } catch {
    names = null;
  }
  cachedOptions = ENGLISH_REGION_OPTIONS.map(({ value, label }) => {
    if (value === 'AUTO') return { value, label: getString('region_auto') };
    if (value === 'UZ') return { value, label: getString('region_uz_no_limit') };
    let translated: string | undefined;
    try {
      translated = APP_LOCALE === 'en' ? undefined : names?.of(value);
    } catch {
      translated = undefined;
    }
    return { value, label: translated ?? label };
  });
  cachedLocale = APP_LOCALE;
  return cachedOptions;
}
