import type { BrowserWindow } from 'electron';
import fs from 'fs';
import { sanitizeReportText } from './launcher.ts';

export type LogSource = 'osrs' | 'rs3' | 'launcher' | 'system';
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  id: string;
  timestamp: number;
  source: LogSource;
  level: LogLevel;
  text: string;
}

export class LiveLogger {
  private buffer: LogEntry[] = [];
  private maxEntries: number = 2000;
  private idCounter: number = 0;
  private mainWindow: BrowserWindow | null = null;
  private watchedFiles: Map<string, { watcher: fs.FSWatcher; offset: number }> = new Map();

  public setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  public log(source: LogSource, level: LogLevel, text: string): LogEntry {
    const sanitized = sanitizeReportText(text).trim();
    if (!sanitized) {
      return {
        id: `log-${++this.idCounter}`,
        timestamp: Date.now(),
        source,
        level,
        text: ''
      };
    }

    const effectiveLevel = this.classifyStderrLevel(level, sanitized);

    const entry: LogEntry = {
      id: `log-${++this.idCounter}-${Date.now()}`,
      timestamp: Date.now(),
      source,
      level: effectiveLevel,
      text: sanitized
    };

    this.buffer.push(entry);
    if (this.buffer.length > this.maxEntries) {
      this.buffer.shift();
    }

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      try {
        this.mainWindow.webContents.send('logger:entry', entry);
      } catch {}
    }

    return entry;
  }

  public getEntries(limit?: number): LogEntry[] {
    if (!limit || limit >= this.buffer.length) {
      return [...this.buffer];
    }
    return this.buffer.slice(this.buffer.length - limit);
  }

  public clear(): void {
    this.buffer = [];
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      try {
        this.mainWindow.webContents.send('logger:cleared');
      } catch {}
    }
  }

  public exportText(): string {
    return this.buffer
      .map((entry) => {
        const time = new Date(entry.timestamp).toISOString().split('T')[1].replace('Z', '');
        return `[${time}] [${entry.source.toUpperCase()}] [${entry.level.toUpperCase()}]: ${entry.text}`;
      })
      .join('\n');
  }

  public classifyStderrLevel(level: LogLevel, line: string): LogLevel {
    if (level === 'error') {
      const lower = line.toLowerCase();
      if (
        lower.startsWith('warning:') ||
        lower.includes('warning:') ||
        lower.includes('gamemodeauto') ||
        lower.includes('gamemode:') ||
        lower.includes('[lwjgl]') ||
        lower.includes('unsupported jni version') ||
        lower.includes('gtk-message:') ||
        lower.includes('canberra-gtk-module') ||
        lower.includes('pk-gtk-module') ||
        lower.includes('fontconfig warning:') ||
        lower.includes('alsa lib confmisc.c') ||
        lower.includes('alsa lib pcm.c')
      ) {
        return 'warn';
      }
    }
    return level;
  }

  public tailFile(filePath: string, source: LogSource, level: LogLevel = 'info'): void {
    if (this.watchedFiles.has(filePath)) return;

    try {
      const initialSize = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
      let offset = initialSize;

      // Read last few KB of recent logs if file already exists
      if (initialSize > 0) {
        try {
          const tailBytes = Math.min(initialSize, 16384);
          const fd = fs.openSync(filePath, 'r');
          let initialText = '';
          try {
            const buf = Buffer.alloc(tailBytes);
            fs.readSync(fd, buf, 0, tailBytes, initialSize - tailBytes);
            initialText = buf.toString('utf8');
          } finally {
            fs.closeSync(fd);
          }

          for (const line of initialText.split('\n')) {
            if (line.trim()) {
              const effectiveLevel = this.classifyStderrLevel(level, line);
              this.log(source, effectiveLevel, line);
            }
          }
        } catch {}
      }

      const watcher = fs.watch(filePath, (eventType) => {
        if (eventType === 'change' && fs.existsSync(filePath)) {
          try {
            const stat = fs.statSync(filePath);
            if (stat.size < offset) {
              offset = 0; // File truncated/rotated
            }
            if (stat.size > offset) {
              const diff = stat.size - offset;
              const fd = fs.openSync(filePath, 'r');
              let content = '';
              try {
                const buf = Buffer.alloc(diff);
                fs.readSync(fd, buf, 0, diff, offset);
                content = buf.toString('utf8');
              } finally {
                fs.closeSync(fd);
              }
              offset = stat.size;

              for (const line of content.split('\n')) {
                if (line.trim()) {
                  const effectiveLevel = this.classifyStderrLevel(level, line);
                  this.log(source, effectiveLevel, line);
                }
              }
            }
          } catch {}
        }
      });

      this.watchedFiles.set(filePath, { watcher, offset });
    } catch {
      // Non-fatal if log file does not exist yet
    }
  }

  public stopWatchingAll(): void {
    for (const [_, item] of this.watchedFiles) {
      try {
        item.watcher.close();
      } catch {}
    }
    this.watchedFiles.clear();
  }
}

export const liveLogger = new LiveLogger();
