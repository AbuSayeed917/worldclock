/**
 * The city table. Latitude and longitude are not decoration here — they feed the
 * solar model, so every card gets a real sunrise, a real sunset and a sky that
 * matches what is actually outside the window in that city right now.
 */

export interface City {
  id: string;
  name: string;
  country: string;
  /** IANA timezone identifier. */
  zone: string;
  lat: number;
  lon: number;
  region: Region;
}

export type Region =
  | 'Europe'
  | 'Americas'
  | 'Asia'
  | 'Africa'
  | 'Oceania'
  | 'Middle East';

export const CITIES: City[] = [
  // Europe
  c('london', 'London', 'United Kingdom', 'Europe/London', 51.5074, -0.1278, 'Europe'),
  c('paris', 'Paris', 'France', 'Europe/Paris', 48.8566, 2.3522, 'Europe'),
  c('berlin', 'Berlin', 'Germany', 'Europe/Berlin', 52.52, 13.405, 'Europe'),
  c('madrid', 'Madrid', 'Spain', 'Europe/Madrid', 40.4168, -3.7038, 'Europe'),
  c('barcelona', 'Barcelona', 'Spain', 'Europe/Madrid', 41.3874, 2.1686, 'Europe'),
  c('rome', 'Rome', 'Italy', 'Europe/Rome', 41.9028, 12.4964, 'Europe'),
  c('milan', 'Milan', 'Italy', 'Europe/Rome', 45.4642, 9.19, 'Europe'),
  c('amsterdam', 'Amsterdam', 'Netherlands', 'Europe/Amsterdam', 52.3676, 4.9041, 'Europe'),
  c('brussels', 'Brussels', 'Belgium', 'Europe/Brussels', 50.8503, 4.3517, 'Europe'),
  c('zurich', 'Zurich', 'Switzerland', 'Europe/Zurich', 47.3769, 8.5417, 'Europe'),
  c('geneva', 'Geneva', 'Switzerland', 'Europe/Zurich', 46.2044, 6.1432, 'Europe'),
  c('vienna', 'Vienna', 'Austria', 'Europe/Vienna', 48.2082, 16.3738, 'Europe'),
  c('prague', 'Prague', 'Czechia', 'Europe/Prague', 50.0755, 14.4378, 'Europe'),
  c('warsaw', 'Warsaw', 'Poland', 'Europe/Warsaw', 52.2297, 21.0122, 'Europe'),
  c('budapest', 'Budapest', 'Hungary', 'Europe/Budapest', 47.4979, 19.0402, 'Europe'),
  c('stockholm', 'Stockholm', 'Sweden', 'Europe/Stockholm', 59.3293, 18.0686, 'Europe'),
  c('oslo', 'Oslo', 'Norway', 'Europe/Oslo', 59.9139, 10.7522, 'Europe'),
  c('copenhagen', 'Copenhagen', 'Denmark', 'Europe/Copenhagen', 55.6761, 12.5683, 'Europe'),
  c('helsinki', 'Helsinki', 'Finland', 'Europe/Helsinki', 60.1699, 24.9384, 'Europe'),
  c('reykjavik', 'Reykjavík', 'Iceland', 'Atlantic/Reykjavik', 64.1466, -21.9426, 'Europe'),
  c('tromso', 'Tromsø', 'Norway', 'Europe/Oslo', 69.6492, 18.9553, 'Europe'),
  c('dublin', 'Dublin', 'Ireland', 'Europe/Dublin', 53.3498, -6.2603, 'Europe'),
  c('edinburgh', 'Edinburgh', 'United Kingdom', 'Europe/London', 55.9533, -3.1883, 'Europe'),
  c('lisbon', 'Lisbon', 'Portugal', 'Europe/Lisbon', 38.7223, -9.1393, 'Europe'),
  c('athens', 'Athens', 'Greece', 'Europe/Athens', 37.9838, 23.7275, 'Europe'),
  c('bucharest', 'Bucharest', 'Romania', 'Europe/Bucharest', 44.4268, 26.1025, 'Europe'),
  c('kyiv', 'Kyiv', 'Ukraine', 'Europe/Kyiv', 50.4501, 30.5234, 'Europe'),
  c('moscow', 'Moscow', 'Russia', 'Europe/Moscow', 55.7558, 37.6173, 'Europe'),

  // Americas
  c('newyork', 'New York', 'United States', 'America/New_York', 40.7128, -74.006, 'Americas'),
  c('washington', 'Washington DC', 'United States', 'America/New_York', 38.9072, -77.0369, 'Americas'),
  c('boston', 'Boston', 'United States', 'America/New_York', 42.3601, -71.0589, 'Americas'),
  c('miami', 'Miami', 'United States', 'America/New_York', 25.7617, -80.1918, 'Americas'),
  c('toronto', 'Toronto', 'Canada', 'America/Toronto', 43.6532, -79.3832, 'Americas'),
  c('montreal', 'Montréal', 'Canada', 'America/Toronto', 45.5019, -73.5674, 'Americas'),
  c('chicago', 'Chicago', 'United States', 'America/Chicago', 41.8781, -87.6298, 'Americas'),
  c('dallas', 'Dallas', 'United States', 'America/Chicago', 32.7767, -96.797, 'Americas'),
  c('mexicocity', 'Mexico City', 'Mexico', 'America/Mexico_City', 19.4326, -99.1332, 'Americas'),
  c('denver', 'Denver', 'United States', 'America/Denver', 39.7392, -104.9903, 'Americas'),
  c('phoenix', 'Phoenix', 'United States', 'America/Phoenix', 33.4484, -112.074, 'Americas'),
  c('losangeles', 'Los Angeles', 'United States', 'America/Los_Angeles', 34.0522, -118.2437, 'Americas'),
  c('sanfrancisco', 'San Francisco', 'United States', 'America/Los_Angeles', 37.7749, -122.4194, 'Americas'),
  c('seattle', 'Seattle', 'United States', 'America/Los_Angeles', 47.6062, -122.3321, 'Americas'),
  c('vancouver', 'Vancouver', 'Canada', 'America/Vancouver', 49.2827, -123.1207, 'Americas'),
  c('anchorage', 'Anchorage', 'United States', 'America/Anchorage', 61.2181, -149.9003, 'Americas'),
  c('honolulu', 'Honolulu', 'United States', 'Pacific/Honolulu', 21.3069, -157.8583, 'Americas'),
  c('bogota', 'Bogotá', 'Colombia', 'America/Bogota', 4.711, -74.0721, 'Americas'),
  c('lima', 'Lima', 'Peru', 'America/Lima', -12.0464, -77.0428, 'Americas'),
  c('santiago', 'Santiago', 'Chile', 'America/Santiago', -33.4489, -70.6693, 'Americas'),
  c('buenosaires', 'Buenos Aires', 'Argentina', 'America/Argentina/Buenos_Aires', -34.6037, -58.3816, 'Americas'),
  c('saopaulo', 'São Paulo', 'Brazil', 'America/Sao_Paulo', -23.5505, -46.6333, 'Americas'),
  c('rio', 'Rio de Janeiro', 'Brazil', 'America/Sao_Paulo', -22.9068, -43.1729, 'Americas'),
  c('havana', 'Havana', 'Cuba', 'America/Havana', 23.1136, -82.3666, 'Americas'),
  c('panama', 'Panama City', 'Panama', 'America/Panama', 8.9824, -79.5199, 'Americas'),

  // Asia
  c('tokyo', 'Tokyo', 'Japan', 'Asia/Tokyo', 35.6762, 139.6503, 'Asia'),
  c('osaka', 'Osaka', 'Japan', 'Asia/Tokyo', 34.6937, 135.5023, 'Asia'),
  c('seoul', 'Seoul', 'South Korea', 'Asia/Seoul', 37.5665, 126.978, 'Asia'),
  c('beijing', 'Beijing', 'China', 'Asia/Shanghai', 39.9042, 116.4074, 'Asia'),
  c('shanghai', 'Shanghai', 'China', 'Asia/Shanghai', 31.2304, 121.4737, 'Asia'),
  c('hongkong', 'Hong Kong', 'Hong Kong', 'Asia/Hong_Kong', 22.3193, 114.1694, 'Asia'),
  c('taipei', 'Taipei', 'Taiwan', 'Asia/Taipei', 25.033, 121.5654, 'Asia'),
  c('singapore', 'Singapore', 'Singapore', 'Asia/Singapore', 1.3521, 103.8198, 'Asia'),
  c('kualalumpur', 'Kuala Lumpur', 'Malaysia', 'Asia/Kuala_Lumpur', 3.139, 101.6869, 'Asia'),
  c('jakarta', 'Jakarta', 'Indonesia', 'Asia/Jakarta', -6.2088, 106.8456, 'Asia'),
  c('bangkok', 'Bangkok', 'Thailand', 'Asia/Bangkok', 13.7563, 100.5018, 'Asia'),
  c('hanoi', 'Hanoi', 'Vietnam', 'Asia/Ho_Chi_Minh', 21.0285, 105.8542, 'Asia'),
  c('hochiminh', 'Ho Chi Minh City', 'Vietnam', 'Asia/Ho_Chi_Minh', 10.8231, 106.6297, 'Asia'),
  c('manila', 'Manila', 'Philippines', 'Asia/Manila', 14.5995, 120.9842, 'Asia'),
  c('mumbai', 'Mumbai', 'India', 'Asia/Kolkata', 19.076, 72.8777, 'Asia'),
  c('delhi', 'New Delhi', 'India', 'Asia/Kolkata', 28.6139, 77.209, 'Asia'),
  c('bengaluru', 'Bengaluru', 'India', 'Asia/Kolkata', 12.9716, 77.5946, 'Asia'),
  c('kolkata', 'Kolkata', 'India', 'Asia/Kolkata', 22.5726, 88.3639, 'Asia'),
  c('dhaka', 'Dhaka', 'Bangladesh', 'Asia/Dhaka', 23.8103, 90.4125, 'Asia'),
  c('chittagong', 'Chattogram', 'Bangladesh', 'Asia/Dhaka', 22.3569, 91.7832, 'Asia'),
  c('karachi', 'Karachi', 'Pakistan', 'Asia/Karachi', 24.8607, 67.0011, 'Asia'),
  c('lahore', 'Lahore', 'Pakistan', 'Asia/Karachi', 31.5204, 74.3587, 'Asia'),
  c('kathmandu', 'Kathmandu', 'Nepal', 'Asia/Kathmandu', 27.7172, 85.324, 'Asia'),
  c('colombo', 'Colombo', 'Sri Lanka', 'Asia/Colombo', 6.9271, 79.8612, 'Asia'),
  c('tashkent', 'Tashkent', 'Uzbekistan', 'Asia/Tashkent', 41.2995, 69.2401, 'Asia'),
  c('almaty', 'Almaty', 'Kazakhstan', 'Asia/Almaty', 43.222, 76.8512, 'Asia'),
  c('vladivostok', 'Vladivostok', 'Russia', 'Asia/Vladivostok', 43.1332, 131.9113, 'Asia'),

  // Middle East
  c('dubai', 'Dubai', 'United Arab Emirates', 'Asia/Dubai', 25.2048, 55.2708, 'Middle East'),
  c('abudhabi', 'Abu Dhabi', 'United Arab Emirates', 'Asia/Dubai', 24.4539, 54.3773, 'Middle East'),
  c('doha', 'Doha', 'Qatar', 'Asia/Qatar', 25.2854, 51.531, 'Middle East'),
  c('riyadh', 'Riyadh', 'Saudi Arabia', 'Asia/Riyadh', 24.7136, 46.6753, 'Middle East'),
  c('jeddah', 'Jeddah', 'Saudi Arabia', 'Asia/Riyadh', 21.4858, 39.1925, 'Middle East'),
  c('kuwait', 'Kuwait City', 'Kuwait', 'Asia/Kuwait', 29.3759, 47.9774, 'Middle East'),
  c('tehran', 'Tehran', 'Iran', 'Asia/Tehran', 35.6892, 51.389, 'Middle East'),
  c('istanbul', 'Istanbul', 'Türkiye', 'Europe/Istanbul', 41.0082, 28.9784, 'Middle East'),
  c('telaviv', 'Tel Aviv', 'Israel', 'Asia/Jerusalem', 32.0853, 34.7818, 'Middle East'),
  c('amman', 'Amman', 'Jordan', 'Asia/Amman', 31.9454, 35.9284, 'Middle East'),
  c('beirut', 'Beirut', 'Lebanon', 'Asia/Beirut', 33.8938, 35.5018, 'Middle East'),
  c('baghdad', 'Baghdad', 'Iraq', 'Asia/Baghdad', 33.3152, 44.3661, 'Middle East'),

  // Africa
  c('cairo', 'Cairo', 'Egypt', 'Africa/Cairo', 30.0444, 31.2357, 'Africa'),
  c('lagos', 'Lagos', 'Nigeria', 'Africa/Lagos', 6.5244, 3.3792, 'Africa'),
  c('abuja', 'Abuja', 'Nigeria', 'Africa/Lagos', 9.0765, 7.3986, 'Africa'),
  c('accra', 'Accra', 'Ghana', 'Africa/Accra', 5.6037, -0.187, 'Africa'),
  c('nairobi', 'Nairobi', 'Kenya', 'Africa/Nairobi', -1.2921, 36.8219, 'Africa'),
  c('addis', 'Addis Ababa', 'Ethiopia', 'Africa/Addis_Ababa', 9.03, 38.74, 'Africa'),
  c('kampala', 'Kampala', 'Uganda', 'Africa/Kampala', 0.3476, 32.5825, 'Africa'),
  c('daressalaam', 'Dar es Salaam', 'Tanzania', 'Africa/Dar_es_Salaam', -6.7924, 39.2083, 'Africa'),
  c('johannesburg', 'Johannesburg', 'South Africa', 'Africa/Johannesburg', -26.2041, 28.0473, 'Africa'),
  c('capetown', 'Cape Town', 'South Africa', 'Africa/Johannesburg', -33.9249, 18.4241, 'Africa'),
  c('casablanca', 'Casablanca', 'Morocco', 'Africa/Casablanca', 33.5731, -7.5898, 'Africa'),
  c('marrakesh', 'Marrakesh', 'Morocco', 'Africa/Casablanca', 31.6295, -7.9811, 'Africa'),
  c('tunis', 'Tunis', 'Tunisia', 'Africa/Tunis', 36.8065, 10.1815, 'Africa'),
  c('algiers', 'Algiers', 'Algeria', 'Africa/Algiers', 36.7538, 3.0588, 'Africa'),
  c('dakar', 'Dakar', 'Senegal', 'Africa/Dakar', 14.7167, -17.4677, 'Africa'),

  // Oceania
  c('sydney', 'Sydney', 'Australia', 'Australia/Sydney', -33.8688, 151.2093, 'Oceania'),
  c('melbourne', 'Melbourne', 'Australia', 'Australia/Melbourne', -37.8136, 144.9631, 'Oceania'),
  c('brisbane', 'Brisbane', 'Australia', 'Australia/Brisbane', -27.4698, 153.0251, 'Oceania'),
  c('perth', 'Perth', 'Australia', 'Australia/Perth', -31.9505, 115.8605, 'Oceania'),
  c('adelaide', 'Adelaide', 'Australia', 'Australia/Adelaide', -34.9285, 138.6007, 'Oceania'),
  c('darwin', 'Darwin', 'Australia', 'Australia/Darwin', -12.4634, 130.8456, 'Oceania'),
  c('auckland', 'Auckland', 'New Zealand', 'Pacific/Auckland', -36.8485, 174.7633, 'Oceania'),
  c('wellington', 'Wellington', 'New Zealand', 'Pacific/Auckland', -41.2866, 174.7756, 'Oceania'),
  c('suva', 'Suva', 'Fiji', 'Pacific/Fiji', -18.1416, 178.4419, 'Oceania'),
  c('portmoresby', 'Port Moresby', 'Papua New Guinea', 'Pacific/Port_Moresby', -9.4438, 147.1803, 'Oceania'),
];

function c(
  id: string,
  name: string,
  country: string,
  zone: string,
  lat: number,
  lon: number,
  region: Region,
): City {
  return { id, name, country, zone, lat, lon, region };
}

const BY_ID = new Map(CITIES.map((city) => [city.id, city]));

export function cityById(id: string): City | undefined {
  return BY_ID.get(id);
}

/** The opening line-up: five cities that span the full 24 hours of the strip. */
export const DEFAULT_CITY_IDS = ['london', 'newyork', 'tokyo', 'dubai', 'sydney'];

/**
 * Rank cities against a query. Prefix matches outrank interior matches so typing
 * "san" surfaces San Francisco before Kuala Lumpur's "…san…" — the behaviour
 * people expect but few search boxes bother with.
 */
export function searchCities(query: string, limit = 8): City[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const scored: Array<{ city: City; score: number }> = [];
  for (const city of CITIES) {
    const name = city.name.toLowerCase();
    const country = city.country.toLowerCase();
    let score = -1;

    if (name.startsWith(q)) score = 0;
    else if (name.includes(q)) score = 1;
    else if (country.startsWith(q)) score = 2;
    else if (country.includes(q)) score = 3;
    else if (city.zone.toLowerCase().includes(q)) score = 4;

    if (score >= 0) scored.push({ city, score });
  }

  scored.sort((a, b) => a.score - b.score || a.city.name.localeCompare(b.city.name));
  return scored.slice(0, limit).map((s) => s.city);
}

/** Nearest city to a coordinate, used to name the viewer's own location. */
export function nearestCity(lat: number, lon: number): City {
  let best = CITIES[0];
  let bestDistance = Infinity;
  for (const city of CITIES) {
    const dLat = city.lat - lat;
    const dLon = city.lon - lon;
    const distance = dLat * dLat + dLon * dLon;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = city;
    }
  }
  return best;
}
