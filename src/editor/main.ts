import { SONG_DATABASE } from '../data/songs';
import { SongInfo, Difficulty, NoteData } from '../engine/types';
import { EditorCanvas } from './editorCanvas';
import { ChartRecorder } from './recorder';
import { JudgementEngine } from '../engine/judgement';
import { CanvasRenderer } from '../engine/renderer';
import { InputManager } from '../engine/input';

class ChartEditorApp {
  private songs: SongInfo[] = SONG_DATABASE;
  private currentSong: SongInfo;
  private currentDifficulty: Difficulty = 'NORMAL';

  private audio: HTMLAudioElement;
  private audioCtx: AudioContext | null = null;
  private metronomeEnabled = false;
  private lastMetronomeBeat = -1;

  private canvasEditor: EditorCanvas;
  private recorder: ChartRecorder;

  // DOM Elements
  private songSelectEl: HTMLSelectElement;
  private diffBtns: NodeListOf<HTMLButtonElement>;
  private playPauseBtn: HTMLButtonElement;
  private stopBtn: HTMLButtonElement;
  private rateBtns: NodeListOf<HTMLButtonElement>;
  private metronomeBtn: HTMLButtonElement;
  private snapSelectEl: HTMLSelectElement;
  private modeNormalBtn: HTMLButtonElement;
  private modeHoldBtn: HTMLButtonElement;
  private recBtn: HTMLButtonElement;
  private testBtn: HTMLButtonElement;
  private saveBtn: HTMLButtonElement;
  private exportBtn: HTMLButtonElement;
  private importBtn: HTMLButtonElement;
  private importFileInput: HTMLInputElement;
  private copyJsonBtn: HTMLButtonElement;
  private clearChartBtn: HTMLButtonElement;
  private resetDefaultBtn: HTMLButtonElement;

  // Sidebar info
  private metaJacketEl: HTMLElement;
  private metaTitleEl: HTMLElement;
  private metaArtistEl: HTMLElement;
  private metaBpmEl: HTMLElement;
  private metaGenreEl: HTMLElement;
  private displayTimeEl: HTMLElement;
  private displayBarEl: HTMLElement;
  private displayDurationEl: HTMLElement;
  private statTotalEl: HTMLElement;
  private statTapsEl: HTMLElement;
  private statHoldsEl: HTMLElement;
  private statNpsEl: HTMLElement;
  private valOffsetEl: HTMLElement;
  private btnOffsetSub: HTMLButtonElement;
  private btnOffsetAdd: HTMLButtonElement;

  // Scrubber
  private scrubberWrap: HTMLElement;
  private scrubberFill: HTMLElement;
  private scrubberHandle: HTMLElement;

  // Test Play
  private testOverlay: HTMLElement;
  private testGameCanvas: HTMLCanvasElement;
  private btnExitTest: HTMLButtonElement;
  private testSongTitleEl: HTMLElement;
  private isTesting = false;
  private testJudgement: JudgementEngine | null = null;
  private testRenderer: CanvasRenderer | null = null;
  private testInput: InputManager | null = null;

  // Toast
  private toastEl: HTMLElement;
  private toastTimer: any = null;

  private startOffsetSec = 0.410;

  constructor() {
    this.currentSong = this.songs[0];
    this.audio = new Audio();

    // DOM Caches
    this.songSelectEl = document.getElementById('select-song') as HTMLSelectElement;
    this.diffBtns = document.querySelectorAll('.btn-group-diff .diff-btn');
    this.playPauseBtn = document.getElementById('btn-play-pause') as HTMLButtonElement;
    this.stopBtn = document.getElementById('btn-stop') as HTMLButtonElement;
    this.rateBtns = document.querySelectorAll('.rate-group .rate-btn');
    this.metronomeBtn = document.getElementById('btn-metronome') as HTMLButtonElement;
    this.snapSelectEl = document.getElementById('select-snap') as HTMLSelectElement;
    this.modeNormalBtn = document.getElementById('btn-mode-normal') as HTMLButtonElement;
    this.modeHoldBtn = document.getElementById('btn-mode-hold') as HTMLButtonElement;
    this.recBtn = document.getElementById('btn-rec') as HTMLButtonElement;
    this.testBtn = document.getElementById('btn-test-play') as HTMLButtonElement;
    this.saveBtn = document.getElementById('btn-save-game') as HTMLButtonElement;
    this.exportBtn = document.getElementById('btn-export-json') as HTMLButtonElement;
    this.importBtn = document.getElementById('btn-import-json') as HTMLButtonElement;
    this.importFileInput = document.getElementById('file-import-json') as HTMLInputElement;
    this.copyJsonBtn = document.getElementById('btn-copy-json') as HTMLButtonElement;
    this.clearChartBtn = document.getElementById('btn-clear-chart') as HTMLButtonElement;
    this.resetDefaultBtn = document.getElementById('btn-reset-default') as HTMLButtonElement;

    this.metaJacketEl = document.getElementById('meta-jacket')!;
    this.metaTitleEl = document.getElementById('meta-title')!;
    this.metaArtistEl = document.getElementById('meta-artist')!;
    this.metaBpmEl = document.getElementById('meta-bpm')!;
    this.metaGenreEl = document.getElementById('meta-genre')!;
    this.displayTimeEl = document.getElementById('display-time')!;
    this.displayBarEl = document.getElementById('display-bar')!;
    this.displayDurationEl = document.getElementById('display-duration')!;
    this.statTotalEl = document.getElementById('stat-total')!;
    this.statTapsEl = document.getElementById('stat-taps')!;
    this.statHoldsEl = document.getElementById('stat-holds')!;
    this.statNpsEl = document.getElementById('stat-nps')!;
    this.valOffsetEl = document.getElementById('val-offset')!;
    this.btnOffsetSub = document.getElementById('btn-offset-sub') as HTMLButtonElement;
    this.btnOffsetAdd = document.getElementById('btn-offset-add') as HTMLButtonElement;

    this.scrubberWrap = document.getElementById('scrubber-wrap')!;
    this.scrubberFill = document.getElementById('scrubber-fill')!;
    this.scrubberHandle = document.getElementById('scrubber-handle')!;

    this.testOverlay = document.getElementById('test-overlay')!;
    this.testGameCanvas = document.getElementById('test-game-canvas') as HTMLCanvasElement;
    this.btnExitTest = document.getElementById('btn-exit-test') as HTMLButtonElement;
    this.testSongTitleEl = document.getElementById('test-song-title')!;

    this.toastEl = document.getElementById('editor-toast')!;

    // Initialize Canvas
    const canvas = document.getElementById('editor-canvas') as HTMLCanvasElement;
    const container = document.getElementById('canvas-scroll-wrap')!;

    this.canvasEditor = new EditorCanvas(canvas, container, {
      bpm: this.currentSong.bpm,
      offsetSec: this.startOffsetSec,
      snapDiv: 8,
      pixelsPerBeat: 130
    });

    this.recorder = new ChartRecorder(
      this.canvasEditor,
      () => this.audio.currentTime,
      () => this.playTapSound()
    );

    this.setupAudio();
    this.populateSongList();
    this.setupEvents();
    this.loadCurrentSongData();
    this.startLoop();
  }

  private setupAudio() {
    this.audio.preload = 'auto';
    this.audio.addEventListener('loadedmetadata', () => {
      this.canvasEditor.setSongDuration(this.audio.duration || 180);
      this.displayDurationEl.textContent = this.formatTime(this.audio.duration || 0);
    });

    this.audio.addEventListener('ended', () => {
      this.playPauseBtn.textContent = '▶ PLAY';
      this.recorder.stop();
      this.recBtn.classList.remove('active');
    });
  }

  private populateSongList() {
    this.songSelectEl.innerHTML = '';
    this.songs.forEach((song, idx) => {
      const opt = document.createElement('option');
      opt.value = idx.toString();
      opt.textContent = `${song.title} (${song.bpm} BPM)`;
      this.songSelectEl.appendChild(opt);
    });
  }

  private loadCurrentSongData() {
    // 1. 오디오 로드
    const audioUrl = this.getAudioUrlForSong(this.currentSong);
    this.audio.src = audioUrl;
    this.audio.currentTime = 0;
    this.audio.playbackRate = 1.0;

    // 2. 메타 정보 업데이트
    this.metaTitleEl.textContent = this.currentSong.title;
    this.metaArtistEl.textContent = this.currentSong.artist;
    this.metaBpmEl.textContent = `BPM ${this.currentSong.bpm}`;
    this.metaGenreEl.textContent = this.currentSong.genre.toUpperCase();

    if (this.currentSong.jacketUrl) {
      this.metaJacketEl.style.backgroundImage = `url("${encodeURI(this.currentSong.jacketUrl)}")`;
    } else {
      this.metaJacketEl.style.background = `linear-gradient(135deg, ${this.currentSong.jacketColor1}, ${this.currentSong.jacketColor2})`;
    }

    // 3. 오프셋 설정
    this.startOffsetSec = 0.410;
    this.valOffsetEl.textContent = `${this.startOffsetSec.toFixed(3)}s`;

    // 4. 캔버스 설정 갱신
    this.canvasEditor.setConfig({
      bpm: this.currentSong.bpm,
      offsetSec: this.startOffsetSec
    });

    // 5. 채보 데이터 로드 (커스텀 저장본 우선 확인)
    this.loadChartForCurrentSelection();
  }

  private getAudioUrlForSong(song: SongInfo): string {
    const fn = song.generateAudioBuffer.toString();
    const match = fn.match(/loadAudioBuffer\(['"]([^'"]+)['"]\)/);
    if (match && match[1]) {
      return match[1];
    }
    // Fallback: search standard convention
    return `/audio/${song.title}.mp3`;
  }

  private loadChartForCurrentSelection() {
    const customKey = `CUSTOM_CHART_${this.currentSong.id}_4K_${this.currentDifficulty}`;
    const saved = localStorage.getItem(customKey);

    if (saved) {
      try {
        const notes = JSON.parse(saved);
        if (Array.isArray(notes) && notes.length > 0) {
          this.canvasEditor.setNotes(notes);
          this.showToast(`📂 "${this.currentSong.title}" [${this.currentDifficulty}] 커스텀 채보 로드됨`);
          this.updateStats();
          return;
        }
      } catch (e) {
        console.warn(e);
      }
    }

    // 기본 프로시저럴 채보 로드
    const chartKey = `4K_${this.currentDifficulty}` as const;
    const defaultChart = this.currentSong.charts[chartKey];
    if (defaultChart && defaultChart.notes) {
      this.canvasEditor.setNotes(defaultChart.notes);
    } else {
      this.canvasEditor.setNotes([]);
    }
    this.updateStats();
  }

  private setupEvents() {
    // 곡 변경
    this.songSelectEl.addEventListener('change', () => {
      const idx = parseInt(this.songSelectEl.value, 10);
      this.currentSong = this.songs[idx] || this.songs[0];
      this.audio.pause();
      this.playPauseBtn.textContent = '▶ PLAY';
      this.recorder.stop();
      this.recBtn.classList.remove('active');
      this.loadCurrentSongData();
    });

    // 난이도 변경
    this.diffBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const diff = btn.dataset.diff as Difficulty;
        if (diff && diff !== this.currentDifficulty) {
          this.currentDifficulty = diff;
          this.diffBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.loadChartForCurrentSelection();
        }
      });
    });

    // 재생 / 일시정지
    this.playPauseBtn.addEventListener('click', () => {
      this.togglePlay();
    });

    this.stopBtn.addEventListener('click', () => {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.playPauseBtn.textContent = '▶ PLAY';
      this.recorder.stop();
      this.recBtn.classList.remove('active');
    });

    // 재생 속도
    this.rateBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const rate = parseFloat(btn.dataset.rate || '1.0');
        this.audio.playbackRate = rate;
        this.rateBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // 메트로놈
    this.metronomeBtn.addEventListener('click', () => {
      this.metronomeEnabled = !this.metronomeEnabled;
      this.metronomeBtn.classList.toggle('primary', this.metronomeEnabled);
      this.metronomeBtn.textContent = this.metronomeEnabled ? '🔔 TICK [ON]' : '🔔 TICK';
    });

    // 그리드 스냅
    this.snapSelectEl.addEventListener('change', () => {
      const snap = parseInt(this.snapSelectEl.value, 10);
      this.canvasEditor.setConfig({ snapDiv: snap });
    });

    // 탭 vs 롱노트 모드
    this.modeNormalBtn.addEventListener('click', () => {
      this.canvasEditor.noteMode = 'normal';
      this.modeNormalBtn.classList.add('active');
      this.modeHoldBtn.classList.remove('active');
    });

    this.modeHoldBtn.addEventListener('click', () => {
      this.canvasEditor.noteMode = 'hold';
      this.modeHoldBtn.classList.add('active');
      this.modeNormalBtn.classList.remove('active');
    });

    // 실시간 탭 녹음
    this.recBtn.addEventListener('click', () => {
      if (this.recorder.isActive()) {
        this.recorder.stop();
        this.recBtn.classList.remove('active');
        this.showToast('🛑 녹음 종료');
      } else {
        this.recorder.start();
        this.recBtn.classList.add('active');
        if (this.audio.paused) {
          this.togglePlay();
        }
        this.showToast('● 탭 녹음 시작! D, F, J, K 키로 박자를 연주하세요!');
      }
    });

    // 인게임 테스트 연주
    this.testBtn.addEventListener('click', () => {
      this.startTestPlay();
    });

    this.btnExitTest.addEventListener('click', () => {
      this.stopTestPlay();
    });

    // 저장
    this.saveBtn.addEventListener('click', () => {
      this.saveToGame();
    });

    // JSON 내보내기 / 불러오기
    this.exportBtn.addEventListener('click', () => {
      this.exportJson();
    });

    this.importBtn.addEventListener('click', () => {
      this.importFileInput.click();
    });

    this.importFileInput.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const notes = JSON.parse(ev.target?.result as string);
            if (Array.isArray(notes)) {
              this.canvasEditor.setNotes(notes);
              this.showToast(`📂 ${file.name} 불러오기 성공 (${notes.length}개 노트)`);
            }
          } catch {
            alert('올바른 JSON 채보 파일이 아닙니다.');
          }
        };
        reader.readAsText(file);
      }
    });

    this.copyJsonBtn.addEventListener('click', () => {
      const notes = this.canvasEditor.getNotes();
      navigator.clipboard.writeText(JSON.stringify(notes, null, 2)).then(() => {
        this.showToast('📋 채보 JSON 데이터가 클립보드에 복사되었습니다!');
      });
    });

    this.clearChartBtn.addEventListener('click', () => {
      if (confirm('현재 채보의 모든 노트를 비우시겠습니까?')) {
        this.canvasEditor.clearNotes();
        this.showToast('🗑️ 모든 노트가 삭제되었습니다.');
      }
    });

    this.resetDefaultBtn.addEventListener('click', () => {
      if (confirm('기존 자동 생성 기본 채보로 되돌리시겠습니까?')) {
        const customKey = `CUSTOM_CHART_${this.currentSong.id}_4K_${this.currentDifficulty}`;
        localStorage.removeItem(customKey);
        const chartKey = `4K_${this.currentDifficulty}` as const;
        this.canvasEditor.setNotes(this.currentSong.charts[chartKey]?.notes || []);
        this.showToast('↺ 기본 채보로 초기화되었습니다.');
      }
    });

    // 오프셋 증감
    this.btnOffsetSub.addEventListener('click', () => {
      this.startOffsetSec = Math.max(0, Math.round((this.startOffsetSec - 0.010) * 1000) / 1000);
      this.valOffsetEl.textContent = `${this.startOffsetSec.toFixed(3)}s`;
      this.canvasEditor.setConfig({ offsetSec: this.startOffsetSec });
    });

    this.btnOffsetAdd.addEventListener('click', () => {
      this.startOffsetSec = Math.round((this.startOffsetSec + 0.010) * 1000) / 1000;
      this.valOffsetEl.textContent = `${this.startOffsetSec.toFixed(3)}s`;
      this.canvasEditor.setConfig({ offsetSec: this.startOffsetSec });
    });

    // 스크러버 클릭
    this.scrubberWrap.addEventListener('click', (e) => {
      const rect = this.scrubberWrap.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const targetTime = ratio * (this.audio.duration || 180);
      this.audio.currentTime = targetTime;
    });

    // 캔버스 변경 시 콜백
    this.canvasEditor.onNotesChanged(() => {
      this.updateStats();
    });

    this.canvasEditor.onSeek((t) => {
      this.audio.currentTime = t;
    });

    // 키보드 단축키
    window.addEventListener('keydown', (e) => {
      if (this.isTesting) {
        if (e.key === 'Escape') {
          this.stopTestPlay();
        }
        return;
      }

      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        this.togglePlay();
      } else if (e.code === 'Digit1') {
        this.stepInsertNote(0);
      } else if (e.code === 'Digit2') {
        this.stepInsertNote(1);
      } else if (e.code === 'Digit3') {
        this.stepInsertNote(2);
      } else if (e.code === 'Digit4') {
        this.stepInsertNote(3);
      }
    });
  }

  private stepInsertNote(lane: number) {
    const t = this.canvasEditor.getSnappedTime(this.audio.currentTime);
    this.canvasEditor.addNoteAt(lane, t, 0, 'normal');
    this.playTapSound();

    // 약간 앞으로 전진 (스텝 입력 편의)
    if (this.audio.paused) {
      const beatSec = 60 / this.currentSong.bpm;
      const step = beatSec * 0.5; // 8분음표 전진
      this.audio.currentTime = Math.min(this.audio.duration || 180, this.audio.currentTime + step);
    }
  }

  private togglePlay() {
    this.initAudioContext();
    if (this.audio.paused) {
      this.audio.play();
      this.playPauseBtn.textContent = '❚❚ PAUSE';
    } else {
      this.audio.pause();
      this.playPauseBtn.textContent = '▶ PLAY';
      if (this.recorder.isActive()) {
        this.recorder.stop();
        this.recBtn.classList.remove('active');
      }
    }
  }

  private saveToGame() {
    const notes = this.canvasEditor.getNotes();
    const key = `CUSTOM_CHART_${this.currentSong.id}_4K_${this.currentDifficulty}`;
    localStorage.setItem(key, JSON.stringify(notes));
    this.showToast(`💾 "${this.currentSong.title}" [${this.currentDifficulty}] 채보가 메인 게임에 저장되었습니다!`);
  }

  private exportJson() {
    const notes = this.canvasEditor.getNotes();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(notes, null, 2));
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', `${this.currentSong.id}_4K_${this.currentDifficulty}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
    this.showToast(`📥 ${this.currentSong.id}_4K_${this.currentDifficulty}.json 다운로드 완료!`);
  }

  private updateStats() {
    const notes = this.canvasEditor.getNotes();
    const taps = notes.filter(n => n.type === 'normal').length;
    const holds = notes.filter(n => n.type === 'hold').length;
    const dur = this.audio.duration || 180;
    const nps = dur > 0 ? (notes.length / dur).toFixed(1) : '0.0';

    this.statTotalEl.textContent = notes.length.toString();
    this.statTapsEl.textContent = taps.toString();
    this.statHoldsEl.textContent = holds.toString();
    this.statNpsEl.textContent = nps;
  }

  private startLoop() {
    const update = () => {
      const t = this.audio.currentTime;

      if (!this.isTesting) {
        this.canvasEditor.setCurrentTime(t);

        // 시간 표시
        this.displayTimeEl.textContent = this.formatTime(t);

        // 마디 번호 계산
        const beatSec = 60 / this.currentSong.bpm;
        const barSec = beatSec * 4;
        const curBar = Math.floor((t - this.startOffsetSec) / barSec) + 1;
        const curBeat = (((t - this.startOffsetSec) % barSec) / beatSec + 1).toFixed(1);
        this.displayBarEl.textContent = `#${Math.max(1, curBar)} . ${curBeat}`;

        // 스크러버 업데이트
        const dur = this.audio.duration || 180;
        const pct = Math.max(0, Math.min(100, (t / dur) * 100));
        this.scrubberFill.style.width = `${pct}%`;
        this.scrubberHandle.style.left = `${pct}%`;

        // 메트로놈 틱
        if (this.metronomeEnabled && !this.audio.paused) {
          const beatIdx = Math.floor((t - this.startOffsetSec) / beatSec);
          if (beatIdx !== this.lastMetronomeBeat && beatIdx >= 0) {
            this.lastMetronomeBeat = beatIdx;
            this.playTickSound(beatIdx % 4 === 0);
          }
        }
      } else {
        // 테스트 플레이 루프
        this.updateTestPlay();
      }

      requestAnimationFrame(update);
    };

    requestAnimationFrame(update);
  }

  // =========================================================================
  // 인게임 즉시 테스트 플레이
  // =========================================================================
  private startTestPlay() {
    this.audio.pause();
    this.isTesting = true;
    this.testSongTitleEl.textContent = `${this.currentSong.title} (${this.currentDifficulty})`;
    this.testOverlay.classList.remove('hidden');

    // 캔버스 크기 조정
    const rect = this.testOverlay.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.testGameCanvas.width = rect.width * dpr;
    this.testGameCanvas.height = (rect.height - 50) * dpr;

    this.testJudgement = new JudgementEngine();
    this.testRenderer = new CanvasRenderer(this.testGameCanvas);
    this.testInput = new InputManager();
    this.testInput.setMode('4K');

    const notesToPlay = this.canvasEditor.getNotes().map(n => ({ ...n }));
    this.testJudgement.init(
      this.currentSong.title,
      this.currentSong.artist,
      '4K',
      this.currentDifficulty,
      notesToPlay
    );

    // 키 입력 연동
    this.testInput.onKey((lane, type) => {
      if (type === 'down') {
        this.testJudgement?.handleKeyDown(lane, this.audio.currentTime);
        this.playTapSound();
      } else {
        this.testJudgement?.handleKeyUp(lane, this.audio.currentTime);
      }
    });

    this.audio.currentTime = 0;
    this.audio.playbackRate = 1.0;
    this.audio.play();
  }

  private updateTestPlay() {
    if (!this.testJudgement || !this.testRenderer || !this.testInput) return;

    const t = this.audio.currentTime;
    this.testJudgement.update(t);

    const stats = this.testJudgement.getStats();
    const notes = this.testJudgement.getNotes();
    const newJudgements = this.testJudgement.popEvents();

    this.testRenderer.renderGame(
      '4K',
      t,
      notes,
      stats,
      this.testInput,
      2.5,
      newJudgements
    );

    if (this.audio.ended) {
      this.stopTestPlay();
    }
  }

  private stopTestPlay() {
    this.isTesting = false;
    this.audio.pause();
    this.testOverlay.classList.add('hidden');
    this.testJudgement = null;
    this.testRenderer = null;
    this.testInput = null;
    this.playPauseBtn.textContent = '▶ PLAY';
  }

  // =========================================================================
  // 오디오 효과음 & 유틸
  // =========================================================================
  private initAudioContext() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  private playTapSound() {
    this.initAudioContext();
    if (!this.audioCtx) return;

    const t = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.exponentialRampToValueAtTime(160, t + 0.04);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(t);
    osc.stop(t + 0.045);
  }

  private playTickSound(isDownbeat: boolean) {
    this.initAudioContext();
    if (!this.audioCtx) return;

    const t = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(isDownbeat ? 1200 : 800, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.025);

    gain.gain.setValueAtTime(isDownbeat ? 0.35 : 0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(t);
    osc.stop(t + 0.03);
  }

  private formatTime(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 1000);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }

  private showToast(msg: string) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.remove('show');
    void this.toastEl.offsetWidth;
    this.toastEl.classList.add('show');

    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastEl.classList.remove('show');
    }, 2500);
  }
}

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
  new ChartEditorApp();
});
