export const CONTINENTS = [
  { code: "EU", name: "Europe" },
  { code: "AF", name: "Africa" },
  { code: "AS", name: "Asia" },
  { code: "NA", name: "North America" },
  { code: "SA", name: "South America" },
  { code: "OC", name: "Oceania" },
];

export const COUNTRIES = [
  { code: "US", name: "United States", continent: "NA" },
  { code: "CA", name: "Canada", continent: "NA" },
  { code: "MX", name: "Mexico", continent: "NA" },
  { code: "UK", name: "United Kingdom", continent: "EU" },
  { code: "IE", name: "Ireland", continent: "EU" },
  { code: "FR", name: "France", continent: "EU" },
  { code: "DE", name: "Germany", continent: "EU" },
  { code: "ES", name: "Spain", continent: "EU" },
  { code: "IT", name: "Italy", continent: "EU" },
  { code: "PT", name: "Portugal", continent: "EU" },
  { code: "NL", name: "Netherlands", continent: "EU" },
  { code: "BE", name: "Belgium", continent: "EU" },
  { code: "CH", name: "Switzerland", continent: "EU" },
  { code: "AT", name: "Austria", continent: "EU" },
  { code: "SE", name: "Sweden", continent: "EU" },
  { code: "NO", name: "Norway", continent: "EU" },
  { code: "FI", name: "Finland", continent: "EU" },
  { code: "DK", name: "Denmark", continent: "EU" },
  { code: "PL", name: "Poland", continent: "EU" },
  { code: "CZ", name: "Czech Republic", continent: "EU" },
  { code: "SK", name: "Slovakia", continent: "EU" },
  { code: "HU", name: "Hungary", continent: "EU" },
  { code: "RO", name: "Romania", continent: "EU" },
  { code: "BG", name: "Bulgaria", continent: "EU" },
  { code: "GR", name: "Greece", continent: "EU" },
  { code: "HR", name: "Croatia", continent: "EU" },
  { code: "RS", name: "Serbia", continent: "EU" },
  { code: "UA", name: "Ukraine", continent: "EU" },
  { code: "RU", name: "Russia", continent: "EU" },
  { code: "TR", name: "Türkiye", continent: "AS" },
  { code: "IL", name: "Israel", continent: "AS" },
  { code: "AE", name: "United Arab Emirates", continent: "AS" },
  { code: "SA", name: "Saudi Arabia", continent: "AS" },
  { code: "QA", name: "Qatar", continent: "AS" },
  { code: "EG", name: "Egypt", continent: "AF" },
  { code: "MA", name: "Morocco", continent: "AF" },
  { code: "TN", name: "Tunisia", continent: "AF" },
  { code: "DZ", name: "Algeria", continent: "AF" },
  { code: "NG", name: "Nigeria", continent: "AF" },
  { code: "GH", name: "Ghana", continent: "AF" },
  { code: "KE", name: "Kenya", continent: "AF" },
  { code: "ZA", name: "South Africa", continent: "AF" },
  { code: "CN", name: "China", continent: "AS" },
  { code: "TW", name: "Taiwan", continent: "AS" },
  { code: "HK", name: "Hong Kong", continent: "AS" },
  { code: "JP", name: "Japan", continent: "AS" },
  { code: "KR", name: "South Korea", continent: "AS" },
  { code: "IN", name: "India", continent: "AS" },
  { code: "PK", name: "Pakistan", continent: "AS" },
  { code: "BD", name: "Bangladesh", continent: "AS" },
  { code: "LK", name: "Sri Lanka", continent: "AS" },
  { code: "NP", name: "Nepal", continent: "AS" },
  { code: "ID", name: "Indonesia", continent: "AS" },
  { code: "MY", name: "Malaysia", continent: "AS" },
  { code: "SG", name: "Singapore", continent: "AS" },
  { code: "TH", name: "Thailand", continent: "AS" },
  { code: "VN", name: "Vietnam", continent: "AS" },
  { code: "PH", name: "Philippines", continent: "AS" },
  { code: "KH", name: "Cambodia", continent: "AS" },
  { code: "AU", name: "Australia", continent: "OC" },
  { code: "NZ", name: "New Zealand", continent: "OC" },
  { code: "BR", name: "Brazil", continent: "SA" },
  { code: "AR", name: "Argentina", continent: "SA" },
  { code: "CL", name: "Chile", continent: "SA" },
  { code: "CO", name: "Colombia", continent: "SA" },
  { code: "PE", name: "Peru", continent: "SA" },
  { code: "VE", name: "Venezuela", continent: "SA" },
  { code: "EC", name: "Ecuador", continent: "SA" },
  { code: "UY", name: "Uruguay", continent: "SA" },
  { code: "BO", name: "Bolivia", continent: "SA" },
  { code: "CR", name: "Costa Rica", continent: "NA" },
  { code: "PA", name: "Panama", continent: "NA" },
  { code: "DO", name: "Dominican Republic", continent: "NA" },
  { code: "CU", name: "Cuba", continent: "NA" },
  { code: "PR", name: "Puerto Rico", continent: "NA" },
];

export function countryName(code) {
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

export function continentOf(countryCode) {
  return COUNTRIES.find((country) => country.code === countryCode)?.continent ?? null;
}

export function countryMatchesContinents(countryCode, continents) {
  if (!continents?.length || continents.length >= CONTINENTS.length) return true;
  if (!countryCode) return true;
  const continent = continentOf(countryCode);
  if (!continent) return true;
  return continents.includes(continent);
}
