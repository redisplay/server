import express from 'express';
import { validateView } from '../models/viewSchema.js';

export function createViewRoutes(viewManager) {
  const router = express.Router();

  // Get current view (optionally for a specific channel)
  router.get('/current', (req, res) => {
    const { channel } = req.query;
    const view = viewManager.getCurrentView(channel || null);
    res.json(view);
  });

  // Get all views
  router.get('/', (req, res) => {
    const views = viewManager.getAllViews();
    res.json(views);
  });

  // Add a new view
  router.post('/', (req, res) => {
    const { id, metadata, data } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'ID is required' });
    }
    
    // Support both formats: { metadata, data } or just { data } (legacy)
    let view;
    if (metadata && data) {
      view = { metadata, data };
    } else if (data) {
      // Legacy format - will be wrapped in default metadata
      view = data;
    } else {
      return res.status(400).json({ error: 'View data or (metadata and data) is required' });
    }
    
    try {
      viewManager.addView(id, view);
      res.json({ success: true, view: viewManager.views.get(id) });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Update a view
  router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { metadata, data } = req.body;
    
    if (!viewManager.views.has(id)) {
      return res.status(404).json({ error: 'View not found' });
    }
    
    // Support both formats
    let view;
    if (metadata && data) {
      view = { metadata, data };
    } else if (data) {
      view = data;
    } else {
      return res.status(400).json({ error: 'View data or (metadata and data) is required' });
    }
    
    try {
      viewManager.addView(id, view);
      res.json({ success: true, view: viewManager.views.get(id) });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Delete a view
  router.delete('/:id', (req, res) => {
    const { id } = req.params;
    if (!viewManager.views.has(id)) {
      return res.status(404).json({ error: 'View not found' });
    }
    viewManager.removeView(id);
    res.json({ success: true });
  });

  // Set current view (optionally for a specific channel)
  router.post('/:id/activate', (req, res) => {
    const { id } = req.params;
    const { channel } = req.body;
    try {
      viewManager.setCurrentView(id, channel || null);
      res.json({ success: true, view: viewManager.getCurrentView(channel || null) });
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  // Trigger a view (optionally for a specific channel)
  router.post('/:id/trigger', (req, res) => {
    const { id } = req.params;
    const { channel } = req.body;
    try {
      viewManager.triggerView(id, channel || null);
      res.json({ success: true, view: viewManager.getCurrentView(channel || null) });
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  // Get views for a specific channel
  router.get('/channel/:channel', (req, res) => {
    const { channel } = req.params;
    const views = viewManager.getChannelViews(channel);
    res.json(views);
  });

  // Start rotation
  router.post('/rotation/start', (req, res) => {
    const { delay } = req.body;
    viewManager.startRotation(delay);
    res.json({ success: true, delay: viewManager.rotationDelay });
  });

  // Stop rotation
  router.post('/rotation/stop', (req, res) => {
    viewManager.stopRotation();
    res.json({ success: true });
  });

  return router;
}

