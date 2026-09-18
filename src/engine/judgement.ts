import { NoteData, JudgementType, JudgementEvent, GameStats, PlayResult, KeyMode, Difficulty } from './types';

// 판정 윈도우 (밀리초 단위 오차 범위)
export const TIMING_WINDOWS: { type: JudgementType; maxDiffMs: number; scoreRate: number }[] = [
  { type: 'MAX100', maxDiffMs: 38,  scoreRate: 1.0 },
  { type: '90',     maxDiffMs: 75,  scoreRate: 0.9 },
  { type: '80',     maxDiffMs: 110, scoreRate: 0.8 },
  { type: '70',     maxDiffMs: 145, scoreRate: 0.7 },
  { type: '50',     maxDiffMs: 180, scoreRate: 0.5 },
];

export class JudgementEngine {
  private notes: NoteData[] = [];
  private stats: GameStats = {
    score: 0,
    combo: 0,
    maxCombo: 0,
    feverGauge: 0,
    feverLevel: 1,
    isFeverActive: false,
    grooveGauge: 100,
    counts: {
      MAX100: 0,
      '90': 0,
      '80': 0,
      '70': 0,
      '50': 0,
      MISS: 0,
    },
    totalNotes: 0,
    processedNotes: 0,
  };

  private events: JudgementEvent[] = [];
  private baseNoteScore = 0;
  private holdTickInterval = 0.08; // 롱노트 콤보 틱 간격 (80ms)
  private songTitle = '';
  private artist = '';
  private keyMode: KeyMode = '4K';
  private difficulty: Difficulty = 'NORMAL';

  private lastHitTimePerLane: number[] = [0, 0, 0, 0, 0, 0];

  constructor() {}

  public init(songTitle: string, artist: string, keyMode: KeyMode, difficulty: Difficulty, notes: NoteData[]) {
    this.songTitle = songTitle;
    this.artist = artist;
    this.keyMode = keyMode;
    this.difficulty = difficulty;
    this.lastHitTimePerLane = [0, 0, 0, 0, 0, 0];

    // 노트 복사 및 시간 순 정렬 보장
    this.notes = notes
      .map(n => ({
        ...n,
        hit: false,
        missed: false,
        holding: false,
        holdCompleted: false,
        holdSuccessTime: 0
      }))
      .sort((a, b) => a.time - b.time);

    // 총 점수 1,000,000점 기준 가중치 계산
    const totalCount = this.notes.length;
    this.baseNoteScore = totalCount > 0 ? (900000 / totalCount) : 0;

    this.stats = {
      score: 0,
      combo: 0,
      maxCombo: 0,
      feverGauge: 0,
      feverLevel: 1,
      isFeverActive: false,
      grooveGauge: 100,
      counts: {
        MAX100: 0,
        '90': 0,
        '80': 0,
        '70': 0,
        '50': 0,
        MISS: 0,
      },
      totalNotes: totalCount,
      processedNotes: 0,
    };
    this.events = [];
  }

  public getNotes(): NoteData[] {
    return this.notes;
  }

  public getStats(): GameStats {
    return this.stats;
  }

  public popEvents(): JudgementEvent[] {
    const ev = [...this.events];
    this.events = [];
    return ev;
  }

  /**
   * 키를 눌렀을 때(Key Down) 호출
   */
  public handleKeyDown(lane: number, currentSongTime: number) {
    // 0. 레인별 35ms 이내 초고속 중복 바운스 방지
    if (this.lastHitTimePerLane[lane] && (currentSongTime - this.lastHitTimePerLane[lane]) < 0.035 && (currentSongTime - this.lastHitTimePerLane[lane]) >= 0) {
      return;
    }

    // 1. 이미 판정선을 지나서 늦어버린(180ms 초과) 이전 노트들은 즉시 MISS 처리하여 큐에서 소진
    for (const note of this.notes) {
      if (note.lane === lane && !note.hit && !note.missed) {
        if (currentSongTime - note.time > 0.18) {
          note.missed = true;
          this.applyJudgement('MISS', lane, 180, currentSongTime, 0);
        }
      }
    }

    // 2. 해당 레인에서 아직 판정되지 않은 가장 가까운 노트 찾기 (시간 순 정렬)
    const candidates = this.notes
      .filter(n => n.lane === lane && !n.hit && !n.missed)
      .sort((a, b) => a.time - b.time);

    if (candidates.length === 0) return;

    // 시간 순 정렬된 첫 번째 노트
    const target = candidates[0];
    const diffSec = currentSongTime - target.time;
    const diffMs = diffSec * 1000;
    const absDiffMs = Math.abs(diffMs);

    // 판정 범위(±180ms) 안에 들어왔는가?
    let matchedJudge: JudgementType | null = null;
    let scoreRate = 0;

    for (const win of TIMING_WINDOWS) {
      if (absDiffMs <= win.maxDiffMs) {
        matchedJudge = win.type;
        scoreRate = win.scoreRate;
        break;
      }
    }

    if (matchedJudge) {
      target.hit = true;
      this.lastHitTimePerLane[lane] = currentSongTime;
      if (target.type === 'hold') {
        target.holding = true;
        target.holdSuccessTime = currentSongTime;
      }
      this.applyJudgement(matchedJudge, lane, diffMs, currentSongTime, scoreRate);
    } else if (diffMs < -180 && diffMs >= -280) {
      // 너무 일찍 침 (Early MISS)
      target.missed = true;
      this.lastHitTimePerLane[lane] = currentSongTime;
      this.applyJudgement('MISS', lane, diffMs, currentSongTime, 0);
    }
  }

  /**
   * 키를 뗐을 때(Key Up) 호출 - 롱노트 처리
   */
  public handleKeyUp(lane: number, currentSongTime: number) {
    // 해당 레인에서 현재 누르고 있던 롱노트가 있는지 확인
    const holdingNote = this.notes.find(
      n => n.lane === lane && n.type === 'hold' && n.holding && !n.holdCompleted && !n.missed
    );

    if (!holdingNote) return;

    holdingNote.holding = false;
    const endTime = holdingNote.time + holdingNote.duration;
    const remainingTime = endTime - currentSongTime;

    // 끝나는 지점 근처(100ms 이내)에서 뗐다면 완벽한 홀드 클리어
    if (remainingTime <= 0.1) {
      holdingNote.holdCompleted = true;
    } else {
      // 너무 일찍 손을 뗐을 때 미스 처리
      holdingNote.missed = true;
      this.applyJudgement('MISS', lane, 0, currentSongTime, 0);
    }
  }

  /**
   * 프레임 업데이트 시 호출 - 놓친 노트 판정 및 롱노트 지속 틱 갱신
   */
  public update(currentSongTime: number) {
    const missThresholdSec = 0.18; // 판정선 지나고 180ms 지나면 자동 MISS

    for (const note of this.notes) {
      // 1. 일반 노트 & 홀드 시작 미스 검사
      if (!note.hit && !note.missed) {
        if (currentSongTime - note.time > missThresholdSec) {
          note.missed = true;
          this.applyJudgement('MISS', note.lane, 180, currentSongTime, 0);
        }
      }

      // 2. 누르고 있는 롱노트 틱 처리
      if (note.type === 'hold' && note.holding && !note.holdCompleted && !note.missed) {
        const endTime = note.time + note.duration;

        // 롱노트 지속시간 동안 콤보 누적
        const lastTick = note.holdSuccessTime || note.time;
        if (currentSongTime - lastTick >= this.holdTickInterval) {
          note.holdSuccessTime = currentSongTime;
          this.stats.combo++;
          if (this.stats.combo > this.stats.maxCombo) {
            this.stats.maxCombo = this.stats.combo;
          }
          // 틱 보너스 점수 (피버 배율 적용)
          const feverMult = 1.0 + (this.stats.feverLevel - 1) * 0.25;
          this.stats.score += Math.round(this.baseNoteScore * 0.1 * feverMult);
          this.addFever(0.5);
        }

        // 끝나는 시간 도달 시 완료 처리
        if (currentSongTime >= endTime) {
          note.holdCompleted = true;
          note.holding = false;
          this.events.push({
            type: 'MAX100',
            lane: note.lane,
            diffMs: 0,
            time: currentSongTime
          });
        }
      }
    }
  }

  private applyJudgement(type: JudgementType, lane: number, diffMs: number, time: number, scoreRate: number) {
    this.stats.counts[type]++;
    this.stats.processedNotes++;

    this.events.push({ type, lane, diffMs, time });

    if (type === 'MISS') {
      this.stats.combo = 0;
      this.stats.grooveGauge = Math.max(0, this.stats.grooveGauge - 7);
      // 피버 게이지 감소
      this.stats.feverGauge = Math.max(0, this.stats.feverGauge - 20);
      if (this.stats.feverLevel > 1) {
        this.stats.feverLevel = 1;
        this.stats.isFeverActive = false;
      }
    } else {
      this.stats.combo++;
      if (this.stats.combo > this.stats.maxCombo) {
        this.stats.maxCombo = this.stats.combo;
      }

      // 피버 배율 (Fever Lv 1~5 -> 1.0x ~ 2.0x)
      const feverMult = 1.0 + (this.stats.feverLevel - 1) * 0.25;

      // 콤보 보너스 계산
      const comboBonusRate = Math.min(1.0, this.stats.combo / 500);
      const comboScore = (100000 / Math.max(1, this.stats.totalNotes)) * comboBonusRate;

      const gainedScore = (this.baseNoteScore * scoreRate * feverMult) + comboScore;
      this.stats.score += Math.round(gainedScore);

      // 체력 회복
      this.stats.grooveGauge = Math.min(100, this.stats.grooveGauge + 1.5);

      // 피버 게이지 충전
      this.addFever(type === 'MAX100' ? 2.5 : 1.5);
    }
  }

  private addFever(amount: number) {
    this.stats.feverGauge += amount;
    if (this.stats.feverGauge >= 100) {
      if (this.stats.feverLevel < 5) {
        this.stats.feverLevel++;
        this.stats.feverGauge = 0;
        this.stats.isFeverActive = true;
      } else {
        this.stats.feverGauge = 100;
      }
    }
  }

  public isFinished(currentSongTime: number, songDuration: number): boolean {
    // 모든 노트가 처리되었고 음악이 끝났거나 마지막 노트 후 1.5초 지났을 때
    const lastNoteTime = this.notes.reduce((max, n) => Math.max(max, n.time + n.duration), 0);
    return (
      (this.stats.processedNotes >= this.stats.totalNotes || currentSongTime > lastNoteTime + 1.2) &&
      currentSongTime >= songDuration
    );
  }

  public getPlayResult(): PlayResult {
    const total = Math.max(1, this.stats.totalNotes);
    const score = this.stats.score;

    // 정확도 계산 (가중 평균)
    const weightedSum =
      this.stats.counts.MAX100 * 100 +
      this.stats.counts['90'] * 90 +
      this.stats.counts['80'] * 80 +
      this.stats.counts['70'] * 70 +
      this.stats.counts['50'] * 50;
    const accuracy = Number((weightedSum / total).toFixed(2));

    const isClear = this.stats.grooveGauge > 0 && accuracy >= 60;

    let rank: 'SSS' | 'SS' | 'S' | 'A' | 'B' | 'C' | 'F' = 'F';
    if (!isClear) {
      rank = 'F';
    } else if (accuracy >= 98 && this.stats.counts.MISS === 0) {
      rank = 'SSS';
    } else if (accuracy >= 95) {
      rank = 'SS';
    } else if (accuracy >= 90) {
      rank = 'S';
    } else if (accuracy >= 80) {
      rank = 'A';
    } else if (accuracy >= 70) {
      rank = 'B';
    } else {
      rank = 'C';
    }

    return {
      songTitle: this.songTitle,
      artist: this.artist,
      keyMode: this.keyMode,
      difficulty: this.difficulty,
      score,
      maxCombo: this.stats.maxCombo,
      accuracy,
      rank,
      isClear,
      counts: { ...this.stats.counts }
    };
  }
}
