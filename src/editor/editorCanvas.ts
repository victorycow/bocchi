import { NoteData, NoteType } from '../engine/types';

export interface EditorGridConfig {
  bpm: number;
  offsetSec: number;
  snapDiv: number; // 4, 8, 16, 12, 0 (free)
  pixelsPerBeat: number;
}

export class EditorCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private container: HTMLElement;

  private notes: NoteData[] = [];
  private currentTime = 0;
  private songDuration = 180;
  private config: EditorGridConfig;

  // Lane Colors
  private readonly LANE_COLORS = ['#ff6b9d', '#ffcc00', '#00c2ff', '#ff4365'];
  private readonly RULER_WIDTH = 60;
  private readonly LANE_COUNT = 4;

  // Interaction state
  private hoverLane: number | null = null;
  private hoverTime: number | null = null;
  private isDraggingHold = false;
  private dragHoldStartLane: number | null = null;
  private dragHoldStartTime: number | null = null;
  private dragHoldCurrentTime: number | null = null;

  // Callbacks
  private onNotesChangedCb: (() => void) | null = null;
  private onSeekCb: ((time: number) => void) | null = null;

  public noteMode: 'normal' | 'hold' = 'normal';

  constructor(canvas: HTMLCanvasElement, container: HTMLElement, config: EditorGridConfig) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.container = container;
    this.config = config;

    this.setupResize();
    this.setupMouseEvents();
  }

  public setNotes(notes: NoteData[]) {
    this.notes = notes.map(n => ({ ...n }));
    this.sortNotes();
    this.render();
  }

  public getNotes(): NoteData[] {
    return this.notes.map(n => ({ ...n }));
  }

  public setCurrentTime(t: number) {
    this.currentTime = Math.max(0, Math.min(this.songDuration, t));
    this.render();
  }

  public setSongDuration(d: number) {
    this.songDuration = d;
  }

  public setConfig(cfg: Partial<EditorGridConfig>) {
    this.config = { ...this.config, ...cfg };
    this.render();
  }

  public onNotesChanged(cb: () => void) {
    this.onNotesChangedCb = cb;
  }

  public onSeek(cb: (time: number) => void) {
    this.onSeekCb = cb;
  }

  public addNoteAt(lane: number, time: number, duration = 0, type: NoteType = 'normal'): boolean {
    if (lane < 0 || lane >= 4 || time < 0) return false;

    // 중복 검사: 같은 레인에 비슷한 시간대(0.02초 이내)의 노트가 있으면 무시
    const existingIdx = this.notes.findIndex(
      n => n.lane === lane && Math.abs(n.time - time) < 0.03
    );

    if (existingIdx >= 0) {
      return false;
    }

    const newNote: NoteData = {
      id: Date.now() + Math.floor(Math.random() * 100000),
      lane,
      time: Math.round(time * 1000) / 1000,
      duration: Math.max(0, Math.round(duration * 1000) / 1000),
      type: duration > 0.08 ? 'hold' : type
    };

    this.notes.push(newNote);
    this.sortNotes();
    this.render();
    this.onNotesChangedCb?.();
    return true;
  }

  public deleteNoteAt(lane: number, time: number, toleranceSec = 0.06): boolean {
    const idx = this.notes.findIndex(
      n => n.lane === lane && Math.abs(n.time - time) < toleranceSec
    );
    if (idx >= 0) {
      this.notes.splice(idx, 1);
      this.render();
      this.onNotesChangedCb?.();
      return true;
    }
    return false;
  }

  public clearNotes() {
    this.notes = [];
    this.render();
    this.onNotesChangedCb?.();
  }

  public getSnappedTime(rawTime: number): number {
    const { bpm, offsetSec, snapDiv } = this.config;
    if (snapDiv === 0) return Math.max(0, rawTime); // Free

    const beatSec = 60 / bpm;
    const intervalSec = beatSec / (snapDiv / 4); // snapDiv=4 -> beatSec, snapDiv=8 -> beatSec/2
    const relativeTime = rawTime - offsetSec;
    const nearestIndex = Math.round(relativeTime / intervalSec);
    const snapped = offsetSec + nearestIndex * intervalSec;
    return Math.max(0, Math.round(snapped * 1000) / 1000);
  }

  private sortNotes() {
    this.notes.sort((a, b) => a.time - b.time);
  }

  private setupResize() {
    const ro = new ResizeObserver(() => {
      const rect = this.container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = rect.width * dpr;
      this.canvas.height = rect.height * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.render();
    });
    ro.observe(this.container);
  }

  private setupMouseEvents() {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const laneWidth = (rect.width - this.RULER_WIDTH) / this.LANE_COUNT;
      if (x < this.RULER_WIDTH) {
        this.hoverLane = null;
      } else {
        const lane = Math.floor((x - this.RULER_WIDTH) / laneWidth);
        this.hoverLane = Math.max(0, Math.min(3, lane));
      }

      const pixelsPerSecond = this.getPixelsPerSecond();
      const playheadY = this.getPlayheadY(rect.height);
      const rawHoverTime = this.currentTime + (playheadY - y) / pixelsPerSecond;
      this.hoverTime = this.getSnappedTime(rawHoverTime);

      if (this.isDraggingHold && this.dragHoldStartTime !== null) {
        this.dragHoldCurrentTime = Math.max(this.dragHoldStartTime + 0.05, this.hoverTime);
      }

      this.render();
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.hoverLane = null;
      this.hoverTime = null;
      if (this.isDraggingHold) {
        this.finishHoldDrag();
      }
      this.render();
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Left click only
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // 룰러 영역 클릭 시 시크(Seek)
      if (x < this.RULER_WIDTH) {
        const pixelsPerSecond = this.getPixelsPerSecond();
        const playheadY = this.getPlayheadY(rect.height);
        const seekTime = Math.max(0, this.currentTime + (playheadY - y) / pixelsPerSecond);
        this.onSeekCb?.(seekTime);
        return;
      }

      if (this.hoverLane === null || this.hoverTime === null) return;

      const targetLane = this.hoverLane;
      const targetTime = this.hoverTime;

      // 1. 기존 노트 삭제 확인
      const tolerance = (this.config.bpm > 180 ? 0.07 : 0.05);
      const existing = this.notes.find(n => n.lane === targetLane && Math.abs(n.time - targetTime) < tolerance);

      if (existing) {
        this.deleteNoteAt(targetLane, existing.time, 0.08);
        return;
      }

      // 2. 새 노트 생성 (단타 vs 롱노트 드래그 시작)
      if (this.noteMode === 'hold') {
        this.isDraggingHold = true;
        this.dragHoldStartLane = targetLane;
        this.dragHoldStartTime = targetTime;
        this.dragHoldCurrentTime = targetTime + 0.2;
      } else {
        // 단타 생성
        this.addNoteAt(targetLane, targetTime, 0, 'normal');
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.isDraggingHold) {
        this.finishHoldDrag();
      }
    });

    // 마우스 휠 스크롤 (타임라인 시간 이동)
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const beatSec = 60 / this.config.bpm;
      const step = e.shiftKey ? beatSec * 4 : beatSec * (this.config.snapDiv ? 4 / this.config.snapDiv : 1);
      const delta = e.deltaY > 0 ? -step : step;
      const nextTime = Math.max(0, Math.min(this.songDuration, this.currentTime + delta));
      this.onSeekCb?.(nextTime);
    }, { passive: false });
  }

  private finishHoldDrag() {
    if (this.dragHoldStartLane !== null && this.dragHoldStartTime !== null && this.dragHoldCurrentTime !== null) {
      const startTime = Math.min(this.dragHoldStartTime, this.dragHoldCurrentTime);
      const endTime = Math.max(this.dragHoldStartTime, this.dragHoldCurrentTime);
      const duration = endTime - startTime;
      if (duration > 0.08) {
        this.addNoteAt(this.dragHoldStartLane, startTime, duration, 'hold');
      }
    }
    this.isDraggingHold = false;
    this.dragHoldStartLane = null;
    this.dragHoldStartTime = null;
    this.dragHoldCurrentTime = null;
    this.render();
  }

  private getPixelsPerSecond(): number {
    const beatSec = 60 / this.config.bpm;
    return this.config.pixelsPerBeat / beatSec;
  }

  private getPlayheadY(height: number): number {
    // 판정선 위치 (캔버스 하단에서 약 75px)
    return height - 75;
  }

  public render() {
    const ctx = this.ctx;
    const w = this.canvas.width / (window.devicePixelRatio || 1);
    const h = this.canvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, w, h);

    const laneAreaW = w - this.RULER_WIDTH;
    const laneWidth = laneAreaW / this.LANE_COUNT;
    const pixelsPerSecond = this.getPixelsPerSecond();
    const playheadY = this.getPlayheadY(h);

    // 1. 레인 배경 그리기
    for (let i = 0; i < this.LANE_COUNT; i++) {
      const lx = this.RULER_WIDTH + i * laneWidth;
      const isEven = i % 2 === 0;
      ctx.fillStyle = isEven ? 'rgba(10, 14, 28, 0.95)' : 'rgba(14, 20, 36, 0.95)';
      ctx.fillRect(lx, 0, laneWidth, h);

      // 세로 구분선
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(lx, 0);
      ctx.lineTo(lx, h);
      ctx.stroke();
    }

    // 2. 룰러 배경 (왼쪽 마디 바)
    ctx.fillStyle = 'rgba(8, 10, 20, 0.98)';
    ctx.fillRect(0, 0, this.RULER_WIDTH, h);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(this.RULER_WIDTH, 0);
    ctx.lineTo(this.RULER_WIDTH, h);
    ctx.stroke();

    // 3. 비트 및 마디 그리드선 렌더링
    this.drawGridLines(w, h, laneAreaW, pixelsPerSecond, playheadY);

    // 4. 기존 노트들 렌더링
    this.drawNotes(laneWidth, pixelsPerSecond, playheadY, h);

    // 5. 드래그 중인 롱노트 프리뷰
    if (this.isDraggingHold && this.dragHoldStartLane !== null && this.dragHoldStartTime !== null && this.dragHoldCurrentTime !== null) {
      this.drawHoldPreview(laneWidth, pixelsPerSecond, playheadY);
    }

    // 6. 마우스 호버 스냅 가이드 라인 & 고스트 노트
    if (this.hoverLane !== null && this.hoverTime !== null && !this.isDraggingHold) {
      this.drawHoverGuide(laneWidth, pixelsPerSecond, playheadY);
    }

    // 7. 플레이헤드 (판정선) 렌더링
    this.drawPlayhead(w, playheadY);
  }

  private drawGridLines(w: number, h: number, laneAreaW: number, pixelsPerSecond: number, playheadY: number) {
    const ctx = this.ctx;
    const { bpm, offsetSec, snapDiv } = this.config;
    const beatSec = 60 / bpm;
    const barSec = beatSec * 4;

    const timeAbove = playheadY / pixelsPerSecond;
    const timeBelow = (h - playheadY) / pixelsPerSecond;
    const minTime = Math.max(0, this.currentTime - timeBelow);
    const maxTime = this.currentTime + timeAbove;

    // 마디 및 박자 범위 계산
    const minBarIdx = Math.floor((minTime - offsetSec) / barSec) - 1;
    const maxBarIdx = Math.ceil((maxTime - offsetSec) / barSec) + 1;

    // 스냅 분할 주기
    const subDiv = snapDiv > 0 ? snapDiv : 4;
    const stepSec = beatSec / (subDiv / 4);

    for (let bar = minBarIdx; bar <= maxBarIdx; bar++) {
      const barTime = offsetSec + bar * barSec;

      // 마디 내부 세부 그리드선
      for (let s = 0; s < subDiv; s++) {
        const t = barTime + s * stepSec;
        if (t < minTime || t > maxTime) continue;

        const y = playheadY - (t - this.currentTime) * pixelsPerSecond;
        const isBarLine = s === 0;
        const isMainBeat = s % (subDiv / 4) === 0;

        ctx.save();
        if (isBarLine) {
          // 마디선 (굵은 골드/화이트)
          ctx.strokeStyle = '#ffe169';
          ctx.lineWidth = 2;
          ctx.shadowColor = 'rgba(255, 225, 105, 0.5)';
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.moveTo(this.RULER_WIDTH, y);
          ctx.lineTo(w, y);
          ctx.stroke();

          // 룰러에 마디 번호 표기 (#1, #2...)
          ctx.font = 'bold 12px Orbitron, sans-serif';
          ctx.fillStyle = '#ffe169';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`#${bar + 1}`, this.RULER_WIDTH / 2, y);
        } else if (isMainBeat) {
          // 정박선 (하늘색)
          ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(this.RULER_WIDTH, y);
          ctx.lineTo(w, y);
          ctx.stroke();

          // 박자 번호 (1.2, 1.3...)
          const beatNum = Math.floor(s / (subDiv / 4)) + 1;
          ctx.font = '600 10px Rajdhani, sans-serif';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`.${beatNum}`, this.RULER_WIDTH / 2, y);
        } else {
          // 세부 분할선 (1/8, 1/16 등)
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.lineWidth = 0.8;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(this.RULER_WIDTH, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }

  private drawNotes(laneWidth: number, pixelsPerSecond: number, playheadY: number, h: number) {
    const ctx = this.ctx;
    const noteHeight = 22;

    for (const note of this.notes) {
      const lx = this.RULER_WIDTH + note.lane * laneWidth;
      const color = this.LANE_COLORS[note.lane];
      const headY = playheadY - (note.time - this.currentTime) * pixelsPerSecond;

      if (note.type === 'hold' && note.duration > 0) {
        // 롱노트
        const tailY = playheadY - (note.time + note.duration - this.currentTime) * pixelsPerSecond;
        const bodyH = Math.max(4, headY - tailY);

        // 화면 바깥이면 건너뛰기
        if (headY < -20 || tailY > h + 20) continue;

        ctx.save();
        // 롱노트 바디
        const grad = ctx.createLinearGradient(0, tailY, 0, headY);
        grad.addColorStop(0, this.hexToRgba(color, 0.35));
        grad.addColorStop(1, this.hexToRgba(color, 0.7));
        ctx.fillStyle = grad;
        ctx.fillRect(lx + 6, tailY, laneWidth - 12, bodyH);

        // 롱노트 측면 테두리
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(lx + 6, tailY, laneWidth - 12, bodyH);

        // 롱노트 테일
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(lx + 8, tailY - 3, laneWidth - 16, 5);

        // 롱노트 헤드
        this.renderNoteBlock(ctx, lx + 4, headY - noteHeight, laneWidth - 8, noteHeight, color);
        ctx.restore();
      } else {
        // 단타 노트
        if (headY < -30 || headY > h + 30) continue;
        this.renderNoteBlock(ctx, lx + 4, headY - noteHeight, laneWidth - 8, noteHeight, color);
      }
    }
  }

  private drawHoldPreview(laneWidth: number, pixelsPerSecond: number, playheadY: number) {
    const ctx = this.ctx;
    const lane = this.dragHoldStartLane!;
    const startT = Math.min(this.dragHoldStartTime!, this.dragHoldCurrentTime!);
    const endT = Math.max(this.dragHoldStartTime!, this.dragHoldCurrentTime!);

    const lx = this.RULER_WIDTH + lane * laneWidth;
    const color = this.LANE_COLORS[lane];
    const headY = playheadY - (startT - this.currentTime) * pixelsPerSecond;
    const tailY = playheadY - (endT - this.currentTime) * pixelsPerSecond;
    const bodyH = Math.max(4, headY - tailY);

    ctx.save();
    ctx.fillStyle = this.hexToRgba(color, 0.5);
    ctx.fillRect(lx + 6, tailY, laneWidth - 12, bodyH);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(lx + 6, tailY, laneWidth - 12, bodyH);
    this.renderNoteBlock(ctx, lx + 4, headY - 22, laneWidth - 8, 22, color);
    ctx.restore();
  }

  private drawHoverGuide(laneWidth: number, pixelsPerSecond: number, playheadY: number) {
    const ctx = this.ctx;
    const lane = this.hoverLane!;
    const time = this.hoverTime!;
    const lx = this.RULER_WIDTH + lane * laneWidth;
    const color = this.LANE_COLORS[lane];
    const y = playheadY - (time - this.currentTime) * pixelsPerSecond;

    ctx.save();
    // 가로 스냅선
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(lx, y);
    ctx.lineTo(lx + laneWidth, y);
    ctx.stroke();

    // 반투명 고스트 노트
    ctx.fillStyle = this.hexToRgba(color, 0.4);
    ctx.fillRect(lx + 4, y - 22, laneWidth - 8, 22);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(lx + 4, y - 22, laneWidth - 8, 22);

    // 시간 툴팁
    ctx.font = '600 10px Rajdhani, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(`${time.toFixed(3)}s`, lx + laneWidth / 2, y - 26);
    ctx.restore();
  }

  private drawPlayhead(w: number, playheadY: number) {
    const ctx = this.ctx;
    ctx.save();

    // 판정선 발광
    ctx.strokeStyle = '#ffe169';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#ffe169';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(this.RULER_WIDTH, playheadY);
    ctx.lineTo(w, playheadY);
    ctx.stroke();

    // 중심 화이트 라인
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(this.RULER_WIDTH, playheadY);
    ctx.lineTo(w, playheadY);
    ctx.stroke();

    // 왼쪽 룰러 플레이헤드 삼각 마커
    ctx.fillStyle = '#ffe169';
    ctx.beginPath();
    ctx.moveTo(this.RULER_WIDTH - 2, playheadY);
    ctx.lineTo(this.RULER_WIDTH - 12, playheadY - 7);
    ctx.lineTo(this.RULER_WIDTH - 12, playheadY + 7);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  private renderNoteBlock(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string
  ) {
    ctx.save();
    const grad = ctx.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.25, color);
    grad.addColorStop(1, this.hexToRgba(color, 0.75));

    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    // 탑 하이라이트
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, w, 3);

    // 테두리
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }

  private hexToRgba(hex: string, alpha: number): string {
    let c = hex.replace('#', '');
    if (c.length === 3) {
      c = c.split('').map(ch => ch + ch).join('');
    }
    const num = parseInt(c, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}
