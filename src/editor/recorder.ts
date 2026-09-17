import { EditorCanvas } from './editorCanvas';

export class ChartRecorder {
  private canvas: EditorCanvas;
  private isRecording = false;
  private lanePressTimes: (number | null)[] = [null, null, null, null];
  private getAudioTime: () => number;
  private playHitSound: () => void;

  // Key mappings for 4K
  private readonly KEY_MAP: Record<string, number> = {
    KeyD: 0,
    KeyF: 1,
    KeyJ: 2,
    KeyK: 3,
    // 대소문자 및 영문 보조
    d: 0,
    f: 1,
    j: 2,
    k: 3
  };

  constructor(
    canvas: EditorCanvas,
    getAudioTime: () => number,
    playHitSound: () => void
  ) {
    this.canvas = canvas;
    this.getAudioTime = getAudioTime;
    this.playHitSound = playHitSound;

    this.setupListeners();
  }

  public start() {
    this.isRecording = true;
    this.lanePressTimes = [null, null, null, null];
  }

  public stop() {
    this.isRecording = false;
    this.lanePressTimes = [null, null, null, null];
  }

  public isActive(): boolean {
    return this.isRecording;
  }

  private setupListeners() {
    window.addEventListener('keydown', (e) => {
      if (!this.isRecording) return;
      if (e.repeat) return;

      const lane = this.KEY_MAP[e.code] ?? this.KEY_MAP[e.key.toLowerCase()];
      if (lane !== undefined) {
        e.preventDefault();
        const rawTime = this.getAudioTime();
        const snappedTime = this.canvas.getSnappedTime(rawTime);

        this.lanePressTimes[lane] = snappedTime;
        this.playHitSound();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (!this.isRecording) return;

      const lane = this.KEY_MAP[e.code] ?? this.KEY_MAP[e.key.toLowerCase()];
      if (lane !== undefined) {
        const pressTime = this.lanePressTimes[lane];
        if (pressTime !== null) {
          const rawTime = this.getAudioTime();
          const snappedEndTime = this.canvas.getSnappedTime(rawTime);
          const duration = Math.max(0, snappedEndTime - pressTime);

          if (duration >= 0.15) {
            // 롱노트
            this.canvas.addNoteAt(lane, pressTime, duration, 'hold');
          } else {
            // 단타 노트
            this.canvas.addNoteAt(lane, pressTime, 0, 'normal');
          }

          this.lanePressTimes[lane] = null;
        }
      }
    });
  }
}
