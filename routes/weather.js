import express from 'express';
import https from 'https';
import { getWeatherData, saveWeatherData } from '../services/weather-db.js';

// Weather code descriptions
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

async function fetchAndProcessWeather(location) {
  const weatherData = await fetchWeatherFromAPI(location);
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
    hours: hours.slice(0, 12) // Next 12 hours
  };
  
  // Cache the result
  saveWeatherData(location, result, 10 * 60 * 1000);
  
  return result;
}


export function createWeatherRoutes() {
  const router = express.Router();

  // GET /api/weather?location={"name":"Cosenza","lat":39.2989,"lon":16.25307}
  router.get('/', async (req, res) => {
    try {
      const locationParam = req.query.location;
      
      if (!locationParam) {
        return res.status(400).json({ error: 'Location parameter is required' });
      }

      let location;
      try {
        location = JSON.parse(decodeURIComponent(locationParam));
      } catch (e) {
        return res.status(400).json({ error: 'Invalid location format' });
      }

      if (!location.name || typeof location.lat !== 'number' || typeof location.lon !== 'number') {
        return res.status(400).json({ error: 'Location must have name, lat, and lon' });
      }

      // Get cached weather data (fetched by background service)
      const cached = getWeatherData(location);
      if (cached) {
        return res.json(cached);
      }

      // Fallback: fetch live if cache is not available (e.g., on first request before background fetcher runs)
      console.log(`Cache miss for ${location.name}, fetching live...`);
      try {
        const result = await fetchAndProcessWeather(location);
        return res.json(result);
      } catch (fetchError) {
        console.error('Error fetching weather live:', fetchError);
        return res.status(503).json({ 
          error: 'Weather data not available. Please try again later.' 
        });
      }
    } catch (error) {
      console.error('Error in GET /api/weather:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

