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

  constructor(adapter: Adapter, timer: TimerConfig) {
    super(adapter, `timer-${timer.id}`);
    this['@context'] = 'https://iot.mozilla.org/schemas/';
    this.name = timer.name;
    this.description = manifest.description;
    this.callbacks = {};

    const finishedProperty = this.createProperty({
      type: 'boolean',
      title: 'elapsed',
      description: 'Whether the timer has elapsed',
      readOnly: true
    });

    const runningProperty = this.createProperty({
      type: 'boolean',
      title: 'running',
      description: 'Whether the timer is currently running',
      readOnly: true
    });

    this.addCallbackAction('start', 'Start the timer', () => {
      if (!this.timerHandle) {
        console.log(`Starting timer ${timer.name}`);
        runningProperty.setCachedValue(true);
        this.notifyPropertyChanged(runningProperty);

        this.timerHandle = setTimeout(() => {
          finishedProperty.setCachedValue(true);
          this.notifyPropertyChanged(finishedProperty);

          runningProperty.setCachedValue(false);
          this.notifyPropertyChanged(runningProperty);
        }, timer.seconds * 1000);
      }
    });

    this.addCallbackAction('reset', 'Reset the timer', () => {
      if (this.timerHandle) {
        console.log(`Resetting timer ${timer.name}`);
        clearTimeout(this.timerHandle);
        this.timerHandle = undefined;

        runningProperty.setCachedValue(false);
        this.notifyPropertyChanged(runningProperty);
      }

      finishedProperty.setCachedValue(false);
      this.notifyPropertyChanged(finishedProperty);
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
}

class Interval extends Device {
  constructor(adapter: Adapter, interval: IntervalConfig) {
    super(adapter, `interval-${interval.id}`);
    this['@context'] = 'https://iot.mozilla.org/schemas/';
    this.name = interval.name;
    this.description = manifest.description;

    this.events.set('elapsed', {
      name: 'elapsed',
      metadata: {
        description: 'Interval elapsed',
        type: 'string'
      }
    });

    setInterval(() => {
      this.eventNotify(new Event(this, 'elapsed'));
    }, interval.seconds * 1000);
  }

  createProperty(description: any) {
    const property = new Property(this, description.title, description);
    this.properties.set(description.title, property);
    return property;
  }
}

export class TimerAdapter extends Adapter {
  constructor(addonManager: any) {
    super(addonManager, TimerAdapter.name, manifest.id);
    addonManager.addAdapter(this);

    const db = new Database(manifest.id);
    db.open().then(() => {
      return db.loadConfig();
    }).then((config) => {
      if (config.timers) {
        for (const timer of config.timers) {
          if (!timer.id) {
            timer.id = `${crypto.randomBytes(16).toString('hex')}`;
          }

          const device = new Timer(this, timer);
          this.handleDeviceAdded(device);
        }
      }

      if (config.intervals) {
        for (const interval of config.intervals) {
          if (!interval.id) {
            interval.id = `${crypto.randomBytes(16).toString('hex')}`;
          }

          const device = new Interval(this, interval);
          this.handleDeviceAdded(device);
        }
      }

      return db.saveConfig(config);
    }).catch(console.error);
  }
}
