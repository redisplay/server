import nodeIcal from 'node-ical';
import { v4 as uuidv4 } from 'uuid';

// In-memory cache: { "cacheKey": { timestamp: 123456789, data: [...] } }
const calendarCache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

/**
 * Fetches and parses a single ICS feed.
 * @param {string} url - The URL of the ICS feed.
 * @param {string} name - A label for this source (e.g. "Work", "Personal").
 * @param {string} color - Optional color for events from this source.
 * @returns {Promise<Array>} - Array of event objects.
 */
async function fetchCalendar(url, name, color) {
  console.log(`Fetching calendar: ${name} from ${url}`);
  
  // Fetch raw ICS content and pre-process to fix UNTIL dates
  try {
    const https = await import('https');
    const rawICS = await new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      }).on('error', reject);
    });
    
    // Fix date-only UNTIL values by converting them to UTC datetime
    // UNTIL=20200930 -> UNTIL=20200930T235959Z
    const fixedICS = rawICS.replace(/UNTIL=(\d{8});/g, 'UNTIL=$1T235959Z;');
    
    const data = await nodeIcal.async.parseICS(fixedICS);
    const events = [];

    for (const k in data) {
      if (data.hasOwnProperty(k)) {
        const ev = data[k];
        if (ev.type === 'VEVENT') {
          events.push({
            id: ev.uid,
            summary: ev.summary,
            description: ev.description,
            start: ev.start,
            end: ev.end,
            location: ev.location,
            allDay: ev.datetype === 'date',
            source: name,
            color: color || '#3498db',
          });
        }
      }
    }
    console.log(`Fetched ${events.length} events from ${name}`);
    return events;
  } catch (error) {
    console.error(`Error fetching calendar ${name} (${url}):`, error.message);
    return [];
  }
}

/**
 * Merges events from multiple calendar sources.
 * @param {Array} sources - Array of { url, name, color } objects.
 * @returns {Promise<Array>} - Sorted array of merged events.
 */
export async function getMergedEvents(sources) {
  // Create a cache key based on the sorted URLs
  const cacheKey = JSON.stringify(sources.map(s => s.url).sort());
  
  const cached = calendarCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.data;
  }

  const promises = sources.map(source => 
    fetchCalendar(source.url, source.name, source.color)
  );

  const results = await Promise.all(promises);
  
  // Flatten array
  const allEvents = results.flat();

  // Sort by start date
  allEvents.sort((a, b) => {
    return new Date(a.start) - new Date(b.start);
  });

  // Filter: keep events from start of today onwards (includes past events from today)
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0); // Start of current day
  
  // Track filtering per source
  const filterStats = {};
  
  const futureEvents = allEvents.filter(e => {
      const start = e.start ? new Date(e.start) : null;
      const end = e.end ? new Date(e.end) : start;
      const isValid = start && !isNaN(start.getTime());
      
      if (!filterStats[e.source]) {
          filterStats[e.source] = { total: 0, kept: 0, filtered: 0 };
      }
      filterStats[e.source].total++;
      
      // Debug date parsing issues
      if (!isValid) {
          console.warn(`[Calendar] Invalid date for event: ${e.summary} from ${e.source} (${e.start})`);
          filterStats[e.source].filtered++;
          return false;
      }
      
      // Keep events from start of today onwards (includes today's past events)
      const passes = (end || start) >= startOfToday;
      if (passes) {
          filterStats[e.source].kept++;
      } else {
          filterStats[e.source].filtered++;
      }
      
      return passes;
  });
  
  // Log filtering statistics
  console.log('[Calendar] Filtering summary (showing events from start of today):');
  console.log(`  Now: ${now.toISOString()}`);
  console.log(`  Cutoff (start of today): ${startOfToday.toISOString()}`);
  Object.keys(filterStats).forEach(source => {
      const stats = filterStats[source];
      console.log(`  ${source}: ${stats.kept} kept, ${stats.filtered} filtered (${stats.total} total)`);
  });
  console.log(`  Total events after filter: ${futureEvents.length}`);
  // const futureEvents = allEvents; // DISABLE FILTER FOR DEBUGGING

  calendarCache.set(cacheKey, {
    timestamp: Date.now(),
    data: futureEvents
  });

  return futureEvents;
}

