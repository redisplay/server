import Redis from 'ioredis';

let publisher = null;
let subscriber = null;
const channelCallbacks = new Map(); // channel -> Set of callbacks

export async function initializeRedis() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  
  publisher = new Redis(redisUrl);
  subscriber = new Redis(redisUrl);

  publisher.on('error', (err) => {
    console.error('Redis Publisher error:', err);
  });

  subscriber.on('error', (err) => {
    console.error('Redis Subscriber error:', err);
  });

  // Handle all messages from subscribed channels
  subscriber.on('message', (ch, msg) => {
    const callbacks = channelCallbacks.get(ch);
    if (callbacks) {
      const message = JSON.parse(msg);
      callbacks.forEach(callback => callback(message));
    }
  });

  console.log('Redis connected');
}

export function getPublisher() {
  return publisher;
}

export function getSubscriber() {
  return subscriber;
}

export async function publish(channel, message) {
  if (!publisher) {
    throw new Error('Redis not initialized');
  }
  await publisher.publish(channel, JSON.stringify(message));
}

export async function subscribe(channel, callback) {
  if (!subscriber) {
    throw new Error('Redis not initialized');
  }
  
  if (!channelCallbacks.has(channel)) {
    channelCallbacks.set(channel, new Set());
    await subscriber.subscribe(channel);
  }
  
  channelCallbacks.get(channel).add(callback);
}

export async function unsubscribe(channel, callback) {
  const callbacks = channelCallbacks.get(channel);
  if (callbacks) {
    callbacks.delete(callback);
    if (callbacks.size === 0) {
      channelCallbacks.delete(channel);
      await subscriber.unsubscribe(channel);
    }
  }
}

