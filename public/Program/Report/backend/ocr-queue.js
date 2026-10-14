'use strict';

class SimpleQueue {
  constructor(concurrency = 2) {
    this.concurrency = Math.max(1, concurrency);
    this._running = 0;
    this._pending = [];
  }

  add(fn) {
    return new Promise((resolve, reject) => {
      this._pending.push({ fn, resolve, reject });
      this._tick();
    });
  }

  _tick() {
    while (this._running < this.concurrency && this._pending.length > 0) {
      const { fn, resolve, reject } = this._pending.shift();
      this._running++;
      Promise.resolve()
        .then(() => fn())
        .then(resolve, reject)
        .finally(() => { this._running--; this._tick(); });
    }
  }
}

module.exports = { SimpleQueue };
