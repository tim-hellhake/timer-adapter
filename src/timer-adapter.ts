/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

'use strict';

import { Adapter, Device, Property, Event, Database } from 'gateway-addon';

let debug: (message?: any, ...optionalParams: any[]) => void = () => { }

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
    this.finishedProperty.setCachedValueAndNotify(value);
  }

  private setRunning(value: boolean) {
    this.runningProperty.setCachedValueAndNotify(value);
  }

  private setSeconds(value: number) {
    this.seconds = value;
    this.secondsProperty.setCachedValueAndNotify(value);
  }

  private start() {
    if (!this.timerHandle) {
      debug(`Starting timer ${this.timer.name}`);
      this.setRunning(true);

      this.timerHandle = setInterval(() => {
        this.tick();
      }, 1000);
    }
  }

  private restart() {
    debug(`Restarting timer ${this.timer.name}`);
    this.reset();
    this.start();
  }

  private reset() {
    if (this.timerHandle) {
      debug(`Resetting timer ${this.timer.name}`);
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

class PrecisionTimer extends Device {
  private callbacks: { [name: string]: () => void } = {};
  private timerHandle?: NodeJS.Timeout;

  constructor(adapter: Adapter, private timer: TimerConfig) {
    super(adapter, `timer-${timer.id}`);
    this['@context'] = 'https://iot.mozilla.org/schemas/';
    this['@type'] = [];
    this.name = timer.name;
    this.description = manifest.description;

    this.addCallbackAction('start', 'Start the timer', () => {
      this.start();
    });
  }

  addCallbackAction(title: string, description: string, callback: () => void) {
    this.addAction(title, {
      title,
      description
    });

    this.events.set('elapsed', {
      name: 'elapsed',
      metadata: {
        description: 'Timer elapsed',
        type: 'string'
      }
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

  private start() {
    if (!this.timerHandle) {
      debug(`Starting timer ${this.timer.name}`);

      this.timerHandle = setTimeout(() => {
        this.eventNotify(new Event(this, 'elapsed'));
        this.timerHandle = undefined;
      }, this.timer.seconds * 1000);
    }
  }
}

class Interval extends Device {
  private seconds: number = 1;
  private secondsProperty?: Property;

  constructor(adapter: Adapter, private interval: IntervalConfig, progressBar: boolean) {
    super(adapter, `interval-${interval.id}`);
    this['@context'] = 'https://iot.mozilla.org/schemas/';
    this.name = interval.name;
    this.description = manifest.description;

    if (progressBar) {
      this['@type'] = ['MultiLevelSensor'];

      this.secondsProperty = this.createProperty({
        '@type': 'LevelProperty',
        type: 'integer',
        minimum: 0,
        maximum: interval.seconds,
        title: 'seconds',
        description: 'The number of seconds',
        readOnly: true
      });
    }

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
    this.secondsProperty?.setCachedValueAndNotify(value);
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
  private precisionTimers: { [key: string]: PrecisionTimer } = {};
  private intervals: { [key: string]: Interval } = {};

  constructor(addonManager: any, manifest: any) {
    super(addonManager, TimerAdapter.name, manifest.id);

    const {
      logging
    } = manifest.moziot.config;

    if (logging.debug === true) {
      debug = console.log;
    }

    addonManager.addAdapter(this);
    this.start();
  }

  private async start() {
    await this.load();
    await this.advertise();
  }

  public startPairing(_timeoutSeconds: number) {
    debug('Start pairing');
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

    if (config.precisionTimers) {
      for (const precisionTimer of config.precisionTimers) {
        if (!precisionTimer.id) {
          precisionTimer.id = `${crypto.randomBytes(16).toString('hex')}`;
        }

        this.precisionTimers[precisionTimer.id] = new PrecisionTimer(this, precisionTimer);
      }
    }

    if (config.intervals) {
      for (const interval of config.intervals) {
        if (!interval.id) {
          interval.id = `${crypto.randomBytes(16).toString('hex')}`;
        }

        this.intervals[interval.id] = new Interval(this, interval, config.deactivateProgressBar !== true);
      }
    }

    await db.saveConfig(config);
  }

  private advertise() {
    for (let id in this.timers) {
      const timer = this.timers[id];
      this.handleDeviceAdded(timer);
    }

    for (let id in this.precisionTimers) {
      const precisionTimer = this.precisionTimers[id];
      this.handleDeviceAdded(precisionTimer);
    }

    for (let id in this.intervals) {
      const interval = this.intervals[id];
      this.handleDeviceAdded(interval);
    }
  }
}
