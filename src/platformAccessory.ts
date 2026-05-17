import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';

import type { TethralPlatform } from './platform.js';
import type { TethralRoutine } from './tethralClient.js';

const STATELESS_RESET_MS = 1_200;

export interface RoutineContext {
  routine: TethralRoutine;
}

export class TethralAccessory {
  private readonly service: Service;
  private resetTimer: NodeJS.Timeout | null = null;
  private disposed = false;

  constructor(
    private readonly platform: TethralPlatform,
    private readonly accessory: PlatformAccessory<RoutineContext>,
  ) {
    const routine = accessory.context.routine;

    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Tethral')
      .setCharacteristic(this.platform.Characteristic.Model, 'Routine')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, routine.id);

    this.service =
      this.accessory.getService(this.platform.Service.Switch) ??
      this.accessory.addService(this.platform.Service.Switch);

    this.service.setCharacteristic(this.platform.Characteristic.Name, routine.name);

    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onGet(() => false)
      .onSet(this.fireRoutine.bind(this));
  }

  updateRoutine(routine: TethralRoutine): void {
    this.accessory.context.routine = routine;
    if (this.service.displayName !== routine.name) {
      this.service.updateCharacteristic(this.platform.Characteristic.Name, routine.name);
    }
  }

  dispose(): void {
    this.disposed = true;
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }

  private async fireRoutine(value: CharacteristicValue): Promise<void> {
    if (value !== true) {
      return;
    }

    const routine = this.accessory.context.routine;
    const client = this.platform.client;

    if (!client) {
      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE,
      );
    }

    try {
      await client.executeRoutine(routine.id);
      this.platform.log.info(`Routine fired: ${routine.name} (${routine.id})`);
    } catch (err) {
      this.platform.log.warn(`Routine execution failed: ${routine.name} — ${(err as Error).message}`);
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
