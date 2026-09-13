/**
 * Web Audio API Master Clock & Sound System
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private hitsoundGain: GainNode | null = null;

  private isPlaying = false;
  private startTime = 0;
  private pauseTime = 0;
  private offsetSeconds = 0; // ms / 1000

  private currentBuffer: AudioBuffer | null = null;
  private bgmVolume = 0.8;
  private hitsoundVolume = 0.7;

  constructor() {
    this.loadVolumeSettings();
  }

  private loadVolumeSettings() {
    try {
      const savedBgm = localStorage.getItem('CYBERBEAT_VOL_BGM');
      if (savedBgm !== null) this.bgmVolume = parseFloat(savedBgm);
      const savedHit = localStorage.getItem('CYBERBEAT_VOL_HITSOUND');
      if (savedHit !== null) this.hitsoundVolume = parseFloat(savedHit);
    } catch {
      // ignore
    }
  }

  public init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.value = this.bgmVolume;

      this.hitsoundGain = this.ctx.createGain();
      this.hitsoundGain.gain.value = this.hitsoundVolume;
      this.hitsoundGain.connect(this.ctx.destination);

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.smoothingTimeConstant = 0.8;

      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setBgmVolume(val: number) {
    this.bgmVolume = Math.max(0, Math.min(1, val));
    if (this.gainNode) {
      this.gainNode.gain.value = this.bgmVolume;
    }
    localStorage.setItem('CYBERBEAT_VOL_BGM', this.bgmVolume.toString());
  }

  public getBgmVolume(): number {
    return this.bgmVolume;
  }

  public setHitsoundVolume(val: number) {
    this.hitsoundVolume = Math.max(0, Math.min(1, val));
    if (this.hitsoundGain) {
      this.hitsoundGain.gain.value = this.hitsoundVolume;
    }
    localStorage.setItem('CYBERBEAT_VOL_HITSOUND', this.hitsoundVolume.toString());
  }

  public getHitsoundVolume(): number {
    return this.hitsoundVolume;
  }

  public getContext(): AudioContext {
    if (!this.ctx) this.init();
    return this.ctx!;
  }

  public setOffsetMs(offsetMs: number) {
    this.offsetSeconds = offsetMs / 1000;
  }

  public getOffsetMs(): number {
    return this.offsetSeconds * 1000;
  }

  /**
   * 버퍼 로드 및 재생 준비
   */
  public prepare(buffer: AudioBuffer) {
    this.stop();
    this.currentBuffer = buffer;
    this.pauseTime = 0;
  }

  /**
   * BGM 재생 시작
   * @param delaySec 카운트다운이나 노트 낙하 대기시간
   */
  public play(delaySec = 0) {
    if (!this.ctx || !this.currentBuffer) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.stopSource();

    this.currentSource = this.ctx.createBufferSource();
    this.currentSource.buffer = this.currentBuffer;
    this.currentSource.connect(this.gainNode!);

    const now = this.ctx.currentTime;
    const startAt = now + delaySec;
    this.startTime = startAt - this.pauseTime;

    this.currentSource.start(startAt, this.pauseTime);
    this.isPlaying = true;
  }

  public pause() {
    if (!this.isPlaying || !this.ctx) return;
    this.pauseTime = this.ctx.currentTime - this.startTime;
    this.stopSource();
    this.isPlaying = false;
  }

  public resume() {
    if (this.isPlaying || !this.ctx || !this.currentBuffer) return;
    this.play(0);
  }

  public stop() {
    this.stopSource();
    this.isPlaying = false;
    this.pauseTime = 0;
    this.startTime = 0;
  }

  private stopSource() {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch {
        // 이미 중단되었거나 재생 전인 경우 예외 무시
      }
      this.currentSource = null;
    }
  }

  /**
   * 고정밀 현재 음악 재생 타임스탬프 (초 단위)
   */
  public getCurrentSongTime(): number {
    if (!this.ctx) return 0;
    if (!this.isPlaying) {
      return this.pauseTime + this.offsetSeconds;
    }
    return (this.ctx.currentTime - this.startTime) + this.offsetSeconds;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * 오디오 시각화용 주파수 데이터 (BGA/Visualizer 연동)
   */
  public getFrequencyData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(0);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  /**
   * 절차적 타격 효과음 (Hitsound)
   * 탭 시 청량하고 타격감 있는 전자음 생성
   */
  public playHitSound(type: 'tap' | 'combo' | 'fever' = 'tap') {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const t = this.ctx.currentTime;

    if (type === 'tap') {
      // 1. 펀치 바디 사운드 (드럼 림샷 / 스네어 타격감)
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1200, t);
      osc.frequency.exponentialRampToValueAtTime(140, t + 0.045);

      gain.gain.setValueAtTime(0.55, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

      osc.connect(gain);
      gain.connect(this.hitsoundGain!);

      osc.start(t);
      osc.stop(t + 0.05);

      // 2. 청량한 크리스피 노이즈 스냅 (딱! 소리의 어택감)
      this.playNoiseSnap(t);
    } else if (type === 'fever') {
      // 피버 활성화 상승음
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, t);
      osc.frequency.exponentialRampToValueAtTime(1200, t + 0.25);

      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

      osc.connect(gain);
      gain.connect(this.hitsoundGain!);

      osc.start(t);
      osc.stop(t + 0.26);
    }
  }

  private playNoiseSnap(t: number) {
    if (!this.ctx) return;
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.035); // 35ms
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2400; // 청량한 고음역 클릭감

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.45, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);

    whiteNoise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.hitsoundGain!);

    whiteNoise.start(t);
    whiteNoise.stop(t + 0.04);
  }
}
