import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db = null;
const GALLERY_DIR = path.join(__dirname, '../data/gallery-images');

export async function initializeGalleryDb() {
  try {
    // Ensure gallery images directory exists
    await fs.mkdir(GALLERY_DIR, { recursive: true });
    
    db = await open({
      filename: path.join(__dirname, '../data/gallery.db'),
      driver: sqlite3.Database
    });

    await db.exec(`
      CREATE TABLE IF NOT EXISTS gallery_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        view_id TEXT NOT NULL,
        filename TEXT NOT NULL UNIQUE,
        caption TEXT,
        uploaded_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        mime_type TEXT NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_gallery_view_id ON gallery_images(view_id);
      CREATE INDEX IF NOT EXISTS idx_gallery_expires_at ON gallery_images(expires_at);
    `);

    console.log('Gallery database initialized');
    
    // Start cleanup interval (check every minute)
    setInterval(async () => {
      await cleanupExpiredImages();
    }, 60000);
    
    // Run initial cleanup
    await cleanupExpiredImages();
  } catch (error) {
    console.error('Error initializing gallery database:', error);
    throw error;
  }
}

export async function addGalleryImage(viewId, filename, caption, ttlHours, mimeType) {
  const now = Date.now();
  const expiresAt = now + (ttlHours * 60 * 60 * 1000);
  
  try {
    const result = await db.run(
      `INSERT INTO gallery_images (view_id, filename, caption, uploaded_at, expires_at, mime_type)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [viewId, filename, caption || null, now, expiresAt, mimeType]
    );
    
    return {
      id: result.lastID,
      view_id: viewId,
      filename,
      caption,
      uploaded_at: now,
      expires_at: expiresAt,
      mime_type: mimeType
    };
  } catch (error) {
    console.error('Error adding gallery image:', error);
    throw error;
  }
}

export async function getGalleryImages(viewId = null) {
  const now = Date.now();
  
  try {
    let query = `SELECT * FROM gallery_images WHERE expires_at > ?`;
    let params = [now];
    
    if (viewId) {
      query += ` AND view_id = ?`;
      params.push(viewId);
    }
    
    query += ` ORDER BY uploaded_at DESC`;
    
    const images = await db.all(query, params);
    
    return images;
  } catch (error) {
    console.error('Error getting gallery images:', error);
    throw error;
  }
}

export async function getGalleryImageById(id) {
  try {
    const image = await db.get(
      `SELECT * FROM gallery_images WHERE id = ?`,
      [id]
    );
    
    return image;
  } catch (error) {
    console.error('Error getting gallery image:', error);
    throw error;
  }
}

export async function deleteGalleryImage(id) {
  try {
    const image = await getGalleryImageById(id);
    if (image) {
      // Delete file
      const filePath = path.join(GALLERY_DIR, image.filename);
      try {
        await fs.unlink(filePath);
      } catch (err) {
        console.warn('Could not delete file:', filePath, err.message);
      }
      
      // Delete from database
      await db.run(`DELETE FROM gallery_images WHERE id = ?`, [id]);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting gallery image:', error);
    throw error;
  }
}

async function cleanupExpiredImages() {
  const now = Date.now();
  
  try {
    const expired = await db.all(
      `SELECT * FROM gallery_images WHERE expires_at <= ?`,
      [now]
    );
    
    for (const image of expired) {
      console.log(`Cleaning up expired gallery image: ${image.filename}`);
      await deleteGalleryImage(image.id);
    }
    
    if (expired.length > 0) {
      console.log(`Cleaned up ${expired.length} expired gallery image(s)`);
    }
  } catch (error) {
    console.error('Error cleaning up expired images:', error);
  }
}

export function getGalleryImagePath(filename) {
  return path.join(GALLERY_DIR, filename);
}

export { GALLERY_DIR };

