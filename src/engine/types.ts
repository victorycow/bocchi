export type KeyMode = '4K' | '6K';
export type Difficulty = 'NORMAL' | 'HARD' | 'EXPERT';
export type ChartKey = `${KeyMode}_${Difficulty}`;

export type NoteType = 'normal' | 'hold';

export interface NoteData {
  id: number;
  lane: number;           // 0 ~ 3 (4K) 또는 0 ~ 5 (6K)
  time: number;           // 판정선 도달 시간 (초 단위)
  duration: number;       // 롱노트 지속시간 (단타는 0)
  type: NoteType;

  // 런타임 게임 플레이 상태
  hit?: boolean;          // 단타 판정 완료 또는 롱노트 시작 판정
  missed?: boolean;       // 미스 처리 여부
  holding?: boolean;      // 롱노트 현재 누르고 있는 중인지
  holdCompleted?: boolean;// 롱노트 완전히 끝까지 성공
  holdSuccessTime?: number;// 롱노트 유지된 총 시간
}

export type JudgementType = 'MAX100' | '90' | '80' | '70' | '50' | 'MISS';

export interface JudgementEvent {
  type: JudgementType;
  lane: number;
  diffMs: number;
  time: number;
}

export interface SongChart {
  keyMode: KeyMode;
  difficulty: Difficulty;
  notes: NoteData[];
  chartSource?: string;
}

export type SongAlbum = '結束バンド' | 'Re:結束バンド' | 'We will' | '結束バンドの歌ってみた' | '光の中へ';

export interface PlayMods {
  mirror: boolean;
  random: boolean;
  autoPlay: boolean;
}

export interface SongInfo {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  genre: string;
  album?: SongAlbum;
  jacketColor1: string;
  jacketColor2: string;
  jacketUrl?: string;
  generateAudioBuffer: (ctx: AudioContext) => AudioBuffer | Promise<AudioBuffer>;
  charts: {
    [key in ChartKey]?: SongChart;
  };
}

export interface GameStats {
  score: number;
  combo: number;
  maxCombo: number;
  feverGauge: number;     // 0 ~ 100
  feverLevel: number;     // 1 ~ 5
  isFeverActive: boolean;
  grooveGauge: number;    // 0 ~ 100 (HP)
  counts: Record<JudgementType, number>;
  totalNotes: number;
  processedNotes: number;
}

export interface PlayResult {
  songTitle: string;
  artist: string;
  keyMode: KeyMode;
  difficulty: Difficulty;
  score: number;
  maxCombo: number;
  accuracy: number;
  rank: 'SSS' | 'SS' | 'S' | 'A' | 'B' | 'C' | 'F';
  isClear: boolean;
  counts: Record<JudgementType, number>;
}
