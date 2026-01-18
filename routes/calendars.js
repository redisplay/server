import express from 'express';
import { getMergedEvents } from '../services/calendarService.js';

export function createCalendarRoutes(viewManager) {
  const router = express.Router();

  /**
   * GET /api/calendars/view/:viewId
   * Fetches merged calendar events for a specific view configuration.
   */
  router.get('/view/:viewId', async (req, res) => {
    try {
      const { viewId } = req.params;
      
      if (!viewManager) {
        return res.status(500).json({ error: 'ViewManager not initialized' });
      }

      const view = viewManager.getView(viewId);
      if (!view) {
        return res.status(404).json({ error: 'View not found' });
      }

      if (view.metadata.type !== 'calendar') {
        return res.status(400).json({ error: 'View is not of type calendar' });
      }

      const sources = view.data.sources;
      if (!sources || !Array.isArray(sources)) {
        return res.status(400).json({ error: 'Calendar view has no valid sources configured' });
      }

      const events = await getMergedEvents(sources);
      res.json(events);
    } catch (error) {
      console.error(`Error fetching calendar view ${req.params.viewId}:`, error);
      res.status(500).json({ error: 'Failed to fetch calendar events' });
    }
  });

  /**
   * GET /api/calendars/merge
   * Query params or Body:
   * sources: JSON string of array [{ url, name, color }]
   */
  router.post('/merge', async (req, res) => {
    try {
      const { sources } = req.body;
      
      if (!sources || !Array.isArray(sources)) {
        return res.status(400).json({ error: 'Invalid sources provided. Must be an array of {url, name, color}.' });
      }

      const events = await getMergedEvents(sources);
      res.json(events);
    } catch (error) {
      console.error('Error merging calendars:', error);
      res.status(500).json({ error: 'Failed to merge calendars' });
    }
  });

  return router;
}

