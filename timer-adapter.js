/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

'use strict';

const {
  Adapter,
  Device,
  Property
} = require('gateway-addon');

class Timer extends Device {
  constructor(adapter, manifest, timer) {
    super(adapter, timer.name);
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
        this.timerHandle = null;

        runningProperty.setCachedValue(false);
        this.notifyPropertyChanged(runningProperty);
      }

      finishedProperty.setCachedValue(false);
      this.notifyPropertyChanged(finishedProperty);
    });
  }

  createProperty(description) {
    const property = new Property(this, description.title, description);
    this.properties.set(description.title, property);
    return property;
  }

  addCallbackAction(title, description, callback) {
    this.addAction(title, {
      title,
      description
    });

    this.callbacks[title] = callback;
  }

  async performAction(action) {
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

class TimerAdapter extends Adapter {
  constructor(addonManager, manifest) {
    super(addonManager, TimerAdapter.name, manifest.name);
    addonManager.addAdapter(this);
    const timers = manifest.moziot.config.timers;

    if (timers) {
      for (const timer of timers) {
        const device = new Timer(this, manifest, timer);
        this.handleDeviceAdded(device);
      }
    }
  }
}

module.exports = TimerAdapter;
