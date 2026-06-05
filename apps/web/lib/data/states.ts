/**
 * Canonical list of Nigeria's 36 states + FCT.
 *
 * `code` is the ISO 3166-2:NG 2-letter suffix (e.g. "LA" for Lagos = NG-LA). The matching
 * GeoJSON polygon in `nigeria-states.geojson` carries the same code in `properties.shapeISO`
 * as "NG-XX" — the map component strips the "NG-" prefix when keying by state.
 *
 * `slug` is the URL slug used at /states/[slug]. The existing lga-mapping.json uses a
 * non-ISO code "KB" for Kebbi; we keep "ke" as the canonical slug here and resolveSlug()
 * accepts both for backward compatibility with that fixture.
 */
export interface NigeriaState {
  /** ISO 3166-2:NG suffix, e.g. "LA". */
  code: string;
  name: string;
  slug: string;
  /** Slug aliases accepted by resolveSlug (lower-case). */
  aliases?: string[];
  /** Geopolitical zone — useful for grouping on the dashboard. */
  zone: 'NC' | 'NE' | 'NW' | 'SE' | 'SS' | 'SW';
}

export const STATES: NigeriaState[] = [
  { code: 'AB', name: 'Abia',         slug: 'abia',          zone: 'SE' },
  { code: 'AD', name: 'Adamawa',      slug: 'adamawa',       zone: 'NE' },
  { code: 'AK', name: 'Akwa Ibom',    slug: 'akwa-ibom',     zone: 'SS' },
  { code: 'AN', name: 'Anambra',      slug: 'anambra',       zone: 'SE' },
  { code: 'BA', name: 'Bauchi',       slug: 'bauchi',        zone: 'NE' },
  { code: 'BY', name: 'Bayelsa',      slug: 'bayelsa',       zone: 'SS' },
  { code: 'BE', name: 'Benue',        slug: 'benue',         zone: 'NC' },
  { code: 'BO', name: 'Borno',        slug: 'borno',         zone: 'NE' },
  { code: 'CR', name: 'Cross River',  slug: 'cross-river',   zone: 'SS' },
  { code: 'DE', name: 'Delta',        slug: 'delta',         zone: 'SS' },
  { code: 'EB', name: 'Ebonyi',       slug: 'ebonyi',        zone: 'SE' },
  { code: 'ED', name: 'Edo',          slug: 'edo',           zone: 'SS' },
  { code: 'EK', name: 'Ekiti',        slug: 'ekiti',         zone: 'SW' },
  { code: 'EN', name: 'Enugu',        slug: 'enugu',         zone: 'SE' },
  { code: 'FC', name: 'FCT',          slug: 'fct',           aliases: ['abuja', 'federal-capital-territory'], zone: 'NC' },
  { code: 'GO', name: 'Gombe',        slug: 'gombe',         zone: 'NE' },
  { code: 'IM', name: 'Imo',          slug: 'imo',           zone: 'SE' },
  { code: 'JI', name: 'Jigawa',       slug: 'jigawa',        zone: 'NW' },
  { code: 'KD', name: 'Kaduna',       slug: 'kaduna',        zone: 'NW' },
  { code: 'KN', name: 'Kano',         slug: 'kano',          zone: 'NW' },
  { code: 'KT', name: 'Katsina',      slug: 'katsina',       zone: 'NW' },
  { code: 'KE', name: 'Kebbi',        slug: 'kebbi',         aliases: ['kb'], zone: 'NW' },
  { code: 'KO', name: 'Kogi',         slug: 'kogi',          zone: 'NC' },
  { code: 'KW', name: 'Kwara',        slug: 'kwara',         zone: 'NC' },
  { code: 'LA', name: 'Lagos',        slug: 'lagos',         zone: 'SW' },
  { code: 'NA', name: 'Nasarawa',     slug: 'nasarawa',      zone: 'NC' },
  { code: 'NI', name: 'Niger',        slug: 'niger',         zone: 'NC' },
  { code: 'OG', name: 'Ogun',         slug: 'ogun',          zone: 'SW' },
  { code: 'ON', name: 'Ondo',         slug: 'ondo',          zone: 'SW' },
  { code: 'OS', name: 'Osun',         slug: 'osun',          zone: 'SW' },
  { code: 'OY', name: 'Oyo',          slug: 'oyo',           zone: 'SW' },
  { code: 'PL', name: 'Plateau',      slug: 'plateau',       zone: 'NC' },
  { code: 'RI', name: 'Rivers',       slug: 'rivers',        zone: 'SS' },
  { code: 'SO', name: 'Sokoto',       slug: 'sokoto',        zone: 'NW' },
  { code: 'TA', name: 'Taraba',       slug: 'taraba',        zone: 'NE' },
  { code: 'YO', name: 'Yobe',         slug: 'yobe',          zone: 'NE' },
  { code: 'ZA', name: 'Zamfara',      slug: 'zamfara',       zone: 'NW' },
];

const BY_CODE = new Map(STATES.map((s) => [s.code, s]));
const BY_SLUG = new Map<string, NigeriaState>();
for (const s of STATES) {
  BY_SLUG.set(s.slug, s);
  for (const alias of s.aliases ?? []) BY_SLUG.set(alias, s);
}

export function getByCode(code: string): NigeriaState | undefined {
  return BY_CODE.get(code.toUpperCase());
}

export function getBySlug(slug: string): NigeriaState | undefined {
  return BY_SLUG.get(slug.toLowerCase());
}

export const ZONE_NAMES: Record<NigeriaState['zone'], string> = {
  NC: 'North Central',
  NE: 'North East',
  NW: 'North West',
  SE: 'South East',
  SS: 'South South',
  SW: 'South West',
};
