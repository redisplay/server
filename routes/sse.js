import express from 'express';
import { channelManager } from '../services/channelManager.js';
import { logSSE } from '../utils/logger.js';
import { rewriteImageUrls } from '../utils/imageProxy.js';

export function createSSEHandler(viewManager) {
  const router = express.Router();

  router.get('/:channel', async (req, res) => {
    const { channel } = req.params;
    const clientId = `${req.ip}-${Date.now()}`;
    
    logSSE(`Client connecting`, { 
      clientId, 
      channel, 
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
    
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Send initial current view for the channel
    const currentView = viewManager.getCurrentView(channel);
    if (currentView) {
      // Rewrite image URLs to use proxy (transparent to client)
      const proxiedView = rewriteImageUrls(currentView);
      const initialMessage = {
        type: 'initial_view',
        view: proxiedView
      };
      res.write(`data: ${JSON.stringify(initialMessage)}\n\n`);
      logSSE(`Sent initial view to client`, { 
        clientId, 
        channel, 
        message: initialMessage 
      });
    }

    // Subscribe client to channel (will close any existing connections from same IP)
    await channelManager.subscribeClient(channel, res, clientId, req.ip);

    // Keep connection alive
    const keepAlive = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch (err) {
        clearInterval(keepAlive);
      }
    }, 30000);

    req.on('close', () => {
      clearInterval(keepAlive);
      logSSE(`Client disconnected`, { clientId, channel });
      channelManager.unsubscribeClient(channel, res);
    });
  });

  return router;
}

