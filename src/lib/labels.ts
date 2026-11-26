// Display labels for stored codes, in English and Bangla.

const GENDER: Record<string, [string, string]> = {
  male: ['Male', 'পুরুষ'],
  female: ['Female', 'নারী'],
  other: ['Other', 'অন্যান্য'],
};

export function genderLabel(value: unknown, locale: string): string {
  const key = String(value ?? '').toLowerCase();
  return GENDER[key]?.[locale === 'bn' ? 1 : 0] ?? String(value ?? '');
}
