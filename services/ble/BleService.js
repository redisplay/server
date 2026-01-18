import bleno from '@abandonware/bleno';
import { UUIDS } from './constants.js';
import { ViewCharacteristic } from './ViewCharacteristic.js';
import { CommandCharacteristic } from './CommandCharacteristic.js';
import { BleResponseAdapter } from './BleResponseAdapter.js';
import { channelManager } from '../channelManager.js';
import { logBle, logError } from '../../utils/logger.js';

export class BleService {
  constructor(viewManager) {
    this.viewManager = viewManager;
    this.viewCharacteristic = new ViewCharacteristic();
    this.commandCharacteristic = new CommandCharacteristic(this);
    this.currentChannel = null;
    this.adapter = null;
    
    this.init();
  }
  
  init() {
    bleno.on('stateChange', (state) => {
      logBle(`BLE Adapter state: ${state}`);
      if (state === 'poweredOn') {
        bleno.startAdvertising('Kiosk Server', [UUIDS.SERVICE]);
      } else {
        bleno.stopAdvertising();
      }
    });

    bleno.on('advertisingStart', (error) => {
      if (!error) {
        bleno.setServices([
          new bleno.PrimaryService({
            uuid: UUIDS.SERVICE,
            characteristics: [
              this.viewCharacteristic,
              this.commandCharacteristic
            ]
          })
        ]);
        logBle('BLE Service started and advertising');
      } else {
        logError('BLE Advertising error:', error);
      }
    });
    
    // Start with default channel
    this.subscribeToChannel('test');
  }
  
  async subscribeToChannel(channelId) {
    if (this.currentChannel === channelId && this.adapter && !this.adapter.destroyed) return;
    
    logBle(`Switching to channel: ${channelId}`);
    
    // Unsubscribe previous adapter
    if (this.adapter) {
      this.adapter.destroy();
      this.adapter = null;
    }
    
    this.currentChannel = channelId;
    
    // Create new adapter
    this.adapter = new BleResponseAdapter(this.viewCharacteristic);
    
    // Initial View (Mock the SSE initial send)
    const currentView = this.viewManager.getCurrentView(channelId);
    if (currentView) {
      this.viewCharacteristic.sendViewUpdate({
        type: 'initial_view',
        view: currentView
      });
    }
    
    // Subscribe to updates
    // We use a fake client ID and IP for BLE
    const clientId = 'BLE-SERVER';
    const ip = 'BLE';
    
    await channelManager.subscribeClient(channelId, this.adapter, clientId, ip);
  }
}

