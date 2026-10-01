import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

export type GpuVendor = 'nvidia' | 'amd' | 'intel' | 'unknown';
export type GpuType = 'discrete' | 'integrated' | 'unknown';

export interface GpuDevice {
  id: string;
  name: string;
  vendor: GpuVendor;
  type: GpuType;
  pciSlot?: string;
  vendorId?: string;
  deviceId?: string;
}

export interface GpuHardwareInfo {
  hasMultipleGpus: boolean;
  gpus: GpuDevice[];
  recommendedGpu?: string;
}

let cachedGpuInfo: GpuHardwareInfo | null = null;

export function classifyGpuVendor(vendorIdStr: string): GpuVendor {
  const norm = vendorIdStr.toLowerCase().replace(/^0x/, '');
  if (norm === '10de') return 'nvidia';
  if (norm === '1002') return 'amd';
  if (norm === '8086') return 'intel';
  return 'unknown';
}

export function classifyGpuType(vendor: GpuVendor, deviceName: string): GpuType {
  const lower = deviceName.toLowerCase();
  if (vendor === 'nvidia') {
    // Virtually all NVIDIA desktop/laptop GPUs on x86_64 are discrete
    return 'discrete';
  }
  if (vendor === 'intel') {
    // Intel Arc series (Alchemist/Battlemage) are discrete
    if (lower.includes('arc') || lower.includes('dg1') || lower.includes('dg2') || lower.includes('a770') || lower.includes('a750') || lower.includes('a580') || lower.includes('a380') || lower.includes('b580')) {
      return 'discrete';
    }
    return 'integrated';
  }
  if (vendor === 'amd') {
    // Detect integrated APUs vs discrete Radeon cards
    if (lower.includes('radeon graphics') || lower.includes('cezanne') || lower.includes('renoir') || lower.includes('barcelo') || lower.includes('phoenix') || lower.includes('raphael') || lower.includes('lucienne')) {
      return 'integrated';
    }
    return 'discrete';
  }
  return 'unknown';
}

export class GpuManager {
  public detectHardware(): GpuHardwareInfo {
    if (cachedGpuInfo) {
      return cachedGpuInfo;
    }

    const gpus: GpuDevice[] = [];

    // Strategy 1: Query lspci for high-fidelity device names
    try {
      const lspciCheck = spawnSync('which', ['lspci'], { stdio: 'ignore' });
      if (lspciCheck.status === 0) {
        const res = spawnSync('lspci', ['-nn', '-D'], { encoding: 'utf8', timeout: 3000 });
        if (res.status === 0 && res.stdout) {
          const lines = res.stdout.split('\n');
          for (const line of lines) {
            // Match lines like: 0000:02:00.0 VGA compatible controller [0300]: Advanced Micro Devices, Inc. ... [1002:679e]
            if (/(?:VGA compatible controller|3D controller|Display controller)/i.test(line)) {
              const slotMatch = line.match(/^([0-9a-fA-F:.]+)\s+/);
              const pciSlot = slotMatch ? slotMatch[1] : undefined;

              const idsMatch = line.match(/\[([0-9a-fA-F]{4}):([0-9a-fA-F]{4})\]/);
              const vendorId = idsMatch ? idsMatch[1] : '';
              const deviceId = idsMatch ? idsMatch[2] : '';

              // Extract device name between controller type and PCI IDs
              let name = line;
              const typeIdx = line.indexOf(': ');
              if (typeIdx !== -1) {
                name = line.substring(typeIdx + 2);
                const bracketIdx = name.lastIndexOf(' [');
                if (bracketIdx !== -1) {
                  name = name.substring(0, bracketIdx);
                }
              }

              // Clean up common prefix noise like "Advanced Micro Devices, Inc. [AMD/ATI]"
              name = name
                .replace(/^Advanced Micro Devices,\s*Inc\.\s*(\[AMD\/ATI\])?\s*/i, 'AMD ')
                .replace(/^NVIDIA Corporation\s*/i, 'NVIDIA ')
                .replace(/^Intel Corporation\s*/i, 'Intel ')
                .trim();

              const vendor = classifyGpuVendor(vendorId);
              const type = classifyGpuType(vendor, name);

              gpus.push({
                id: pciSlot || `gpu-${gpus.length}`,
                name: name || `GPU (${vendor.toUpperCase()})`,
                vendor,
                type,
                pciSlot,
                vendorId,
                deviceId
              });
            }
          }
        }
      }
    } catch {
      // Non-fatal, fallback to /sys/class/drm
    }

    // Strategy 2: If lspci found nothing, inspect /sys/class/drm/
    if (gpus.length === 0 && process.platform === 'linux' && fs.existsSync('/sys/class/drm')) {
      try {
        const drmEntries = fs.readdirSync('/sys/class/drm');
        const cardDirs = drmEntries.filter((e) => /^card\d+$/.test(e));

        for (const card of cardDirs) {
          const vendorPath = path.join('/sys/class/drm', card, 'device', 'vendor');
          const devicePath = path.join('/sys/class/drm', card, 'device', 'device');

          if (fs.existsSync(vendorPath)) {
            const rawVendor = fs.readFileSync(vendorPath, 'utf8').trim();
            const rawDevice = fs.existsSync(devicePath) ? fs.readFileSync(devicePath, 'utf8').trim() : '';

            const vendor = classifyGpuVendor(rawVendor);
            const vendorName = vendor === 'nvidia' ? 'NVIDIA' : (vendor === 'amd' ? 'AMD Radeon' : (vendor === 'intel' ? 'Intel HD / Iris' : 'Unknown'));
            const type = classifyGpuType(vendor, vendorName);

            gpus.push({
              id: card,
              name: `${vendorName} (${card})`,
              vendor,
              type,
              vendorId: rawVendor,
              deviceId: rawDevice
            });
          }
        }
      } catch {
        // Fallback
      }
    }

    // Deduplicate identical PCI slots if any
    const uniqueGpus = gpus.filter((gpu, index, self) =>
      index === self.findIndex((g) => g.id === gpu.id)
    );

    const hasMultipleGpus = uniqueGpus.length > 1;
    const recommended = uniqueGpus.find((g) => g.type === 'discrete') || uniqueGpus[0];

    cachedGpuInfo = {
      hasMultipleGpus,
      gpus: uniqueGpus,
      recommendedGpu: recommended ? recommended.name : undefined
    };

    return cachedGpuInfo;
  }

  public applyGpuEnvironment(
    env: NodeJS.ProcessEnv,
    preference: 'auto' | 'discrete' | 'integrated' = 'auto'
  ): void {
    if (preference === 'discrete') {
      // DRI PRIME offload (standard across Mesa AMD, Intel, and hybrid laptops)
      env.DRI_PRIME = '1';

      // NVIDIA PRIME Render Offload variables
      env.__NV_PRIME_RENDER_OFFLOAD = '1';
      env.__GLX_VENDOR_LIBRARY_NAME = 'nvidia';
      env.__VK_LAYER_NV_optimus = 'NVIDIA_only';
      console.log('[GPU] Applied Dedicated / Discrete GPU environment (DRI_PRIME=1, __NV_PRIME_RENDER_OFFLOAD=1).');
    } else if (preference === 'integrated') {
      // Force primary integrated GPU / iGPU
      env.DRI_PRIME = '0';
      delete env.__NV_PRIME_RENDER_OFFLOAD;
      delete env.__GLX_VENDOR_LIBRARY_NAME;
      delete env.__VK_LAYER_NV_optimus;
      console.log('[GPU] Applied Integrated GPU environment (DRI_PRIME=0, stripped PRIME offload).');
    } else {
      // 'auto' - do not override system defaults unless user explicitly opted into discrete/integrated
    }
  }

  public clearCache(): void {
    cachedGpuInfo = null;
  }
}

export const gpuManager = new GpuManager();
