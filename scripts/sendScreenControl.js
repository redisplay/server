import { channelManager } from '../services/channelManager.js';

/**
 * Send screen control event to a channel
 * Usage: node scripts/sendScreenControl.js <channel> <action> [brightness]
 * 
 * Examples:
 *   node scripts/sendScreenControl.js test turn_off
 *   node scripts/sendScreenControl.js test turn_on
 *   node scripts/sendScreenControl.js test dim 50
 */
async function sendScreenControl(channel, action, brightness = null) {
  const message = {
    type: 'screen_control',
    action: action
  };
  
  if (brightness !== null && action === 'dim') {
    message.brightness = parseInt(brightness);
  }
  
  await channelManager.sendToChannel(channel, message);
  console.log(`Sent screen control to channel "${channel}":`, message);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const channel = process.argv[2] || 'test';
  const action = process.argv[3] || 'turn_off';
  const brightness = process.argv[4];
  
  sendScreenControl(channel, action, brightness)
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Error:', err);
      process.exit(1);
    });
}

export { sendScreenControl };

