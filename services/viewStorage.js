import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ViewStorage {
  constructor() {
    this.storageDir = path.join(__dirname, '../data');
    this.viewsPath = path.join(this.storageDir, 'views.json');
  }

  async ensureStorageDir() {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
    } catch (err) {
      // Directory might already exist, ignore
    }
  }

  async loadViews() {
    try {
      await this.ensureStorageDir();
      const data = await fs.readFile(this.viewsPath, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      if (err.code === 'ENOENT') {
        // File doesn't exist, return empty object
        return {};
      }
      console.error('Error loading views:', err);
      return {};
    }
  }

  async saveViews(views) {
    try {
      await this.ensureStorageDir();
      // Convert Map to object for JSON serialization
      const viewsObj = {};
      views.forEach((view, id) => {
        viewsObj[id] = view;
      });
      await fs.writeFile(this.viewsPath, JSON.stringify(viewsObj, null, 2), 'utf-8');
      return true;
    } catch (err) {
      console.error('Error saving views:', err);
      return false;
    }
  }
}

export const viewStorage = new ViewStorage();

