# Timer Adapter

[![Build Status](https://travis-ci.org/tim-hellhake/timer-adapter.svg?branch=master)](https://travis-ci.org/tim-hellhake/timer-adapter)
[![dependencies](https://david-dm.org/tim-hellhake/timer-adapter.svg)](https://david-dm.org/tim-hellhake/timer-adapter)
[![devDependencies](https://david-dm.org/tim-hellhake/timer-adapter/dev-status.svg)](https://david-dm.org/tim-hellhake/timer-adapter?type=dev)
[![optionalDependencies](https://david-dm.org/tim-hellhake/timer-adapter/optional-status.svg)](https://david-dm.org/tim-hellhake/timer-adapter?type=optional)
[![license](https://img.shields.io/badge/license-MPL--2.0-blue.svg)](LICENSE)

There are two types of devices provided by this adapter:
1. Timer: Runs for the specified number of seconds
2. Interval: Continuously emits an event after the specified number of seconds

## Configuration
1. Go to settings
2. Add a timer/interval

## Usage
The timer has two actions:
* `start`: Start the timer and set the `elapsed` property after the specified number of seconds
* `reset`: Reset the timer to the specified number of seconds and clear the `elapsed` property

The interval provides an `active` property to control whether events are emitted.

When the specified number of seconds is over an `elapsed` event is emitted.
