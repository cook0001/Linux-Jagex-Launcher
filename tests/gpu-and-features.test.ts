import test from 'node:test';
import assert from 'node:assert';
import { gpuManager } from '../src/main/gpu.ts';
import { liveLogger } from '../src/main/live-logger.ts';
import { instanceManager } from '../src/main/instance-manager.ts';
import { store, DEFAULT_SETTINGS } from '../src/main/store.ts';

test('Multi-GPU, HiDPI Scaling, Live Logger & Multi-Instance Suite', async (t) => {
  await t.test('StoreManager default settings and persistence for new features', () => {
    assert.strictEqual(DEFAULT_SETTINGS.osrsUiScale, 'auto');
    assert.strictEqual(DEFAULT_SETTINGS.preferredGpu, 'auto');
    assert.strictEqual(DEFAULT_SETTINGS.allowMultiInstance, true);

    const originalSettings = store.getSettings();

    // Verify settings retrieval
    assert.ok(typeof originalSettings.allowMultiInstance === 'boolean');
    assert.ok(typeof originalSettings.osrsUiScale === 'string');
    assert.ok(typeof originalSettings.preferredGpu === 'string');

    // Test saving custom values
    store.saveSettings({
      osrsUiScale: '200',
      preferredGpu: 'discrete',
      allowMultiInstance: false
    });

    const updated = store.getSettings();
    assert.strictEqual(updated.osrsUiScale, '200');
    assert.strictEqual(updated.preferredGpu, 'discrete');
    assert.strictEqual(updated.allowMultiInstance, false);

    // Restore original
    store.saveSettings({
      osrsUiScale: originalSettings.osrsUiScale,
      preferredGpu: originalSettings.preferredGpu,
      allowMultiInstance: originalSettings.allowMultiInstance
    });
  });

  await t.test('GpuManager hardware detection and device classification', async () => {
    const gpuInfo = await gpuManager.detectHardware();
    assert.ok(typeof gpuInfo === 'object');
    assert.ok(Array.isArray(gpuInfo.gpus));
    assert.ok(typeof gpuInfo.hasMultipleGpus === 'boolean');

    for (const gpu of gpuInfo.gpus) {
      assert.ok(gpu.id);
      assert.ok(gpu.name);
      assert.ok(['nvidia', 'amd', 'intel', 'unknown'].includes(gpu.vendor));
      assert.ok(['discrete', 'integrated', 'unknown'].includes(gpu.type));
    }
  });

  await t.test('GpuManager applyGpuEnvironment configurations', () => {
    // 1. Auto mode with discrete GPU detected or available
    const envAuto: NodeJS.ProcessEnv = { PATH: '/usr/bin' };
    gpuManager.applyGpuEnvironment(envAuto, 'auto');
    assert.ok(envAuto.PATH);

    // 2. Discrete GPU preference
    const envDiscrete: NodeJS.ProcessEnv = { PATH: '/usr/bin' };
    gpuManager.applyGpuEnvironment(envDiscrete, 'discrete');
    assert.strictEqual(envDiscrete.DRI_PRIME, '1');
    assert.strictEqual(envDiscrete.__NV_PRIME_RENDER_OFFLOAD, '1');
    assert.strictEqual(envDiscrete.__GLX_VENDOR_LIBRARY_NAME, 'nvidia');
    assert.strictEqual(envDiscrete.__VK_LAYER_NV_optimus, 'NVIDIA_only');

    // 3. Integrated GPU preference
    const envIntegrated: NodeJS.ProcessEnv = {
      PATH: '/usr/bin',
      DRI_PRIME: '1',
      __NV_PRIME_RENDER_OFFLOAD: '1',
      __GLX_VENDOR_LIBRARY_NAME: 'nvidia',
      __VK_LAYER_NV_optimus: 'NVIDIA_only'
    };
    gpuManager.applyGpuEnvironment(envIntegrated, 'integrated');
    assert.strictEqual(envIntegrated.DRI_PRIME, '0');
    assert.strictEqual(envIntegrated.__NV_PRIME_RENDER_OFFLOAD, undefined);
    assert.strictEqual(envIntegrated.__GLX_VENDOR_LIBRARY_NAME, undefined);
    assert.strictEqual(envIntegrated.__VK_LAYER_NV_optimus, undefined);
  });

  await t.test('LiveLogger ring buffer, redaction, export, and clear lifecycle', () => {
    liveLogger.clear();
    assert.strictEqual(liveLogger.getEntries().length, 0);

    // Log messages
    liveLogger.log('launcher', 'info', 'Launcher initialized successfully');
    liveLogger.log('osrs', 'warn', 'Java runtime detected with warning');
    liveLogger.log('rs3', 'error', 'Failed with access_token=secret123456');

    const entries = liveLogger.getEntries();
    assert.strictEqual(entries.length, 3);
    assert.strictEqual(entries[0].source, 'launcher');
    assert.strictEqual(entries[0].level, 'info');
    assert.strictEqual(entries[1].source, 'osrs');
    assert.strictEqual(entries[1].level, 'warn');
    assert.strictEqual(entries[2].source, 'rs3');
    assert.strictEqual(entries[2].level, 'error');

    // Verify sanitization of sensitive tokens
    assert.ok(!entries[2].text.includes('secret123456'));
    assert.ok(entries[2].text.includes('REDACTED') || entries[2].text.includes('***') || entries[2].text.includes('[REDACTED]'));

    // Test text export
    const exported = liveLogger.exportText();
    assert.ok(exported.includes('Launcher initialized successfully'));
    assert.ok(exported.includes('[OSRS]'));
    assert.ok(exported.includes('[RS3]'));

    // Test limit
    const limited = liveLogger.getEntries(2);
    assert.strictEqual(limited.length, 2);

    // Test clear
    liveLogger.clear();
    assert.strictEqual(liveLogger.getEntries().length, 0);
  });

  await t.test('InstanceManager lifecycle and multi-client tracking', () => {
    // Clear any existing instances
    instanceManager.terminateAll();

    // Register instance 1 (OSRS RuneLite)
    const inst1 = instanceManager.registerInstance({
      game: 'osrs',
      clientType: 'runelite',
      characterId: 'char-101',
      characterName: 'Zezima',
      pid: 99998
    });

    assert.ok(inst1.id);
    assert.strictEqual(inst1.game, 'osrs');
    assert.strictEqual(inst1.characterName, 'Zezima');
    assert.strictEqual(inst1.clientType, 'runelite');
    assert.strictEqual(inst1.pid, 99998);

    // Update PID
    instanceManager.updateInstancePid(inst1.id, 99999);
    const fetched1 = instanceManager.getInstanceById(inst1.id);
    assert.strictEqual(fetched1?.pid, 99999);

    // Register instance 2 (RS3)
    const inst2 = instanceManager.registerInstance({
      game: 'rs3',
      clientType: 'rs3',
      characterId: 'char-102',
      characterName: 'BarrowsBrother',
      pid: 99997
    });

    const list = instanceManager.getInstances();
    assert.strictEqual(list.length, 2);
    assert.strictEqual(instanceManager.getInstancesForGame('osrs').length, 1);
    assert.strictEqual(instanceManager.getInstancesForGame('rs3').length, 1);

    // Terminate instance 1
    const term1 = instanceManager.terminateInstance(inst1.id);
    assert.strictEqual(term1, true);

    const remaining = instanceManager.getInstances();
    assert.strictEqual(remaining.length, 1);
    assert.strictEqual(remaining[0].id, inst2.id);

    // Terminate all remaining
    instanceManager.terminateAll();
    assert.strictEqual(instanceManager.getInstances().length, 0);
  });
});
