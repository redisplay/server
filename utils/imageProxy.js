import { URL } from 'url';

// Get the server base URL from environment or use default
const SERVER_BASE_URL = process.env.SERVER_BASE_URL || 'http://192.168.1.104:3000';

/**
 * Rewrites image URLs in view data to use the server proxy
 * This makes proxy usage transparent to the client
 */
export function rewriteImageUrls(view) {
  if (!view || !view.data) {
    return view;
  }

  const viewCopy = JSON.parse(JSON.stringify(view)); // Deep clone

  // Check if this is an image view
  if (viewCopy.metadata?.type === 'image' && viewCopy.data.url) {
    const originalUrl = viewCopy.data.url;
    
    // Only rewrite if it's an external URL (not already proxied)
    if (originalUrl.startsWith('http://') || originalUrl.startsWith('https://')) {
      // Check if it's already a proxy URL
      if (!originalUrl.includes('/api/proxy/image/')) {
        // Encode the URL for use in path
        const encodedUrl = encodeURIComponent(originalUrl);
        viewCopy.data.url = `${SERVER_BASE_URL}/api/proxy/image/${encodedUrl}`;
      }
    }
  }

  return viewCopy;
}

