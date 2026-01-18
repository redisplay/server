// View type definitions and validators

export const ViewTypes = {
  STATIC_TEXT: 'static_text',
  IMAGE: 'image',
  VIDEO: 'video',
  SLIDESHOW: 'slideshow',
  SCREEN_CONTROL: 'screen_control',
  WEBCAM: 'webcam',
  WEATHER: 'weather',
  CALENDAR: 'calendar',
  GALLERY: 'gallery',
  CUSTOM: 'custom'
};

export function validateCalendarView(data) {
  const errors = [];
  
  if (!data.sources || !Array.isArray(data.sources)) {
    errors.push('sources is required and must be an array');
  } else {
    data.sources.forEach((source, index) => {
      if (!source.url || typeof source.url !== 'string') {
        errors.push(`sources[${index}].url is required and must be a string`);
      }
      if (source.name && typeof source.name !== 'string') {
        errors.push(`sources[${index}].name must be a string`);
      }
      if (source.color && typeof source.color !== 'string') {
        errors.push(`sources[${index}].color must be a string`);
      }
    });
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateStaticTextView(data) {
  const errors = [];
  
  if (!data.title || typeof data.title !== 'string') {
    errors.push('title is required and must be a string');
  }
  
  if (data.text && typeof data.text !== 'string') {
    errors.push('text must be a string');
  }
  
  if (data.background) {
    if (typeof data.background !== 'object') {
      errors.push('background must be an object');
    } else if (data.background.type === 'gradient') {
      if (!data.background.from || !data.background.to) {
        errors.push('gradient background requires from and to colors');
      }
      if (data.background.middle && typeof data.background.middle !== 'string') {
        errors.push('middle color must be a string');
      }
    } else if (data.background.type === 'solid') {
      if (!data.background.color) {
        errors.push('solid background requires a color');
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateScreenControlView(data) {
  const errors = [];
  
  if (!data.action || typeof data.action !== 'string') {
    errors.push('action is required and must be a string');
  } else if (!['turn_on', 'turn_off', 'dim'].includes(data.action)) {
    errors.push('action must be one of: turn_on, turn_off, dim');
  }
  
  if (data.action === 'dim' && (data.brightness === undefined || typeof data.brightness !== 'number')) {
    errors.push('brightness is required and must be a number when action is dim');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateImageView(data) {
  const errors = [];
  
  if (!data.url || typeof data.url !== 'string') {
    errors.push('url is required and must be a string');
  }
  
  if (data.scaleType && typeof data.scaleType !== 'string') {
    errors.push('scaleType must be a string');
  } else if (data.scaleType && !['center', 'fitCenter', 'fitXY', 'centerCrop', 'matrix'].includes(data.scaleType)) {
    errors.push('scaleType must be one of: center, fitCenter, fitXY, centerCrop, matrix');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateWebcamView(data) {
  const errors = [];
  
  if (!data.webcamId && !data.url) {
    errors.push('either webcamId or url is required');
  }
  
  if (data.webcamId && typeof data.webcamId !== 'string') {
    errors.push('webcamId must be a string');
  }
  
  if (data.url && typeof data.url !== 'string') {
    errors.push('url must be a string');
  }
  
  if (data.scaleType && typeof data.scaleType !== 'string') {
    errors.push('scaleType must be a string');
  } else if (data.scaleType && !['center', 'fitCenter', 'fitXY', 'centerCrop', 'matrix'].includes(data.scaleType)) {
    errors.push('scaleType must be one of: center, fitCenter, fitXY, centerCrop, matrix');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateWeatherView(data) {
  const errors = [];
  
  if (!data.location || typeof data.location !== 'object') {
    errors.push('location is required and must be an object');
  } else {
    if (!data.location.name || typeof data.location.name !== 'string') {
      errors.push('location.name is required and must be a string');
    }
    if (typeof data.location.lat !== 'number') {
      errors.push('location.lat is required and must be a number');
    }
    if (typeof data.location.lon !== 'number') {
      errors.push('location.lon is required and must be a number');
    }
  }
  
  if (data.hoursToShow && typeof data.hoursToShow !== 'number') {
    errors.push('hoursToShow must be a number');
  }
  
  // Validate background if present
  if (data.background !== undefined) {
    if (typeof data.background !== 'object') {
      errors.push('background must be an object');
    } else {
      const bgType = data.background.type;
      if (bgType === 'gradient') {
        if (typeof data.background.from !== 'string') {
          errors.push('background.from is required for gradient type');
        }
        if (typeof data.background.to !== 'string') {
          errors.push('background.to is required for gradient type');
        }
        if (data.background.middle && typeof data.background.middle !== 'string') {
          errors.push('background.middle must be a string');
        }
      } else if (bgType === 'solid' || data.background.color) {
        if (typeof data.background.color !== 'string') {
          errors.push('background.color must be a string');
        }
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateGalleryView(data) {
  const errors = [];
  
  if (data.imageUrl && typeof data.imageUrl !== 'string') {
    errors.push('imageUrl must be a string');
  }
  
  if (data.imageId !== undefined && typeof data.imageId !== 'number') {
    errors.push('imageId must be a number');
  }
  
  if (data.caption && typeof data.caption !== 'string') {
    errors.push('caption must be a string');
  }
  
  if (data.scaleType && typeof data.scaleType !== 'string') {
    errors.push('scaleType must be a string');
  } else if (data.scaleType && !['center', 'fitCenter', 'fitXY', 'centerCrop', 'matrix'].includes(data.scaleType)) {
    errors.push('scaleType must be one of: center, fitCenter, fitXY, centerCrop, matrix');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateViewByType(type, data) {
  switch (type) {
    case ViewTypes.STATIC_TEXT:
      return validateStaticTextView(data);
    case ViewTypes.SCREEN_CONTROL:
      return validateScreenControlView(data);
    case ViewTypes.IMAGE:
      return validateImageView(data);
    case ViewTypes.WEBCAM:
      return validateWebcamView(data);
    case ViewTypes.WEATHER:
      return validateWeatherView(data);
    case ViewTypes.CALENDAR:
      return validateCalendarView(data);
    case ViewTypes.GALLERY:
      return validateGalleryView(data);
    case ViewTypes.VIDEO:
    case ViewTypes.SLIDESHOW:
    case ViewTypes.CUSTOM:
      // Basic validation - can be extended
      return { valid: true, errors: [] };
    default:
      return { valid: true, errors: [] }; // Allow custom types
  }
}

