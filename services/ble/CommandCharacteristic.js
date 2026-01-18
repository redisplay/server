import bleno from '@abandonware/bleno';
import { UUIDS } from './constants.js';
import { logBle } from '../../utils/logger.js';

export class CommandCharacteristic extends bleno.Characteristic {
  constructor(bleService) {
    super({
      uuid: UUIDS.COMMAND,
      properties: ['write'],
      value: null
    });
    this.bleService = bleService;
  }

  onWriteRequest(data, offset, withoutResponse, callback) {
    if (offset) {
      callback(this.RESULT_ATTR_NOT_LONG);
      return;
    }
    
    const command = data.toString('utf-8');
    logBle(`Received command: ${command}`);
    
    if (command.startsWith('CHANNEL:')) {
      const channelId = command.split(':')[1];
      this.bleService.subscribeToChannel(channelId);
    }
    
    callback(this.RESULT_SUCCESS);
  }
}

