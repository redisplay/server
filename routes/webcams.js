import express from 'express';
import https from 'https';
import http from 'http';
import multer from 'multer';
import sharp from 'sharp';
import { getLatestWebcamImage, getWebcamImage, saveWebcamImage, getWebcamImageBuffer } from '../services/webcam-db.js';

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Validate webcam ID format
function isValidWebcamId(webcamId) {
  return /^[a-zA-Z0-9_-]+$/.test(webcamId) && webcamId.length > 0 && webcamId.length <= 50;
}

// Check API key authentication (optional)
function isAuthorized(req) {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  const expectedKey = process.env.WEBCAM_API_KEY;
  
  // If no API key is configured, allow all (for development)
  if (!expectedKey) {
    return true;
  }
  
  return apiKey === expectedKey;
}

export function createWebcamRoutes() {
  const router = express.Router();

  // POST: Upload webcam image
  router.post('/:webcamId', upload.single('image'), async (req, res) => {
    try {
      const { webcamId } = req.params;

      if (!webcamId) {
        return res.status(400).json({ error: 'Webcam ID is required' });
      }

      // Validate webcam ID format
      if (!isValidWebcamId(webcamId)) {
        return res.status(400).json({ 
          error: 'Invalid webcam ID format. Must be alphanumeric with hyphens/underscores, 1-50 characters' 
        });
      }

      // Check API key authentication
      if (!isAuthorized(req)) {
        return res.status(401).json({ 
          error: 'Unauthorized. Provide X-API-Key header or Authorization Bearer token' 
        });
      }

      let imageBuffer;
      let filename;

      // Handle multipart/form-data (from multer)
      if (req.file) {
        imageBuffer = req.file.buffer;
        filename = req.file.originalname;
      } 
      // Handle raw image data
      else if (req.body && Buffer.isBuffer(req.body)) {
        imageBuffer = req.body;
        filename = req.headers['x-filename'] || undefined;
      }
      // Handle base64 encoded string
      else if (req.body && typeof req.body === 'string') {
        const base64String = req.body.includes(',') 
          ? req.body.split(',')[1] 
          : req.body;
        imageBuffer = Buffer.from(base64String, 'base64');
        filename = req.headers['x-filename'] || undefined;
      }
      // Try to get from body as buffer
      else if (req.body && req.body.data) {
        if (Buffer.isBuffer(req.body.data)) {
          imageBuffer = req.body.data;
        } else if (typeof req.body.data === 'string') {
          const base64String = req.body.data.includes(',') 
            ? req.body.data.split(',')[1] 
            : req.body.data;
          imageBuffer = Buffer.from(base64String, 'base64');
        }
        filename = req.body.filename || req.headers['x-filename'] || undefined;
      }
      else {
        return res.status(400).json({ error: 'Image data is required' });
      }

      if (!imageBuffer || imageBuffer.length === 0) {
        return res.status(400).json({ error: 'Image data is required' });
      }

      // Save image
      const savedImage = saveWebcamImage(webcamId, imageBuffer, filename);

      res.json({
        success: true,
        webcamId,
        image: {
          id: savedImage.id,
          filename: savedImage.filename,
          createdAt: savedImage.created_at,
        },
      });
    } catch (error) {
      console.error('Error in POST /api/webcams/:webcamId:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET: Fetch latest webcam image (proxy to actual image URL)
  router.get('/:webcamId', async (req, res) => {
    try {
      const { webcamId } = req.params;
      const { imageId, w, h } = req.query;

      if (!webcamId) {
        return res.status(400).json({ error: 'Webcam ID is required' });
      }

      let image;
      if (imageId) {
        const id = parseInt(imageId, 10);
        if (isNaN(id)) {
          return res.status(400).json({ error: 'Invalid image ID' });
        }
        image = getWebcamImage(webcamId, id);
      } else {
        image = getLatestWebcamImage(webcamId);
      }

      if (!image) {
        return res.status(404).json({ error: 'Image not found' });
      }

      // Get image buffer from disk using persistent storage
      try {
        let imageBuffer = getWebcamImageBuffer(image);
        
        // Resize if width/height provided
        if (w || h) {
          const width = w ? parseInt(w, 10) : null;
          const height = h ? parseInt(h, 10) : null;
          
          if ((width && !isNaN(width)) || (height && !isNaN(height))) {
            try {
              imageBuffer = await sharp(imageBuffer)
                .resize({
                  width: width,
                  height: height,
                  fit: 'inside', // Maintain aspect ratio
                  withoutEnlargement: true
                })
                .toBuffer();
                
              console.log(`[Webcam Fetch] Resized image for ${webcamId} to ${width}x${height}, new size: ${imageBuffer.length} bytes`);
            } catch (resizeErr) {
              console.error(`[Webcam Fetch] Error resizing image:`, resizeErr);
              // Continue with original buffer
            }
          }
        }
        
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('X-Image-Created-At', image.created_at.toString());
        res.setHeader('Cache-Control', 'public, max-age=300');
        
        console.log(`[Webcam Fetch] Serving image for ${webcamId}, ID: ${image.id}, size: ${imageBuffer.length} bytes`);
        res.send(imageBuffer);
      } catch (err) {
        console.error(`[Webcam Fetch] Error reading image file:`, err);
        res.status(500).json({ error: 'Failed to read image file' });
      }
    } catch (error) {
      console.error('Error in GET /api/webcams/:webcamId:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET: Fetch webcam metadata (timestamp, relative time)
  router.get('/:webcamId/meta', async (req, res) => {
    try {
      const { webcamId } = req.params;

      if (!webcamId) {
        return res.status(400).json({ error: 'Webcam ID is required' });
      }

      const image = getLatestWebcamImage(webcamId);

      if (!image) {
        return res.status(404).json({ error: 'No image found for this webcam' });
      }

      const now = Date.now();
      const timestamp = image.created_at;
      const diff = now - timestamp;

      // Calculate relative time
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      let relativeTime;
      if (seconds < 60) {
        relativeTime = 'just now';
      } else if (minutes < 60) {
        relativeTime = `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
      } else if (hours < 24) {
        relativeTime = `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
      } else {
        relativeTime = `${days} ${days === 1 ? 'day' : 'days'} ago`;
      }

      res.json({
        t: timestamp,
        now: now,
        rel: relativeTime,
        created_at: timestamp,
        image: `/api/webcams/${webcamId}?t=${timestamp}`
      });
    } catch (error) {
      console.error('Error in GET /api/webcams/:webcamId/meta:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

