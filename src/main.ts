import { AudioManager } from './engine/audio';
import { InputManager } from './engine/input';
import { JudgementEngine } from './engine/judgement';
import { CanvasRenderer } from './engine/renderer';
import { KeyConfigModal } from './ui/keyConfigModal';
import { CustomSongModal } from './ui/customSongModal';
import { SongSelectUI, SongSelectConfig } from './ui/songSelect';
import { ResultScreenUI } from './ui/resultScreen';
import { SongInfo, KeyMode, Difficulty } from './engine/types';

type GameScreen = 'TITLE' | 'SELECT' | 'GAME' | 'RESULT';

class RhythmGameApp {
  // 엔진 인스턴스
  private audio: AudioManager;
  private input: InputManager;
  private judgement: JudgementEngine;
  private renderer: CanvasRenderer;

  // UI 인스턴스
  private keyConfigModal: KeyConfigModal;
  private customSongModal: CustomSongModal;
  private songSelectUI: SongSelectUI;
  private resultScreenUI: ResultScreenUI;

  // 화면 요소들
  private screenTitle: HTMLElement;
  private screenSelect: HTMLElement;
  private screenGame: HTMLElement;
  private screenResult: HTMLElement;
  private pauseOverlay: HTMLElement;

  // 인게임 HUD 요소들
  private hudTitleEl: HTMLElement;
  private hudModeEl: HTMLElement;
  private hudScoreEl: HTMLElement;

  // 현재 게임 세션 상태
  private currentScreen: GameScreen = 'TITLE';
  private isPaused = false;
  private currentSong: SongInfo | null = null;
  private currentKeyMode: KeyMode = '4K';
  private currentDifficulty: Difficulty = 'NORMAL';
  private speedMultiplier = 2.5;
  private songDuration = 0;
  private startCountdownSec = 1.0; // 노트가 판정선까지 미리 내려올 수 있는 여유 시간

  // 애니메이션 루프 ID
  private animFrameId: number | null = null;

  constructor() {
    // 캔버스 초기화
    const gameCanvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const bgCanvas = document.getElementById('bg-canvas') as HTMLCanvasElement;

    this.audio = new AudioManager();
    this.input = new InputManager();
    this.judgement = new JudgementEngine();
    this.renderer = new CanvasRenderer(gameCanvas, bgCanvas);

    // UI 인스턴스
    this.keyConfigModal = new KeyConfigModal(this.input);
    this.songSelectUI = new SongSelectUI(this.audio);
    this.resultScreenUI = new ResultScreenUI();
    this.customSongModal = new CustomSongModal(this.audio);

    this.customSongModal.onSongLoaded((_newSong) => {
      this.songSelectUI.reloadTrackList(0);
    });

    // DOM 요소 캐싱
    this.screenTitle = document.getElementById('screen-title')!;
    this.screenSelect = document.getElementById('screen-select')!;
    this.screenGame = document.getElementById('screen-game')!;
    this.screenResult = document.getElementById('screen-result')!;
    this.pauseOverlay = document.getElementById('pause-overlay')!;

    this.hudTitleEl = document.getElementById('hud-track-title')!;
    this.hudModeEl = document.getElementById('hud-track-mode')!;
    this.hudScoreEl = document.getElementById('hud-score')!;

    this.setupEvents();
    this.setupInputHandling();
    this.startMainLoop();
  }

  private setScreen(screen: GameScreen) {
    this.currentScreen = screen;

    this.screenTitle.classList.remove('active');
    this.screenSelect.classList.remove('active');
    this.screenGame.classList.remove('active');
    this.screenResult.classList.remove('active');

    if (screen === 'TITLE') this.screenTitle.classList.add('active');
    if (screen === 'SELECT') {
      this.songSelectUI.refreshRecord();
      this.songSelectUI.updateVolumeDisplay();
      this.screenSelect.classList.add('active');
    }
    if (screen === 'GAME') this.screenGame.classList.add('active');
    if (screen === 'RESULT') this.screenResult.classList.add('active');
  }

  private updatePauseVolumeDisplay() {
    const bgmPct = Math.round(this.audio.getBgmVolume() * 100);
    const hitPct = Math.round(this.audio.getHitsoundVolume() * 100);
    const bgmEl = document.getElementById('val-pause-bgm');
    const hitEl = document.getElementById('val-pause-hit');
    if (bgmEl) bgmEl.textContent = `${bgmPct}%`;
    if (hitEl) hitEl.textContent = `${hitPct}%`;
  }

  private setupEvents() {
    // 1. 타이틀 화면 이벤트
    document.getElementById('btn-start')!.addEventListener('click', () => {
      this.audio.init(); // 사용자 인터랙션 시 Web Audio API 활성화
      this.audio.playHitSound('fever');
      this.setScreen('SELECT');
    });

    document.getElementById('btn-open-settings')!.addEventListener('click', () => {
      this.keyConfigModal.open(this.songSelectUI.getKeyMode());
    });

    // 2. 곡 선택 화면 이벤트
    document.getElementById('btn-select-keyconfig')!.addEventListener('click', () => {
      this.keyConfigModal.open(this.songSelectUI.getKeyMode());
    });

    document.getElementById('btn-back-to-title')!.addEventListener('click', () => {
      this.setScreen('TITLE');
    });

    this.songSelectUI.onStartGame((config) => {
      this.startGameSession(config);
    });

    // 3. 인게임 화면 이벤트 (일시정지 및 ESC)
    document.getElementById('btn-game-pause')!.addEventListener('click', () => {
      this.togglePause();
    });

    document.getElementById('btn-pause-resume')!.addEventListener('click', () => {
      this.resumeGame();
    });

    document.getElementById('btn-pause-retry')!.addEventListener('click', () => {
      this.pauseOverlay.classList.add('hidden');
      this.isPaused = false;
      this.restartGame();
    });

    document.getElementById('btn-pause-quit')!.addEventListener('click', () => {
      this.pauseOverlay.classList.add('hidden');
      this.isPaused = false;
      this.audio.stop();
      this.setScreen('SELECT');
    });

    // 일시정지 창 볼륨 조절
    document.getElementById('btn-pause-bgm-down')?.addEventListener('click', () => {
      const cur = this.audio.getBgmVolume();
      this.audio.setBgmVolume(Math.max(0, Math.round((cur - 0.1) * 10) / 10));
      this.updatePauseVolumeDisplay();
    });

    document.getElementById('btn-pause-bgm-up')?.addEventListener('click', () => {
      const cur = this.audio.getBgmVolume();
      this.audio.setBgmVolume(Math.min(1.0, Math.round((cur + 0.1) * 10) / 10));
      this.updatePauseVolumeDisplay();
    });

    document.getElementById('btn-pause-hit-down')?.addEventListener('click', () => {
      const cur = this.audio.getHitsoundVolume();
      this.audio.setHitsoundVolume(Math.max(0, Math.round((cur - 0.1) * 10) / 10));
      this.updatePauseVolumeDisplay();
      this.audio.playHitSound('tap');
    });

    document.getElementById('btn-pause-hit-up')?.addEventListener('click', () => {
      const cur = this.audio.getHitsoundVolume();
      this.audio.setHitsoundVolume(Math.min(1.0, Math.round((cur + 0.1) * 10) / 10));
      this.updatePauseVolumeDisplay();
      this.audio.playHitSound('tap');
    });

    // 4. 결과 화면 이벤트
    this.resultScreenUI.onRetry(() => {
      this.restartGame();
    });

    this.resultScreenUI.onSelect(() => {
      this.setScreen('SELECT');
    });

    // 키보드 ESC 키 핸들링
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.currentScreen === 'GAME') {
        this.togglePause();
      }
    });
  }

  private setupInputHandling() {
    this.input.onKey((lane, type) => {
      if (this.currentScreen !== 'GAME' || this.isPaused) return;

      const songTime = this.audio.getCurrentSongTime();

      if (type === 'down') {
        // 타격음(Hitsound) 재생
        this.audio.playHitSound('tap');
        // 판정 엔진에 키 입력 전달
        this.judgement.handleKeyDown(lane, songTime);
      } else if (type === 'up') {
        // 롱노트 릴리즈 판정
        this.judgement.handleKeyUp(lane, songTime);
      }
    });
  }

  private async startGameSession(config: SongSelectConfig) {
    this.currentSong = config.selectedSong;
    this.currentKeyMode = config.keyMode;
    this.currentDifficulty = config.difficulty;
    this.speedMultiplier = config.speed;

    this.input.setMode(this.currentKeyMode);
    this.audio.setOffsetMs(config.offsetMs);

    // 차트 데이터 가져오기
    const chartKey = `${this.currentKeyMode}_${this.currentDifficulty}` as const;
    const chart = this.currentSong.charts[chartKey];

    if (!chart || !chart.notes || chart.notes.length === 0) {
      alert('준비 중인 채보입니다.');
      return;
    }

    // HUD 업데이트
    this.hudTitleEl.textContent = this.currentSong.title;
    this.hudModeEl.textContent = `${this.currentKeyMode} ${this.currentDifficulty}`;
    this.hudScoreEl.textContent = '0000000';

    // 오디오 버퍼 생성 및 준비 (비동기 fetch 완벽 지원)
    const audioCtx = this.audio.getContext();
    const audioBuffer = await this.currentSong.generateAudioBuffer(audioCtx);
    this.songDuration = audioBuffer.duration;
    this.audio.prepare(audioBuffer);

    // 판정 엔진 초기화
    this.judgement.init(
      this.currentSong.title,
      this.currentSong.artist,
      this.currentKeyMode,
      this.currentDifficulty,
      chart.notes
    );

    this.isPaused = false;
    this.pauseOverlay.classList.add('hidden');
    this.setScreen('GAME');

    // 카운트다운(1.5초) 후 음악 재생 시작
    this.audio.play(this.startCountdownSec);
  }

  private restartGame() {
    if (!this.currentSong) return;
    this.startGameSession({
      selectedSong: this.currentSong,
      keyMode: this.currentKeyMode,
      difficulty: this.currentDifficulty,
      speed: this.speedMultiplier,
      offsetMs: this.audio.getOffsetMs()
    });
  }

  private togglePause() {
    if (this.isPaused) {
      this.resumeGame();
    } else {
      this.pauseGame();
    }
  }

  private pauseGame() {
    this.isPaused = true;
    this.audio.pause();
    this.updatePauseVolumeDisplay();
    this.pauseOverlay.classList.remove('hidden');
  }

  private resumeGame() {
    this.isPaused = false;
    this.pauseOverlay.classList.add('hidden');
    this.audio.resume();
  }

  private startMainLoop() {
    const loop = () => {
      this.updateAndRender();
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  private updateAndRender() {
    try {
      const freqData = this.audio.getFrequencyData();
      const stats = this.judgement.getStats();

      // 1. 항상 배경 비주얼라이저 렌더링
      this.renderer.renderBackground(freqData, stats.feverLevel);

      // 2. 인게임 상태일 때
      if (this.currentScreen === 'GAME') {
        const songTime = this.audio.getCurrentSongTime();

        if (!this.isPaused) {
          // 판정 업데이트 (자동 미스, 롱노트 틱)
          this.judgement.update(songTime);

          // 점수 HUD 갱신
          this.hudScoreEl.textContent = stats.score.toString().padStart(7, '0');

          // 게임 종료 체크
          if (this.judgement.isFinished(songTime, this.songDuration)) {
            this.finishGame();
            return;
          }
        }

        // 판정 이벤트 팝업 큐 가져오기
        const newJudgements = this.judgement.popEvents();

        // 인게임 캔버스 렌더링
        this.renderer.renderGame(
          this.currentKeyMode,
          songTime,
          this.judgement.getNotes(),
          stats,
          this.input,
          this.speedMultiplier,
          newJudgements
        );
      }
    } catch (err) {
      console.error('Render loop error:', err);
    }
  }

  private finishGame() {
    this.audio.stop();
    const result = this.judgement.getPlayResult();
    this.resultScreenUI.showResult(result, this.currentSong!.id);
    this.setScreen('RESULT');
  }
}

// 애플리케이션 초기화
window.addEventListener('DOMContentLoaded', () => {
  new RhythmGameApp();
});
