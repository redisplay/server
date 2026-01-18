import express from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { 
  addGalleryImage, 
  getGalleryImages, 
  getGalleryImageById,
  deleteGalleryImage,
  getGalleryImagePath 
} from '../services/gallery-db.js';

const router = express.Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const { GALLERY_DIR } = await import('../services/gallery-db.js');
    cb(null, GALLERY_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueId = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueId}${ext}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

export function createGalleryRoutes(viewManager) {
  // Upload a new gallery image
  router.post('/upload', upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
      }

      const viewId = req.body.viewId || req.body.view_id;
      if (!viewId) {
        return res.status(400).json({ error: 'viewId is required' });
      }
      
      // Check if view exists
      const view = viewManager.getView(viewId);
      if (!view) {
        return res.status(404).json({ error: `View ${viewId} not found` });
      }
      
      // Check if view is a gallery type
      if (view.metadata.type !== 'gallery') {
        return res.status(400).json({ error: `View ${viewId} is not a gallery type` });
      }

      const caption = req.body.caption || '';
      const ttl = parseFloat(req.body.ttl) || 2; // Default 2 hours
      
      // Add to database
      const image = await addGalleryImage(
        viewId,
        req.file.filename,
        caption,
        ttl,
        req.file.mimetype
      );
      
      // Trigger gallery view with the new image on all channels containing this view
      try {
        await viewManager.triggerGalleryImage(viewId, image);
      } catch (err) {
        console.error('Error triggering gallery view:', err);
        // Don't fail the upload if trigger fails
      }
      
      res.json({ 
        success: true, 
        image: {
          id: image.id,
          view_id: image.view_id,
          filename: image.filename,
          caption: image.caption,
          uploaded_at: image.uploaded_at,
          expires_at: image.expires_at,
          url: `/api/gallery/images/${image.id}`
        }
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get all gallery images (optionally filtered by viewId)
  router.get('/images', async (req, res) => {
    try {
      const viewId = req.query.viewId || req.query.view_id;
      const images = await getGalleryImages(viewId);
      const imagesWithUrls = images.map(img => ({
        ...img,
        url: `/api/gallery/images/${img.id}`
      }));
      res.json(imagesWithUrls);
    } catch (error) {
      console.error('Get images error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get a specific gallery image file
  router.get('/images/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const image = await getGalleryImageById(id);
      
      if (!image) {
        return res.status(404).json({ error: 'Image not found' });
      }
      
      const filePath = getGalleryImagePath(image.filename);
      res.sendFile(filePath);
    } catch (error) {
      console.error('Get image error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete a gallery image
  router.delete('/images/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await deleteGalleryImage(id);
      
      if (deleted) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Image not found' });
      }
    } catch (error) {
      console.error('Delete image error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Trigger gallery view manually
  router.post('/trigger', async (req, res) => {
    try {
      const { imageId, viewId } = req.body;
      
      if (imageId) {
        const image = await getGalleryImageById(imageId);
        if (!image) {
          return res.status(404).json({ error: 'Image not found' });
        }
        await viewManager.triggerGalleryImage(image.view_id, image);
      } else if (viewId) {
        // Trigger specific gallery view (will show next image in rotation)
        await viewManager.triggerGalleryView(viewId);
      } else {
        return res.status(400).json({ error: 'Either imageId or viewId is required' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Trigger error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

