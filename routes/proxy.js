import express from 'express';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import sharp from 'sharp';

// Whitelist of allowed domains/URLs for security
const ALLOWED_DOMAINS = [
  'picsum.photos',
  'www.virail.com',
  'virail.com',
  'sila.love',
  // Add more allowed domains here
];

// Whitelist of allowed URL patterns (for more flexible matching)
const ALLOWED_URL_PATTERNS = [
  /^https?:\/\/.*\.virail\.com\/.*/,
  /^https?:\/\/.*\.sila\.love\/.*/,
  /^https?:\/\/picsum\.photos\/.*/,
  // Add more patterns here
];

function isUrlAllowed(urlString) {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname;
    
    // Check domain whitelist
    for (const domain of ALLOWED_DOMAINS) {
      if (hostname === domain || hostname.endsWith('.' + domain)) {
        return true;
      }
    }
    
    // Check URL pattern whitelist
    for (const pattern of ALLOWED_URL_PATTERNS) {
      if (pattern.test(urlString)) {
        return true;
      }
    }
    
    return false;
  } catch (err) {
    return false;
  }
}

export function createProxyRoutes() {
  const router = express.Router();

  // Proxy endpoint for images
  // URL format: /api/proxy/image/ENCODED_URL
  router.get('/image/:encodedUrl(*)', async (req, res) => {
    const startTime = Date.now();
    // Extract URL from path parameter (Express wildcard captures everything)
    const encodedUrl = req.params.encodedUrl;
    
    console.log('[Proxy] Image request received, encoded URL length:', encodedUrl?.length);
    
    if (!encodedUrl) {
      console.error('[Proxy] No URL provided in request');
      return res.status(400).json({ error: 'URL is required in path' });
    }

    // Decode the URL (it was encoded with encodeURIComponent)
    let targetUrlString;
    try {
      targetUrlString = decodeURIComponent(encodedUrl);
      console.log('[Proxy] Decoded target URL:', targetUrlString);
    } catch (e) {
      console.warn('[Proxy] Failed to decode URL, using as-is:', e.message);
      // If decoding fails, try using it as-is
      targetUrlString = encodedUrl;
    }

    // Ensure URL has protocol
    if (!targetUrlString.startsWith('http://') && !targetUrlString.startsWith('https://')) {
      targetUrlString = 'https://' + targetUrlString;
      console.log('[Proxy] Added https:// protocol, new URL:', targetUrlString);
    }

    // Check if URL is whitelisted
    if (!isUrlAllowed(targetUrlString)) {
      console.warn('[Proxy] Blocked proxy request for non-whitelisted URL:', targetUrlString);
      return res.status(403).json({ error: 'URL not allowed. Domain must be in whitelist.' });
    }
    
    console.log('[Proxy] URL whitelist check passed');

    try {
      const targetUrl = new URL(targetUrlString);
      const protocol = targetUrl.protocol === 'https:' ? https : http;
      
      // Set appropriate headers
      const options = {
        hostname: targetUrl.hostname,
        port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
        path: targetUrl.pathname + targetUrl.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Kiosk-Server/1.0',
          // Forward caching headers
          ...(req.headers['if-modified-since'] && { 'If-Modified-Since': req.headers['if-modified-since'] }),
          ...(req.headers['if-none-match'] && { 'If-None-Match': req.headers['if-none-match'] })
        },
        rejectUnauthorized: false // Accept self-signed certificates
      };

      console.log('[Proxy] Making request to:', targetUrl.hostname + targetUrl.pathname);
      
      const proxyReq = protocol.request(options, (proxyRes) => {
        const contentType = proxyRes.headers['content-type'] || '';
        const isWebP = contentType.includes('image/webp') || 
                      targetUrlString.toLowerCase().includes('.webp');
        
        console.log('[Proxy] Response received - Status:', proxyRes.statusCode, 'Content-Type:', contentType);
        console.log('[Proxy] Is WebP:', isWebP);
        
        // Forward status code
        res.status(proxyRes.statusCode);
        
        // Forward Caching headers
        const cacheHeaders = ['last-modified', 'etag', 'cache-control', 'expires'];
        cacheHeaders.forEach(header => {
          if (proxyRes.headers[header]) {
            res.setHeader(header.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('-'), proxyRes.headers[header]);
          }
        });
        
        // Handle 304 Not Modified
        if (proxyRes.statusCode === 304) {
          res.end();
          return;
        }
        
        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        // If it's WebP, convert to JPG for Android 4.2.2 compatibility
        if (isWebP && proxyRes.statusCode === 200) {
          console.log('[Proxy] Starting WebP to JPG conversion');
          // Collect the image data chunks
          const chunks = [];
          proxyRes.on('data', (chunk) => {
            chunks.push(chunk);
          });
          
          proxyRes.on('end', async () => {
            try {
              const imageBuffer = Buffer.concat(chunks);
              console.log('[Proxy] WebP image received, size:', imageBuffer.length, 'bytes');
              
              // Convert WebP to JPG using sharp
              const jpgBuffer = await sharp(imageBuffer)
                .jpeg({ quality: 90 })
                .toBuffer();
              
              console.log('[Proxy] WebP converted to JPG, size:', jpgBuffer.length, 'bytes');
              
              // Set appropriate headers for JPG
              res.setHeader('Content-Type', 'image/jpeg');
              res.setHeader('Content-Length', jpgBuffer.length.toString());
              
              // Send converted image
              res.end(jpgBuffer);
              console.log('[Proxy] JPG sent to client, total time:', Date.now() - startTime, 'ms');
            } catch (conversionError) {
              console.error('[Proxy] WebP conversion error:', conversionError);
              // Fallback: try to send original (might fail on old Android)
              res.setHeader('Content-Type', contentType);
              res.end(Buffer.concat(chunks));
            }
          });
          
          proxyRes.on('error', (err) => {
            console.error('Proxy response error:', err);
            if (!res.headersSent) {
              res.status(500).json({ error: 'Failed to fetch image: ' + err.message });
            }
          });
        } else {
          // Not WebP, forward headers and stream as-is
          console.log('[Proxy] Streaming image as-is (not WebP)');
          const headersToForward = ['content-type', 'content-length', 'cache-control', 'expires'];
          headersToForward.forEach(header => {
            if (proxyRes.headers[header]) {
              res.setHeader(header, proxyRes.headers[header]);
            }
          });
          
          proxyRes.on('end', () => {
            console.log('[Proxy] Image streamed to client, total time:', Date.now() - startTime, 'ms');
          });
          
          // Stream the response
          proxyRes.pipe(res);
        }
      });

      proxyReq.on('error', (err) => {
        console.error('[Proxy] Request error:', err.message, err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to fetch image: ' + err.message });
        }
      });

      proxyReq.end();
      console.log('[Proxy] Request sent');
    } catch (err) {
      console.error('[Proxy] Setup error:', err.message, err);
      res.status(400).json({ error: 'Invalid URL: ' + err.message });
    }
  });

  return router;
}

