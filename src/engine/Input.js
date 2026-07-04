export class Input {
  constructor() {
    this.keys = {};
    this.previousKeys = {};

    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  update() {
    // Copy current state to previous state for "just pressed" checks
    this.previousKeys = { ...this.keys };
  }

  isDown(code) {
    return !!this.keys[code];
  }

  isJustPressed(code) {
    return !!this.keys[code] && !this.previousKeys[code];
  }
}
