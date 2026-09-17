import { KeyMode, NoteData, JudgementEvent, GameStats } from './types';
import { InputManager } from './input';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

interface JudgementPopup {
  text: string;
  color: string;
  diffMsText: string;
  alpha: number;
  scale: number;
  yOffset: number;
}

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private bgCanvas: HTMLCanvasElement;
  private bgCtx: CanvasRenderingContext2D;

  private width = 0;
  private height = 0;

  // 파티클 & 애니메이션
  private particles: Particle[] = [];
  private currentJudgement: JudgementPopup | null = null;
  private comboScale = 1.0;

  // 봇치 더 록! 결속밴드 4인 상징 레인 컬러 (0:보치 핑크, 1:니지카 옐로우, 2:료 블루, 3:키타 레드)
  private readonly LANE_COLORS_4K = ['#ff6b9d', '#ffcc00', '#00c2ff', '#ff4365'];
  private readonly LANE_COLORS_6K = ['#ff6b9d', '#ffcc00', '#00c2ff', '#ff4365', '#ffcc00', '#ff6b9d'];

  // 무대 배경 일러스트 (stage-bg.jpg / stage-bg.png)
  private stageBgImg: HTMLImageElement | null = null;
  private stageBgLoaded = false;

  constructor(gameCanvas: HTMLCanvasElement, bgCanvas?: HTMLCanvasElement) {
    this.canvas = gameCanvas;
    this.ctx = gameCanvas.getContext('2d')!;
    this.bgCanvas = bgCanvas || document.createElement('canvas');
    this.bgCtx = this.bgCanvas.getContext('2d')!;

    this.initStageBackground();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private initStageBackground() {
    const tryLoad = (src: string, fallbackSrc?: string) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        this.stageBgImg = img;
        this.stageBgLoaded = true;
      };
      img.onerror = () => {
        if (fallbackSrc) {
          tryLoad(fallbackSrc);
        }
      };
    };
    tryLoad('/images/stage-bg.jpg', '/images/stage-bg.png');
  }

  public resize() {
    const dpr = window.devicePixelRatio || 1;
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.resetTransform?.();
    this.ctx.scale(dpr, dpr);

    this.bgCanvas.width = this.width * dpr;
    this.bgCanvas.height = this.height * dpr;
    this.bgCtx.resetTransform?.();
    this.bgCtx.scale(dpr, dpr);
  }

  /**
   * 배경 앰비언트 & 오디오 비주얼라이저 (STARRY 라이브하우스 무대 감성)
   */
  public renderBackground(audioFreqData: Uint8Array, feverLevel: number) {
    const ctx = this.bgCtx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    // 1. 라이브하우스 STARRY 암막 및 무대 조명 베이스 그라디언트
    const bgGrad = ctx.createRadialGradient(w / 2, h * 0.4, 80, w / 2, h / 2, Math.max(w, h));
    bgGrad.addColorStop(0, feverLevel > 1 ? '#220e24' : '#141726');
    bgGrad.addColorStop(0.6, '#0b0c16');
    bgGrad.addColorStop(1, '#05060b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // 1-1. 무대 배경 이미지 렌더링 (stage-bg.jpg / stage-bg.png 가 존재할 경우 은은하게 오버레이)
    if (this.stageBgLoaded && this.stageBgImg) {
      ctx.save();
      ctx.globalAlpha = 0.38 + (feverLevel > 1 ? 0.12 : 0);
      const imgW = this.stageBgImg.naturalWidth || this.stageBgImg.width;
      const imgH = this.stageBgImg.naturalHeight || this.stageBgImg.height;
      if (imgW > 0 && imgH > 0) {
        const imgRatio = imgW / imgH;
        const screenRatio = w / h;
        let drawW = w;
        let drawH = h;
        let drawX = 0;
        let drawY = 0;
        if (screenRatio > imgRatio) {
          drawW = w;
          drawH = w / imgRatio;
          drawY = (h - drawH) / 2;
        } else {
          drawH = h;
          drawW = h * imgRatio;
          drawX = (w - drawW) / 2;
        }
        ctx.drawImage(this.stageBgImg, drawX, drawY, drawW, drawH);
      }
      ctx.restore();
    }

    // 2. 무대 스포트라이트 콘 (핑크 & 스타리 골드 빔)
    ctx.save();
    // 좌측 스포트라이트 (보치 핑크)
    const spotPink = ctx.createRadialGradient(w * 0.25, 0, 10, w * 0.35, h * 0.6, h * 0.7);
    spotPink.addColorStop(0, 'rgba(255, 107, 157, 0.18)');
    spotPink.addColorStop(1, 'rgba(255, 107, 157, 0)');
    ctx.fillStyle = spotPink;
    ctx.fillRect(0, 0, w, h);

    // 우측 스포트라이트 (스타리 옐로우)
    const spotYellow = ctx.createRadialGradient(w * 0.75, 0, 10, w * 0.65, h * 0.6, h * 0.7);
    spotYellow.addColorStop(0, 'rgba(255, 225, 105, 0.16)');
    spotYellow.addColorStop(1, 'rgba(255, 225, 105, 0)');
    ctx.fillStyle = spotYellow;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // 3. 결속밴드 4색 오디오 반응형 무대 이퀄라이저
    if (audioFreqData && audioFreqData.length > 0) {
      const barCount = audioFreqData.length;
      const barWidth = (w / barCount) * 1.5;
      const bandColors = ['#ff6b9d', '#ffcc00', '#00c2ff', '#ff4365'];

      ctx.save();
      for (let i = 0; i < barCount; i++) {
        const val = audioFreqData[i] / 255;
        const barHeight = val * (h * 0.36);

        const color = bandColors[i % bandColors.length];
        ctx.fillStyle = this.hexToRgba(color, 0.18 + val * 0.32);

        const x = (i * barWidth);
        ctx.fillRect(x, h - barHeight, barWidth - 4, barHeight);
        ctx.fillRect(w - x - barWidth, h - barHeight, barWidth - 4, barHeight);
      }
      ctx.restore();
    }

    // 4. STARRY 라이브하우스 무대 별빛 앰비언트
    ctx.save();
    ctx.fillStyle = 'rgba(255, 234, 121, 0.12)';
    const starCount = 18;
    for (let i = 0; i < starCount; i++) {
      const sx = (w * (i * 0.055 + 0.03)) % w;
      const sy = (h * 0.15 + (i % 5) * 45) % (h * 0.7);
      ctx.beginPath();
      ctx.arc(sx, sy, (i % 3) + 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * 메인 게임 화면 렌더링
   */
  public renderGame(
    keyMode: KeyMode,
    currentSongTime: number,
    notes: NoteData[],
    stats: GameStats,
    input: InputManager,
    speedMultiplier: number,
    newJudgements: JudgementEvent[]
  ) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    const laneCount = keyMode === '4K' ? 4 : 6;
    // 화면 크기에 맞추되 시원시원하고 큼직한 아케이드 건반 크기 (4K: 126px, 6K: 98px)
    const maxAvailableWidth = Math.min(w * 0.85, 800);
    const targetLaneWidth = keyMode === '4K' ? 126 : 98;
    const laneWidth = Math.min(targetLaneWidth, Math.floor(maxAvailableWidth / laneCount));
    const gearWidth = laneCount * laneWidth;
    const gearX = (w - gearWidth) / 2;
    // 판정선 Y 좌표: 화면 하단 약 1/3(32~33%) 지점으로 상향 배치 (시야각 최적화 및 목/눈 피로 방지)
    const judgeLineY = Math.round(h * 0.68);
    const laneColors = keyMode === '4K' ? this.LANE_COLORS_4K : this.LANE_COLORS_6K;

    // 새로운 판정 이벤트 처리 (팝업 및 파티클 트리거)
    for (const ev of newJudgements) {
      this.triggerJudgementVisual(ev, gearX, laneWidth, judgeLineY, laneColors);
    }

    // 1. 기어 배경 및 레일 그리기
    this.drawGear(gearX, gearWidth, judgeLineY, h, laneCount, laneWidth, stats);

    // 2. 키 빔 (건반 누르고 있을 때 판정선 위로 은은하게 솟는 빛)
    this.drawKeyBeams(gearX, laneWidth, laneCount, judgeLineY, input, laneColors);

    // 3. 판정선 렌더링
    this.drawJudgeLine(gearX, gearWidth, judgeLineY);

    // 4. 노트 렌더링 (단타 및 롱노트)
    this.drawNotes(notes, currentSongTime, speedMultiplier, gearX, laneWidth, judgeLineY, laneColors);

    // 5. 건반 하단 캡 및 하단 STARRY 스테이지 콘솔 덱
    this.drawKeycaps(gearX, laneWidth, laneCount, judgeLineY, input, keyMode, laneColors, stats);

    // 6. 타격 파티클 렌더링
    this.updateAndDrawParticles();

    // 7. 판정 텍스트 & 콤보 팝업 렌더링 (키 빔 윗 공간)
    this.drawJudgementAndCombo(w / 2, judgeLineY - 150, stats.combo);

    // 8. 양쪽 게이지 (Groove HP / Fever) 렌더링
    this.drawGauges(gearX, gearWidth, judgeLineY, stats);
  }

  private drawGear(gearX: number, gearWidth: number, judgeLineY: number, h: number, laneCount: number, laneWidth: number, stats: GameStats) {
    const ctx = this.ctx;

    ctx.save();

    // 기어 본체 배경 (반투명 다크 글래스)
    const gearGrad = ctx.createLinearGradient(gearX, 0, gearX + gearWidth, 0);
    gearGrad.addColorStop(0, 'rgba(8, 12, 24, 0.94)');
    gearGrad.addColorStop(0.5, 'rgba(12, 18, 36, 0.90)');
    gearGrad.addColorStop(1, 'rgba(8, 12, 24, 0.94)');
    ctx.fillStyle = gearGrad;
    ctx.fillRect(gearX, 0, gearWidth, h);

    // 기어 외곽 프레임 네온 라인 (피버 시 보치 핑크, 평상 시 스타리 골드)
    const borderColor = stats.isFeverActive ? '#ff6b9d' : '#ffe169';
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 3.5;
    ctx.shadowColor = borderColor;
    ctx.shadowBlur = stats.isFeverActive ? 24 : 14;

    ctx.beginPath();
    ctx.moveTo(gearX, 0);
    ctx.lineTo(gearX, h);
    ctx.moveTo(gearX + gearWidth, 0);
    ctx.lineTo(gearX + gearWidth, h);
    ctx.stroke();

    // 레인 구분선
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1.5;
    for (let i = 1; i < laneCount; i++) {
      const lx = gearX + i * laneWidth;
      ctx.beginPath();
      ctx.moveTo(lx, 0);
      ctx.lineTo(lx, h);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawKeyBeams(
    gearX: number,
    laneWidth: number,
    laneCount: number,
    judgeLineY: number,
    input: InputManager,
    laneColors: string[]
  ) {
    const ctx = this.ctx;
    // 키 빔 높이 제한: 전체 트랙을 가리지 않고 판정선 근처에서만 은은하게 솟아오름 (약 200px)
    const beamHeight = Math.min(220, judgeLineY * 0.28);
    const beamTopY = judgeLineY - beamHeight;

    for (let i = 0; i < laneCount; i++) {
      if (input.isLanePressed(i)) {
        const lx = gearX + i * laneWidth;
        const color = laneColors[i];

        ctx.save();

        // 1. 레인 소프트 빔 (판정선에서 위로 올라갈수록 부드럽게 소멸하여 위쪽 노트 시야 완전 확보)
        const beamGrad = ctx.createLinearGradient(0, judgeLineY, 0, beamTopY);
        beamGrad.addColorStop(0, this.hexToRgba(color, 0.35));
        beamGrad.addColorStop(0.35, this.hexToRgba(color, 0.15));
        beamGrad.addColorStop(0.75, this.hexToRgba(color, 0.04));
        beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = beamGrad;
        ctx.fillRect(lx, beamTopY, laneWidth, beamHeight);

        // 2. 중앙 은은한 코어 플레어 (짧고 부드럽게 위로 페이드)
        const coreHeight = Math.min(85, beamHeight * 0.45);
        const coreTopY = judgeLineY - coreHeight;
        const coreGrad = ctx.createLinearGradient(0, judgeLineY, 0, coreTopY);
        coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
        coreGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.08)');
        coreGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = coreGrad;
        ctx.fillRect(lx + laneWidth * 0.2, coreTopY, laneWidth * 0.6, coreHeight);

        // 3. 판정선 타격 라인 악센트 플래시
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.fillRect(lx + 4, judgeLineY - 2, laneWidth - 8, 4);

        ctx.restore();
      }
    }
  }

  private drawJudgeLine(gearX: number, gearWidth: number, judgeLineY: number) {
    const ctx = this.ctx;
    ctx.save();

    // 판정선 글로우 (STARRY 골드 & 화이트)
    ctx.shadowColor = '#ffe169';
    ctx.shadowBlur = 14;
    ctx.strokeStyle = '#ffe169';
    ctx.lineWidth = 4;

    ctx.beginPath();
    ctx.moveTo(gearX, judgeLineY);
    ctx.lineTo(gearX + gearWidth, judgeLineY);
    ctx.stroke();

    // 중심 화이트 라인
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(gearX, judgeLineY);
    ctx.lineTo(gearX + gearWidth, judgeLineY);
    ctx.stroke();

    ctx.restore();
  }

  private drawNotes(
    notes: NoteData[],
    currentSongTime: number,
    speedMultiplier: number,
    gearX: number,
    laneWidth: number,
    judgeLineY: number,
    laneColors: string[]
  ) {
    const ctx = this.ctx;
    const pixelsPerSecond = 550 * speedMultiplier;
    const noteHeight = 26; // 시원시원하고 묵직한 아케이드 건반 노트 두께

    // 화면에 보여야 할 시간 범위 계산
    const timeBeforeJudge = judgeLineY / pixelsPerSecond;
    const minVisibleTime = currentSongTime - 0.4;
    const maxVisibleTime = currentSongTime + timeBeforeJudge;

    ctx.save();

    for (const note of notes) {
      if (note.missed && !note.holding) continue;
      if (note.hit && note.type === 'normal') continue;
      if (note.holdCompleted) continue;

      const noteEndTime = note.time + note.duration;
      // 화면 범위 바깥 노트 건너뛰기
      if (noteEndTime < minVisibleTime || note.time > maxVisibleTime) continue;

      const lx = gearX + note.lane * laneWidth;
      const color = laneColors[note.lane];

      // 노트 Y 좌표: time = currentSongTime 일 때 judgeLineY에 도달
      // time > currentSongTime 이면 judgeLineY 위쪽에 위치
      const headY = judgeLineY - (note.time - currentSongTime) * pixelsPerSecond;

      if (note.type === 'hold') {
        // 롱노트 렌더링
        const tailY = judgeLineY - (noteEndTime - currentSongTime) * pixelsPerSecond;
        const currentHeadY = note.holding ? judgeLineY : headY;
        const bodyHeight = Math.max(4, currentHeadY - tailY);

        // 롱노트 바디 (그라디언트)
        const bodyGrad = ctx.createLinearGradient(0, tailY, 0, currentHeadY);
        bodyGrad.addColorStop(0, this.hexToRgba(color, 0.4));
        bodyGrad.addColorStop(1, this.hexToRgba(color, 0.75));

        ctx.fillStyle = bodyGrad;
        ctx.fillRect(lx + 7, tailY, laneWidth - 14, bodyHeight);

        // 롱노트 측면 발광 라인
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(lx + 7, tailY, laneWidth - 14, bodyHeight);

        // 롱노트 테일 캡 (끝부분)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(lx + 9, tailY - 4, laneWidth - 18, 7);

        // 롱노트 헤드 캡 (머리부분)
        if (!note.holding) {
          this.drawNoteBlock(ctx, lx, headY - noteHeight, laneWidth, noteHeight, color);
        } else {
          // 홀드 중일 때 판정선에서 튀는 전기/파티클 생성
          if (Math.random() < 0.6) {
            this.addParticle(lx + laneWidth / 2, judgeLineY, color);
          }
        }
      } else {
        // 단타 노트 렌더링
        this.drawNoteBlock(ctx, lx, headY - noteHeight, laneWidth, noteHeight, color);
      }
    }

    ctx.restore();
  }

  private drawNoteBlock(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    color: string
  ) {
    const pad = 5;
    const nw = width - pad * 2;
    const nx = x + pad;

    // 본체 그라디언트 (고급스러운 네온 하이라이트)
    const grad = ctx.createLinearGradient(0, y, 0, y + height);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.22, color);
    grad.addColorStop(1, this.hexToRgba(color, 0.75));

    ctx.fillStyle = grad;
    ctx.fillRect(nx, y, nw, height);

    // 하이라이트 탑 라인
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(nx, y, nw, 4);

    // 외곽 테두리
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(nx, y, nw, height);
  }

  private drawKeycaps(
    gearX: number,
    laneWidth: number,
    laneCount: number,
    judgeLineY: number,
    input: InputManager,
    keyMode: KeyMode,
    laneColors: string[],
    stats: GameStats
  ) {
    const ctx = this.ctx;
    const h = this.height;
    const bottomAreaHeight = h - judgeLineY;
    const buttonHeight = Math.min(95, Math.max(68, Math.round(bottomAreaHeight * 0.35)));

    ctx.save();

    // 1. 건반 버튼 (Keycaps)
    for (let i = 0; i < laneCount; i++) {
      const lx = gearX + i * laneWidth;
      const isPressed = input.isLanePressed(i);
      const color = laneColors[i];
      const btnY = judgeLineY + 5;
      const btnH = buttonHeight;

      // 건반 캡 배경 그라디언트
      const btnGrad = ctx.createLinearGradient(0, btnY, 0, btnY + btnH);
      if (isPressed) {
        btnGrad.addColorStop(0, this.hexToRgba(color, 0.85));
        btnGrad.addColorStop(0.35, this.hexToRgba(color, 0.55));
        btnGrad.addColorStop(1, this.hexToRgba(color, 0.25));
        ctx.fillStyle = btnGrad;
        ctx.shadowColor = color;
        ctx.shadowBlur = 14;
      } else {
        btnGrad.addColorStop(0, 'rgba(24, 32, 52, 0.92)');
        btnGrad.addColorStop(1, 'rgba(12, 17, 30, 0.95)');
        ctx.fillStyle = btnGrad;
        ctx.shadowBlur = 0;
      }
      ctx.fillRect(lx + 3, btnY, laneWidth - 6, btnH);

      // 상단 베벨 하이라이트 라인
      ctx.fillStyle = isPressed ? '#ffffff' : this.hexToRgba(color, 0.7);
      ctx.fillRect(lx + 5, btnY + 2, laneWidth - 10, 3);

      // 외곽 테두리
      ctx.strokeStyle = isPressed ? '#ffffff' : this.hexToRgba(color, 0.35);
      ctx.lineWidth = isPressed ? 2.5 : 1.5;
      ctx.strokeRect(lx + 3, btnY, laneWidth - 6, btnH);

      // 키 매핑 텍스트 라벨 (예: D, F, J, K)
      const keyName = input.getKeyNameForLane(i, keyMode);
      ctx.font = 'bold 22px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isPressed ? '#ffffff' : this.hexToRgba(color, 0.95);
      ctx.shadowColor = isPressed ? color : 'transparent';
      ctx.shadowBlur = isPressed ? 8 : 0;
      ctx.fillText(keyName, lx + laneWidth / 2, btnY + btnH * 0.44);

      // 4K 모드일 때 결속밴드 4인 상징 멤버 표기 (BOCCHI, NIJIKA, RYO, KITA)
      if (keyMode === '4K') {
        const memberNames = ['BOCCHI', 'NIJIKA', 'RYO', 'KITA'];
        ctx.font = '800 11px Orbitron, sans-serif';
        ctx.fillStyle = isPressed ? '#ffffff' : this.hexToRgba(color, 0.75);
        ctx.fillText(memberNames[i], lx + laneWidth / 2, btnY + btnH * 0.76);
      }
    }

    // 2. 하단 STARRY 라이브 스테이지 콘솔 덱 (아케이드 감성 디자인)
    const deckY = judgeLineY + buttonHeight + 11;
    const deckHeight = h - deckY - 8;

    if (deckHeight >= 36) {
      // 덱 메인 프레임 배경
      const deckGrad = ctx.createLinearGradient(0, deckY, 0, deckY + deckHeight);
      deckGrad.addColorStop(0, 'rgba(10, 14, 26, 0.98)');
      deckGrad.addColorStop(0.5, 'rgba(15, 20, 38, 0.95)');
      deckGrad.addColorStop(1, 'rgba(8, 11, 20, 0.98)');
      ctx.fillStyle = deckGrad;
      ctx.fillRect(gearX + 3, deckY, (laneCount * laneWidth) - 6, deckHeight);

      // 덱 외곽선 (피버 모드 시 핑크 글로우)
      const deckBorder = stats.isFeverActive ? '#ff6b9d' : 'rgba(255, 225, 105, 0.35)';
      ctx.strokeStyle = deckBorder;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = stats.isFeverActive ? '#ff6b9d' : 'rgba(255, 225, 105, 0.4)';
      ctx.shadowBlur = stats.isFeverActive ? 12 : 6;
      ctx.strokeRect(gearX + 3, deckY, (laneCount * laneWidth) - 6, deckHeight);

      // 레인별 동적 LED 인디케이터
      for (let i = 0; i < laneCount; i++) {
        const lx = gearX + i * laneWidth;
        const isPressed = input.isLanePressed(i);
        const color = laneColors[i];

        // 상단 LED 램프
        const ledY = deckY + 6;
        const ledH = 4;
        if (isPressed) {
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = color;
          ctx.shadowBlur = 10;
          ctx.fillRect(lx + 8, ledY, laneWidth - 16, ledH);
        } else {
          ctx.fillStyle = this.hexToRgba(color, 0.25);
          ctx.shadowBlur = 0;
          ctx.fillRect(lx + 8, ledY, laneWidth - 16, ledH);
        }

        // 세로 레일 구분선
        if (i > 0) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(lx, deckY);
          ctx.lineTo(lx, deckY + deckHeight);
          ctx.stroke();
        }
      }

      // 중앙 STARRY 스테이지 엠블럼 텍스트
      const centerX = gearX + (laneCount * laneWidth) / 2;
      const centerY = deckY + deckHeight / 2 + 3;

      if (deckHeight >= 55) {
        ctx.font = '900 12px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const starColor = stats.isFeverActive ? '#ff6b9d' : '#ffe169';
        ctx.fillStyle = starColor;
        ctx.shadowColor = starColor;
        ctx.shadowBlur = 8;
        ctx.fillText('★ LIVE HOUSE STARRY ★', centerX, centerY - 8);

        ctx.font = '700 9px Orbitron, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.shadowBlur = 0;
        ctx.fillText('KESSOKU BAND STAGE CONSOLE', centerX, centerY + 10);
      }
    }

    ctx.restore();
  }

  private triggerJudgementVisual(
    ev: JudgementEvent,
    gearX: number,
    laneWidth: number,
    judgeLineY: number,
    laneColors: string[]
  ) {
    const colorMap: Record<string, string> = {
      MAX100: '#ffe169', // STARRY 골드
      '90': '#ffcc00',   // 니지카 옐로우
      '80': '#00c2ff',   // 료 블루
      '70': '#ff6b9d',   // 보치 핑크
      '50': '#b5179e',
      MISS: '#ff4365',   // 키타 레드
    };

    const textMap: Record<string, string> = {
      MAX100: '100% MAX',
      '90': '90%',
      '80': '80%',
      '70': '70%',
      '50': '50%',
      MISS: 'MISS',
    };

    const c = colorMap[ev.type] || '#fff';
    const diffStr = ev.type === 'MISS' ? '' : `${ev.diffMs > 0 ? '+' : ''}${Math.round(ev.diffMs)}ms`;

    this.currentJudgement = {
      text: textMap[ev.type] || ev.type,
      color: c,
      diffMsText: diffStr,
      alpha: 1.0,
      scale: 1.3,
      yOffset: 0
    };

    // 콤보 애니메이션 스케일 펌프
    this.comboScale = 1.35;

    // 판정 적중 파티클 폭발 (MISS 제외)
    if (ev.type !== 'MISS') {
      const hitX = gearX + ev.lane * laneWidth + laneWidth / 2;
      const count = ev.type === 'MAX100' ? 18 : 10;
      for (let i = 0; i < count; i++) {
        this.addParticle(hitX, judgeLineY, laneColors[ev.lane]);
      }
    }
  }

  private addParticle(x: number, y: number, color: string) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 6;
    this.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.5,
      size: 2 + Math.random() * 4,
      color,
      alpha: 1.0,
      life: 0,
      maxLife: 20 + Math.random() * 15
    });
  }

  private updateAndDrawParticles() {
    const ctx = this.ctx;
    ctx.save();

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12; // 중력
      p.life++;
      p.alpha = 1 - p.life / p.maxLife;

      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      ctx.fillStyle = this.hexToRgba(p.color, p.alpha);
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawJudgementAndCombo(centerX: number, centerY: number, combo: number) {
    const ctx = this.ctx;

    // 1. 콤보 카운터 렌더링
    if (combo > 1) {
      ctx.save();
      this.comboScale += (1.0 - this.comboScale) * 0.15;

      ctx.translate(centerX, centerY - 48);
      ctx.scale(this.comboScale, this.comboScale);

      // 숫자
      ctx.font = '900 64px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 18;
      ctx.fillText(combo.toString(), 0, 0);

      // COMBO 텍스트
      ctx.font = '700 18px Orbitron, sans-serif';
      ctx.fillStyle = '#00f0ff';
      ctx.letterSpacing = '4px';
      ctx.shadowBlur = 8;
      ctx.fillText('COMBO', 0, 36);

      ctx.restore();
    }

    // 2. 판정 텍스트 렌더링
    if (this.currentJudgement) {
      const j = this.currentJudgement;
      j.scale += (1.0 - j.scale) * 0.2;
      j.alpha -= 0.025;
      j.yOffset -= 0.4;

      if (j.alpha <= 0) {
        this.currentJudgement = null;
        return;
      }

      ctx.save();
      ctx.translate(centerX, centerY + j.yOffset);
      ctx.scale(j.scale, j.scale);

      ctx.font = '900 32px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = this.hexToRgba(j.color, j.alpha);
      ctx.shadowColor = j.color;
      ctx.shadowBlur = 16;
      ctx.fillText(j.text, 0, 0);

      // 밀리초 오차 표기 (ms)
      if (j.diffMsText) {
        ctx.font = '600 15px Rajdhani, sans-serif';
        ctx.fillStyle = this.hexToRgba('#ffffff', j.alpha * 0.85);
        ctx.shadowBlur = 4;
        ctx.fillText(j.diffMsText, 0, 24);
      }

      ctx.restore();
    }
  }

  private drawGauges(gearX: number, gearWidth: number, judgeLineY: number, stats: GameStats) {
    const ctx = this.ctx;
    const gaugeWidth = 12;
    const gaugeHeight = judgeLineY - 40;
    const gaugeY = 30;

    ctx.save();

    // 1. 좌측: Groove HP 게이지
    const hpX = gearX - gaugeWidth - 16;
    // 배경
    ctx.fillStyle = 'rgba(10, 15, 25, 0.7)';
    ctx.fillRect(hpX, gaugeY, gaugeWidth, gaugeHeight);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.strokeRect(hpX, gaugeY, gaugeWidth, gaugeHeight);

    // HP 채움
    const hpRate = Math.max(0, Math.min(1, stats.grooveGauge / 100));
    const hpFillH = gaugeHeight * hpRate;
    const hpGrad = ctx.createLinearGradient(0, gaugeY + gaugeHeight, 0, gaugeY);
    hpGrad.addColorStop(0, '#ff3344');
    hpGrad.addColorStop(0.5, '#ffe600');
    hpGrad.addColorStop(1, '#00ff66');

    ctx.fillStyle = hpGrad;
    ctx.shadowColor = '#00ff66';
    ctx.shadowBlur = 10;
    ctx.fillRect(hpX, gaugeY + gaugeHeight - hpFillH, gaugeWidth, hpFillH);

    // 2. 우측: Fever 게이지 (결속밴드 4색 에너지)
    const feverX = gearX + gearWidth + 16;
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(10, 15, 25, 0.7)';
    ctx.fillRect(feverX, gaugeY, gaugeWidth, gaugeHeight);
    ctx.strokeStyle = stats.isFeverActive ? '#ff6b9d' : 'rgba(255, 255, 255, 0.3)';
    ctx.strokeRect(feverX, gaugeY, gaugeWidth, gaugeHeight);

    const feverRate = Math.max(0, Math.min(1, stats.feverGauge / 100));
    const feverFillH = gaugeHeight * feverRate;
    const feverGrad = ctx.createLinearGradient(0, gaugeY + gaugeHeight, 0, gaugeY);
    feverGrad.addColorStop(0, '#ff6b9d'); // 보치 핑크
    feverGrad.addColorStop(0.35, '#ff4365'); // 키타 레드
    feverGrad.addColorStop(0.7, '#ffcc00'); // 니지카 옐로우
    feverGrad.addColorStop(1, '#00c2ff'); // 료 블루

    ctx.fillStyle = feverGrad;
    ctx.shadowColor = '#ff6b9d';
    ctx.shadowBlur = stats.isFeverActive ? 18 : 6;
    ctx.fillRect(feverX, gaugeY + gaugeHeight - feverFillH, gaugeWidth, feverFillH);

    // 피버 레벨 텍스트
    if (stats.feverLevel > 1) {
      ctx.font = '900 11px Orbitron, sans-serif';
      ctx.fillStyle = '#ffe169';
      ctx.shadowColor = '#ffe169';
      ctx.shadowBlur = 8;
      ctx.textAlign = 'center';
      ctx.fillText(`KESSOKU x${stats.feverLevel}`, feverX + gaugeWidth / 2, gaugeY - 10);
    }

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
