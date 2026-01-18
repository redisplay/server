import Database from 'better-sqlite3';
import { mkdirSync, writeFileSync, unlinkSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = process.env.WEBCAM_DB_PATH || join(__dirname, '../data/webcams.db');
const IMAGES_DIR = process.env.WEBCAM_IMAGES_DIR || join(__dirname, '../data/webcam-images');
const MAX_IMAGES_PER_WEBCAM = parseInt(process.env.MAX_IMAGES_PER_WEBCAM || '10', 10);

// Ensure directories exist
const dbDir = DB_PATH.substring(0, DB_PATH.lastIndexOf('/'));
if (dbDir && !existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}
if (!existsSync(IMAGES_DIR)) {
  mkdirSync(IMAGES_DIR, { recursive: true });
}

let db = null;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    
    // Create tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS webcam_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        webcam_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        filepath TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE(webcam_id, filename)
      );
      
      CREATE INDEX IF NOT EXISTS idx_webcam_created ON webcam_images(webcam_id, created_at DESC);
    `);
  }
  return db;
}

/**
 * Store a webcam image buffer to disk and database
 * @param {string} webcamId - The webcam identifier
 * @param {Buffer} imageBuffer - Image data buffer
 * @param {string} filename - Optional filename
 * @param {number} timestamp - Timestamp when the image was captured
 */
export function saveWebcamImage(webcamId, imageBuffer, filename, timestamp = Date.now()) {
  if (!Buffer.isBuffer(imageBuffer)) {
    throw new Error('imageBuffer must be a Buffer');
  }

  const db = getDb();
  
  // Generate filename if not provided
  const finalFilename = filename || `${webcamId}-${timestamp}.jpg`;
  const filepath = join(IMAGES_DIR, finalFilename);
  
  // Write image to disk
  writeFileSync(filepath, imageBuffer);
  
  // Save metadata to database
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO webcam_images (webcam_id, filename, filepath, created_at)
    VALUES (?, ?, ?, ?)
  `);
  
  const result = stmt.run(webcamId, finalFilename, filepath, timestamp);
  const imageId = result.lastInsertRowid;
  
  // Clean up old images (keep only MAX_IMAGES_PER_WEBCAM most recent)
  cleanupOldImages(webcamId);
  
  return {
    id: imageId,
    webcam_id: webcamId,
    filename: finalFilename,
    filepath: filepath,
    created_at: timestamp
  };
}

/**
 * Clean up old images, keeping only the most recent MAX_IMAGES_PER_WEBCAM
 */
function cleanupOldImages(webcamId) {
  const db = getDb();
  
  // Get all images for this webcam, ordered by created_at DESC
  const images = db.prepare(`
    SELECT id, filepath FROM webcam_images
    WHERE webcam_id = ?
    ORDER BY created_at DESC
  `).all(webcamId);
  
  // If we have more than MAX_IMAGES_PER_WEBCAM, delete the oldest ones
  if (images.length > MAX_IMAGES_PER_WEBCAM) {
    const toDelete = images.slice(MAX_IMAGES_PER_WEBCAM);
    
    for (const image of toDelete) {
      // Delete file from disk
      try {
        if (existsSync(image.filepath)) {
          unlinkSync(image.filepath);
        }
      } catch (err) {
        console.error(`Error deleting image file ${image.filepath}:`, err);
      }
      
      // Delete from database
      db.prepare('DELETE FROM webcam_images WHERE id = ?').run(image.id);
    }
  }
}

/**
 * Get the latest webcam image for a webcam
 * @param {string} webcamId - The webcam identifier
 * @returns {Object|null} - Image object with buffer, filename, and timestamp, or null if not found
 */
export function getLatestWebcamImage(webcamId) {
  const db = getDb();
  
  const image = db.prepare(`
    SELECT id, webcam_id, filename, filepath, created_at
    FROM webcam_images
    WHERE webcam_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(webcamId);
  
  if (!image) {
    return null;
  }
  
  return {
    id: image.id,
    webcam_id: image.webcam_id,
    filename: image.filename,
    filepath: image.filepath,
    created_at: image.created_at
  };
}

/**
 * Get a specific webcam image by ID
 * @param {string} webcamId - The webcam identifier
 * @param {number} imageId - The image ID
 * @returns {Object|null} - Image object or null
 */
export function getWebcamImage(webcamId, imageId) {
  const db = getDb();
  
  const image = db.prepare(`
    SELECT id, webcam_id, filename, filepath, created_at
    FROM webcam_images
    WHERE webcam_id = ? AND id = ?
  `).get(webcamId, imageId);
  
  if (!image) {
    return null;
  }
  
  return {
    id: image.id,
    webcam_id: image.webcam_id,
    filename: image.filename,
    filepath: image.filepath,
    created_at: image.created_at
  };
}

/**
 * Get the image buffer for a webcam image
 * @param {Object} image - The image object returned by getLatestWebcamImage or getWebcamImage
 * @returns {Buffer} - The image data buffer
 * @throws {Error} If the image file is not found
 */
export function getWebcamImageBuffer(image) {
  if (!image || !image.filepath) {
    throw new Error('Image filepath not found for the provided image object.');
  }
  
  if (!existsSync(image.filepath)) {
    throw new Error(`Image file not found: ${image.filepath}`);
  }
  
  return readFileSync(image.filepath);
}

/**
 * Initialize webcam database (called on server startup)
 */
export function initializeWebcamDb() {
  getDb(); // Initialize database and create tables
  console.log(`Webcam database initialized at: ${DB_PATH}`);
  console.log(`Webcam images directory: ${IMAGES_DIR}`);
}
