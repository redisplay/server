import express from 'express';
import { channelConfig } from '../services/channelConfig.js';

export function createChannelConfigRoutes() {
  const router = express.Router();

  // Get all channel configurations
  router.get('/', (req, res) => {
    const channels = channelConfig.getAllChannels();
    const configs = {};
    channels.forEach(channel => {
      configs[channel] = channelConfig.getChannelConfig(channel);
    });
    res.json({ channels: configs });
  });

  // Get specific channel configuration
  router.get('/:channel', (req, res) => {
    const { channel } = req.params;
    const config = channelConfig.getChannelConfig(channel);
    if (!config) {
      return res.status(404).json({ error: 'Channel not found' });
    }
    
    // Filter quadrants to only include views that are in the channel
    if (config.quadrants && config.views) {
      const filteredQuadrants = {};
      for (const [quadrant, viewId] of Object.entries(config.quadrants)) {
        // Keep special actions (NEXT, PREVIOUS) and views that exist in the channel
        if (viewId === 'NEXT' || viewId === 'PREVIOUS' || config.views.includes(viewId)) {
          filteredQuadrants[quadrant] = viewId;
        } else {
          console.log(`[Channel ${channel}] Filtering out quadrant ${quadrant} -> ${viewId} (not in channel views)`);
        }
      }
      config.quadrants = filteredQuadrants;
    }
    
    res.json(config);
  });

  // Set channel views
  router.put('/:channel/views', async (req, res) => {
    const { channel } = req.params;
    const { views } = req.body;
    
    if (!Array.isArray(views)) {
      return res.status(400).json({ error: 'Views must be an array' });
    }
    
    channelConfig.setChannelViews(channel, views);
    const saved = await channelConfig.save();
    
    if (saved) {
      res.json({ success: true, channel, views });
    } else {
      res.status(500).json({ error: 'Failed to save configuration' });
    }
  });

  // Set channel rotation
  router.put('/:channel/rotation', async (req, res) => {
    const { channel } = req.params;
    const { enabled, delay } = req.body;
    
    const rotation = {};
    if (enabled !== undefined) rotation.enabled = enabled;
    if (delay !== undefined) rotation.delay = delay;
    
    channelConfig.setChannelRotation(channel, rotation);
    const saved = await channelConfig.save();
    
    if (saved) {
      res.json({ success: true, channel, rotation: channelConfig.getChannelRotation(channel) });
    } else {
      res.status(500).json({ error: 'Failed to save configuration' });
    }
  });

  return router;
}

