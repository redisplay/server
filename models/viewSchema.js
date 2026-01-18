export const ViewSchema = {
  metadata: {
    type: String,
    required: true,
    rotateAfter: Number, // Optional: milliseconds to wait before rotating
    rotateAt: String, // Optional: relative time (e.g., "14:30", "+30s", "5m")
    schedule: { // Optional: time-based scheduling
      days: Array, // ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
      hours: [{ from: String, to: String }] // Array of time ranges: [{ from: "08:00", to: "09:00" }, { from: "16:00", to: "18:00" }]
      // OR single object (legacy): { from: "09:00", to: "17:00" }
    }
  },
  data: {
    type: Object,
    required: true
  }
};

export function validateView(view) {
  if (!view) {
    return { valid: false, error: 'View is required' };
  }

  if (!view.metadata || typeof view.metadata !== 'object') {
    return { valid: false, error: 'View metadata is required and must be an object' };
  }

  if (!view.metadata.type || typeof view.metadata.type !== 'string') {
    return { valid: false, error: 'View metadata.type is required and must be a string' };
  }

  if (!view.data || typeof view.data !== 'object') {
    return { valid: false, error: 'View data is required and must be an object' };
  }

  // Validate rotateAfter if present
  if (view.metadata.rotateAfter !== undefined) {
    if (typeof view.metadata.rotateAfter !== 'number' || view.metadata.rotateAfter < 0) {
      return { valid: false, error: 'metadata.rotateAfter must be a non-negative number' };
    }
  }

  // Validate rotateAt if present
  if (view.metadata.rotateAt !== undefined) {
    if (typeof view.metadata.rotateAt !== 'string') {
      return { valid: false, error: 'metadata.rotateAt must be a string' };
    }
  }

  // Validate schedule if present
  if (view.metadata.schedule !== undefined) {
    if (typeof view.metadata.schedule !== 'object') {
      return { valid: false, error: 'metadata.schedule must be an object' };
    }

    // Validate days if present
    if (view.metadata.schedule.days !== undefined) {
      if (!Array.isArray(view.metadata.schedule.days)) {
        return { valid: false, error: 'metadata.schedule.days must be an array' };
      }
      const validDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
      for (const day of view.metadata.schedule.days) {
        if (!validDays.includes(day.toLowerCase())) {
          return { valid: false, error: `Invalid day in schedule.days: ${day}. Must be one of: ${validDays.join(', ')}` };
        }
      }
    }

    // Validate hours if present (can be object or array)
    if (view.metadata.schedule.hours !== undefined) {
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      
      if (Array.isArray(view.metadata.schedule.hours)) {
        // Array of time ranges
        for (const range of view.metadata.schedule.hours) {
          if (typeof range !== 'object' || !range.from || !range.to) {
            return { valid: false, error: 'Each item in metadata.schedule.hours array must have "from" and "to" properties' };
          }
          if (!timeRegex.test(range.from)) {
            return { valid: false, error: `Invalid "from" time in schedule.hours: ${range.from}. Must be in HH:MM format (e.g., "09:00")` };
          }
          if (!timeRegex.test(range.to)) {
            return { valid: false, error: `Invalid "to" time in schedule.hours: ${range.to}. Must be in HH:MM format (e.g., "17:00")` };
          }
        }
      } else if (typeof view.metadata.schedule.hours === 'object') {
        // Single time range (legacy format)
        if (!view.metadata.schedule.hours.from || !view.metadata.schedule.hours.to) {
          return { valid: false, error: 'metadata.schedule.hours must have both "from" and "to" properties' };
        }
        if (!timeRegex.test(view.metadata.schedule.hours.from)) {
          return { valid: false, error: 'metadata.schedule.hours.from must be in HH:MM format (e.g., "09:00")' };
        }
        if (!timeRegex.test(view.metadata.schedule.hours.to)) {
          return { valid: false, error: 'metadata.schedule.hours.to must be in HH:MM format (e.g., "17:00")' };
        }
      } else {
        return { valid: false, error: 'metadata.schedule.hours must be an object or array' };
      }
    }
  }

  return { valid: true };
}

export function parseRotateAt(rotateAt) {
  if (!rotateAt) return null;

  // Time of day format: "14:30" or "14:30:00"
  const timeOfDayRegex = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
  const timeMatch = rotateAt.match(timeOfDayRegex);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const seconds = parseInt(timeMatch[3] || '0', 10);
    
    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60 && seconds >= 0 && seconds < 60) {
      const now = new Date();
      const target = new Date();
      target.setHours(hours, minutes, seconds, 0);
      
      // If time has passed today, schedule for tomorrow
      if (target <= now) {
        target.setDate(target.getDate() + 1);
      }
      
      return target.getTime() - now.getTime();
    }
  }

  // Relative format: "+30s", "+5m", "+1h" or duration: "30s", "5m", "1h"
  const relativeRegex = /^\+?(\d+)([smhd])$/i;
  const relativeMatch = rotateAt.match(relativeRegex);
  if (relativeMatch) {
    const value = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2].toLowerCase();
    
    const multipliers = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000
    };
    
    if (multipliers[unit]) {
      return value * multipliers[unit];
    }
  }

  return null;
}

/**
 * Check if a view should be active based on its schedule configuration
 * @param {Object} view - The view object with metadata.schedule
 * @param {Date} now - Optional date/time to check against (defaults to current time)
 * @returns {boolean} - True if view should be active
 */
export function isViewScheduled(view, now = new Date()) {
  // If no schedule defined, view is always active
  if (!view.metadata || !view.metadata.schedule) {
    return true;
  }

  const schedule = view.metadata.schedule;

  // Check day of week
  if (schedule.days && Array.isArray(schedule.days) && schedule.days.length > 0) {
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const currentDay = dayNames[now.getDay()];
    const scheduledDays = schedule.days.map(d => d.toLowerCase());
    
    if (!scheduledDays.includes(currentDay)) {
      return false; // Not scheduled for this day
    }
  }

  // Check hours (supports both single object and array of ranges)
  if (schedule.hours) {
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const hourRanges = Array.isArray(schedule.hours) ? schedule.hours : [schedule.hours];
    
    // Check if current time falls within ANY of the hour ranges
    let withinAnyRange = false;
    for (const range of hourRanges) {
      if (!range.from || !range.to) continue;
      
      const [fromHours, fromMins] = range.from.split(':').map(Number);
      const fromMinutes = fromHours * 60 + fromMins;
      
      const [toHours, toMins] = range.to.split(':').map(Number);
      const toMinutes = toHours * 60 + toMins;
      
      // Handle overnight schedules (e.g., 22:00 to 06:00)
      if (fromMinutes > toMinutes) {
        // Overnight: active if current time is after 'from' OR before 'to'
        if (currentMinutes >= fromMinutes || currentMinutes < toMinutes) {
          withinAnyRange = true;
          break;
        }
      } else {
        // Normal: active if current time is between 'from' and 'to'
        if (currentMinutes >= fromMinutes && currentMinutes < toMinutes) {
          withinAnyRange = true;
          break;
        }
      }
    }
    
    if (!withinAnyRange) {
      return false;
    }
  }

  return true;
}

export function createView(metadata, data) {
  return {
    metadata: { ...metadata },
    data: { ...data }
  };
}

