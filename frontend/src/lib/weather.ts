// 날씨 → 배경 분류 및 팔레트.
// 프론트엔드에서 직접 Open-Meteo(무료, API 키 불필요)로 현재 날씨를 조회한다.
// WMO weather_code 를 카테고리로 변환하고, 카테고리별 3D 씬 배경/안개/조명 팔레트를 제공한다.

export type WeatherCategory = "clear" | "cloudy" | "rain" | "snow" | "fog" | "storm";

export interface WeatherInfo {
  /** 한글 날씨 설명 */
  condition: string;
  /** 섭씨 기온 */
  temperatureC: number | null;
  /** 카드용 이모지 */
  emoji: string;
  category: WeatherCategory;
}

// 3D 씬 배경/안개 + 조명 톤 (hex 숫자)
export interface WeatherPalette {
  background: number;
  fog: number;
  hemiSky: number;
  hemiGround: number;
  sun: number;
  sunIntensity: number;
}

export const WEATHER_PALETTES: Record<WeatherCategory, WeatherPalette> = {
  clear: { background: 0xf3dcc2, fog: 0xf3dcc2, hemiSky: 0xfff4e0, hemiGround: 0xc89a66, sun: 0xfff2d6, sunIntensity: 1.5 },
  cloudy: { background: 0xe3e7ec, fog: 0xe3e7ec, hemiSky: 0xeef1f5, hemiGround: 0xb8bdc4, sun: 0xeef1f4, sunIntensity: 1.2 },
  rain: { background: 0xb6c0cb, fog: 0xb6c0cb, hemiSky: 0xc6cfd8, hemiGround: 0x8a939d, sun: 0xc8d0d8, sunIntensity: 0.92 },
  snow: { background: 0xeef2f6, fog: 0xeef2f6, hemiSky: 0xffffff, hemiGround: 0xccd3db, sun: 0xf2f6fa, sunIntensity: 1.2 },
  fog: { background: 0xd2cfc8, fog: 0xd2cfc8, hemiSky: 0xdedbd3, hemiGround: 0xb2afa7, sun: 0xd6d3ca, sunIntensity: 0.95 },
  storm: { background: 0x9298a0, fog: 0x9298a0, hemiSky: 0xa4abb3, hemiGround: 0x676d74, sun: 0xb0b6be, sunIntensity: 0.78 },
};

// WMO weather_code → { 한글 설명, 카테고리, 이모지 }
interface WmoEntry {
  label: string;
  category: WeatherCategory;
  emoji: string;
}

const WMO_MAP: Record<number, WmoEntry> = {
  0: { label: "맑음", category: "clear", emoji: "☀️" },
  1: { label: "대체로 맑음", category: "clear", emoji: "🌤️" },
  2: { label: "부분적 구름", category: "cloudy", emoji: "⛅" },
  3: { label: "흐림", category: "cloudy", emoji: "☁️" },
  45: { label: "안개", category: "fog", emoji: "🌫️" },
  48: { label: "서리 안개", category: "fog", emoji: "🌫️" },
  51: { label: "약한 이슬비", category: "rain", emoji: "🌦️" },
  53: { label: "이슬비", category: "rain", emoji: "🌦️" },
  55: { label: "강한 이슬비", category: "rain", emoji: "🌧️" },
  56: { label: "약한 어는 이슬비", category: "rain", emoji: "🌧️" },
  57: { label: "어는 이슬비", category: "rain", emoji: "🌧️" },
  61: { label: "약한 비", category: "rain", emoji: "🌦️" },
  63: { label: "비", category: "rain", emoji: "🌧️" },
  65: { label: "강한 비", category: "rain", emoji: "🌧️" },
  66: { label: "약한 어는 비", category: "rain", emoji: "🌧️" },
  67: { label: "어는 비", category: "rain", emoji: "🌧️" },
  71: { label: "약한 눈", category: "snow", emoji: "🌨️" },
  73: { label: "눈", category: "snow", emoji: "❄️" },
  75: { label: "강한 눈", category: "snow", emoji: "❄️" },
  77: { label: "싸락눈", category: "snow", emoji: "🌨️" },
  80: { label: "약한 소나기", category: "rain", emoji: "🌦️" },
  81: { label: "소나기", category: "rain", emoji: "🌧️" },
  82: { label: "강한 소나기", category: "rain", emoji: "🌧️" },
  85: { label: "약한 눈 소나기", category: "snow", emoji: "🌨️" },
  86: { label: "눈 소나기", category: "snow", emoji: "❄️" },
  95: { label: "뇌우", category: "storm", emoji: "⛈️" },
  96: { label: "우박 동반 뇌우", category: "storm", emoji: "⛈️" },
  99: { label: "강한 우박 동반 뇌우", category: "storm", emoji: "⛈️" },
};

function entryFromCode(code: number): WmoEntry {
  return WMO_MAP[code] ?? { label: "알 수 없음", category: "clear", emoji: "🌡️" };
}

// 한글 condition 문자열로부터 카테고리 추정(외부에서 문자열만 받을 때 사용).
const KEYWORD_TO_CATEGORY: { cat: WeatherCategory; words: string[] }[] = [
  { cat: "storm", words: ["뇌우", "우박", "천둥"] },
  { cat: "snow", words: ["눈", "싸락"] },
  { cat: "rain", words: ["비", "이슬비", "소나기"] },
  { cat: "fog", words: ["안개", "서리"] },
  { cat: "cloudy", words: ["대체로 맑음", "구름", "흐림"] },
  { cat: "clear", words: ["맑음"] },
];

export function classifyCondition(condition?: string | null): WeatherCategory {
  if (!condition) return "clear";
  for (const { cat, words } of KEYWORD_TO_CATEGORY) {
    if (words.some((w) => condition.includes(w))) return cat;
  }
  return "clear";
}

// 기본 위치(서울) — 위치 권한이 없거나 거부될 때 사용.
const DEFAULT_LAT = 37.5665;
const DEFAULT_LON = 126.978;

function getPosition(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve({ lat: DEFAULT_LAT, lon: DEFAULT_LON });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve({ lat: DEFAULT_LAT, lon: DEFAULT_LON }),
      { timeout: 5000, maximumAge: 10 * 60 * 1000 },
    );
  });
}

// 프론트엔드에서 직접 Open-Meteo로 현재 날씨 조회. 실패 시 null.
export async function fetchWeather(): Promise<WeatherInfo | null> {
  try {
    const { lat, lon } = await getPosition();
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,weather_code`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      current?: { temperature_2m?: number; weather_code?: number };
    };
    const code = data.current?.weather_code ?? 0;
    const entry = entryFromCode(code);
    const temp = data.current?.temperature_2m;
    return {
      condition: entry.label,
      temperatureC: typeof temp === "number" ? Math.round(temp) : null,
      emoji: entry.emoji,
      category: entry.category,
    };
  } catch {
    return null;
  }
}
