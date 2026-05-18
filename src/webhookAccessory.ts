import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';

import type { TethralPlatform } from './platform.js';
import { fireWebhook, type WebhookConfig } from './webhookClient.js';

const STATELESS_RESET_MS = 1_200;

export interface WebhookContext {
  webhook: WebhookConfig;
}

/**
 * Stateless Switch wrapper for a user-configured webhook. Behaves identically
 * to TethralAccessory — toggle on, fire the configured request, auto-reset to
 * off ~1.2s later, surface failures as HAPStatus.SERVICE_COMMUNICATION_FAILURE.
 */
export class WebhookAccessory {
  private readonly service: Service;
  private resetTimer: NodeJS.Timeout | null = null;
  private disposed = false;

  constructor(
    private readonly platform: TethralPlatform,
    private readonly accessory: PlatformAccessory<WebhookContext>,
  ) {
    const config = accessory.context.webhook;

    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Name, config.name)
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Tethral')
      .setCharacteristic(this.platform.Characteristic.Model, 'Webhook')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, config.name)
      .setCharacteristic(this.platform.Characteristic.FirmwareRevision, '0.2.0');

    this.service =
      this.accessory.getService(this.platform.Service.Switch) ??
      this.accessory.addService(this.platform.Service.Switch);

    this.service.setCharacteristic(this.platform.Characteristic.Name, config.name);
    if (!this.service.testCharacteristic(this.platform.Characteristic.ConfiguredName)) {
      this.service.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
    }
    this.service.setCharacteristic(this.platform.Characteristic.ConfiguredName, config.name);

    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onGet(() => false)
      .onSet(this.fire.bind(this));
  }

  updateConfig(config: WebhookConfig): void {
    this.accessory.context.webhook = config;
    if (this.service.displayName !== config.name) {
      this.service.updateCharacteristic(this.platform.Characteristic.Name, config.name);
      this.service.updateCharacteristic(this.platform.Characteristic.ConfiguredName, config.name);
    }
  }

  dispose(): void {
    this.disposed = true;
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }

  private async fire(value: CharacteristicValue): Promise<void> {
    if (value !== true) {
      return;
    }

    const config = this.accessory.context.webhook;

    try {
      await fireWebhook(config, this.platform.shutdownSignal);
      this.platform.log.info(`Webhook fired: ${config.name} -> ${config.method ?? 'POST'} ${config.url}`);
    } catch (err) {
      this.platform.log.warn(`Webhook execution failed: ${config.name} — ${(err as Error).message}`);
      this.scheduleReset();
      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE,
      );
    }

    this.scheduleReset();
  }

  private scheduleReset(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }
    this.resetTimer = setTimeout(() => {
      this.resetTimer = null;
      if (this.disposed) {
        return;
      }
      this.service.updateCharacteristic(this.platform.Characteristic.On, false);
    }, STATELESS_RESET_MS);
  }
}
