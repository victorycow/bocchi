import { SongInfo, SongChart, NoteData, KeyMode, Difficulty, NoteType, SongAlbum } from '../engine/types';

export const ALBUM_CATEGORIES: ('ALL' | SongAlbum)[] = [
  'ALL',
  '結束バンド',
  'Re:結束バンド',
  'We will',
  '結束バンドの歌ってみた',
  '光の中へ'
];

export type ChartStyle = 'jrock' | 'punk' | 'funk' | 'guitarhero' | 'mathrock' | 'ballad' | 'shoegaze' | 'poppunk' | 'edm';

/**
 * 레인 중첩 충돌 방지 및 다채로운 리듬 패턴 빌더
 */
class ChartBuilder {
  private notes: NoteData[] = [];
  private idCounter = 1;
  private totalLanes: number;

  constructor(totalLanes: number) {
    this.totalLanes = totalLanes;
  }

  /**
   * 해당 레인의 [startTime - margin, endTime + margin] 구간이 다른 노트와 겹치지 않는지 검사
   */
  public isLaneAvailable(lane: number, startTime: number, duration = 0, margin = 0.04): boolean {
    const endTime = startTime + duration;
    for (const n of this.notes) {
      if (n.lane === lane) {
        const nEnd = n.time + n.duration;
        if (startTime - margin < nEnd && endTime + margin > n.time) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * 지정된 레인에 노트 배치 시도 (성공 시 true)
   */
  public tryAdd(lane: number, time: number, duration = 0, type: NoteType = 'normal'): boolean {
    if (this.isLaneAvailable(lane, time, duration)) {
      this.notes.push({
        id: this.idCounter++,
        lane,
        time,
        duration,
        type
      });
      return true;
    }
    return false;
  }

  /**
   * 선호 레인이 사용 중일 경우 다른 빈 레인으로 안전하게 우회 배치
   */
  public addSafe(preferredLane: number, time: number, duration = 0, type: NoteType = 'normal'): boolean {
    if (this.tryAdd(preferredLane, time, duration, type)) return true;

    for (let offset = 1; offset < this.totalLanes; offset++) {
      const altLane = (preferredLane + offset) % this.totalLanes;
      if (this.tryAdd(altLane, time, duration, type)) return true;
    }
    return false;
  }

  /**
   * 동시치기 (Chord - 킥, 심벌, 강렬한 악센트)
   */
  public addChord(lanes: number[], time: number): void {
    for (const l of lanes) {
      this.addSafe(l, time, 0, 'normal');
    }
  }

  /**
   * 계단 (Stairs - 아르페지오, 속주 런)
   */
  public addStair(startLane: number, startTime: number, stepSec: number, count: number, dir: 1 | -1 = 1): void {
    for (let i = 0; i < count; i++) {
      const lane = (startLane + i * dir + this.totalLanes * 10) % this.totalLanes;
      this.addSafe(lane, startTime + i * stepSec, 0, 'normal');
    }
  }

  /**
   * 트릴 (Trill - 양손 교차 연타)
   */
  public addTrill(laneA: number, laneB: number, startTime: number, stepSec: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const lane = i % 2 === 0 ? laneA : laneB;
      this.addSafe(lane, startTime + i * stepSec, 0, 'normal');
    }
  }

  /**
   * 롱잡 (Hold & Tap - 한 손 홀드 + 반대 손 리듬 타격)
   */
  public addLongJob(holdLane: number, holdStart: number, holdDuration: number, tapLanes: number[], tapStepSec: number): void {
    this.tryAdd(holdLane, holdStart, holdDuration, 'hold');
    const tapCount = Math.floor(holdDuration / tapStepSec);
    for (let i = 1; i < tapCount; i++) {
      const tapLane = tapLanes[i % tapLanes.length];
      if (tapLane !== holdLane) {
        this.addSafe(tapLane, holdStart + i * tapStepSec, 0, 'normal');
      }
    }
  }

  /**
   * 따닥이 (Gallop - 16비트 바운스 리듬)
   */
  public addGallop(laneA: number, laneB: number, time: number, beatSec: number): void {
    this.addSafe(laneA, time, 0, 'normal');
    this.addSafe(laneB, time + beatSec * 0.25, 0, 'normal');
  }

  /**
   * 더블 탭 (빠른 연속 타격)
   */
  public addDoubleTap(lanes: number[], time: number, gapSec: number): void {
    for (const l of lanes) this.addSafe(l, time, 0, 'normal');
    for (const l of lanes) this.addSafe((l + 1) % this.totalLanes, time + gapSec, 0, 'normal');
  }

  public getSortedNotes(): NoteData[] {
    return this.notes.sort((a, b) => a.time - b.time);
  }
}

/**
 * 음악 전개(기승전결) 및 장르 특화 다이내믹 채보 생성 엔진
 */
export function createChartNotes(
  bpm: number,
  totalBars: number,
  keyMode: KeyMode,
  difficulty: Difficulty,
  style: ChartStyle = 'edm',
  startOffsetSec?: number
): NoteData[] {
  const laneCount = keyMode === '4K' ? 4 : 6;
  const builder = new ChartBuilder(laneCount);
  const beatSec = 60 / bpm;
  const barSec = beatSec * 4;

  const defaultOffset = style === 'edm' ? 0.0 : 0.410;
  const offset = startOffsetSec !== undefined ? startOffsetSec : defaultOffset;

  const isNormal = difficulty === 'NORMAL';
  const isHard = difficulty === 'HARD';
  const isExpert = difficulty === 'EXPERT';
  const is6K = keyMode === '6K';

  // Key mode lane maps
  // 4K: Left=[0, 1], Right=[2, 3]
  // 6K: Left=[0, 1, 2], Right=[3, 4, 5]
  const L0 = 0;
  const L1 = 1;
  const L2 = is6K ? 2 : 1;
  const R0 = is6K ? 3 : 2;
  const R1 = is6K ? 4 : 2;
  const R2 = is6K ? 5 : 3;

  const chordA = is6K ? [1, 4] : [0, 2];
  const chordB = is6K ? [2, 5] : [1, 3];
  const chordOuter = is6K ? [0, 5] : [0, 3];
  const chordInner = is6K ? [2, 3] : [1, 2];
  const chordImpact = is6K ? [0, 2, 5] : [0, 3];

  // Musical sections
  const introBars = Math.max(4, Math.floor(totalBars * 0.12));
  const verseBars = Math.max(introBars + 6, Math.floor(totalBars * 0.32));
  const buildBars = Math.max(verseBars + 4, Math.floor(totalBars * 0.44));
  const chorusBars = Math.max(buildBars + 8, Math.floor(totalBars * 0.65));
  const soloBars = Math.max(chorusBars + 6, Math.floor(totalBars * 0.80));
  const finalChorusBars = Math.max(soloBars + 8, Math.floor(totalBars * 0.93));

  for (let bar = 0; bar < totalBars; bar++) {
    const barStart = offset + bar * barSec;

    // -----------------------------------------------------------------
    // 1. INTRO
    // -----------------------------------------------------------------
    if (bar < introBars) {
      if (bar === 0) {
        if (style === 'guitarhero') {
          builder.tryAdd(R0, barStart, beatSec * 2.8, 'hold');
          if (isExpert) {
            builder.addSafe(L0, barStart + beatSec * 0.75, 0, 'normal');
            builder.addSafe(L1, barStart + beatSec * 1.5, 0, 'normal');
            builder.addSafe(L0, barStart + beatSec * 2.25, 0, 'normal');
          }
        } else if (style === 'mathrock') {
          builder.addSafe(L0, barStart, 0, 'normal');
          builder.addSafe(L1, barStart + beatSec * 0.75, 0, 'normal');
          builder.addSafe(L0, barStart + beatSec * 1.5, 0, 'normal');
          builder.addSafe(L1, barStart + beatSec * 2.25, 0, 'normal');
          if (isExpert) {
            builder.addGallop(R0, R1, barStart + beatSec * 2.75, beatSec);
          }
        } else if (style === 'shoegaze' || style === 'ballad') {
          builder.tryAdd(L1, barStart, beatSec * 2.0, 'hold');
          builder.addSafe(R1, barStart + beatSec * 2.0, 0, 'normal');
          builder.addSafe(R2, barStart + beatSec * 3.0, 0, 'normal');
          if (isExpert) {
            builder.addStair(L0, barStart + beatSec * 0.5, beatSec * 0.5, is6K ? 5 : 3, 1);
          }
        } else {
          builder.addChord(isExpert ? chordOuter : chordA, barStart);
          builder.tryAdd(R1, barStart + beatSec, beatSec * 2.0, 'hold');
          if (isExpert) {
            builder.addSafe(L0, barStart + beatSec * 1.5, 0, 'normal');
            builder.addSafe(L1, barStart + beatSec * 2.5, 0, 'normal');
          }
        }
      } else if (bar === 1 && style === 'guitarhero') {
        if (isExpert) {
          builder.addStair(L0, barStart, beatSec * 0.25, is6K ? 6 : 4, 1);
          builder.addChord(chordA, barStart + beatSec * 1.5);
          builder.addStair(R2, barStart + beatSec * 2.0, beatSec * 0.25, is6K ? 6 : 4, -1);
        } else {
          builder.addStair(L0, barStart, beatSec * 0.5, 4, 1);
          builder.addChord(chordA, barStart + beatSec * 2.5);
        }
      } else if (bar === 2 && style === 'guitarhero') {
        builder.addChord(chordImpact, barStart);
        if (isExpert) {
          builder.addGallop(L0, L1, barStart + beatSec * 0.5, beatSec);
          builder.addSafe(R1, barStart + beatSec * 1.25, 0, 'normal');
          builder.addChord(chordB, barStart + beatSec * 2.0);
          builder.addStair(L0, barStart + beatSec * 2.5, beatSec * 0.25, 4, 1);
        } else {
          builder.addSafe(L1, barStart + beatSec * 0.75, 0, 'normal');
          builder.addSafe(R1, barStart + beatSec * 1.5, 0, 'normal');
          builder.addChord(chordB, barStart + beatSec * 2.0);
        }
      } else if (bar === introBars - 1) {
        if (isExpert) {
          builder.addStair(R2, barStart + beatSec * 1.0, beatSec * 0.25, is6K ? 6 : 4, -1);
          builder.addChord(chordImpact, barStart + beatSec * 2.5);
        } else {
          const step = isHard ? beatSec * 0.25 : beatSec * 0.5;
          const count = isHard ? 4 : 3;
          builder.addStair(R2, barStart + beatSec * 2, step, count, -1);
        }
      } else {
        const iBar = bar - 1;
        if (isNormal) {
          if (style === 'shoegaze' || style === 'ballad') {
            for (let b = 0; b < 4; b++) {
              builder.addSafe((iBar + b) % laneCount, barStart + b * beatSec, 0, 'normal');
              if (b % 2 === 0) builder.addSafe((iBar + b + 2) % laneCount, barStart + (b + 0.5) * beatSec, 0, 'normal');
            }
          } else {
            const order = (iBar % 2 === 0) ? [0, 1, 2, 3] : [3, 2, 1, 0];
            for (let b = 0; b < 4; b++) {
              const lane = is6K ? (order[b] + 1) : order[b];
              builder.addSafe(lane, barStart + b * beatSec, 0, 'normal');
            }
          }
        } else if (isHard) {
          if (style === 'funk' || style === 'mathrock') {
            builder.addChord(chordA, barStart);
            builder.addGallop(R0, R1, barStart + beatSec * 0.75, beatSec);
            builder.addChord(chordB, barStart + beatSec * 2.0);
            builder.addGallop(R1, R2, barStart + beatSec * 2.75, beatSec);
          } else if (style === 'punk' || style === 'guitarhero') {
            for (let b = 0; b < 4; b++) {
              const baseL = (b % 2 === 0) ? L0 : L1;
              builder.addSafe(baseL, barStart + b * beatSec, 0, 'normal');
              const leadL = (b % 2 === 0) ? R1 : R0;
              builder.addSafe(leadL, barStart + (b + 0.5) * beatSec, 0, 'normal');
            }
          } else if (style === 'shoegaze' || style === 'ballad') {
            builder.addStair(L0, barStart, beatSec * 0.5, 6, 1);
            builder.tryAdd(R2, barStart + beatSec * 3.0, beatSec, 'hold');
          } else if (style === 'poppunk') {
            builder.addSafe(L0, barStart, 0, 'normal');
            builder.addChord(chordInner, barStart + beatSec);
            builder.addSafe(L1, barStart + beatSec * 1.5, 0, 'normal');
            builder.addChord(chordInner, barStart + beatSec * 3);
          } else {
            if (iBar % 2 === 0) {
              const arp = is6K ? [1, 3, 2, 4] : [0, 2, 1, 3];
              for (let b = 0; b < 4; b++) {
                builder.addSafe(arp[b], barStart + b * beatSec, 0, 'normal');
                builder.addSafe((arp[b] + 1) % laneCount, barStart + (b + 0.5) * beatSec, 0, 'normal');
              }
            } else {
              const ch = (iBar % 4 === 1) ? chordA : chordB;
              builder.addChord(ch, barStart);
              builder.addSafe(R0, barStart + beatSec, 0, 'normal');
              builder.addChord(ch.slice().reverse(), barStart + beatSec * 2.5);
              builder.addSafe(R1, barStart + beatSec * 3.5, 0, 'normal');
            }
          }
        } else {
          // EXPERT: High intensity intro drive
          if (style === 'funk' || style === 'mathrock') {
            builder.addChord(chordA, barStart);
            builder.addGallop(R0, R1, barStart + beatSec * 0.5, beatSec);
            builder.addSafe(L1, barStart + beatSec * 1.5, 0, 'normal');
            builder.addChord(chordB, barStart + beatSec * 2.0);
            builder.addGallop(R1, R2, barStart + beatSec * 2.5, beatSec);
            builder.addStair(L0, barStart + beatSec * 3.0, beatSec * 0.25, 4, 1);
          } else if (style === 'punk' || style === 'guitarhero') {
            for (let b = 0; b < 4; b++) {
              builder.addSafe((b % 2 === 0) ? L0 : L1, barStart + b * beatSec, 0, 'normal');
              builder.addSafe((b % 2 === 0) ? R1 : R0, barStart + (b + 0.5) * beatSec, 0, 'normal');
            }
            builder.addGallop(R1, R2, barStart + beatSec * 1.25, beatSec);
            builder.addGallop(R0, R1, barStart + beatSec * 3.25, beatSec);
          } else if (style === 'shoegaze' || style === 'ballad') {
            builder.addStair(L0, barStart, beatSec * 0.25, is6K ? 6 : 4, 1);
            builder.tryAdd(R2, barStart + beatSec * 2.0, beatSec * 1.8, 'hold');
            builder.addSafe(L1, barStart + beatSec * 2.5, 0, 'normal');
            builder.addSafe(R0, barStart + beatSec * 3.25, 0, 'normal');
          } else if (style === 'poppunk') {
            builder.addSafe(L0, barStart, 0, 'normal');
            builder.addChord(chordInner, barStart + beatSec);
            builder.addGallop(R0, R1, barStart + beatSec * 1.5, beatSec);
            builder.addSafe(L1, barStart + beatSec * 2.0, 0, 'normal');
            builder.addChord(chordInner, barStart + beatSec * 3.0);
            builder.addStair(R2, barStart + beatSec * 3.25, beatSec * 0.25, 3, -1);
          } else {
            builder.addChord(chordA, barStart);
            builder.addStair(L1, barStart + beatSec * 0.5, beatSec * 0.25, 4, 1);
            builder.addChord(chordB, barStart + beatSec * 2.0);
            builder.addGallop(R0, R1, barStart + beatSec * 2.75, beatSec);
            builder.addSafe(L0, barStart + beatSec * 3.5, 0, 'normal');
          }
        }
      }
    }

    // -----------------------------------------------------------------
    // 2. VERSE (A멜로디)
    // -----------------------------------------------------------------
    else if (bar < verseBars) {
      const vBar = bar - introBars;
      const phrase = vBar % 4;

      if (isNormal) {
        if (style === 'shoegaze' || style === 'ballad') {
          builder.addSafe(L0, barStart, 0, 'normal');
          builder.addSafe(L1, barStart + beatSec * 0.5, 0, 'normal');
          builder.addSafe(R0, barStart + beatSec * 1.0, 0, 'normal');
          builder.tryAdd(R1, barStart + beatSec * 2.0, beatSec * 1.5, 'hold');
        } else if (style === 'poppunk') {
          builder.addSafe(L0, barStart, 0, 'normal');
          builder.addSafe(R0, barStart + beatSec, 0, 'normal');
          builder.addSafe(L1, barStart + beatSec * 2.0, 0, 'normal');
          builder.addSafe(R1, barStart + beatSec * 3.0, 0, 'normal');
        } else {
          if (phrase === 0) {
            builder.addSafe(L0, barStart, 0, 'normal');
            builder.addSafe(R1, barStart + beatSec, 0, 'normal');
            builder.addSafe(L1, barStart + beatSec * 2, 0, 'normal');
            builder.addSafe(R2, barStart + beatSec * 3, 0, 'normal');
          } else if (phrase === 1) {
            builder.addSafe(L0, barStart, 0, 'normal');
            builder.addSafe(R0, barStart + beatSec * 1.5, 0, 'normal');
            builder.addSafe(L1, barStart + beatSec * 2.5, 0, 'normal');
            builder.addSafe(R2, barStart + beatSec * 3.0, 0, 'normal');
          } else if (phrase === 2) {
            builder.addSafe(L1, barStart, 0, 'normal');
            builder.addSafe(R0, barStart + beatSec, 0, 'normal');
            builder.addSafe(R2, barStart + beatSec * 2, 0, 'normal');
          } else {
            builder.tryAdd(R2, barStart, beatSec * 2.0, 'hold');
            builder.addSafe(L0, barStart + beatSec * 2.5, 0, 'normal');
            builder.addSafe(L1, barStart + beatSec * 3.0, 0, 'normal');
          }
        }
      } else if (isHard) {
        if (style === 'funk' || style === 'mathrock') {
          builder.addSafe(L0, barStart, 0, 'normal');
          builder.addGallop(R0, R1, barStart + beatSec * 0.75, beatSec);
          builder.addSafe(L1, barStart + beatSec * 2.0, 0, 'normal');
          builder.addGallop(R1, R2, barStart + beatSec * 2.75, beatSec);
          if (phrase === 3) {
            builder.tryAdd(R2, barStart + beatSec * 2.0, beatSec * 1.8, 'hold');
          }
        } else if (style === 'punk' || style === 'guitarhero') {
          builder.addSafe(L0, barStart, 0, 'normal');
          builder.addSafe(R0, barStart + beatSec * 0.5, 0, 'normal');
          builder.addSafe(L1, barStart + beatSec * 1.0, 0, 'normal');
          builder.addSafe(R1, barStart + beatSec * 1.5, 0, 'normal');
          builder.addSafe(L0, barStart + beatSec * 2.0, 0, 'normal');
          builder.addSafe(R2, barStart + beatSec * 2.5, 0, 'normal');
          builder.addSafe(R1, barStart + beatSec * 3.0, 0, 'normal');
          builder.addSafe(L1, barStart + beatSec * 3.5, 0, 'normal');
        } else if (style === 'shoegaze' || style === 'ballad') {
          builder.addSafe(L0, barStart, 0, 'normal');
          builder.addStair(L1, barStart + beatSec * 0.5, beatSec * 0.5, 5, 1);
          if (phrase % 2 === 1) {
            builder.tryAdd(R2, barStart + beatSec * 2.0, beatSec * 1.8, 'hold');
          }
        } else if (style === 'poppunk') {
          builder.addSafe(L0, barStart, 0, 'normal');
          builder.addChord(chordInner, barStart + beatSec);
          builder.addSafe(R0, barStart + beatSec * 1.5, 0, 'normal');
          builder.addSafe(L1, barStart + beatSec * 2.0, 0, 'normal');
          builder.addChord(chordInner, barStart + beatSec * 3.0);
          builder.addSafe(R1, barStart + beatSec * 3.5, 0, 'normal');
        } else {
          builder.addSafe(L0, barStart, 0, 'normal');
          builder.addSafe(L1, barStart + beatSec * 2.0, 0, 'normal');
          if (phrase === 0) {
            builder.addSafe(R0, barStart + beatSec * 0.5, 0, 'normal');
            builder.addSafe(R1, barStart + beatSec * 1.5, 0, 'normal');
            builder.addSafe(R0, barStart + beatSec * 2.5, 0, 'normal');
            builder.addSafe(R2, barStart + beatSec * 3.0, 0, 'normal');
          } else if (phrase === 1) {
            builder.addSafe(R1, barStart + beatSec * 0.5, 0, 'normal');
            builder.addSafe(R0, barStart + beatSec * 1.0, 0, 'normal');
            builder.addSafe(R2, barStart + beatSec * 2.5, 0, 'normal');
            builder.addSafe(R1, barStart + beatSec * 3.5, 0, 'normal');
          } else if (phrase === 2) {
            builder.addSafe(R0, barStart + beatSec * 0.5, 0, 'normal');
            builder.addSafe(L1, barStart + beatSec * 1.0, 0, 'normal');
            builder.addSafe(R2, barStart + beatSec * 1.5, 0, 'normal');
            builder.addSafe(R0, barStart + beatSec * 3.0, 0, 'normal');
          } else {
            builder.tryAdd(R2, barStart, beatSec * 2.5, 'hold');
            builder.addSafe(L0, barStart + beatSec * 1.0, 0, 'normal');
            builder.addSafe(L1, barStart + beatSec * 2.0, 0, 'normal');
            builder.addSafe(R0, barStart + beatSec * 3.5, 0, 'normal');
          }
        }
      } else {
        // EXPERT: Polyrhythmic density & 16th stream accents
        if (style === 'funk' || style === 'mathrock') {
          builder.addSafe(L0, barStart, 0, 'normal');
          builder.addGallop(R0, R1, barStart + beatSec * 0.5, beatSec);
          builder.addSafe(L1, barStart + beatSec * 1.5, 0, 'normal');
          builder.addChord(chordInner, barStart + beatSec * 2.0);
          builder.addGallop(R1, R2, barStart + beatSec * 2.5, beatSec);
          builder.addSafe(L0, barStart + beatSec * 3.25, 0, 'normal');
          if (phrase === 3) builder.addStair(R2, barStart + beatSec * 2.5, beatSec * 0.25, 4, -1);
        } else if (style === 'punk' || style === 'guitarhero') {
          builder.addSafe(L0, barStart, 0, 'normal');
          builder.addSafe(R0, barStart + beatSec * 0.5, 0, 'normal');
          builder.addSafe(L1, barStart + beatSec * 1.0, 0, 'normal');
          builder.addGallop(R1, R2, barStart + beatSec * 1.25, beatSec);
          builder.addSafe(L0, barStart + beatSec * 2.0, 0, 'normal');
          builder.addSafe(R1, barStart + beatSec * 2.5, 0, 'normal');
          builder.addSafe(L1, barStart + beatSec * 3.0, 0, 'normal');
          builder.addGallop(R0, R2, barStart + beatSec * 3.25, beatSec);
          if (phrase === 3) builder.addStair(L0, barStart + beatSec * 2.5, beatSec * 0.25, 4, 1);
        } else if (style === 'shoegaze' || style === 'ballad') {
          builder.addSafe(L0, barStart, 0, 'normal');
          builder.addStair(L1, barStart + beatSec * 0.25, beatSec * 0.25, is6K ? 6 : 4, 1);
          builder.tryAdd(R2, barStart + beatSec * 2.0, beatSec * 1.8, 'hold');
          builder.addSafe(L0, barStart + beatSec * 2.5, 0, 'normal');
          builder.addSafe(L1, barStart + beatSec * 3.25, 0, 'normal');
        } else if (style === 'poppunk') {
          builder.addSafe(L0, barStart, 0, 'normal');
          builder.addChord(chordInner, barStart + beatSec);
          builder.addGallop(R0, R1, barStart + beatSec * 1.5, beatSec);
          builder.addSafe(L1, barStart + beatSec * 2.0, 0, 'normal');
          builder.addChord(chordInner, barStart + beatSec * 3.0);
          builder.addGallop(R1, R2, barStart + beatSec * 3.25, beatSec);
        } else {
          builder.addSafe(L0, barStart, 0, 'normal');
          builder.addSafe(R0, barStart + beatSec * 0.5, 0, 'normal');
          builder.addSafe(L1, barStart + beatSec * 1.0, 0, 'normal');
          builder.addSafe(R1, barStart + beatSec * 1.5, 0, 'normal');
          builder.addSafe(L0, barStart + beatSec * 2.0, 0, 'normal');
          builder.addSafe(R0, barStart + beatSec * 2.5, 0, 'normal');
          builder.addSafe(L1, barStart + beatSec * 3.0, 0, 'normal');
          if (phrase === 3) {
            builder.addStair(R2, barStart + beatSec * 2.5, beatSec * 0.25, 4, -1);
          } else {
            builder.addSafe(R2, barStart + beatSec * 3.5, 0, 'normal');
          }
        }
      }
    }

    // -----------------------------------------------------------------
    // 3. BUILD-UP (Pre-Chorus / B멜로디 긴장감 고조)
    // -----------------------------------------------------------------
    else if (bar < buildBars) {
      const bBar = bar - verseBars;
      const bTotal = buildBars - verseBars;

      if (isNormal) {
        if (bBar < bTotal - 1) {
          builder.addSafe(L0, barStart, 0, 'normal');
          builder.addSafe(R0, barStart + beatSec, 0, 'normal');
          builder.addSafe(L1, barStart + beatSec * 2, 0, 'normal');
          builder.addSafe(R2, barStart + beatSec * 3, 0, 'normal');
        } else {
          builder.addChord(chordA, barStart);
          builder.addChord(chordB, barStart + beatSec * 1.5);
          builder.addSafe(R1, barStart + beatSec * 2.5, 0, 'normal');
        }
      } else if (isHard) {
        if (bBar < bTotal - 1) {
          const stepDir = (bBar % 2 === 0) ? 1 : -1;
          const startL = (bBar % 2 === 0) ? L0 : R2;
          builder.addStair(startL, barStart, beatSec * 0.5, 4, stepDir);
          builder.addSafe(L1, barStart + beatSec * 2.5, 0, 'normal');
          builder.addSafe(R0, barStart + beatSec * 3.5, 0, 'normal');
        } else {
          builder.addStair(R2, barStart, beatSec * 0.25, 4, -1);
          builder.addChord(chordImpact, barStart + beatSec * 1.5);
        }
      } else {
        // EXPERT: Escalating 16th rolls into climax
        if (bBar < bTotal - 1) {
          const dir = (bBar % 2 === 0) ? 1 : -1;
          const startL = (bBar % 2 === 0) ? L0 : R2;
          builder.addStair(startL, barStart, beatSec * 0.25, 4, dir);
          builder.addChord(chordA, barStart + beatSec * 1.5);
          builder.addStair(startL, barStart + beatSec * 2.0, beatSec * 0.25, 4, (dir * -1) as 1 | -1);
          builder.addSafe(R1, barStart + beatSec * 3.5, 0, 'normal');
        } else {
          builder.addStair(R2, barStart, beatSec * 0.25, is6K ? 6 : 4, -1);
          builder.addChord(chordImpact, barStart + beatSec * 1.5);
          builder.addStair(L0, barStart + beatSec * 2.0, beatSec * 0.25, 4, 1);
        }
      }
    }

    // -----------------------------------------------------------------
    // 4. CHORUS (사비 / 후렴구: 손맛 폭발!)
    // -----------------------------------------------------------------
    else if (bar < chorusBars) {
      const cBar = bar - buildBars;
      const phrase = cBar % 4;

      if (isNormal) {
        if (phrase === 0) {
          builder.addChord(chordA, barStart);
          builder.addSafe(L1, barStart + beatSec * 1.5, 0, 'normal');
          builder.addSafe(R0, barStart + beatSec * 2.0, 0, 'normal');
          builder.addSafe(R2, barStart + beatSec * 3.0, 0, 'normal');
        } else if (phrase === 1) {
          builder.tryAdd(R0, barStart, beatSec * 1.5, 'hold');
          builder.addSafe(L0, barStart + beatSec * 2.0, 0, 'normal');
          builder.addSafe(L1, barStart + beatSec * 3.0, 0, 'normal');
        } else if (phrase === 2) {
          builder.addChord(chordB, barStart);
          builder.addSafe(R0, barStart + beatSec * 1.5, 0, 'normal');
          builder.addSafe(L1, barStart + beatSec * 2.0, 0, 'normal');
          builder.addSafe(L0, barStart + beatSec * 3.0, 0, 'normal');
        } else {
          builder.tryAdd(R2, barStart, beatSec * 2.0, 'hold');
          builder.addSafe(L1, barStart + beatSec * 2.5, 0, 'normal');
          builder.addSafe(R0, barStart + beatSec * 3.0, 0, 'normal');
        }
      } else if (isHard) {
        if (style === 'guitarhero' || style === 'punk') {
          if (phrase === 0) {
            builder.addChord(chordA, barStart);
            builder.addSafe(R0, barStart + beatSec * 0.75, 0, 'normal');
            builder.addSafe(L1, barStart + beatSec * 1.25, 0, 'normal');
            builder.addChord(chordB, barStart + beatSec * 2.0);
            builder.addSafe(L0, barStart + beatSec * 2.75, 0, 'normal');
            builder.addSafe(R2, barStart + beatSec * 3.25, 0, 'normal');
          } else if (phrase === 1) {
            builder.tryAdd(R2, barStart, beatSec * 2.25, 'hold');
            builder.addSafe(L0, barStart + beatSec * 0.5, 0, 'normal');
            builder.addSafe(L1, barStart + beatSec * 1.25, 0, 'normal');
            builder.addSafe(L0, barStart + beatSec * 1.75, 0, 'normal');
            builder.addSafe(R0, barStart + beatSec * 2.75, 0, 'normal');
            builder.addSafe(L1, barStart + beatSec * 3.25, 0, 'normal');
          } else if (phrase === 2) {
            builder.addChord(chordOuter, barStart);
            builder.addSafe(L1, barStart + beatSec * 0.75, 0, 'normal');
            builder.addSafe(R0, barStart + beatSec * 1.5, 0, 'normal');
            builder.addChord(chordInner, barStart + beatSec * 2.0);
            builder.addSafe(L1, barStart + beatSec * 2.75, 0, 'normal');
            builder.addSafe(R0, barStart + beatSec * 3.25, 0, 'normal');
          } else {
            builder.addStair(L0, barStart, beatSec * 0.25, 4, 1);
            builder.addChord(chordA, barStart + beatSec * 1.5);
            builder.addSafe(R0, barStart + beatSec * 2.5, 0, 'normal');
            builder.addSafe(L1, barStart + beatSec * 3.25, 0, 'normal');
          }
        } else if (style === 'funk' || style === 'mathrock') {
          if (phrase === 0) {
            builder.addChord(chordA, barStart);
            builder.addGallop(R0, R1, barStart + beatSec * 0.75, beatSec);
            builder.addChord(chordB, barStart + beatSec * 2.0);
            builder.addGallop(R1, R2, barStart + beatSec * 2.75, beatSec);
          } else if (phrase === 1) {
            builder.tryAdd(R2, barStart, beatSec * 2.0, 'hold');
            builder.addSafe(L0, barStart + beatSec * 0.5, 0, 'normal');
            builder.addSafe(L1, barStart + beatSec * 1.25, 0, 'normal');
            builder.addSafe(L0, barStart + beatSec * 1.75, 0, 'normal');
            builder.addGallop(R0, R1, barStart + beatSec * 2.5, beatSec);
          } else if (phrase === 2) {
            builder.addChord(chordOuter, barStart);
            builder.addGallop(L1, R0, barStart + beatSec * 0.75, beatSec);
            builder.addChord(chordInner, barStart + beatSec * 2.0);
            builder.addSafe(R1, barStart + beatSec * 3.0, 0, 'normal');
          } else {
            builder.addStair(L0, barStart, beatSec * 0.25, 4, 1);
            builder.addChord(chordA, barStart + beatSec * 1.5);
            builder.addGallop(R1, R2, barStart + beatSec * 2.5, beatSec);
          }
        } else if (style === 'shoegaze' || style === 'ballad') {
          builder.addChord(chordOuter, barStart);
          builder.addStair(L1, barStart + beatSec * 0.5, beatSec * 0.5, 5, 1);
          builder.addChord(chordInner, barStart + beatSec * 2.5);
          builder.tryAdd(R2, barStart + beatSec * 3.0, beatSec, 'hold');
        } else {
          if (phrase === 0) {
            builder.addChord(chordA, barStart);
            builder.addSafe(R0, barStart + beatSec * 0.75, 0, 'normal');
            builder.addSafe(L1, barStart + beatSec * 1.25, 0, 'normal');
            builder.addChord(chordB, barStart + beatSec * 2.0);
            builder.addSafe(L0, barStart + beatSec * 2.75, 0, 'normal');
            builder.addSafe(R2, barStart + beatSec * 3.25, 0, 'normal');
          } else if (phrase === 1) {
            builder.tryAdd(R2, barStart, beatSec * 2.25, 'hold');
            builder.addSafe(L0, barStart + beatSec * 0.5, 0, 'normal');
            builder.addSafe(L1, barStart + beatSec * 1.25, 0, 'normal');
            builder.addSafe(L0, barStart + beatSec * 1.75, 0, 'normal');
            builder.addSafe(R0, barStart + beatSec * 2.75, 0, 'normal');
            builder.addSafe(L1, barStart + beatSec * 3.25, 0, 'normal');
          } else if (phrase === 2) {
            builder.addChord(chordOuter, barStart);
            builder.addSafe(L1, barStart + beatSec * 0.75, 0, 'normal');
            builder.addSafe(R0, barStart + beatSec * 1.5, 0, 'normal');
            builder.addChord(chordInner, barStart + beatSec * 2.0);
            builder.addSafe(L1, barStart + beatSec * 2.75, 0, 'normal');
            builder.addSafe(R0, barStart + beatSec * 3.25, 0, 'normal');
          } else {
            builder.addStair(L0, barStart, beatSec * 0.25, 4, 1);
            builder.addChord(chordA, barStart + beatSec * 1.5);
            builder.addSafe(R0, barStart + beatSec * 2.5, 0, 'normal');
            builder.addSafe(L1, barStart + beatSec * 3.25, 0, 'normal');
          }
        }
      } else {
        // EXPERT: Peak thrill with chord punches, stream connectors & long-job
        if (phrase === 0) {
          builder.addChord(chordImpact, barStart);
          builder.addSafe(R0, barStart + beatSec * 0.5, 0, 'normal');
          builder.addSafe(L1, barStart + beatSec * 0.75, 0, 'normal');
          builder.addSafe(R1, barStart + beatSec * 1.25, 0, 'normal');
          builder.addChord(chordB, barStart + beatSec * 1.5);
          builder.addStair(L0, barStart + beatSec * 2.25, beatSec * 0.25, 4, 1);
          builder.addSafe(R2, barStart + beatSec * 3.5, 0, 'normal');
        } else if (phrase === 1) {
          builder.tryAdd(R2, barStart, beatSec * 2.25, 'hold');
          builder.addSafe(L0, barStart + beatSec * 0.25, 0, 'normal');
          builder.addSafe(L1, barStart + beatSec * 0.75, 0, 'normal');
          builder.addSafe(L0, barStart + beatSec * 1.25, 0, 'normal');
          builder.addSafe(L1, barStart + beatSec * 1.75, 0, 'normal');
          builder.addChord(chordInner, barStart + beatSec * 2.5);
          builder.addGallop(R0, R1, barStart + beatSec * 3.25, beatSec);
        } else if (phrase === 2) {
          builder.addChord(chordOuter, barStart);
          builder.addGallop(L1, R0, barStart + beatSec * 0.5, beatSec);
          builder.addSafe(R1, barStart + beatSec * 1.25, 0, 'normal');
          builder.addChord(chordInner, barStart + beatSec * 1.75);
          builder.addStair(L0, barStart + beatSec * 2.25, beatSec * 0.25, 4, 1);
          builder.addSafe(R2, barStart + beatSec * 3.5, 0, 'normal');
        } else {
          builder.addStair(L0, barStart, beatSec * 0.25, is6K ? 6 : 4, 1);
          builder.addChord(chordA, barStart + beatSec * 1.5);
          builder.addTrill(R0, R1, barStart + beatSec * 2.0, beatSec * 0.25, 4);
          builder.addChord(chordB, barStart + beatSec * 3.25);
        }
      }
    }

    // -----------------------------------------------------------------
    // 5. GUITAR SOLO / BREAK (봇치 기타 솔로 속주 구간!)
    // -----------------------------------------------------------------
    else if (bar < soloBars) {
      const sBar = bar - chorusBars;

      if (isNormal) {
        if (sBar % 2 === 0) {
          builder.addStair(L0, barStart, beatSec * 0.5, 4, 1);
          builder.addSafe(R0, barStart + beatSec * 2.5, 0, 'normal');
        } else {
          builder.tryAdd(R2, barStart, beatSec * 2.0, 'hold');
          builder.addSafe(L1, barStart + beatSec * 2.5, 0, 'normal');
          builder.addSafe(L0, barStart + beatSec * 3.0, 0, 'normal');
        }
      } else if (isHard) {
        if (sBar % 4 === 0) {
          builder.addStair(L0, barStart, beatSec * 0.25, 6, 1);
          builder.addSafe(R1, barStart + beatSec * 2.0, 0, 'normal');
          builder.addSafe(R2, barStart + beatSec * 2.5, 0, 'normal');
          builder.addChord(chordA, barStart + beatSec * 3.0);
        } else if (sBar % 4 === 1) {
          builder.addStair(R2, barStart, beatSec * 0.25, 4, -1);
          builder.addTrill(R0, R1, barStart + beatSec * 1.5, beatSec * 0.25, 6);
        } else if (sBar % 4 === 2) {
          builder.tryAdd(L0, barStart, beatSec * 2.5, 'hold');
          builder.addSafe(R0, barStart + beatSec * 0.5, 0, 'normal');
          builder.addSafe(R1, barStart + beatSec * 1.0, 0, 'normal');
          builder.addSafe(R2, barStart + beatSec * 1.5, 0, 'normal');
          builder.addSafe(R1, barStart + beatSec * 2.0, 0, 'normal');
          builder.addChord(chordB, barStart + beatSec * 3.0);
        } else {
          builder.addStair(L0, barStart, beatSec * 0.25, 4, 1);
          builder.addStair(R2, barStart + beatSec * 1.5, beatSec * 0.25, 4, -1);
          builder.addChord(chordImpact, barStart + beatSec * 3.0);
        }
      } else {
        // EXPERT: SHREDDING GUITAR HERO SOLO EXPERIENCE
        if (sBar % 4 === 0) {
          builder.addStair(L0, barStart, beatSec * 0.25, is6K ? 6 : 4, 1);
          builder.addChord(chordA, barStart + beatSec * 1.5);
          builder.addStair(L1, barStart + beatSec * 2.0, beatSec * 0.25, 4, 1);
          builder.addChord(chordB, barStart + beatSec * 3.25);
        } else if (sBar % 4 === 1) {
          builder.addStair(R2, barStart, beatSec * 0.25, is6K ? 6 : 4, -1);
          builder.addTrill(R0, R1, barStart + beatSec * 1.5, beatSec * 0.25, 8);
        } else if (sBar % 4 === 2) {
          builder.tryAdd(L0, barStart, beatSec * 2.5, 'hold');
          builder.addSafe(R0, barStart + beatSec * 0.25, 0, 'normal');
          builder.addSafe(R1, barStart + beatSec * 0.75, 0, 'normal');
          builder.addSafe(R2, barStart + beatSec * 1.25, 0, 'normal');
          builder.addSafe(R1, barStart + beatSec * 1.75, 0, 'normal');
          builder.addSafe(R2, barStart + beatSec * 2.25, 0, 'normal');
          builder.addChord(chordImpact, barStart + beatSec * 3.0);
        } else {
          builder.addStair(L0, barStart, beatSec * 0.25, 4, 1);
          builder.addStair(R2, barStart + beatSec * 1.25, beatSec * 0.25, 4, -1);
          builder.addTrill(L0, L1, barStart + beatSec * 2.25, beatSec * 0.25, 4);
          builder.addChord(chordImpact, barStart + beatSec * 3.25);
        }
      }
    }

    // -----------------------------------------------------------------
    // 6. FINAL CHORUS (라스트 후렴구: 피버 클라이맥스)
    // -----------------------------------------------------------------
    else if (bar < finalChorusBars) {
      const fBar = bar - soloBars;
      const phrase = fBar % 4;

      if (isNormal) {
        if (phrase === 0) {
          builder.addChord(chordA, barStart);
          builder.addSafe(L1, barStart + beatSec * 1.0, 0, 'normal');
          builder.addSafe(R0, barStart + beatSec * 2.0, 0, 'normal');
          builder.addSafe(R2, barStart + beatSec * 3.0, 0, 'normal');
        } else if (phrase === 1) {
          builder.tryAdd(R2, barStart, beatSec * 1.5, 'hold');
          builder.addSafe(L1, barStart + beatSec * 2.0, 0, 'normal');
          builder.addSafe(L0, barStart + beatSec * 3.0, 0, 'normal');
        } else if (phrase === 2) {
          builder.addChord(chordB, barStart);
          builder.addSafe(R0, barStart + beatSec * 1.0, 0, 'normal');
          builder.addSafe(L1, barStart + beatSec * 2.0, 0, 'normal');
          builder.addSafe(L0, barStart + beatSec * 3.0, 0, 'normal');
        } else {
          builder.tryAdd(L1, barStart, beatSec * 2.0, 'hold');
          builder.addSafe(R0, barStart + beatSec * 2.5, 0, 'normal');
          builder.addSafe(R2, barStart + beatSec * 3.0, 0, 'normal');
        }
      } else if (isHard) {
        if (phrase === 0) {
          builder.addChord(chordA, barStart);
          builder.addSafe(R0, barStart + beatSec * 0.5, 0, 'normal');
          builder.addSafe(L1, barStart + beatSec * 1.0, 0, 'normal');
          builder.addChord(chordB, barStart + beatSec * 1.5);
          builder.addSafe(R2, barStart + beatSec * 2.5, 0, 'normal');
          builder.addSafe(L0, barStart + beatSec * 3.0, 0, 'normal');
        } else if (phrase === 1) {
          builder.tryAdd(R2, barStart, beatSec * 2.0, 'hold');
          builder.addSafe(L0, barStart + beatSec * 0.75, 0, 'normal');
          builder.addSafe(L1, barStart + beatSec * 1.25, 0, 'normal');
          builder.addSafe(R0, barStart + beatSec * 2.5, 0, 'normal');
          builder.addSafe(L1, barStart + beatSec * 3.25, 0, 'normal');
        } else if (phrase === 2) {
          builder.addChord(chordOuter, barStart);
          builder.addSafe(L1, barStart + beatSec * 0.75, 0, 'normal');
          builder.addSafe(R0, barStart + beatSec * 1.5, 0, 'normal');
          builder.addChord(chordInner, barStart + beatSec * 2.0);
          builder.addSafe(R2, barStart + beatSec * 2.75, 0, 'normal');
          builder.addSafe(L0, barStart + beatSec * 3.25, 0, 'normal');
        } else {
          builder.addStair(L0, barStart, beatSec * 0.25, 4, 1);
          builder.addChord(chordA, barStart + beatSec * 1.5);
          builder.addSafe(R0, barStart + beatSec * 2.5, 0, 'normal');
          builder.addSafe(L1, barStart + beatSec * 3.25, 0, 'normal');
        }
      } else {
        // EXPERT: Maximum final chorus rush
        if (phrase === 0) {
          builder.addChord(chordImpact, barStart);
          builder.addSafe(R0, barStart + beatSec * 0.5, 0, 'normal');
          builder.addSafe(L1, barStart + beatSec * 0.75, 0, 'normal');
          builder.addChord(chordB, barStart + beatSec * 1.25);
          builder.addSafe(R1, barStart + beatSec * 2.0, 0, 'normal');
          builder.addStair(L0, barStart + beatSec * 2.5, beatSec * 0.25, 4, 1);
          builder.addSafe(R2, barStart + beatSec * 3.5, 0, 'normal');
        } else if (phrase === 1) {
          builder.tryAdd(R2, barStart, beatSec * 2.25, 'hold');
          builder.addSafe(L0, barStart + beatSec * 0.25, 0, 'normal');
          builder.addSafe(L1, barStart + beatSec * 0.75, 0, 'normal');
          builder.addSafe(L0, barStart + beatSec * 1.25, 0, 'normal');
          builder.addSafe(L1, barStart + beatSec * 1.75, 0, 'normal');
          builder.addChord(chordInner, barStart + beatSec * 2.5);
          builder.addGallop(R0, R1, barStart + beatSec * 3.25, beatSec);
        } else if (phrase === 2) {
          builder.addChord(chordOuter, barStart);
          builder.addGallop(L1, R0, barStart + beatSec * 0.5, beatSec);
          builder.addChord(chordInner, barStart + beatSec * 1.5);
          builder.addSafe(R2, barStart + beatSec * 2.25, 0, 'normal');
          builder.addStair(L0, barStart + beatSec * 2.75, beatSec * 0.25, 4, 1);
          builder.addSafe(R1, barStart + beatSec * 3.5, 0, 'normal');
        } else {
          builder.addStair(L0, barStart, beatSec * 0.25, is6K ? 6 : 4, 1);
          builder.addChord(chordA, barStart + beatSec * 1.5);
          builder.addTrill(R0, R1, barStart + beatSec * 2.0, beatSec * 0.25, 4);
          builder.addChord(chordImpact, barStart + beatSec * 3.25);
        }
      }
    }

    // -----------------------------------------------------------------
    // 7. OUTRO (엔딩 피날레)
    // -----------------------------------------------------------------
    else {
      const oBar = bar - finalChorusBars;
      const oTotal = totalBars - finalChorusBars;

      if (bar === totalBars - 1) {
        const endCh = isExpert ? (is6K ? [0, 2, 5] : [0, 3]) : (is6K ? [1, 4] : [0, 3]);
        for (const l of endCh) {
          builder.tryAdd(l, barStart, beatSec * 3.5, 'hold');
        }
      } else if (oBar < oTotal - 1) {
        if (isExpert) {
          builder.addSafe((oBar % 2 === 0) ? L1 : R0, barStart, 0, 'normal');
          builder.addSafe((oBar % 2 === 0) ? R2 : L0, barStart + beatSec * 1.5, 0, 'normal');
          builder.addGallop(R0, R1, barStart + beatSec * 2.5, beatSec);
        } else {
          builder.addSafe((oBar % 2 === 0) ? L1 : R0, barStart, 0, 'normal');
          builder.addSafe((oBar % 2 === 0) ? R2 : L0, barStart + beatSec * 2, 0, 'normal');
        }
      }
    }
  }

  return builder.getSortedNotes();
}

// 1. 공통 오디오 로더 헬퍼 (고음질 MP3 최적화)
const loadAudioBuffer = (filePath: string) => {
  const targetPath = filePath.replace(/\.flac$/i, '.mp3');
  const fn = async (ctx: AudioContext): Promise<AudioBuffer> => {
    try {
      const res = await fetch(encodeURI(targetPath));
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        return await ctx.decodeAudioData(arrayBuffer);
      }
    } catch {
      // MP3 로딩 실패 시 원본 경로 시도
    }

    const resOrig = await fetch(encodeURI(filePath));
    if (!resOrig.ok) {
      throw new Error(`오디오 파일을 찾을 수 없습니다: ${targetPath} 또는 ${filePath}`);
    }
    const arrayBuffer = await resOrig.arrayBuffer();
    return await ctx.decodeAudioData(arrayBuffer);
  };
  (fn as any).audioUrl = targetPath;
  return fn;
};

// 2. 표준 4K/6K 차트 헬퍼 (스타일 및 시작 오프셋 지원)
export const createStandardCharts = (
  bpm: number,
  bars: number,
  style: ChartStyle = 'edm',
  startOffsetSec?: number
): SongInfo['charts'] => ({
  '4K_NORMAL': { keyMode: '4K', difficulty: 'NORMAL', notes: createChartNotes(bpm, bars, '4K', 'NORMAL', style, startOffsetSec) },
  '4K_HARD':   { keyMode: '4K', difficulty: 'HARD',   notes: createChartNotes(bpm, bars, '4K', 'HARD', style, startOffsetSec) },
  '4K_EXPERT': { keyMode: '4K', difficulty: 'EXPERT', notes: createChartNotes(bpm, bars, '4K', 'EXPERT', style, startOffsetSec) },
  '6K_NORMAL': { keyMode: '6K', difficulty: 'NORMAL', notes: createChartNotes(bpm, bars, '6K', 'NORMAL', style, startOffsetSec) },
  '6K_HARD':   { keyMode: '6K', difficulty: 'HARD',   notes: createChartNotes(bpm, bars, '6K', 'HARD', style, startOffsetSec) },
  '6K_EXPERT': { keyMode: '6K', difficulty: 'EXPERT', notes: createChartNotes(bpm, bars, '6K', 'EXPERT', style, startOffsetSec) },
});

/**
 * 커스텀 수제 채보가 로컬에 저장되어 있으면 우선 로드하고, 없으면 기본 채보 반환
 */
export function getActiveChart(song: SongInfo, keyMode: KeyMode, difficulty: Difficulty): SongChart {
  try {
    const customKey = `CUSTOM_CHART_${song.id}_${keyMode}_${difficulty}`;
    const saved = localStorage.getItem(customKey);
    if (saved) {
      const parsedNotes = JSON.parse(saved);
      if (Array.isArray(parsedNotes) && parsedNotes.length > 0) {
        return {
          keyMode,
          difficulty,
          notes: parsedNotes
        };
      }
    }
  } catch (e) {
    console.warn('Failed to load custom chart from storage:', e);
  }

  const chartKey = `${keyMode}_${difficulty}` as const;
  return song.charts[chartKey] || { keyMode, difficulty, notes: [] };
}

export function hasCustomChart(songId: string, keyMode: KeyMode, difficulty: Difficulty): boolean {
  try {
    const customKey = `CUSTOM_CHART_${songId}_${keyMode}_${difficulty}`;
    const saved = localStorage.getItem(customKey);
    return !!saved && JSON.parse(saved).length > 0;
  } catch {
    return false;
  }
}

// 3. 봇치 더 록! 트랙 리스트
export const BOCCHI_TRACKS: SongInfo[] = [
  {
    id: 'kessoku-seishun-complex',
    title: '青春コンプレックス',
    artist: '結束バンド',
    bpm: 190,
    genre: 'J-Rock / Anime',
    album: '結束バンド',
    jacketColor1: '#ff5b99',
    jacketColor2: '#ffe600',
    jacketUrl: '/images/청춘 콤플렉스.jpg',
    generateAudioBuffer: loadAudioBuffer('/audio/01. 青春コンプレックス.mp3'),
    charts: createStandardCharts(190, 160, 'jrock', 0.410)
  },
  {
    id: 'kessoku-distortion',
    title: 'Distortion!!',
    artist: '結束バンド',
    bpm: 195,
    genre: 'Pop Punk / J-Rock',
    album: '結束バンド',
    jacketColor1: '#ffb703',
    jacketColor2: '#fb8500',
    jacketUrl: '/images/Distortion!!.jpg',
    generateAudioBuffer: loadAudioBuffer('/audio/03. Distortion!!.mp3'),
    charts: createStandardCharts(195, 165, 'punk', 0.400)
  },
  {
    id: 'kessoku-seiza-ni-naretara',
    title: '星座になれたら',
    artist: '結束バンド',
    bpm: 124,
    genre: 'City Pop / Funk Rock',
    album: '結束バンド',
    jacketColor1: '#00f0ff',
    jacketColor2: '#ff2a6d',
    jacketUrl: '/images/별자리가 될 수 있다면.jpg',
    generateAudioBuffer: loadAudioBuffer('/audio/12. 星座になれたら.mp3'),
    charts: createStandardCharts(124, 133, 'funk', 0.417)
  },
  {
    id: 'kessoku-hitoribocchi-tokyo',
    title: 'ひとりぼっち東京',
    artist: '結束バンド',
    bpm: 192,
    genre: 'J-Rock / Alternative',
    album: '結束バンド',
    jacketColor1: '#3a86ff',
    jacketColor2: '#ff006e',
    jacketUrl: '/images/결속밴드.jpg',
    generateAudioBuffer: loadAudioBuffer('/audio/02. ひとりぼっち東京.mp3'),
    charts: createStandardCharts(192, 185, 'jrock', 0.410)
  },
  {
    id: 'kessoku-himitsu-kichi',
    title: 'ひみつ基地',
    artist: '結束バンド',
    bpm: 180,
    genre: 'Indie Rock / Pop Rock',
    album: '結束バンド',
    jacketColor1: '#06d6a0',
    jacketColor2: '#ffd166',
    jacketUrl: '/images/결속밴드.jpg',
    generateAudioBuffer: loadAudioBuffer('/audio/04. ひみつ基地.mp3'),
    charts: createStandardCharts(180, 174, 'jrock', 0.980)
  },
  {
    id: 'kessoku-aoi-wakusei',
    title: 'ギターと孤独と蒼い惑星',
    artist: '結束バンド',
    bpm: 193,
    genre: 'Alternative Rock / Punk',
    album: '結束バンド',
    jacketColor1: '#0048ff',
    jacketColor2: '#00f5d4',
    jacketUrl: '/images/기타와 고독과 푸른 행성.jpg',
    generateAudioBuffer: loadAudioBuffer('/audio/05. ギターと孤独と蒼い惑星.mp3'),
    charts: createStandardCharts(193, 183, 'guitarhero', 0.370)
  },
  {
    id: 'kessoku-love-song',
    title: 'ラブソングが歌えない',
    artist: '結束バンド',
    bpm: 186,
    genre: 'Garage Rock / J-Rock',
    album: '結束バンド',
    jacketColor1: '#8338ec',
    jacketColor2: '#ff0054',
    jacketUrl: '/images/결속밴드.jpg',
    generateAudioBuffer: loadAudioBuffer('/audio/06. ラブソングが歌えない.mp3'),
    charts: createStandardCharts(186, 146, 'punk', 0.410)
  },
  {
    id: 'kessoku-ano-band',
    title: 'あのバンド',
    artist: '結束バンド',
    bpm: 190,
    genre: 'Post-Punk / Math Rock',
    album: '結束バンド',
    jacketColor1: '#ffffff',
    jacketColor2: '#9d4edd',
    jacketUrl: '/images/그 밴드.jpg',
    generateAudioBuffer: loadAudioBuffer('/audio/07. あのバンド.mp3'),
    charts: createStandardCharts(190, 168, 'mathrock', 0.410)
  },
  {
    id: 'kessoku-karakara',
    title: 'カラカラ',
    artist: '結束バンド',
    bpm: 190,
    genre: 'Math Rock / Indie Rock',
    album: '結束バンド',
    jacketColor1: '#0055ff',
    jacketColor2: '#f4a261',
    jacketUrl: '/images/달각달각.jpg',
    generateAudioBuffer: loadAudioBuffer('/audio/08. カラカラ.mp3'),
    charts: createStandardCharts(190, 210, 'mathrock', 0.410)
  },
  {
    id: 'kessoku-chiisana-umi',
    title: '小さな海',
    artist: '結束バンド',
    bpm: 94,
    genre: 'Indie Pop / Ballad',
    album: '結束バンド',
    jacketColor1: '#0077b6',
    jacketColor2: '#90e0ef',
    jacketUrl: '/images/결속밴드.jpg',
    generateAudioBuffer: loadAudioBuffer('/audio/09. 小さな海.mp3'),
    charts: createStandardCharts(94, 87, 'ballad', 0.400)
  },
  {
    id: 'kessoku-nani-ga-warui',
    title: 'なにが悪い',
    artist: '結束バンド',
    bpm: 122,
    genre: 'Pop Rock / Anime Pop',
    album: '結束バンド',
    jacketColor1: '#ffd000',
    jacketColor2: '#ff007f',
    jacketUrl: '/images/뭐가 나빠.jpg',
    generateAudioBuffer: loadAudioBuffer('/audio/10. なにが悪い.mp3'),
    charts: createStandardCharts(122, 115, 'poppunk', 0.430)
  },
  {
    id: 'kessoku-wasurete-yaranai',
    title: '忘れてやらない',
    artist: '結束バンド',
    bpm: 184,
    genre: 'Power Pop / Punk Rock',
    album: '結束バンド',
    jacketColor1: '#ff0055',
    jacketColor2: '#ffbe0b',
    jacketUrl: '/images/잊어주지 않을 거야.jpg',
    generateAudioBuffer: loadAudioBuffer('/audio/11. 忘れてやらない.mp3'),
    charts: createStandardCharts(184, 171, 'punk', 0.410)
  },
  {
    id: 'kessoku-flashbacker',
    title: 'フラッシュバッカー',
    artist: '結束バンド',
    bpm: 77,
    genre: 'Shoegaze / Alternative',
    album: '結束バンド',
    jacketColor1: '#e0aaff',
    jacketColor2: '#3c096c',
    jacketUrl: '/images/결속밴드.jpg',
    generateAudioBuffer: loadAudioBuffer('/audio/13. フラッシュバッカー.mp3'),
    charts: createStandardCharts(77, 88, 'shoegaze', 0.410)
  },
  {
    id: 'kessoku-korogaru-iwa',
    title: '転がる岩、君に朝が降る',
    artist: '結束バンド',
    bpm: 150,
    genre: 'Alternative Rock / Cover',
    album: '結束バンド',
    jacketColor1: '#ff758f',
    jacketColor2: '#48cae4',
    jacketUrl: '/images/구르는 바위, 네게 아침이 내린다.jpg',
    generateAudioBuffer: loadAudioBuffer('/audio/14. 転がる岩、君に朝が降る.mp3'),
    charts: createStandardCharts(150, 170, 'jrock', 0.410)
  },
  {
    id: 'kessoku-hikari-no-naka-e',
    title: '光の中へ',
    artist: '結束バンド',
    bpm: 196,
    genre: 'Alternative Rock / J-Rock',
    album: '光の中へ',
    jacketColor1: '#fff3b0',
    jacketColor2: '#ff007f',
    jacketUrl: '/images/빛 속으로.jpg',
    generateAudioBuffer: loadAudioBuffer('/audio/01. 光の中へ.mp3'),
    charts: createStandardCharts(196, 210, 'guitarhero', 0.400)
  },
  {
    id: 'kessoku-aoiharu-to-nishi-no-sora',
    title: '青い春と西の空',
    artist: '結束バンド',
    bpm: 165,
    genre: 'J-Rock / Youth Pop',
    album: '光の中へ',
    jacketColor1: '#ff7b00',
    jacketColor2: '#00b4d8',
    jacketUrl: '/images/빛 속으로.jpg',
    generateAudioBuffer: loadAudioBuffer('/audio/02. 青い春と西の空.mp3'),
    charts: createStandardCharts(165, 175, 'jrock', 0.400)
  },
  {
    id: 'kessoku-byoushin-shoujo',
    title: '秒針少女',
    artist: '結束バンド',
    bpm: 182,
    genre: 'J-Rock / Guitar Pop',
    album: 'Re:結束バンド',
    jacketColor1: '#ff2a6d',
    jacketColor2: '#05d9e8',
    jacketUrl: '/images/결속밴드6.png',
    generateAudioBuffer: loadAudioBuffer('/audio/秒針少女.mp3'),
    charts: createStandardCharts(182, 170, 'jrock', 0.500)
  },
  {
    id: 'kessoku-boku-to-sangenshoku',
    title: '僕と三原色',
    artist: '結束バンド',
    bpm: 174,
    genre: 'Power Pop / J-Rock',
    album: 'Re:結束バンド',
    jacketColor1: '#ffbe0b',
    jacketColor2: '#3a86ff',
    jacketUrl: '/images/결속밴드6.png',
    generateAudioBuffer: loadAudioBuffer('/audio/僕と三原色.mp3'),
    charts: createStandardCharts(174, 155, 'poppunk', 0.420)
  },
  {
    id: 'kessoku-re-re',
    title: 'Re:Re:',
    artist: '結束バンド',
    bpm: 154,
    genre: 'Alternative Rock / Cover',
    album: 'Re:結束バンド',
    jacketColor1: '#ff758f',
    jacketColor2: '#4361ee',
    jacketUrl: '/images/결속밴드3.png',
    // 파일명에 콜론(:) 대신 언더바(_)가 쓰인 환경 반영
    generateAudioBuffer: loadAudioBuffer('/audio/Re_Re_.mp3'),
    charts: createStandardCharts(154, 198, 'jrock', 0.530)
  },
  {
    id: 'kessoku-doppelganger',
    title: 'ドッペルゲンガー',
    artist: '結束バンド',
    bpm: 192,
    genre: 'Alternative Rock / Punk',
    album: 'Re:結束バンド',
    jacketColor1: '#b5179e',
    jacketColor2: '#00f5d4',
    jacketUrl: '/images/결속밴드3.png',
    generateAudioBuffer: loadAudioBuffer('/audio/ドッペルゲンガー.mp3'),
    charts: createStandardCharts(192, 174, 'punk', 0.450)
  },
  {
    id: 'kessoku-ima-boku-underground-kara',
    title: '今、僕、アンダーグラウンドから',
    artist: '結束バンド',
    bpm: 188,
    genre: 'Post-Punk / Garage Rock',
    album: 'Re:結束バンド',
    jacketColor1: '#ffaa00',
    jacketColor2: '#7b2cbf',
    jacketUrl: '/images/결속밴드2.png',
    generateAudioBuffer: loadAudioBuffer('/audio/今、僕、アンダーグラウンドから.mp3'),
    charts: createStandardCharts(188, 205, 'punk', 0.440)
  },
  {
    id: 'kessoku-tsukinami-ni-kagayake',
    title: '月並みに輝け',
    artist: '結束バンド',
    bpm: 186,
    genre: 'Anime Rock / Pop Rock',
    album: 'Re:結束バンド',
    jacketColor1: '#ffd166',
    jacketColor2: '#5e60ce',
    jacketUrl: '/images/결속밴드2.png',
    generateAudioBuffer: loadAudioBuffer('/audio/月並みに輝け.mp3'),
    charts: createStandardCharts(186, 200, 'jrock', 0.540)
  },
  {
    id: 'kessoku-yume-wo-tabanete',
    title: '夢を束ねて',
    artist: '結束バンド',
    bpm: 144,
    genre: 'Alternative Rock / J-Rock',
    album: 'We will',
    jacketColor1: '#ff4d6d',
    jacketColor2: '#a2d2ff',
    jacketUrl: '/images/결속밴드4.png',
    generateAudioBuffer: loadAudioBuffer('/audio/夢を束ねて.mp3'),
    charts: createStandardCharts(144, 152, 'jrock', 0.430)
  },
  {
    id: 'kessoku-unite',
    title: 'UNITE',
    artist: '結束バンド',
    bpm: 200,
    genre: 'Melodic Punk / Fast Rock',
    album: 'We will',
    jacketColor1: '#ffb703',
    jacketColor2: '#fb5607',
    jacketUrl: '/images/결속밴드4.png',
    generateAudioBuffer: loadAudioBuffer('/audio/UNITE.mp3'),
    charts: createStandardCharts(200, 172, 'punk', 0.400)
  },
  {
    id: 'kessoku-madou-hoshi',
    title: '惑う星',
    artist: '結束バンド',
    bpm: 180,
    genre: 'Indie Rock / Post-Punk',
    album: 'We will',
    jacketColor1: '#3a0ca3',
    jacketColor2: '#4cc9f0',
    jacketUrl: '/images/결속밴드4.png',
    generateAudioBuffer: loadAudioBuffer('/audio/惑う星.mp3'),
    charts: createStandardCharts(180, 172, 'mathrock', 0.400)
  },
  {
    id: 'kessoku-milky-way',
    title: 'milky way',
    artist: '結束バンド',
    bpm: 130,
    genre: 'Indie Pop / Guitar Rock',
    album: 'We will',
    jacketColor1: '#7209b7',
    jacketColor2: '#fee440',
    jacketUrl: '/images/결속밴드4.png',
    generateAudioBuffer: loadAudioBuffer('/audio/milky way.mp3'),
    charts: createStandardCharts(130, 120, 'poppunk', 0.460)
  },
  {
    id: 'sakura-won3chu-kissme',
    title: 'Won(3)Chu KissMe!',
    artist: 'SAKURA*TRICK',
    bpm: 135,
    genre: 'Anime Pop / Denpa',
    album: '結束バンドの歌ってみた',
    jacketColor1: '#ff70a6',
    jacketColor2: '#70d6ff',
    jacketUrl: '/images/결속밴드5.png',
    generateAudioBuffer: loadAudioBuffer('/audio/Won(3)Chu KissMe!.mp3'),
    charts: createStandardCharts(135, 128, 'poppunk', 0.214)
  },
  {
    id: 'yurucamp-shiny-days',
    title: 'SHINY DAYS',
    artist: '亜咲花',
    bpm: 100,
    genre: 'Soul Pop / Anime',
    album: '結束バンドの歌ってみた',
    jacketColor1: '#ff9f1c',
    jacketColor2: '#2ec4b6',
    jacketUrl: '/images/결속밴드5.png',
    generateAudioBuffer: loadAudioBuffer('/audio/SHINY DAYS.mp3'),
    charts: createStandardCharts(100, 110, 'ballad', 0.200)
  },
  {
    id: 'killme-baby',
    title: 'キルミーのベイベー！',
    artist: 'やすなとソーニャ',
    bpm: 152,
    genre: 'Chaos Denpa / Pop Punk',
    album: '結束バンドの歌ってみた',
    jacketColor1: '#70e000',
    jacketColor2: '#ff0054',
    jacketUrl: '/images/결속밴드5.png',
    generateAudioBuffer: loadAudioBuffer('/audio/キルミーのベイベー！.mp3'),
    charts: createStandardCharts(152, 97, 'punk', 0.200)
  },
  {
    id: 'gochiusa-daydream-cafe',
    title: 'Daydream café',
    artist: "Petit Rabbit's",
    bpm: 172,
    genre: 'Kawaii Pop / Anime Jazz',
    album: '結束バンドの歌ってみた',
    jacketColor1: '#ff85a1',
    jacketColor2: '#a0c4ff',
    jacketUrl: '/images/결속밴드5.png',
    generateAudioBuffer: loadAudioBuffer('/audio/Daydream café.mp3'),
    charts: createStandardCharts(172, 163, 'poppunk', 0.317)
  },
  {
    id: 'kon-cagayake-girls',
    title: 'Cagayake!GIRLS',
    artist: '桜高軽音部',
    bpm: 170,
    genre: 'J-Rock / Pop Punk',
    album: '結束バンドの歌ってみた',
    jacketColor1: '#ff0055',
    jacketColor2: '#ffbe0b',
    jacketUrl: '/images/결속밴드5.png',
    generateAudioBuffer: loadAudioBuffer('/audio/Cagayake!GIRLS.mp3'),
    charts: createStandardCharts(170, 177, 'punk', 0.200)
  }
];

// 모든 트랙에 audioUrl 명시적 등록 (HTMLAudioElement 및 에디터 직접 재생 지원)
BOCCHI_TRACKS.forEach(track => {
  if (!track.audioUrl) {
    track.audioUrl = (track.generateAudioBuffer as any)?.audioUrl || `/audio/${track.title}.mp3`;
  }
});

/**
 * 기본 탑재 수록곡 목록 (총 31곡 결속밴드 및 애니메이션 수록곡)
 */
export const SONG_DATABASE: SongInfo[] = [
  ...BOCCHI_TRACKS
];
