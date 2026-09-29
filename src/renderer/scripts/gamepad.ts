export interface GamepadCallbackHandlers {
  onSwitchGame: (direction: 'next' | 'prev') => void;
  onToggleCharacterMenu: () => void;
  onToggleClientMenu: () => void;
  onToggleSettings: () => void;
  onCloseModalOrMenu: () => void;
  onPrimaryAction: () => void;
}

export class GamepadNavigator {
  private handlers: GamepadCallbackHandlers;
  private isConnected: boolean = false;
  private animFrameId: number | null = null;
  private prevButtonState: Map<number, boolean> = new Map();
  private lastStickMoveTime: number = 0;
  private focusedElement: HTMLElement | null = null;

  constructor(handlers: GamepadCallbackHandlers) {
    this.handlers = handlers;
  }

  public init() {
    window.addEventListener('gamepadconnected', (e: GamepadEvent) => {
      console.log(`[Gamepad] Connected: ${e.gamepad.id} (index ${e.gamepad.index})`);
      this.isConnected = true;
      document.getElementById('app')?.classList.add('gamepad-active');
      this.startPolling();
      this.focusInitialElement();
    });

    window.addEventListener('gamepaddisconnected', (e: GamepadEvent) => {
      console.log(`[Gamepad] Disconnected: ${e.gamepad.id}`);
      this.isConnected = false;
      document.getElementById('app')?.classList.remove('gamepad-active');
      this.stopPolling();
      if (this.focusedElement) {
        this.focusedElement.classList.remove('gamepad-focused');
        this.focusedElement = null;
      }
    });

    // Check if gamepads are already connected on load
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of gamepads) {
      if (gp && gp.connected) {
        this.isConnected = true;
        document.getElementById('app')?.classList.add('gamepad-active');
        this.startPolling();
        this.focusInitialElement();
        break;
      }
    }

    // Pause polling loop when app is hidden or in background to save CPU and battery
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stopPolling();
      } else if (this.isConnected) {
        this.startPolling();
      }
    });
  }

  private startPolling() {
    if (this.animFrameId !== null) return;

    const poll = () => {
      this.pollGamepad();
      this.animFrameId = requestAnimationFrame(poll);
    };
    this.animFrameId = requestAnimationFrame(poll);
  }

  private stopPolling() {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private pollGamepad() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = gamepads[0];
    if (!gp || !gp.connected) return;

    // Standard Gamepad Mapping:
    // 0: A / Cross
    // 1: B / Circle
    // 2: X / Square
    // 3: Y / Triangle
    // 4: LB / L1
    // 5: RB / R1
    // 6: LT / L2
    // 7: RT / R2
    // 8: Back / Select / View
    // 9: Start / Menu / Options
    // 12: D-Pad Up
    // 13: D-Pad Down
    // 14: D-Pad Left
    // 15: D-Pad Right

    const checkButtonPress = (index: number): boolean => {
      const isPressed = gp.buttons[index]?.pressed || false;
      const wasPressed = this.prevButtonState.get(index) || false;
      this.prevButtonState.set(index, isPressed);
      return isPressed && !wasPressed;
    };

    // Bumpers: Switch Game Tabs
    if (checkButtonPress(4)) { // LB
      this.handlers.onSwitchGame('prev');
    }
    if (checkButtonPress(5)) { // RB
      this.handlers.onSwitchGame('next');
    }

    // A Button: Primary action / Click focused element
    if (checkButtonPress(0)) {
      if (this.focusedElement && typeof this.focusedElement.click === 'function') {
        this.focusedElement.click();
      } else {
        this.handlers.onPrimaryAction();
      }
    }

    // B Button: Back / Close active modal or menu
    if (checkButtonPress(1)) {
      this.handlers.onCloseModalOrMenu();
    }

    // Y Button: Toggle character menu
    if (checkButtonPress(3)) {
      this.handlers.onToggleCharacterMenu();
    }

    // X Button: Toggle client menu / quick options
    if (checkButtonPress(2)) {
      this.handlers.onToggleClientMenu();
    }

    // Menu / Start Button: Open Settings
    if (checkButtonPress(9)) {
      this.handlers.onToggleSettings();
    }

    // Directional Navigation (D-Pad & Left Stick)
    const now = performance.now();
    const stickThreshold = 0.5;
    const stickX = gp.axes[0] || 0;
    const stickY = gp.axes[1] || 0;

    const dpadUp = checkButtonPress(12) || (stickY < -stickThreshold && now - this.lastStickMoveTime > 220);
    const dpadDown = checkButtonPress(13) || (stickY > stickThreshold && now - this.lastStickMoveTime > 220);
    const dpadLeft = checkButtonPress(14) || (stickX < -stickThreshold && now - this.lastStickMoveTime > 220);
    const dpadRight = checkButtonPress(15) || (stickX > stickThreshold && now - this.lastStickMoveTime > 220);

    if (dpadUp || dpadDown || dpadLeft || dpadRight) {
      this.lastStickMoveTime = now;
      let dir: 'up' | 'down' | 'left' | 'right' = 'down';
      if (dpadUp) dir = 'up';
      else if (dpadDown) dir = 'down';
      else if (dpadLeft) dir = 'left';
      else if (dpadRight) dir = 'right';

      this.moveFocus(dir);
    }
  }

  private focusInitialElement() {
    const playBtn = document.getElementById('btn-play');
    if (playBtn) {
      this.setFocus(playBtn);
    }
  }

  private setFocus(el: HTMLElement) {
    if (this.focusedElement) {
      this.focusedElement.classList.remove('gamepad-focused');
    }
    this.focusedElement = el;
    this.focusedElement.classList.add('gamepad-focused');
    this.focusedElement.focus();
  }

  private moveFocus(direction: 'up' | 'down' | 'left' | 'right') {
    // Find active scope (active modal or main window)
    const activeModal = Array.from(document.querySelectorAll('.modal-overlay:not(.hidden)')).pop();
    const scope: HTMLElement = (activeModal as HTMLElement) || document.body;

    const focusables = Array.from(scope.querySelectorAll<HTMLElement>(
      'button:not([disabled]):not(.hidden), input:not([disabled]), select:not([disabled]), .character-preview, .client-preview'
    )).filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none';
    });

    if (focusables.length === 0) return;

    if (!this.focusedElement || !focusables.includes(this.focusedElement)) {
      this.setFocus(focusables[0]);
      return;
    }

    const currentRect = this.focusedElement.getBoundingClientRect();
    const currentCenter = {
      x: currentRect.left + currentRect.width / 2,
      y: currentRect.top + currentRect.height / 2
    };

    let bestTarget: HTMLElement | null = null;
    let minDistance = Infinity;

    for (const candidate of focusables) {
      if (candidate === this.focusedElement) continue;

      const candRect = candidate.getBoundingClientRect();
      const candCenter = {
        x: candRect.left + candRect.width / 2,
        y: candRect.top + candRect.height / 2
      };

      const dx = candCenter.x - currentCenter.x;
      const dy = candCenter.y - currentCenter.y;

      let isCandidate = false;
      if (direction === 'up' && dy < -5) isCandidate = true;
      else if (direction === 'down' && dy > 5) isCandidate = true;
      else if (direction === 'left' && dx < -5) isCandidate = true;
      else if (direction === 'right' && dx > 5) isCandidate = true;

      if (isCandidate) {
        const dist = Math.hypot(dx, dy);
        if (dist < minDistance) {
          minDistance = dist;
          bestTarget = candidate;
        }
      }
    }

    if (bestTarget) {
      this.setFocus(bestTarget);
    }
  }
}
