import { InputManager } from '../engine/input';
import { KeyMode } from '../engine/types';

export class KeyConfigModal {
  private modalEl: HTMLElement;
  private closeBtn: HTMLElement;
  private saveBtn: HTMLElement;
  private resetBtn: HTMLElement;
  private tab4kBtn: HTMLElement;
  private tab6kBtn: HTMLElement;
  private slotsContainer: HTMLElement;

  private inputManager: InputManager;
  private currentTab: KeyMode = '4K';
  private tempBindings: { '4K': string[]; '6K': string[] };
  private listeningLane: number | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(inputManager: InputManager) {
    this.inputManager = inputManager;
    this.modalEl = document.getElementById('modal-keyconfig')!;
    this.closeBtn = document.getElementById('btn-close-keyconfig')!;
    this.saveBtn = document.getElementById('btn-save-keys')!;
    this.resetBtn = document.getElementById('btn-reset-keys')!;
    this.tab4kBtn = document.getElementById('tab-4k')!;
    this.tab6kBtn = document.getElementById('tab-6k')!;
    this.slotsContainer = document.getElementById('key-slots-container')!;

    this.tempBindings = this.inputManager.getBindings();
    this.setupEvents();
  }

  public open(_defaultMode: KeyMode = '4K') {
    this.currentTab = '4K';
    this.tempBindings = this.inputManager.getBindings();
    this.listeningLane = null;
    this.updateTabs();
    this.renderSlots();
    this.modalEl.classList.remove('hidden');
  }

  public close() {
    this.cleanupListener();
    this.modalEl.classList.add('hidden');
  }

  private setupEvents() {
    this.closeBtn.addEventListener('click', () => this.close());
    this.saveBtn.addEventListener('click', () => {
      this.inputManager.saveBindings(this.tempBindings);
      this.close();
    });

    // 모달 배경 클릭 시 닫기
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) {
        this.close();
      }
    });

    this.resetBtn.addEventListener('click', () => {
      this.inputManager.resetDefaultBindings();
      this.tempBindings = this.inputManager.getBindings();
      this.renderSlots();
    });

    this.tab4kBtn.addEventListener('click', () => {
      this.currentTab = '4K';
      this.listeningLane = null;
      this.updateTabs();
      this.renderSlots();
    });

    this.tab6kBtn.addEventListener('click', () => {
      const toast = document.getElementById('game-toast');
      if (toast) {
        toast.textContent = '🔒 6키 모드는 결속밴드 4인 집중 개발을 위해 잠겨있습니다!';
        toast.classList.remove('show');
        void toast.offsetWidth;
        toast.classList.add('show');
        setTimeout(() => toast?.classList.remove('show'), 2000);
      }
    });
  }

  private updateTabs() {
    if (this.currentTab === '4K') {
      this.tab4kBtn.classList.add('active');
      this.tab6kBtn.classList.remove('active');
    } else {
      this.tab6kBtn.classList.add('active');
      this.tab4kBtn.classList.remove('active');
    }
  }

  private renderSlots() {
    this.slotsContainer.innerHTML = '';
    const keys = this.tempBindings[this.currentTab];

    keys.forEach((code, index) => {
      const slotItem = document.createElement('div');
      slotItem.className = 'key-slot-item';

      const label = document.createElement('span');
      label.className = 'slot-label';
      label.textContent = `LANE ${index + 1}`;

      const box = document.createElement('button');
      box.className = 'key-box';
      box.textContent = this.formatKeyName(code);

      if (this.listeningLane === index) {
        box.classList.add('listening');
        box.textContent = '...';
      }

      box.addEventListener('click', () => {
        this.startListening(index);
      });

      slotItem.appendChild(label);
      slotItem.appendChild(box);
      this.slotsContainer.appendChild(slotItem);
    });
  }

  private startListening(lane: number) {
    this.cleanupListener();
    this.listeningLane = lane;
    this.renderSlots();

    this.keydownHandler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Escape는 취소
      if (e.code === 'Escape') {
        this.cleanupListener();
        this.listeningLane = null;
        this.renderSlots();
        return;
      }

      this.tempBindings[this.currentTab][lane] = e.code;
      this.cleanupListener();
      this.listeningLane = null;
      this.renderSlots();
    };

    window.addEventListener('keydown', this.keydownHandler, { capture: true, once: true });
  }

  private cleanupListener() {
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler, { capture: true });
      this.keydownHandler = null;
    }
  }

  private formatKeyName(code: string): string {
    if (!code) return '?';
    if (code.startsWith('Key')) return code.replace('Key', '');
    if (code.startsWith('Digit')) return code.replace('Digit', '');
    return code;
  }
}
