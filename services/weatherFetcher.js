import https from 'https';
import { getWeatherData, saveWeatherData } from './weather-db.js';
import { ViewManager } from './viewManager.js';

// Weather code descriptions (WMO Weather interpretation codes)
const weatherDescriptions = {
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
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow fall',
  73: 'Moderate snow fall',
  75: 'Heavy snow fall',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail'
};

function fetchWeatherFromAPI(location) {
  return new Promise((resolve, reject) => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&hourly=temperature_2m,relative_humidity_2m,weather_code&timezone=auto`;
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(new Error('Failed to parse weather data: ' + e.message));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function fetchAndCacheWeather(location) {
  try {
    console.log(`Fetching weather for ${location.name} (${location.lat}, ${location.lon})`);
    
    const weatherData = await fetchWeatherFromAPI(location);
    const current = weatherData.current;
    const daily = weatherData.daily;
    const hourly = weatherData.hourly;
    const now = new Date();
    
    // Process hourly data - filter from current hour onwards
    const hours = hourly.time.map((timeStr, index) => {
      const dateObj = new Date(timeStr);
      // Format: "1 PM", "12 AM", etc.
      const label = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
      
      return {
        time: timeStr,
        hour: dateObj.getHours(),
        label: label,
        temp: Math.round(hourly.temperature_2m[index]),
        humidity: Math.round(hourly.relative_humidity_2m[index]),
        weatherCode: hourly.weather_code[index]
      };
    }).filter(h => {
      const d = new Date(h.time);
      return d >= now;
    });

    // Process daily data
    const days = daily.time.map((timeStr, index) => {
      const dateObj = new Date(timeStr);
      
      // Calculate daily humidity from hourly data
      // Find hourly indices for this day
      let minHumidity = 100;
      let maxHumidity = 0;
      let count = 0;
      
      const dayStart = new Date(timeStr).setHours(0, 0, 0, 0);
      const dayEnd = new Date(timeStr).setHours(23, 59, 59, 999);
      
      hourly.time.forEach((hTime, hIndex) => {
        const hDate = new Date(hTime).getTime();
        if (hDate >= dayStart && hDate <= dayEnd) {
          const hHumidity = hourly.relative_humidity_2m[hIndex];
          if (hHumidity !== undefined) {
             if (hHumidity < minHumidity) minHumidity = hHumidity;
             if (hHumidity > maxHumidity) maxHumidity = hHumidity;
             count++;
          }
        }
      });
      
      // If no hourly data found for this day (e.g. far future), default to --
      const humidityText = count > 0 ? `${Math.round((minHumidity + maxHumidity) / 2)}%` : '--%';

      return {
        time: timeStr,
        day: dateObj.toLocaleDateString('en-US', { weekday: 'long' }), // Full day name
        date: dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        tempMin: Math.round(daily.temperature_2m_min[index]),
        tempMax: Math.round(daily.temperature_2m_max[index]),
        weatherCode: daily.weather_code[index],
        weatherDescription: weatherDescriptions[daily.weather_code[index]] || 'Unknown',
        humidity: humidityText
      };
    });
    
    const result = {
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
      hours: hours.slice(0, 12), // Next 12 hours
      days: days.slice(0, 7) // Next 7 days
    };
    
    // Cache the result (10 minutes TTL)
    saveWeatherData(location, result, 10 * 60 * 1000);
    
    console.log(`Weather cached for ${location.name}`);
    return result;
  } catch (error) {
    console.error(`Error fetching weather for ${location.name}:`, error);
    throw error;
  }
}

/**
 * Get all unique weather locations from views
 * @param {ViewManager} viewManager - The view manager instance
 */
function getWeatherLocations(viewManager) {
  const locations = new Map();
  
  try {
    if (!viewManager) {
      console.error('ViewManager not provided to getWeatherLocations');
      return [];
    }
    
    const allViews = viewManager.getAllViews();
    if (!allViews || allViews.length === 0) {
      console.log('No views available yet');
      return [];
    }
    
    for (const view of allViews) {
      if (view && view.metadata && view.metadata.type === 'weather' && view.data && view.data.location) {
        const location = view.data.location;
        const locationKey = `${location.lat},${location.lon}`;
        if (!locations.has(locationKey)) {
          locations.set(locationKey, location);
        }
      }
    }
  } catch (error) {
    console.error('Error getting weather locations:', error);
  }
  
  return Array.from(locations.values());
}

/**
 * Fetch weather for all configured locations
 * @param {ViewManager} viewManager - The view manager instance
 */
async function fetchAllWeather(viewManager) {
  const locations = getWeatherLocations(viewManager);
  console.log(`Fetching weather for ${locations.length} location(s)`);
  
  for (const location of locations) {
    try {
      await fetchAndCacheWeather(location);
    } catch (error) {
      console.error(`Failed to fetch weather for ${location.name}:`, error.message);
    }
  }
}

/**
 * Start background weather fetching service
 * Fetches weather data periodically and on startup
 * @param {ViewManager} viewManager - The view manager instance
 */
export function startWeatherFetcher(viewManager) {
  // Fetch immediately on startup
  fetchAllWeather(viewManager);
  
  // Then fetch every 10 minutes
  setInterval(() => {
    fetchAllWeather(viewManager);
  }, 10 * 60 * 1000);
  
  console.log('Weather fetcher started (updates every 10 minutes)');
}

