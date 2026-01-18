
// Weather code descriptions (WMO Weather interpretation codes)
export const weatherDescriptions = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  18: 'Slight rain',
  61: 'Slight rain',
  63: 'Moderate rain',
  20: 'Heavy rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  23: 'Slight snow fall',
  71: 'Slight snow fall',
  24: 'Moderate snow fall',
  73: 'Moderate snow fall',
  25: 'Heavy snow fall',
  75: 'Heavy snow fall',
  26: 'Snow grains',
  77: 'Snow grains',
  27: 'Slight rain showers',
  80: 'Slight rain showers',
  28: 'Moderate rain showers',
  81: 'Moderate rain showers',
  29: 'Violent rain showers',
  82: 'Violent rain showers',
  30: 'Slight snow showers',
  85: 'Slight snow showers',
  31: 'Heavy snow showers',
  86: 'Heavy snow showers',
  32: 'Thunderstorm',
  95: 'Thunderstorm',
  33: 'Thunderstorm with slight hail',
  96: 'Thunderstorm with slight hail',
  34: 'Thunderstorm with heavy hail',
  99: 'Thunderstorm with heavy hail'
};

export async function fetchWeatherFromAPI(location) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&hourly=temperature_2m,relative_humidity_2m,weather_code&timezone=auto`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'Kiosk-Server/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API returned status code ${response.status}`);
    }

    const json = await response.json();
    return json;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function processWeatherData(location, weatherData) {
  const current = weatherData.current;
  const daily = weatherData.daily;
  const hourly = weatherData.hourly;
  const now = new Date();
  
  // Process hourly data - filter from current hour onwards
  const hours = hourly.time.map((timeStr, index) => {
    const dateObj = new Date(timeStr);
    return {
      time: timeStr,
      hour: dateObj.getHours(),
      label: dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      temp: Math.round(hourly.temperature_2m[index]),
      humidity: Math.round(hourly.relative_humidity_2m[index]),
      weatherCode: hourly.weather_code[index]
    };
  }).filter(h => {
    const d = new Date(h.time);
    return d >= now;
  });
  
  return {
    location: {
      name: location.name,
      lat: location.lat,
      lon: location.lon
    },
    current: {
      temp: Math.round(current.temperature_2m),
      tempMin: Math.round(daily.temperature_2m_min[0]),
      tempMax: Math.round(daily.temperature_2m_max[0]),
      description: weatherDescriptions[current.weather_code] || 'Unknown',
      weatherCode: current.weather_code,
      humidity: Math.round(current.relative_humidity_2m),
      windSpeed: Math.round(current.wind_speed_10m)
    },
    hours: hours.slice(0, 12) // Next 12 hours
  };
}
