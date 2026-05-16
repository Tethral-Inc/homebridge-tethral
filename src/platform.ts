import type { API, Characteristic, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig, Service } from 'homebridge';

import { TethralAccessory } from './platformAccessory.js';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
import { TethralClient, type TethralRoutine } from './tethralClient.js';

interface TethralPlatformConfig extends PlatformConfig {
  apiToken?: string;
  apiBaseUrl?: string;
  pollIntervalSeconds?: number;
  executeTimeoutMs?: number;
}

interface RoutineContext {
  routine: TethralRoutine;
}

const DEFAULT_BASE_URL = 'https://api.tethral.ai';
const DEFAULT_POLL_SECONDS = 300;
const DEFAULT_EXECUTE_TIMEOUT_MS = 5_000;
const MIN_POLL_SECONDS = 60;

export class TethralPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  public readonly accessories: Map<string, PlatformAccessory<RoutineContext>> = new Map();
  public readonly client: TethralClient | null;

  private readonly pollIntervalMs: number;
  private pollTimer: NodeJS.Timeout | null = null;

  constructor(
    public readonly log: Logging,
    public readonly config: TethralPlatformConfig,
    public readonly api: API,
  ) {
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;

    const apiToken = (this.config.apiToken ?? '').trim();
    const apiBaseUrl = (this.config.apiBaseUrl ?? DEFAULT_BASE_URL).trim();
    const pollSeconds = Math.max(MIN_POLL_SECONDS, this.config.pollIntervalSeconds ?? DEFAULT_POLL_SECONDS);
    this.pollIntervalMs = pollSeconds * 1000;

    if (!apiToken) {
      this.log.error('Tethral plugin is not configured: apiToken is missing. Edit the plugin config and add your Tethral API token.');
      this.client = null;
    } else {
      this.client = new TethralClient({
        baseUrl: apiBaseUrl,
        token: apiToken,
        executeTimeoutMs: this.config.executeTimeoutMs ?? DEFAULT_EXECUTE_TIMEOUT_MS,
      });
      this.log.info(`Tethral platform initialized (base URL: ${apiBaseUrl}, poll every ${pollSeconds}s)`);
    }

    this.api.on('didFinishLaunching', () => {
      if (!this.client) {
        return;
      }
      void this.syncRoutines();
      this.pollTimer = setInterval(() => void this.syncRoutines(), this.pollIntervalMs);
    });

    this.api.on('shutdown', () => {
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
      }
    });
  }

  configureAccessory(accessory: PlatformAccessory): void {
    this.log.debug(`Restoring accessory from cache: ${accessory.displayName}`);
    this.accessories.set(accessory.UUID, accessory as PlatformAccessory<RoutineContext>);
  }

  private uuidFor(routineId: string): string {
    return this.api.hap.uuid.generate(`${PLUGIN_NAME}:routine:${routineId}`);
  }

  private async syncRoutines(): Promise<void> {
    if (!this.client) {
      return;
    }

    let routines: TethralRoutine[];
    try {
      routines = await this.client.listRoutines();
    } catch (err) {
      this.log.warn(`Routine sync failed; keeping cached accessories. ${(err as Error).message}`);
      return;
    }

    const seenUUIDs = new Set<string>();

    for (const routine of routines) {
      const uuid = this.uuidFor(routine.id);
      seenUUIDs.add(uuid);
      const existing = this.accessories.get(uuid);

      if (existing) {
        existing.context.routine = routine;
        if (existing.displayName !== routine.name) {
          existing.displayName = routine.name;
        }
        this.api.updatePlatformAccessories([existing]);
        new TethralAccessory(this, existing);
        this.log.debug(`Refreshed accessory: ${routine.name} (${routine.id})`);
      } else {
        const accessory = new this.api.platformAccessory<RoutineContext>(routine.name, uuid);
        accessory.context.routine = routine;
        new TethralAccessory(this, accessory);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.accessories.set(uuid, accessory);
        this.publishToMatter(accessory);
        this.log.info(`Registered new Tethral routine as Switch: ${routine.name} (${routine.id})`);
      }
    }

    for (const [uuid, accessory] of this.accessories) {
      if (!seenUUIDs.has(uuid)) {
        this.log.info(`Removing stale routine: ${accessory.displayName}`);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.accessories.delete(uuid);
      }
    }
  }

  private publishToMatter(accessory: PlatformAccessory<RoutineContext>): void {
    const matter = (this.api as unknown as { matter?: { switch?: { emit: (a: PlatformAccessory) => void } } }).matter;
    if (!matter?.switch?.emit) {
      return;
    }
    try {
      matter.switch.emit(accessory);
      this.log.debug(`Published to Matter: ${accessory.displayName}`);
    } catch (err) {
      this.log.warn(`Matter publish failed for ${accessory.displayName}: ${(err as Error).message}`);
    }
  }
}
