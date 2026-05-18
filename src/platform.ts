import type { API, Characteristic, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig, Service } from 'homebridge';
import { Categories } from 'homebridge';

import { TethralAccessory, type RoutineContext } from './platformAccessory.js';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
import { TethralClient, type TethralRoutine } from './tethralClient.js';
import { WebhookAccessory, type WebhookContext } from './webhookAccessory.js';
import { validateWebhook, type WebhookConfig } from './webhookClient.js';

interface TethralPlatformConfig extends PlatformConfig {
  apiToken?: string;
  apiBaseUrl?: string;
  pollIntervalSeconds?: number;
  executeTimeoutMs?: number;
  webhooks?: Array<Partial<WebhookConfig>>;
}

export interface RoutineDiff {
  create: TethralRoutine[];
  update: Array<{ uuid: string; routine: TethralRoutine }>;
  remove: Array<{ uuid: string; accessory: PlatformAccessory<RoutineContext> }>;
}

export interface WebhookDiff {
  create: WebhookConfig[];
  update: Array<{ uuid: string; config: WebhookConfig }>;
  remove: Array<{ uuid: string; accessory: PlatformAccessory<WebhookContext> }>;
}

const DEFAULT_BASE_URL = 'https://api.tethral.ai';
const DEFAULT_POLL_SECONDS = 300;
const DEFAULT_EXECUTE_TIMEOUT_MS = 5_000;
const MIN_POLL_SECONDS = 60;

export function diffRoutines(
  current: Map<string, PlatformAccessory<RoutineContext>>,
  incoming: TethralRoutine[],
  uuidFor: (routineId: string) => string,
): RoutineDiff {
  const seen = new Set<string>();
  const create: TethralRoutine[] = [];
  const update: RoutineDiff['update'] = [];
  for (const routine of incoming) {
    const uuid = uuidFor(routine.id);
    seen.add(uuid);
    if (current.has(uuid)) {
      update.push({ uuid, routine });
    } else {
      create.push(routine);
    }
  }
  const remove: RoutineDiff['remove'] = [];
  for (const [uuid, accessory] of current) {
    if (!seen.has(uuid)) {
      remove.push({ uuid, accessory });
    }
  }
  return { create, update, remove };
}

export function diffWebhooks(
  current: Map<string, PlatformAccessory<WebhookContext>>,
  incoming: WebhookConfig[],
  uuidFor: (webhookName: string) => string,
): WebhookDiff {
  const seen = new Set<string>();
  const create: WebhookConfig[] = [];
  const update: WebhookDiff['update'] = [];
  for (const config of incoming) {
    const uuid = uuidFor(config.name);
    seen.add(uuid);
    if (current.has(uuid)) {
      update.push({ uuid, config });
    } else {
      create.push(config);
    }
  }
  const remove: WebhookDiff['remove'] = [];
  for (const [uuid, accessory] of current) {
    if (!seen.has(uuid)) {
      remove.push({ uuid, accessory });
    }
  }
  return { create, update, remove };
}

export class TethralPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  public readonly accessories: Map<string, PlatformAccessory<RoutineContext>> = new Map();
  public readonly webhookAccessories: Map<string, PlatformAccessory<WebhookContext>> = new Map();
  public readonly client: TethralClient | null;

  private readonly wrappers: Map<string, TethralAccessory> = new Map();
  private readonly webhookWrappers: Map<string, WebhookAccessory> = new Map();
  private readonly matterPublished: Set<string> = new Set();
  private readonly webhooks: WebhookConfig[];
  private readonly pollIntervalMs: number;
  private readonly shutdownController = new AbortController();
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

    this.webhooks = this.parseWebhooks(this.config.webhooks);
    if (this.webhooks.length > 0) {
      this.log.info(`Loaded ${this.webhooks.length} custom webhook switch(es)`);
    }

    this.api.on('didFinishLaunching', () => {
      for (const accessory of this.accessories.values()) {
        this.publishToMatter(accessory);
      }
      for (const accessory of this.webhookAccessories.values()) {
        this.publishToMatter(accessory as unknown as PlatformAccessory<RoutineContext>);
      }
      this.syncWebhooks();
      if (!this.client) {
        return;
      }
      void this.syncRoutines();
      this.pollTimer = setInterval(() => void this.syncRoutines(), this.pollIntervalMs);
    });

    this.api.on('shutdown', () => {
      this.shutdownController.abort();
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
      for (const wrapper of this.wrappers.values()) {
        wrapper.dispose();
      }
      for (const wrapper of this.webhookWrappers.values()) {
        wrapper.dispose();
      }
    });
  }

  configureAccessory(accessory: PlatformAccessory): void {
    const ctx = accessory.context as Partial<RoutineContext & WebhookContext>;
    if (ctx?.routine) {
      const typed = accessory as PlatformAccessory<RoutineContext>;
      this.log.debug(`Restoring routine accessory from cache: ${accessory.displayName}`);
      this.accessories.set(accessory.UUID, typed);
      this.wrappers.set(accessory.UUID, new TethralAccessory(this, typed));
      return;
    }
    if (ctx?.webhook) {
      const typed = accessory as PlatformAccessory<WebhookContext>;
      this.log.debug(`Restoring webhook accessory from cache: ${accessory.displayName}`);
      this.webhookAccessories.set(accessory.UUID, typed);
      this.webhookWrappers.set(accessory.UUID, new WebhookAccessory(this, typed));
      return;
    }
    this.log.warn(`Cached accessory has no routine or webhook context, skipping: ${accessory.displayName}`);
  }

  get shutdownSignal(): AbortSignal {
    return this.shutdownController.signal;
  }

  private uuidFor(routineId: string): string {
    return this.api.hap.uuid.generate(`${PLUGIN_NAME}:routine:${routineId}`);
  }

  private uuidForWebhook(name: string): string {
    return this.api.hap.uuid.generate(`${PLUGIN_NAME}:webhook:${name}`);
  }

  private parseWebhooks(input: Array<Partial<WebhookConfig>> | undefined): WebhookConfig[] {
    if (!Array.isArray(input) || input.length === 0) {
      return [];
    }
    const seenNames = new Set<string>();
    const out: WebhookConfig[] = [];
    for (const raw of input) {
      const result = validateWebhook(raw ?? {});
      if (!result.ok) {
        this.log.warn(`Skipping invalid webhook config: ${result.reason}`);
        continue;
      }
      if (seenNames.has(result.config.name)) {
        this.log.warn(`Skipping duplicate webhook name: ${result.config.name}`);
        continue;
      }
      seenNames.add(result.config.name);
      out.push(result.config);
    }
    return out;
  }

  private async syncRoutines(): Promise<void> {
    if (!this.client || this.shutdownController.signal.aborted) {
      return;
    }

    let routines: TethralRoutine[];
    try {
      routines = await this.client.listRoutines({ signal: this.shutdownController.signal });
    } catch (err) {
      this.log.warn(`Routine sync failed; keeping cached accessories. ${(err as Error).message}`);
      return;
    }

    const diff = diffRoutines(this.accessories, routines, (id) => this.uuidFor(id));

    for (const routine of diff.create) {
      const uuid = this.uuidFor(routine.id);
      const accessory = new this.api.platformAccessory<RoutineContext>(routine.name, uuid, Categories.SWITCH);
      accessory.context.routine = routine;
      this.wrappers.set(uuid, new TethralAccessory(this, accessory));
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      this.accessories.set(uuid, accessory);
      this.publishToMatter(accessory);
      this.log.info(`Registered new Tethral routine as Switch: ${routine.name} (${routine.id})`);
    }

    for (const { uuid, routine } of diff.update) {
      const accessory = this.accessories.get(uuid)!;
      accessory.context.routine = routine;
      if (accessory.displayName !== routine.name) {
        accessory.displayName = routine.name;
        this.api.updatePlatformAccessories([accessory]);
      }
      this.wrappers.get(uuid)?.updateRoutine(routine);
    }

    for (const { uuid, accessory } of diff.remove) {
      this.log.info(`Removing stale routine: ${accessory.displayName}`);
      this.wrappers.get(uuid)?.dispose();
      this.wrappers.delete(uuid);
      this.matterPublished.delete(uuid);
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      this.accessories.delete(uuid);
    }
  }

  private syncWebhooks(): void {
    const diff = diffWebhooks(this.webhookAccessories, this.webhooks, (name) => this.uuidForWebhook(name));

    for (const config of diff.create) {
      const uuid = this.uuidForWebhook(config.name);
      const accessory = new this.api.platformAccessory<WebhookContext>(config.name, uuid, Categories.SWITCH);
      accessory.context.webhook = config;
      this.webhookWrappers.set(uuid, new WebhookAccessory(this, accessory));
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      this.webhookAccessories.set(uuid, accessory);
      this.publishToMatter(accessory as unknown as PlatformAccessory<RoutineContext>);
      this.log.info(`Registered webhook switch: ${config.name} -> ${config.method ?? 'POST'} ${config.url}`);
    }

    for (const { uuid, config } of diff.update) {
      const accessory = this.webhookAccessories.get(uuid)!;
      accessory.context.webhook = config;
      if (accessory.displayName !== config.name) {
        accessory.displayName = config.name;
        this.api.updatePlatformAccessories([accessory]);
      }
      this.webhookWrappers.get(uuid)?.updateConfig(config);
    }

    for (const { uuid, accessory } of diff.remove) {
      this.log.info(`Removing stale webhook switch: ${accessory.displayName}`);
      this.webhookWrappers.get(uuid)?.dispose();
      this.webhookWrappers.delete(uuid);
      this.matterPublished.delete(uuid);
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      this.webhookAccessories.delete(uuid);
    }
  }

  private publishToMatter(accessory: PlatformAccessory<RoutineContext>): void {
    if (this.matterPublished.has(accessory.UUID)) {
      return;
    }
    const matter = (this.api as unknown as { matter?: { switch?: { emit: (a: PlatformAccessory) => void } } }).matter;
    if (!matter?.switch?.emit) {
      return;
    }
    try {
      matter.switch.emit(accessory);
      this.matterPublished.add(accessory.UUID);
      this.log.debug(`Published to Matter: ${accessory.displayName}`);
    } catch (err) {
      this.log.warn(`Matter publish failed for ${accessory.displayName}: ${(err as Error).message}`);
    }
  }
}
