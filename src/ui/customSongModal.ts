import { SongInfo, SongChart } from '../engine/types';
import { SONG_DATABASE, createStandardCharts } from '../data/songs';
import { AudioManager } from '../engine/audio';

export class CustomSongModal {
  private modalEl: HTMLElement;
  private closeBtn: HTMLElement;
  private cancelBtn: HTMLElement;
  private confirmBtn: HTMLElement;
  private fileInput: HTMLInputElement;
  private openBtn: HTMLElement;

  private titleInput: HTMLInputElement;
  private artistInput: HTMLInputElement;
  private bpmInput: HTMLInputElement;
  private bpmDownBtn: HTMLElement;
  private bpmUpBtn: HTMLElement;
  private bpmTapBtn: HTMLElement;

  private audioManager: AudioManager;
  private currentFile: File | null = null;
  private tapTimestamps: number[] = [];
  private onSongLoadedCallback: ((newSong: SongInfo) => void) | null = null;

  constructor(audioManager: AudioManager) {
    this.audioManager = audioManager;

    this.modalEl = document.getElementById('modal-custom-song')!;
    this.closeBtn = document.getElementById('btn-close-custom-song')!;
    this.cancelBtn = document.getElementById('btn-cancel-custom-song')!;
    this.confirmBtn = document.getElementById('btn-confirm-custom-song')!;
    this.fileInput = document.getElementById('input-custom-audio') as HTMLInputElement;
    this.openBtn = document.getElementById('btn-custom-song')!;

    this.titleInput = document.getElementById('custom-title-input') as HTMLInputElement;
    this.artistInput = document.getElementById('custom-artist-input') as HTMLInputElement;
    this.bpmInput = document.getElementById('custom-bpm-input') as HTMLInputElement;
    this.bpmDownBtn = document.getElementById('btn-bpm-down')!;
    this.bpmUpBtn = document.getElementById('btn-bpm-up')!;
    this.bpmTapBtn = document.getElementById('btn-bpm-tap')!;

    this.setupEvents();
  }

  public onSongLoaded(cb: (newSong: SongInfo) => void) {
    this.onSongLoadedCallback = cb;
  }

  private setupEvents() {
    // 1. 파일 열기 버튼 클릭 시 숨겨진 file input 트리거
    this.openBtn.addEventListener('click', () => {
      this.fileInput.value = '';
      this.fileInput.click();
    });

    // 2. 파일 선택 완료 시
    this.fileInput.addEventListener('change', () => {
      const file = this.fileInput.files?.[0];
      if (!file) return;

      this.currentFile = file;
      // 파일명에서 확장자 제거하여 제목 기본값 설정
      const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      this.titleInput.value = fileNameWithoutExt.toUpperCase();
      this.artistInput.value = 'USER CUSTOM';
      this.bpmInput.value = '130';
      this.tapTimestamps = [];

      this.openModal();
    });

    // 3. 모달 닫기
    this.closeBtn.addEventListener('click', () => this.closeModal());
    this.cancelBtn.addEventListener('click', () => this.closeModal());
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.closeModal();
    });

    // 4. BPM 조절 버튼
    this.bpmDownBtn.addEventListener('click', () => {
      const current = parseInt(this.bpmInput.value, 10) || 120;
      this.bpmInput.value = Math.max(60, current - 5).toString();
    });

    this.bpmUpBtn.addEventListener('click', () => {
      const current = parseInt(this.bpmInput.value, 10) || 120;
      this.bpmInput.value = Math.min(300, current + 5).toString();
    });

    // 5. TAP BPM 측정기
    this.bpmTapBtn.addEventListener('click', () => {
      const now = performance.now();
      // 2.5초 이상 탭이 없었으면 리셋
      if (this.tapTimestamps.length > 0 && now - this.tapTimestamps[this.tapTimestamps.length - 1] > 2500) {
        this.tapTimestamps = [];
      }

      this.tapTimestamps.push(now);
      if (this.tapTimestamps.length > 8) {
        this.tapTimestamps.shift();
      }

      if (this.tapTimestamps.length >= 3) {
        const intervals: number[] = [];
        for (let i = 1; i < this.tapTimestamps.length; i++) {
          intervals.push(this.tapTimestamps[i] - this.tapTimestamps[i - 1]);
        }
        const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const calculatedBpm = Math.round(60000 / avgMs);
        if (calculatedBpm >= 50 && calculatedBpm <= 320) {
          this.bpmInput.value = calculatedBpm.toString();
        }
      }
    });



    // 6. 확정 & 차트 생성 버튼
    this.confirmBtn.addEventListener('click', async () => {
      if (!this.currentFile) return;

      const title = this.titleInput.value.trim() || 'CUSTOM TRACK';
      const artist = this.artistInput.value.trim() || 'UNKNOWN';
      const bpm = parseInt(this.bpmInput.value, 10) || 130;

      this.confirmBtn.textContent = 'DECODING AUDIO...';
      (this.confirmBtn as HTMLButtonElement).disabled = true;

      try {
        const audioCtx = this.audioManager.getContext();
        const arrayBuffer = await this.currentFile.arrayBuffer();
        const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);

        // 총 마디 수 계산
        const beatSec = 60 / bpm;
        const barSec = beatSec * 4;
        const totalBars = Math.ceil(decodedBuffer.duration / barSec);

        // 랜덤 네온 그라디언트 자켓 색상
        const colors = [
          ['#00f0ff', '#ff0077'],
          ['#ffe600', '#00f0ff'],
          ['#00ff66', '#9d00ff'],
          ['#ff0055', '#ff9900'],
          ['#7000ff', '#00ffcc']
        ];
        const [col1, col2] = colors[Math.floor(Math.random() * colors.length)];

        const charts = createStandardCharts(bpm, totalBars, 'jrock');

        const newSong: SongInfo = {
          id: `custom-${Date.now()}`,
          title,
          artist,
          bpm,
          genre: 'USER AUDIO',
          jacketColor1: col1,
          jacketColor2: col2,
          generateAudioBuffer: () => decodedBuffer,
          charts
        };

        // 데이터베이스 맨 앞에 등록
        SONG_DATABASE.unshift(newSong);

        this.closeModal();

        if (this.onSongLoadedCallback) {
          this.onSongLoadedCallback(newSong);
        }
      } catch (err) {
        console.error(err);
        alert('오디오 파일을 디코딩하는데 실패했습니다. 다른 MP3/WAV 파일을 사용해 주세요.');
      } finally {
        this.confirmBtn.textContent = 'GENERATE CHART & LOAD';
        (this.confirmBtn as HTMLButtonElement).disabled = false;
      }
    });
  }

  private openModal() {
    this.modalEl.classList.remove('hidden');
  }

  private closeModal() {
    this.modalEl.classList.add('hidden');
    this.currentFile = null;
  }
}
