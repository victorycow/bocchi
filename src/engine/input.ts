import { KeyMode } from './types';

export interface KeyBindings {
  '4K': string[];
  '6K': string[];
}

const DEFAULT_BINDINGS: KeyBindings = {
  '4K': ['KeyD', 'KeyF', 'KeyJ', 'KeyK'],
  '6K': ['KeyS', 'KeyD', 'KeyF', 'KeyJ', 'KeyK', 'KeyL']
};

export type KeyEventListener = (lane: number, type: 'down' | 'up') => void;

export class InputManager {
  private bindings: KeyBindings;
  private currentMode: KeyMode = '4K';
  private keyState: boolean[] = [false, false, false, false, false, false];
  private listeners: KeyEventListener[] = [];

  constructor() {
    this.bindings = this.loadBindings();
    this.setupListeners();
  }

  private loadBindings(): KeyBindings {
    try {
      const saved = localStorage.getItem('CYBERBEAT_KEYBINDINGS');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed['4K'] && parsed['6K']) {
          return parsed;
        }
      }
    } catch {
      // LocalStorage 에러 시 기본값 사용
    }
    return JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
  }

  public saveBindings(bindings: KeyBindings) {
    this.bindings = JSON.parse(JSON.stringify(bindings));
    try {
      localStorage.setItem('CYBERBEAT_KEYBINDINGS', JSON.stringify(this.bindings));
    } catch {
      // 무시
    }
  }

  public getBindings(): KeyBindings {
    return JSON.parse(JSON.stringify(this.bindings));
  }

  public resetDefaultBindings() {
    this.saveBindings(DEFAULT_BINDINGS);
  }

  public setMode(mode: KeyMode) {
    this.currentMode = mode;
    this.keyState = mode === '4K' ? [false, false, false, false] : [false, false, false, false, false, false];
  }

  public getMode(): KeyMode {
    return this.currentMode;
  }

  public onKey(listener: KeyEventListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  public isLanePressed(lane: number): boolean {
    return !!this.keyState[lane];
  }

  public getLaneState(): boolean[] {
    return [...this.keyState];
  }

  public getKeyNameForLane(lane: number, mode: KeyMode): string {
    const code = this.bindings[mode][lane];
    if (!code) return '?';
    if (code.startsWith('Key')) return code.replace('Key', '');
    if (code.startsWith('Digit')) return code.replace('Digit', '');
    return code;
  }

  private setupListeners() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return; // 반복 키 입력 무시 (리듬게임에서 가장 중요)

      const activeKeys = this.bindings[this.currentMode];
      const lane = activeKeys.indexOf(e.code);

      if (lane !== -1) {
        e.preventDefault();
        this.keyState[lane] = true;
        this.emit(lane, 'down');
      }
    });

    window.addEventListener('keyup', (e) => {
      const activeKeys = this.bindings[this.currentMode];
      const lane = activeKeys.indexOf(e.code);

      if (lane !== -1) {
        e.preventDefault();
        this.keyState[lane] = false;
        this.emit(lane, 'up');
      }
    });

    // 창 포커스 아웃 시 모든 키 해제
    window.addEventListener('blur', () => {
      for (let i = 0; i < this.keyState.length; i++) {
        if (this.keyState[i]) {
          this.keyState[i] = false;
          this.emit(i, 'up');
        }
      }
    });
  }

  private emit(lane: number, type: 'down' | 'up') {
    for (const listener of this.listeners) {
      listener(lane, type);
    }
  }
}
