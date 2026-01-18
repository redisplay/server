import bleno from '@abandonware/bleno';
import { UUIDS } from './constants.js';
import { logBle, logError } from '../../utils/logger.js';

const FLAG_START = 0x01;
const FLAG_CONTINUE = 0x02;
const FLAG_END = 0x03;
const FLAG_SINGLE = 0x04;

export class ViewCharacteristic extends bleno.Characteristic {
  constructor() {
    super({
      uuid: UUIDS.VIEW_DATA,
      properties: ['notify'],
      value: null
    });
    this.updateValueCallback = null;
    this.maxValueSize = 20; // Default BLE MTU
  }

  onSubscribe(maxValueSize, updateValueCallback) {
    logBle(`Client subscribed. Max value size: ${maxValueSize}`);
    this.updateValueCallback = updateValueCallback;
    this.maxValueSize = maxValueSize;
  }

  onUnsubscribe() {
    logBle('Client unsubscribed');
    this.updateValueCallback = null;
  }

  sendViewUpdate(viewData) {
    if (!this.updateValueCallback) return;

    try {
      const jsonString = JSON.stringify(viewData);
      const buffer = Buffer.from(jsonString);
      
      // Calculate safe chunk size (MTU - 1 byte header)
      const chunkSize = this.maxValueSize - 1;
      const totalLen = buffer.length;
      
      if (totalLen <= chunkSize) {
        // Send as single packet
        const packet = Buffer.alloc(1 + totalLen);
        packet.writeUInt8(FLAG_SINGLE, 0);
        buffer.copy(packet, 1);
        this.updateValueCallback(packet);
      } else {
        // Send as multiple chunks
        let offset = 0;
        
        // 1. Send Start
        let currentChunkSize = Math.min(chunkSize, totalLen - offset);
        let packet = Buffer.alloc(1 + currentChunkSize);
        packet.writeUInt8(FLAG_START, 0);
        buffer.copy(packet, 1, offset, offset + currentChunkSize);
        this.updateValueCallback(packet);
        offset += currentChunkSize;
        
        // 2. Send Continue blocks
        while (offset < totalLen) {
           // Check if this is the last block
           const isLast = (totalLen - offset) <= chunkSize;
           
           currentChunkSize = Math.min(chunkSize, totalLen - offset);
           packet = Buffer.alloc(1 + currentChunkSize);
           
           if (isLast) {
             packet.writeUInt8(FLAG_END, 0);
           } else {
             packet.writeUInt8(FLAG_CONTINUE, 0);
           }
           
           buffer.copy(packet, 1, offset, offset + currentChunkSize);
           this.updateValueCallback(packet);
           offset += currentChunkSize;
        }
      }
      logBle(`Sent view update (${totalLen} bytes)`);
    } catch (err) {
      logError('Error sending BLE update', err);
    }
  }
}

