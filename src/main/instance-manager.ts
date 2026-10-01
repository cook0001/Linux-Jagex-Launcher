import type { BrowserWindow } from 'electron';
import fs from 'fs';

export interface ClientInstance {
  id: string;
  pid: number;
  game: 'rs3' | 'osrs';
  clientType: 'runelite' | 'hdos' | 'official' | 'rs3';
  characterName: string;
  characterId?: string;
  accountId?: string;
  startTime: number;
}

export function isGamePid(pid: number): boolean {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
  } catch {
    return false;
  }

  if (process.platform === 'linux') {
    try {
      const commPath = `/proc/${pid}/comm`;
      if (fs.existsSync(commPath)) {
        const comm = fs.readFileSync(commPath, 'utf8').trim().toLowerCase();
        return (
          comm.includes('rs2client') ||
          comm.includes('runescape') ||
          comm.includes('java') ||
          comm.includes('runelite') ||
          comm.includes('hdos') ||
          comm.includes('steam')
        );
      }
    } catch {
      // In sandboxes where /proc may be restricted, allow true
    }
  }
  return true;
}

export class InstanceManager {
  private instances: Map<string, ClientInstance> = new Map();
  private monitorTimer: NodeJS.Timeout | null = null;
  private mainWindow: BrowserWindow | null = null;
  private idCounter = 0;

  public setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  public registerInstance(data: Omit<ClientInstance, 'id' | 'startTime'>): ClientInstance {
    const id = `inst-${++this.idCounter}-${Date.now()}`;
    const instance: ClientInstance = {
      ...data,
      id,
      startTime: Date.now()
    };

    this.instances.set(id, instance);
    this.startHeartbeat();
    this.broadcastChanged();
    console.log(`[InstanceManager] Registered client instance ${id} (${instance.game.toUpperCase()} - ${instance.characterName}, PID ${instance.pid}).`);
    return instance;
  }

  public updateInstancePid(id: string, newPid: number): void {
    const inst = this.instances.get(id);
    if (inst) {
      console.log(`[InstanceManager] Updating instance ${id} PID from ${inst.pid} to ${newPid}.`);
      inst.pid = newPid;
      this.broadcastChanged();
    }
  }

  public removeInstance(id: string): boolean {
    const existed = this.instances.delete(id);
    if (existed) {
      this.broadcastChanged();
      if (this.instances.size === 0) {
        this.stopHeartbeat();
      }
    }
    return existed;
  }

  public getInstances(): ClientInstance[] {
    return Array.from(this.instances.values());
  }

  public getInstancesForGame(game: 'rs3' | 'osrs'): ClientInstance[] {
    return this.getInstances().filter((i) => i.game === game);
  }

  public getInstanceById(id: string): ClientInstance | undefined {
    return this.instances.get(id);
  }

  public terminateInstance(id: string): boolean {
    const inst = this.instances.get(id);
    if (!inst) return false;

    console.log(`[InstanceManager] Terminating instance ${id} (PID ${inst.pid})...`);
    if (inst.pid && inst.pid > 0) {
      try {
        // Send SIGTERM first for clean shutdown
        process.kill(inst.pid, 'SIGTERM');

        // Schedule SIGKILL after 1.5s only if still alive and PID has not been recycled
        setTimeout(() => {
          try {
            if (isGamePid(inst.pid)) {
              process.kill(inst.pid, 'SIGKILL');
            }
          } catch {}
        }, 1500);
      } catch (err: any) {
        if (err.code !== 'ESRCH') {
          console.warn(`[InstanceManager] Error signaling PID ${inst.pid}:`, err);
        }
      }
    }

    this.instances.delete(id);
    this.broadcastChanged();
    if (this.instances.size === 0) {
      this.stopHeartbeat();
    }
    return true;
  }

  public terminateAll(game?: 'rs3' | 'osrs'): void {
    const targets = game ? this.getInstancesForGame(game) : this.getInstances();
    for (const inst of targets) {
      this.terminateInstance(inst.id);
    }
  }

  private startHeartbeat(): void {
    if (this.monitorTimer) return;

    this.monitorTimer = setInterval(() => {
      let changed = false;
      for (const [id, inst] of this.instances) {
        if (!inst.pid || inst.pid <= 0) {
          console.log(`[InstanceManager] Instance ${id} has invalid PID (${inst.pid}). Removing.`);
          this.instances.delete(id);
          changed = true;
          continue;
        }

        try {
          process.kill(inst.pid, 0);

          if (process.platform === 'linux') {
            const commPath = `/proc/${inst.pid}/comm`;
            if (fs.existsSync(commPath)) {
              const comm = fs.readFileSync(commPath, 'utf8').trim().toLowerCase();
              const isMatch = comm.includes('rs2client') || comm.includes('runescape') || comm.includes('java') || comm.includes('runelite') || comm.includes('hdos') || comm.includes('steam');
              if (!isMatch) {
                console.log(`[InstanceManager] PID ${inst.pid} for instance ${id} was recycled by ${comm}. Marking exited.`);
                this.instances.delete(id);
                changed = true;
                continue;
              }
            }
          }
        } catch (err: any) {
          if (err.code === 'ESRCH') {
            console.log(`[InstanceManager] Client PID ${inst.pid} for instance ${id} exited.`);
            this.instances.delete(id);
            changed = true;
          }
        }
      }

      if (changed) {
        this.broadcastChanged();
      }

      if (this.instances.size === 0) {
        this.stopHeartbeat();
      }
    }, 1500);
  }

  private stopHeartbeat(): void {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }
  }

  private broadcastChanged(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      try {
        const instances = this.getInstances();
        this.mainWindow.webContents.send('instances:changed', instances);
      } catch {}
    }
  }
}

export const instanceManager = new InstanceManager();
