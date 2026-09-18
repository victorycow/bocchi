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

  private pendingAction: {
    startLane: number;
    startTime: number;
    startY: number;
    startX: number;
    hasMoved: boolean;
    isResizingTail: boolean;
    resizingNoteId: number | null;
    existingNoteId: number | null;
  } | null = null;

  // Callbacks
  private onNotesChangedCb: (() => void) | null = null;
  private onSeekCb: ((time: number) => void) | null = null;
  private onActionSoundCb: (() => void) | null = null;

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

  public onActionSound(cb: () => void) {
    this.onActionSoundCb = cb;
  }

  public addHoldNote(lane: number, startTime: number, duration: number): boolean {
    if (lane < 0 || lane >= 4 || startTime < 0 || duration <= 0) return false;

    const roundStart = Math.round(startTime * 1000) / 1000;
    const roundDur = Math.round(duration * 1000) / 1000;
    const endTime = roundStart + roundDur;

    // 해당 레인에서 이 롱노트와 겹치는 기존 노트들(단타/롱노트) 자동 정리
    this.notes = this.notes.filter(n => {
      if (n.lane !== lane) return true;
      const nEnd = n.type === 'hold' ? n.time + n.duration : n.time;
      const isOverlapping = !(nEnd < roundStart - 0.02 || n.time > endTime + 0.02);
      return !isOverlapping;
    });

    const newNote: NoteData = {
      id: Date.now() + Math.floor(Math.random() * 100000),
      lane,
      time: roundStart,
      duration: roundDur,
      type: 'hold'
    };

    this.notes.push(newNote);
    this.sortNotes();
    this.render();
    this.onNotesChangedCb?.();
    return true;
  }

  public addNoteAt(lane: number, time: number, duration = 0, type: NoteType = 'normal'): boolean {
    if (lane < 0 || lane >= 4 || time < 0) return false;

    if (duration > 0.05 || type === 'hold') {
      return this.addHoldNote(lane, time, Math.max(0.05, duration));
    }

    const roundTime = Math.round(time * 1000) / 1000;

    // 중복 검사: 같은 레인에 비슷한 시간대(0.03초 이내)의 노트가 있으면 무시
    const existingIdx = this.notes.findIndex(
      n => n.lane === lane && Math.abs(n.time - roundTime) < 0.03
    );

    if (existingIdx >= 0) {
      return false;
    }

    const newNote: NoteData = {
      id: Date.now() + Math.floor(Math.random() * 100000),
      lane,
      time: roundTime,
      duration: 0,
      type: 'normal'
    };

    this.notes.push(newNote);
    this.sortNotes();
    this.render();
    this.onNotesChangedCb?.();
    return true;
  }

  public deleteNoteById(id: number): boolean {
    const idx = this.notes.findIndex(n => n.id === id);
    if (idx >= 0) {
      this.notes.splice(idx, 1);
      this.render();
      this.onNotesChangedCb?.();
      return true;
    }
    return false;
  }

  public deleteNoteAtPosition(lane: number, rawHoverTime: number, pixelsPerSecond: number): boolean {
    const idx = this.notes.findIndex(n => {
      if (n.lane !== lane) return false;
      if (n.type === 'hold') {
        return rawHoverTime >= n.time - 0.04 && rawHoverTime <= n.time + n.duration + 0.04;
      }
      const distPx = Math.abs(n.time - rawHoverTime) * pixelsPerSecond;
      return distPx <= 22;
    });

    if (idx >= 0) {
      this.notes.splice(idx, 1);
      this.render();
      this.onNotesChangedCb?.();
      return true;
    }
    return false;
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

  private isNearAnyHoldTail(lane: number | null, rawHoverTime: number, pixelsPerSecond: number): boolean {
    if (lane === null) return false;
    return this.notes.some(n => {
      if (n.lane !== lane || n.type !== 'hold' || n.duration <= 0) return false;
      const tailT = n.time + n.duration;
      return Math.abs(tailT - rawHoverTime) * pixelsPerSecond <= 16;
    });
  }

  private setupMouseEvents() {
    // 캔버스 우클릭 브라우저 메뉴 차단 (우클릭 노트 삭제 전용)
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

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

      // 우클릭 드래그 지우개: 우클릭을 누른 상태로 이동 시 지나가는 모든 노트 즉시 삭제
      if ((e.buttons & 2) === 2 && this.hoverLane !== null) {
        if (this.deleteNoteAtPosition(this.hoverLane, rawHoverTime, pixelsPerSecond)) {
          this.onActionSoundCb?.();
        }
      }

      // 좌클릭 누른 상태 드래그 처리
      if ((e.buttons & 1) === 1 && this.pendingAction) {
        const distY = Math.abs(e.clientY - this.pendingAction.startY);
        const timeDiff = Math.abs(this.hoverTime - this.pendingAction.startTime);

        // 4픽셀 이상 움직였거나 비트 스냅이 변하면 드래그로 판정!
        if (!this.pendingAction.hasMoved && (distY > 4 || timeDiff > 0.02)) {
          this.pendingAction.hasMoved = true;
        }

        if (this.pendingAction.hasMoved || this.noteMode === 'hold') {
          if (this.pendingAction.isResizingTail && this.pendingAction.resizingNoteId !== null) {
            const note = this.notes.find(n => n.id === this.pendingAction!.resizingNoteId);
            if (note) {
              const newDur = Math.max(0.05, this.hoverTime - note.time);
              note.duration = Math.round(newDur * 1000) / 1000;
            }
          } else {
            this.isDraggingHold = true;
            this.dragHoldStartLane = this.pendingAction.startLane;
            this.dragHoldStartTime = this.pendingAction.startTime;
            this.dragHoldCurrentTime = this.hoverTime;
          }
        }
      } else {
        // 마우스 버튼 안 누르고 호버 중일 때 커서 모양 변경
        if (x < this.RULER_WIDTH) {
          this.canvas.style.cursor = 'pointer';
        } else if (this.isNearAnyHoldTail(this.hoverLane, rawHoverTime, pixelsPerSecond)) {
          this.canvas.style.cursor = 'ns-resize';
        } else {
          this.canvas.style.cursor = 'crosshair';
        }
      }

      this.render();
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.hoverLane = null;
      this.hoverTime = null;
      if (this.isDraggingHold || this.pendingAction) {
        this.finishPointerDrag();
      }
      this.render();
    });

    this.canvas.addEventListener('mousedown', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // 우클릭 단타 삭제: 커서 위치의 노트를 즉시 삭제
      if (e.button === 2) {
        e.preventDefault();
        if (x >= this.RULER_WIDTH && this.hoverLane !== null) {
          const pixelsPerSecond = this.getPixelsPerSecond();
          const playheadY = this.getPlayheadY(rect.height);
          const rawHoverTime = this.currentTime + (playheadY - y) / pixelsPerSecond;
          if (this.deleteNoteAtPosition(this.hoverLane, rawHoverTime, pixelsPerSecond)) {
            this.onActionSoundCb?.();
          }
        }
        return;
      }

      if (e.button !== 0) return; // 좌클릭 전용

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
      const pixelsPerSecond = this.getPixelsPerSecond();
      const playheadY = this.getPlayheadY(rect.height);
      const rawHoverTime = this.currentTime + (playheadY - y) / pixelsPerSecond;

      let isResizingTail = false;
      let resizingNoteId: number | null = null;
      let existingNoteId: number | null = null;
      let baseStartTime = targetTime;

      // 1) 롱노트 테일(끝단) 클릭 감지
      for (const note of this.notes) {
        if (note.lane === targetLane && note.type === 'hold' && note.duration > 0) {
          const tailT = note.time + note.duration;
          const distTailPx = Math.abs((rawHoverTime - tailT) * pixelsPerSecond);
          if (distTailPx <= 16) {
            isResizingTail = true;
            resizingNoteId = note.id;
            baseStartTime = note.time;
            break;
          }
        }
      }

      // 2) 테일이 아니면 기존 노트(헤드 또는 바디) 감지
      if (!isResizingTail) {
        for (const note of this.notes) {
          if (note.lane === targetLane) {
            if (note.type === 'hold') {
              if (rawHoverTime >= note.time - 0.04 && rawHoverTime <= note.time + note.duration + 0.04) {
                existingNoteId = note.id;
                baseStartTime = note.time;
                break;
              }
            } else {
              const distPx = Math.abs((rawHoverTime - note.time) * pixelsPerSecond);
              if (distPx <= 22) {
                existingNoteId = note.id;
                baseStartTime = note.time;
                break;
              }
            }
          }
        }
      }

      this.pendingAction = {
        startLane: targetLane,
        startTime: baseStartTime,
        startY: e.clientY,
        startX: e.clientX,
        hasMoved: false,
        isResizingTail,
        resizingNoteId,
        existingNoteId
      };

      // 만약 HOLD 모드일 경우 즉시 드래그 상태 준비
      if (this.noteMode === 'hold' && !isResizingTail) {
        this.isDraggingHold = true;
        this.dragHoldStartLane = targetLane;
        this.dragHoldStartTime = baseStartTime;
        this.dragHoldCurrentTime = targetTime;
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.pendingAction) {
        this.finishPointerDrag();
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

  private finishPointerDrag() {
    if (!this.pendingAction) return;
    const action = this.pendingAction;
    this.pendingAction = null;

    if (action.isResizingTail) {
      // 롱노트 테일 길이 조절 완료
      this.sortNotes();
      this.onNotesChangedCb?.();
      this.onActionSoundCb?.();
    } else if (action.hasMoved || (this.isDraggingHold && this.dragHoldStartTime !== null)) {
      // 마우스를 드래그함 -> 롱노트 생성!
      const startCandidate = this.dragHoldStartTime ?? action.startTime;
      const curCandidate = this.dragHoldCurrentTime ?? this.hoverTime ?? action.startTime;
      const startT = Math.min(startCandidate, curCandidate);
      const endT = Math.max(startCandidate, curCandidate);
      const duration = Math.round((endT - startT) * 1000) / 1000;

      if (duration >= 0.06) {
        this.addHoldNote(action.startLane, startT, duration);
        this.onActionSoundCb?.();
      } else {
        // 드래그 거리가 0.06초 미만인 미세 클릭인 경우
        if (action.existingNoteId === null) {
          this.addNoteAt(action.startLane, action.startTime, 0, 'normal');
          this.onActionSoundCb?.();
        }
      }
    } else {
      // 단순 클릭 (드래그하지 않음)
      if (action.existingNoteId !== null) {
        // 기존 노트 클릭 -> 삭제 (토글 기능)
        this.deleteNoteById(action.existingNoteId);
        this.onActionSoundCb?.();
      } else {
        // 빈 공간 클릭
        if (this.noteMode === 'hold') {
          // HOLD 모드일 때는 기본 1박자 길이의 롱노트 즉시 생성
          const beatSec = 60 / this.config.bpm;
          const defaultHoldDur = Math.round(beatSec * 1000) / 1000;
          this.addHoldNote(action.startLane, action.startTime, defaultHoldDur);
          this.onActionSoundCb?.();
        } else {
          // 일반 모드: 단타 노트 생성
          this.addNoteAt(action.startLane, action.startTime, 0, 'normal');
          this.onActionSoundCb?.();
        }
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
    const duration = Math.max(0.01, endT - startT);

    const lx = this.RULER_WIDTH + lane * laneWidth;
    const color = this.LANE_COLORS[lane];
    const headY = playheadY - (startT - this.currentTime) * pixelsPerSecond;
    const tailY = playheadY - (endT - this.currentTime) * pixelsPerSecond;
    const bodyH = Math.max(4, headY - tailY);

    ctx.save();
    // 롱노트 바디 그라디언트
    const grad = ctx.createLinearGradient(0, tailY, 0, headY);
    grad.addColorStop(0, this.hexToRgba(color, 0.45));
    grad.addColorStop(1, this.hexToRgba(color, 0.8));
    ctx.fillStyle = grad;
    ctx.fillRect(lx + 6, tailY, laneWidth - 12, bodyH);

    // 테두리
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(lx + 6, tailY, laneWidth - 12, bodyH);

    // 테일 바 (상단 끝단)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(lx + 6, tailY - 4, laneWidth - 12, 6);

    // 헤드 블록 (하단 시작점)
    this.renderNoteBlock(ctx, lx + 4, headY - 22, laneWidth - 8, 22, color);

    // 길이 뱃지 (말풍선 태그)
    const beatSec = 60 / this.config.bpm;
    const beats = duration / beatSec;
    const badgeText = `${duration.toFixed(2)}s (${beats.toFixed(1)}B)`;

    ctx.font = 'bold 11px Orbitron, sans-serif';
    const textW = ctx.measureText(badgeText).width;
    const badgeW = textW + 14;
    const badgeH = 18;
    const badgeX = lx + laneWidth / 2 - badgeW / 2;
    const badgeY = tailY - 26;

    ctx.fillStyle = 'rgba(10, 14, 28, 0.9)';
    ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);

    ctx.fillStyle = '#ffe169';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, lx + laneWidth / 2, badgeY + badgeH / 2);

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
