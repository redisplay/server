import { EventEmitter } from 'events';

export class BleResponseAdapter extends EventEmitter {
  constructor(viewCharacteristic) {
    super();
    this.viewCharacteristic = viewCharacteristic;
    this.destroyed = false;
  }

  write(data) {
    // Data comes in SSE format: "data: {...}\n\n" or ": keepalive\n\n"
    if (this.destroyed) return;
    
    // Check for keepalive or empty lines
    if (typeof data !== 'string' || data.startsWith(':') || data.trim().length === 0) return;
    
    // Parse SSE data
    if (data.startsWith('data: ')) {
      try {
        const jsonStr = data.substring(6).trim();
        if (jsonStr) {
          const jsonData = JSON.parse(jsonStr);
          this.viewCharacteristic.sendViewUpdate(jsonData);
        }
      } catch (err) {
        console.error('Error parsing SSE data for BLE:', err);
      }
    }
  }
  
  // Express res methods that might be called (mocks)
  setHeader() {}
  
  destroy() {
    if (!this.destroyed) {
      this.destroyed = true;
      this.emit('close');
    }
  }
}


