import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ChannelConfig {
  constructor() {
    this.config = null;
    this.configDir = path.join(__dirname, '../config');
    this.configPath = path.join(this.configDir, 'channels.json');
  }

  async ensureConfigDir() {
    try {
      await fs.mkdir(this.configDir, { recursive: true });
    } catch (err) {
      // Directory might already exist, ignore
    }
  }

  async load() {
    try {
      await this.ensureConfigDir();
      const data = await fs.readFile(this.configPath, 'utf-8');
      this.config = JSON.parse(data);
      return this.config;
    } catch (err) {
      if (err.code === 'ENOENT') {
        // File doesn't exist, create default
        this.config = { channels: {} };
        await this.save();
        return this.config;
      }
      console.error('Error loading channel config:', err);
      return null;
    }
  }

  async save() {
    try {
      await this.ensureConfigDir();
      await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
      return true;
    } catch (err) {
      console.error('Error saving channel config:', err);
      return false;
    }
  }

  getChannelViews(channel) {
    if (!this.config || !this.config.channels || !this.config.channels[channel]) {
      return [];
    }
    return this.config.channels[channel].views || [];
  }

  getChannelRotation(channel) {
    if (!this.config || !this.config.channels || !this.config.channels[channel]) {
      return { enabled: false, delay: 30000 };
    }
    return this.config.channels[channel].rotation || { enabled: false, delay: 30000 };
  }

  getAllChannels() {
    if (!this.config || !this.config.channels) {
      return [];
    }
    return Object.keys(this.config.channels);
  }

  getChannelConfig(channel) {
    if (!this.config || !this.config.channels || !this.config.channels[channel]) {
      return null;
    }
    return { ...this.config.channels[channel] };
  }

  setChannelViews(channel, views) {
    if (!this.config) {
      this.config = { channels: {} };
    }
    if (!this.config.channels) {
      this.config.channels = {};
    }
    if (!this.config.channels[channel]) {
      this.config.channels[channel] = { views: [], rotation: { enabled: false, delay: 30000 } };
    }
    this.config.channels[channel].views = views;
  }

  setChannelRotation(channel, rotation) {
    if (!this.config) {
      this.config = { channels: {} };
    }
    if (!this.config.channels) {
      this.config.channels = {};
    }
    if (!this.config.channels[channel]) {
      this.config.channels[channel] = { views: [], rotation: { enabled: false, delay: 30000 } };
    }
    this.config.channels[channel].rotation = { ...this.config.channels[channel].rotation, ...rotation };
  }
}

export const channelConfig = new ChannelConfig();

