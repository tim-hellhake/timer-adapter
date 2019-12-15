/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

'use strict';

import { Adapter, Device, Property, Event, Database } from 'gateway-addon';

const crypto = require('crypto');
const manifest = require('../manifest.json');

interface TimerConfig {
  id: string;
  name: string;
  seconds: number;
}

interface IntervalConfig {
  id: string;
  name: string;
  seconds: number;
}

class Timer extends Device {
  private callbacks: { [name: string]: () => void } = {};
  private timerHandle?: NodeJS.Timeout;
  private seconds: number = 0;
  private finishedProperty: Property;
  private runningProperty: Property;
  private secondsProperty: Property;

  constructor(adapter: Adapter, private timer: TimerConfig) {
    super(adapter, `timer-${timer.id}`);
    this['@context'] = 'https://iot.mozilla.org/schemas/';
    this['@type'] = ['MultiLevelSensor'];
    this.name = timer.name;
    this.description = manifest.description;

    this.finishedProperty = this.createProperty({
      type: 'boolean',
      title: 'elapsed',
      description: 'Whether the timer has elapsed',
      readOnly: true
    });

    this.runningProperty = this.createProperty({
      type: 'boolean',
      title: 'running',
      description: 'Whether the timer is currently running',
      readOnly: true
    });

    this.secondsProperty = this.createProperty({
      '@type': 'LevelProperty',
      type: 'integer',
      minimum: 0,
      maximum: timer.seconds,
      title: 'seconds',
      description: 'The number of seconds',
      readOnly: true
    });

    this.addCallbackAction('start', 'Start the timer', () => {
      this.start();
    });

    this.addCallbackAction('restart', 'Restart the timer', () => {
      this.restart();
    });

    this.addCallbackAction('reset', 'Reset the timer', () => {
      this.reset();
    });
  }

  createProperty(description: any) {
    const property = new Property(this, description.title, description);
    this.properties.set(description.title, property);
    return property;
  }

  addCallbackAction(title: string, description: string, callback: () => void) {
    this.addAction(title, {
      title,
      description
    });

    this.callbacks[title] = callback;
  }

  async performAction(action: any) {
    action.start();

    const callback = this.callbacks[action.name];

    if (callback) {
      callback();
    } else {
      console.warn(`Unknown action ${action.name}`);
    }

    action.finish();
  }

  private setFinished(value: boolean) {
    this.finishedProperty.setCachedValue(value);
    this.notifyPropertyChanged(this.finishedProperty);
  }

  private setRunning(value: boolean) {
    this.runningProperty.setCachedValue(value);
    this.notifyPropertyChanged(this.runningProperty);
  }

  private setSeconds(value: number) {
    this.seconds = value;
    this.secondsProperty.setCachedValue(value);
    this.notifyPropertyChanged(this.secondsProperty);
  }

  private start() {
    if (!this.timerHandle) {
      console.log(`Starting timer ${this.timer.name}`);
      this.setRunning(true);

      this.timerHandle = setInterval(() => {
        this.tick();
      }, 1000);
    }
  }

  private restart() {
    this.reset();
    this.start();
  }

  private reset() {
    if (this.timerHandle) {
      console.log(`Resetting timer ${this.timer.name}`);
      clearTimeout(this.timerHandle);
      this.timerHandle = undefined;
    }

    this.setRunning(false);
    this.setFinished(false);
    this.setSeconds(0);
  }

  private finish() {
    if (this.timerHandle) {
      clearTimeout(this.timerHandle);
      this.timerHandle = undefined;
    }

    this.setRunning(false);
    this.setFinished(true);
  }

  private tick() {
    this.setSeconds(this.seconds + 1);

    if (this.seconds == this.timer.seconds) {
      this.finish();
    }
  }
}

class Interval extends Device {
  private seconds: number = 1;
  private secondsProperty: Property;

  constructor(adapter: Adapter, private interval: IntervalConfig) {
    super(adapter, `interval-${interval.id}`);
    this['@context'] = 'https://iot.mozilla.org/schemas/';
    this['@type'] = ['MultiLevelSensor'];
    this.name = interval.name;
    this.description = manifest.description;

    this.secondsProperty = this.createProperty({
      '@type': 'LevelProperty',
      type: 'integer',
      minimum: 0,
      maximum: interval.seconds,
      title: 'seconds',
      description: 'The number of seconds',
      readOnly: true
    });

    this.events.set('elapsed', {
      name: 'elapsed',
      metadata: {
        description: 'Interval elapsed',
        type: 'string'
      }
    });

    setInterval(() => {
      this.tick();
    }, 1000);
  }

  createProperty(description: any) {
    const property = new Property(this, description.title, description);
    this.properties.set(description.title, property);
    return property;
  }

  private setSeconds(value: number) {
    this.secondsProperty.setCachedValue(value);
    this.notifyPropertyChanged(this.secondsProperty);
  }

  private tick() {
    this.seconds++;

    if (this.seconds == this.interval.seconds) {
      this.eventNotify(new Event(this, 'elapsed'));
    }

    if (this.seconds > this.interval.seconds) {
      this.seconds = 1;
    }

    this.setSeconds(this.seconds);
  }
}

export class TimerAdapter extends Adapter {
  private timers: { [key: string]: Timer } = {};
  private intervals: { [key: string]: Interval } = {};

  constructor(addonManager: any) {
    super(addonManager, TimerAdapter.name, manifest.id);
    addonManager.addAdapter(this);
    this.load();
    this.advertise();
  }

  public startPairing(_timeoutSeconds: number) {
    console.log('Start pairing');
    this.advertise();
  }

  private async load() {
    const db = new Database(manifest.id);
    await db.open();
    const config = await db.loadConfig();

    if (config.timers) {
      for (const timer of config.timers) {
        if (!timer.id) {
          timer.id = `${crypto.randomBytes(16).toString('hex')}`;
        }

        this.timers[timer.id] = new Timer(this, timer);
      }
    }

    if (config.intervals) {
      for (const interval of config.intervals) {
        if (!interval.id) {
          interval.id = `${crypto.randomBytes(16).toString('hex')}`;
        }

        this.intervals[interval.id] = new Interval(this, interval);
      }
    }

    await db.saveConfig(config);
  }

  private advertise() {
    for (let id in this.timers) {
      const timer = this.timers[id];
      this.handleDeviceAdded(timer);
    }

    for (let id in this.intervals) {
      const interval = this.intervals[id];
      this.handleDeviceAdded(interval);
    }
  }
}
