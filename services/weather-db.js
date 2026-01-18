import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = process.env.WEATHER_DB_PATH || join(__dirname, '../data/weather.db');

// Ensure directory exists
const dbDir = DB_PATH.substring(0, DB_PATH.lastIndexOf('/'));
if (dbDir && !existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

let db = null;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    
    // Create table for weather data
    db.exec(`
      CREATE TABLE IF NOT EXISTS weather_cache (
        location_key TEXT PRIMARY KEY,
        location_name TEXT NOT NULL,
        lat REAL NOT NULL,
        lon REAL NOT NULL,
        data TEXT NOT NULL,
        fetched_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_weather_expires ON weather_cache(expires_at);
    `);
  }
  return db;
}

/**
 * Store weather data in database
 * @param {Object} location - Location object with name, lat, lon
 * @param {Object} weatherData - Weather data to store
 * @param {number} ttl - Time to live in milliseconds (default: 10 minutes)
 */
export function saveWeatherData(location, weatherData, ttl = 10 * 60 * 1000) {
  const db = getDb();
  const locationKey = `${location.lat},${location.lon}`;
  const now = Date.now();
  const expiresAt = now + ttl;
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO weather_cache 
    (location_key, location_name, lat, lon, data, fetched_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    locationKey,
    location.name || '',
    location.lat,
    location.lon,
    JSON.stringify(weatherData),
    now,
    expiresAt
  );
}

/**
 * Get cached weather data if it exists and hasn't expired
 * @param {Object} location - Location object with lat, lon
 * @returns {Object|null} - Weather data or null if not found/expired
 */
export function getWeatherData(location) {
  const db = getDb();
  const locationKey = `${location.lat},${location.lon}`;
  const now = Date.now();
  
  const cached = db.prepare(`
    SELECT data, expires_at FROM weather_cache
    WHERE location_key = ? AND expires_at > ?
  `).get(locationKey, now);
  
  if (cached) {
    return JSON.parse(cached.data);
  }
  
  return null;
}

/**
 * Clean up expired weather cache entries
 */
export function cleanupExpiredWeather() {
  const db = getDb();
  const now = Date.now();
  
  const result = db.prepare(`
    DELETE FROM weather_cache WHERE expires_at <= ?
  `).run(now);
  
  if (result.changes > 0) {
    console.log(`Cleaned up ${result.changes} expired weather cache entries`);
  }
}

/**
 * Initialize weather database (called on server startup)
 */
export function initializeWeatherDb() {
  getDb(); // Initialize database and create tables
  cleanupExpiredWeather(); // Clean up expired entries on startup
  console.log(`Weather database initialized at: ${DB_PATH}`);
}

