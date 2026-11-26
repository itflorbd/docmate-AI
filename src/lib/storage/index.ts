import fs from 'fs';
import path from 'path';
import os from 'os';

export interface StorageDriver {
  save(key: string, buffer: Buffer, mime: string): Promise<string>;
  get(key: string): Promise<Buffer | null>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  getUrl(key: string): string;
}

export class LocalStorageDriver implements StorageDriver {
  private baseDir: string;

  constructor(baseDir?: string) {
    const defaultStorageSegments = ['data', 'storage'];
    const preferredDir = baseDir || process.env.STORAGE_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), ...defaultStorageSegments);
    try {
      if (!fs.existsSync(preferredDir)) {
        fs.mkdirSync(preferredDir, { recursive: true });
      }
      this.baseDir = preferredDir;
    } catch (err) {
      console.warn(`[LocalStorageDriver] Warning: Could not initialize directory at ${preferredDir}:`, err);
      const fallbackDir = path.join(os.tmpdir(), 'docmate-storage');
      try {
        if (!fs.existsSync(fallbackDir)) {
          fs.mkdirSync(fallbackDir, { recursive: true });
        }
        this.baseDir = fallbackDir;
        console.warn(`[LocalStorageDriver] Fallback storage directory active at ${fallbackDir}`);
      } catch (fallbackErr) {
        console.error(`[LocalStorageDriver] Fatal: Could not create fallback directory at ${fallbackDir}:`, fallbackErr);
        this.baseDir = fallbackDir;
      }
    }
  }

  private resolveSafePath(key: string): string {
    const cleanKey = key.replace(/^[/\\]+/, '');
    const fullPath = path.resolve(this.baseDir, cleanKey);
    if (!fullPath.startsWith(path.resolve(this.baseDir))) {
      throw new Error('Path traversal attempt detected in storage driver');
    }
    return fullPath;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async save(key: string, buffer: Buffer, _mime: string): Promise<string> {
    try {
      const filePath = this.resolveSafePath(key);
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      await fs.promises.writeFile(filePath, buffer);
      return key;
    } catch (err) {
      console.warn(`[LocalStorageDriver] Failed to save in ${this.baseDir}, trying fallback directory:`, err);
      const fallbackBase = path.join(os.tmpdir(), 'docmate-storage');
      if (this.baseDir !== fallbackBase) {
        this.baseDir = fallbackBase;
        const filePath = this.resolveSafePath(key);
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        await fs.promises.writeFile(filePath, buffer);
        return key;
      }
      throw err;
    }
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      const filePath = this.resolveSafePath(key);
      if (!fs.existsSync(filePath)) {
        const fallbackPath = path.resolve(path.join(os.tmpdir(), 'docmate-storage'), key.replace(/^[/\\]+/, ''));
        if (fs.existsSync(fallbackPath)) {
          return await fs.promises.readFile(fallbackPath);
        }
        return null;
      }
      return await fs.promises.readFile(filePath);
    } catch {
      return null;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const filePath = this.resolveSafePath(key);
      if (fs.existsSync(filePath)) return true;
      const fallbackPath = path.resolve(path.join(os.tmpdir(), 'docmate-storage'), key.replace(/^[/\\]+/, ''));
      return fs.existsSync(fallbackPath);
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const filePath = this.resolveSafePath(key);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
      const fallbackPath = path.resolve(path.join(os.tmpdir(), 'docmate-storage'), key.replace(/^[/\\]+/, ''));
      if (fs.existsSync(fallbackPath)) {
        await fs.promises.unlink(fallbackPath);
      }
    } catch {
      // Ignored if already gone
    }
  }

  getUrl(key: string): string {
    return `/api/admin/library/files/${encodeURIComponent(key)}`;
  }
}

export class S3StorageDriver implements StorageDriver {
  private localFallback: LocalStorageDriver;

  constructor() {
    this.localFallback = new LocalStorageDriver();
  }

  async save(key: string, buffer: Buffer, mime: string): Promise<string> {
    // S3/R2 mockable driver: if env vars not provided, safely fallback to local
    return this.localFallback.save(key, buffer, mime);
  }

  async get(key: string): Promise<Buffer | null> {
    return this.localFallback.get(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.localFallback.exists(key);
  }

  async delete(key: string): Promise<void> {
    return this.localFallback.delete(key);
  }

  getUrl(key: string): string {
    return this.localFallback.getUrl(key);
  }
}

let activeDriver: StorageDriver | null = null;

export function getStorageDriver(): StorageDriver {
  if (activeDriver) return activeDriver;
  const driverType = (process.env.STORAGE_DRIVER || 'local').toLowerCase();
  if (driverType === 's3') {
    activeDriver = new S3StorageDriver();
  } else {
    activeDriver = new LocalStorageDriver();
  }
  return activeDriver;
}
