const config = {
  // Maximum physical clock drift allowed, in ms
  maxDrift: 60000,
};

// code is adopted from https://github.com/jlongster/crdt-example-app/blob/master/shared/timestamp.js
export class HybridClock {
  private _state: { millis: number; counter: number; node: string };

  constructor(millis: number, counter: number, node: string) {
    this._state = {
      millis: millis,
      counter: counter,
      node: node,
    };
  }

  valueOf() {
    return this.toString();
  }

  toString() {
    return [
      new Date(this.millis()).toISOString(),
      ('0000' + this.counter().toString(16).toUpperCase()).slice(-4),
      ('0000000000000000' + this.node()).slice(-16),
    ].join('-');
  }

  millis() {
    return this._state.millis;
  }

  counter() {
    return this._state.counter;
  }

  node() {
    return this._state.node;
  }

  setMillis(n: number) {
    this._state.millis = n;
  }

  setCounter(n: number) {
    this._state.counter = n;
  }

  setNode(n: string) {
    this._state.node = n;
  }

  static from = (clock: HybridClock) => {
    return new HybridClock(clock.millis(), clock.counter(), clock.node());
  };

  static send(clock: HybridClock) {
    // Retrieve the local wall time
    const phys = Date.now();

    // Unpack the clock.timestamp logical time and counter
    const lOld = clock.millis();
    const cOld = clock.counter();

    // Calculate the next logical time and counter
    // * ensure that the logical time never goes backward
    // * increment the counter if phys time does not advance
    const lNew = Math.max(lOld, phys);
    const cNew = lOld === lNew ? cOld + 1 : 0;

    // Check the result for drift and counter overflow
    if (lNew - phys > config.maxDrift) {
      throw new Error('Clock drift error');
    }
    if (cNew > 65535) {
      throw new Error('Clock overflow error');
    }

    // Repack the logical time/counter
    clock.setMillis(lNew);
    clock.setCounter(cNew);

    return new HybridClock(clock.millis(), clock.counter(), clock.node());
  }

  static recv(clock: HybridClock, msg: HybridClock) {
    const phys = Date.now();

    // Unpack the message wall time/counter
    const lMsg = msg.millis();
    const cMsg = msg.counter();

    // Assert the node id and remote clock drift
    if (msg.node() === clock.node()) {
      throw new Error('Node is duplicated');
    }
    if (lMsg - phys > config.maxDrift) {
      throw new Error('Drift error');
    }

    // Unpack the clock.timestamp logical time and counter
    const lOld = clock.millis();
    const cOld = clock.counter();

    // Calculate the next logical time and counter.
    // Ensure that the logical time never goes backward;
    // * if all logical clocks are equal, increment the max counter,
    // * if max = old > message, increment local counter,
    // * if max = messsage > old, increment message counter,
    // * otherwise, clocks are monotonic, reset counter
    const lNew = Math.max(Math.max(lOld, phys), lMsg);
    const cNew =
      lNew === lOld && lNew === lMsg
        ? Math.max(cOld, cMsg) + 1
        : lNew === lOld
        ? cOld + 1
        : lNew === lMsg
        ? cMsg + 1
        : 0;

    // Check the result for drift and counter overflow
    if (lNew - phys > config.maxDrift) {
      throw new Error('Drift error');
    }
    if (cNew > 65535) {
      throw new Error('Overflow error');
    }

    // Repack the logical time/counter
    clock.setMillis(lNew);
    clock.setCounter(cNew);

    return new HybridClock(clock.millis(), clock.counter(), clock.node());
  }

  static parse(timestamp: string) {
    const parts = timestamp.split('-');

    if (parts && parts.length === 5) {
      const millis = Date.parse(parts.slice(0, 3).join('-')).valueOf();
      const counter = parseInt(parts[3], 16);
      const node = parts[4];
      if (!isNaN(millis) && !isNaN(counter)) {
        return new HybridClock(millis, counter, node);
      } else {
        throw new Error('parse failed');
      }
    } else {
      throw new Error('parse failed');
    }
  }

  static since = (isoString: string) => {
    return isoString + '-0000-0000000000000000';
  };
}
