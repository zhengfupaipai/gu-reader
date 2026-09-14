/* Count only visible reading time; ignore suspension and long timer gaps. */
class ReadingClock {
  constructor(interval = 20 * 60 * 1000) { this.interval = interval; this.elapsed = 0; this.last = null; }
  tick(now, active) {
    const delta = this.last === null ? 0 : Math.max(0, now - this.last);
    this.last = now;
    if (active && delta <= 5000) this.elapsed += delta;
    if (this.elapsed < this.interval) return false;
    this.elapsed = 0;
    return true;
  }
  reset() { this.elapsed = 0; this.last = null; }
}
if (typeof module !== 'undefined') module.exports = ReadingClock;
