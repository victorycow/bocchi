import { SONG_DATABASE, ALBUM_CATEGORIES } from '../data/songs';
import { SongInfo, KeyMode, Difficulty, PlayMods, SongAlbum } from '../engine/types';
import { AudioManager } from '../engine/audio';

export interface SongSelectConfig {
  selectedSong: SongInfo;
  keyMode: KeyMode;
  difficulty: Difficulty;
  speed: number;
  offsetMs: number;
  mods: PlayMods;
}

export class SongSelectUI {
  private audioManager: AudioManager;
  private trackListEl: HTMLElement;
  private jacketEl: HTMLElement;
  private titleEl: HTMLElement;
  private artistEl: HTMLElement;
  private bpmEl: HTMLElement;
  private genreEl: HTMLElement;
  private keyModeGroup: HTMLElement;
  private diffGroup: HTMLElement;
  private speedValEl: HTMLElement;
  private offsetValEl: HTMLElement;
  private bgmVolValEl: HTMLElement;
  private hitVolValEl: HTMLElement;
  private highscoreValEl: HTMLElement;
  private highrankValEl: HTMLElement;
  private playBtn: HTMLElement;
  private trackCountBadgeEl: HTMLElement | null;
  private categoryTabsEl: HTMLElement | null;

  private selectedSongIndex = 0;
  private keyMode: KeyMode = '4K';
  private difficulty: Difficulty = 'NORMAL';
  private speed = 2.5;
  private offsetMs = 0;
  private activeCategory: 'ALL' | SongAlbum = 'ALL';
  private mods: PlayMods = { mirror: false, random: false, autoPlay: false };

  private onStartGameCallback: ((config: SongSelectConfig) => void) | null = null;

  constructor(audioManager: AudioManager) {
    this.audioManager = audioManager;
    this.trackListEl = document.getElementById('track-list-container')!;
    this.jacketEl = document.getElementById('track-jacket')!;
    this.titleEl = document.getElementById('track-title')!;
    this.artistEl = document.getElementById('track-artist')!;
    this.bpmEl = document.getElementById('track-bpm')!;
    this.genreEl = document.getElementById('track-genre')!;
    this.keyModeGroup = document.getElementById('key-mode-group')!;
    this.diffGroup = document.getElementById('diff-group')!;
    this.speedValEl = document.getElementById('val-speed')!;
    this.offsetValEl = document.getElementById('val-offset')!;
    this.bgmVolValEl = document.getElementById('val-bgm-vol')!;
    this.hitVolValEl = document.getElementById('val-hit-vol')!;
    this.highscoreValEl = document.getElementById('val-highscore')!;
    this.highrankValEl = document.getElementById('val-highrank')!;
    this.playBtn = document.getElementById('btn-play-game')!;
    this.trackCountBadgeEl = document.getElementById('track-count-badge');
    this.categoryTabsEl = document.getElementById('category-tabs');

    this.loadPreferences();
    this.setupEvents();
    this.renderCategoryTabs();
    this.renderTrackList();
    this.updateTrackDetails();
  }

  public onStartGame(cb: (config: SongSelectConfig) => void) {
    this.onStartGameCallback = cb;
  }

  public getKeyMode(): KeyMode {
    return '4K';
  }

  public showToast(message: string) {
    let toast = document.getElementById('game-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'game-toast';
      toast.className = 'game-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.remove('show');
    void toast.offsetWidth;
    toast.classList.add('show');
    clearTimeout((this as any)._toastTimer);
    (this as any)._toastTimer = setTimeout(() => {
      toast?.classList.remove('show');
    }, 2500);
  }

  public refreshRecord() {
    this.updateHighScoreDisplay();
  }

  public reloadTrackList(selectIndex = 0) {
    this.selectedSongIndex = selectIndex;
    this.renderTrackList();
    this.updateTrackDetails();
  }

  public getFilteredSongs(): SongInfo[] {
    if (this.activeCategory === 'ALL') {
      return SONG_DATABASE;
    }
    return SONG_DATABASE.filter(song => song.album === this.activeCategory);
  }

  private loadPreferences() {
    try {
      const savedSpeed = localStorage.getItem('CYBERBEAT_SPEED');
      if (savedSpeed) this.speed = parseFloat(savedSpeed);
      const savedOffset = localStorage.getItem('CYBERBEAT_OFFSET');
      if (savedOffset) this.offsetMs = parseInt(savedOffset, 10);
      
      const savedMirror = localStorage.getItem('CYBERBEAT_MOD_MIRROR') === 'true';
      const savedRandom = localStorage.getItem('CYBERBEAT_MOD_RANDOM') === 'true';
      const savedAutoPlay = localStorage.getItem('CYBERBEAT_MOD_AUTOPLAY') === 'true';
      this.mods = { mirror: savedMirror, random: savedRandom, autoPlay: savedAutoPlay };
    } catch {
      // ignore
    }
    this.speedValEl.textContent = `${this.speed.toFixed(1)}x`;
    this.offsetValEl.textContent = `${this.offsetMs > 0 ? '+' : ''}${this.offsetMs}ms`;
    this.updateVolumeDisplay();
    this.updateModsDisplay();
  }

  public updateVolumeDisplay() {
    const bgmPct = Math.round(this.audioManager.getBgmVolume() * 100);
    const hitPct = Math.round(this.audioManager.getHitsoundVolume() * 100);
    if (this.bgmVolValEl) this.bgmVolValEl.textContent = `${bgmPct}%`;
    if (this.hitVolValEl) this.hitVolValEl.textContent = `${hitPct}%`;
  }

  private updateModsDisplay() {
    const mirrorBtn = document.getElementById('btn-mod-mirror');
    const randomBtn = document.getElementById('btn-mod-random');
    const autoPlayBtn = document.getElementById('btn-mod-autoplay');

    mirrorBtn?.classList.toggle('active', this.mods.mirror);
    randomBtn?.classList.toggle('active', this.mods.random);
    autoPlayBtn?.classList.toggle('active', this.mods.autoPlay);
  }

  private setupEvents() {
    // BGM 볼륨 조절
    document.getElementById('btn-bgm-down')?.addEventListener('click', () => {
      const current = this.audioManager.getBgmVolume();
      const next = Math.max(0, Math.round((current - 0.1) * 10) / 10);
      this.audioManager.setBgmVolume(next);
      this.updateVolumeDisplay();
    });

    document.getElementById('btn-bgm-up')?.addEventListener('click', () => {
      const current = this.audioManager.getBgmVolume();
      const next = Math.min(1.0, Math.round((current + 0.1) * 10) / 10);
      this.audioManager.setBgmVolume(next);
      this.updateVolumeDisplay();
    });

    // 키 타격음 볼륨 조절
    document.getElementById('btn-hit-down')?.addEventListener('click', () => {
      const current = this.audioManager.getHitsoundVolume();
      const next = Math.max(0, Math.round((current - 0.1) * 10) / 10);
      this.audioManager.setHitsoundVolume(next);
      this.updateVolumeDisplay();
      this.audioManager.playHitSound('tap');
    });

    document.getElementById('btn-hit-up')?.addEventListener('click', () => {
      const current = this.audioManager.getHitsoundVolume();
      const next = Math.min(1.0, Math.round((current + 0.1) * 10) / 10);
      this.audioManager.setHitsoundVolume(next);
      this.updateVolumeDisplay();
      this.audioManager.playHitSound('tap');
    });
    // 키 모드 버튼
    this.keyModeGroup.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const mode = target.dataset.mode as KeyMode;
        if (mode === '6K' || target.classList.contains('locked')) {
          this.audioManager.playHitSound('tap');
          this.showToast('🔒 6키 모드는 결속밴드 4인 집중 개발을 위해 잠겨있습니다!');
          return;
        }
        if (mode && mode !== this.keyMode) {
          this.keyMode = mode;
          this.keyModeGroup.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
          target.classList.add('active');
          this.updateHighScoreDisplay();
        }
      });
    });

    // 난이도 버튼
    this.diffGroup.querySelectorAll('.diff-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const diff = target.dataset.diff as Difficulty;
        if (diff && diff !== this.difficulty) {
          this.difficulty = diff;
          this.diffGroup.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
          target.classList.add('active');
          this.updateHighScoreDisplay();
        }
      });
    });

    // 속도 조절
    document.getElementById('btn-speed-down')!.addEventListener('click', () => {
      if (this.speed > 1.0) {
        this.speed = Math.max(1.0, Math.round((this.speed - 0.25) * 100) / 100);
        this.speedValEl.textContent = `${this.speed.toFixed(2)}x`;
        localStorage.setItem('CYBERBEAT_SPEED', this.speed.toString());
      }
    });

    document.getElementById('btn-speed-up')!.addEventListener('click', () => {
      if (this.speed < 5.0) {
        this.speed = Math.min(5.0, Math.round((this.speed + 0.25) * 100) / 100);
        this.speedValEl.textContent = `${this.speed.toFixed(2)}x`;
        localStorage.setItem('CYBERBEAT_SPEED', this.speed.toString());
      }
    });

    // 오프셋 조절
    document.getElementById('btn-offset-down')!.addEventListener('click', () => {
      if (this.offsetMs > -200) {
        this.offsetMs -= 10;
        this.offsetValEl.textContent = `${this.offsetMs > 0 ? '+' : ''}${this.offsetMs}ms`;
        localStorage.setItem('CYBERBEAT_OFFSET', this.offsetMs.toString());
      }
    });

    document.getElementById('btn-offset-up')!.addEventListener('click', () => {
      if (this.offsetMs < 200) {
        this.offsetMs += 10;
        this.offsetValEl.textContent = `${this.offsetMs > 0 ? '+' : ''}${this.offsetMs}ms`;
        localStorage.setItem('CYBERBEAT_OFFSET', this.offsetMs.toString());
      }
    });

    // 모드(MODS) 버튼 토글
    document.getElementById('btn-mod-mirror')?.addEventListener('click', () => {
      this.mods.mirror = !this.mods.mirror;
      if (this.mods.mirror) {
        this.mods.random = false;
      }
      localStorage.setItem('CYBERBEAT_MOD_MIRROR', this.mods.mirror.toString());
      localStorage.setItem('CYBERBEAT_MOD_RANDOM', this.mods.random.toString());
      this.updateModsDisplay();
      this.audioManager.playHitSound('tap');
    });

    document.getElementById('btn-mod-random')?.addEventListener('click', () => {
      this.mods.random = !this.mods.random;
      if (this.mods.random) {
        this.mods.mirror = false;
      }
      localStorage.setItem('CYBERBEAT_MOD_MIRROR', this.mods.mirror.toString());
      localStorage.setItem('CYBERBEAT_MOD_RANDOM', this.mods.random.toString());
      this.updateModsDisplay();
      this.audioManager.playHitSound('tap');
    });

    document.getElementById('btn-mod-autoplay')?.addEventListener('click', () => {
      this.mods.autoPlay = !this.mods.autoPlay;
      localStorage.setItem('CYBERBEAT_MOD_AUTOPLAY', this.mods.autoPlay.toString());
      this.updateModsDisplay();
      this.audioManager.playHitSound('tap');
    });

    // 시작 버튼
    this.playBtn.addEventListener('click', () => {
      const songs = this.getFilteredSongs();
      const song = songs[this.selectedSongIndex] || songs[0];
      if (this.onStartGameCallback && song) {
        this.onStartGameCallback({
          selectedSong: song,
          keyMode: this.keyMode,
          difficulty: this.difficulty,
          speed: this.speed,
          offsetMs: this.offsetMs,
          mods: { ...this.mods }
        });
      }
    });
  }

  private renderCategoryTabs() {
    if (!this.categoryTabsEl) return;

    // 각 카테고리별 곡 수 계산
    const counts: Record<string, number> = {
      ALL: SONG_DATABASE.length
    };
    for (const song of SONG_DATABASE) {
      if (song.album) {
        counts[song.album] = (counts[song.album] || 0) + 1;
      }
    }

    this.categoryTabsEl.querySelectorAll('.cat-tab').forEach(btn => {
      const cat = (btn as HTMLElement).dataset.cat as ('ALL' | SongAlbum);
      if (cat) {
        const count = counts[cat] || 0;
        const displayName = cat === 'ALL' ? '전체' : (cat === '結束バンドの歌ってみた' ? '歌ってみた' : cat);
        btn.textContent = `${displayName} (${count})`;

        btn.addEventListener('click', () => {
          if (this.activeCategory === cat) return;

          const currentSong = this.getFilteredSongs()[this.selectedSongIndex];
          this.activeCategory = cat;

          this.categoryTabsEl?.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          const newFiltered = this.getFilteredSongs();
          const foundIdx = newFiltered.findIndex(s => s.id === currentSong?.id);
          this.selectedSongIndex = foundIdx >= 0 ? foundIdx : 0;

          this.renderTrackList();
          this.updateTrackDetails();
          this.audioManager.playHitSound('tap');
        });
      }
    });
  }

  private renderTrackList() {
    const songs = this.getFilteredSongs();
    this.trackListEl.innerHTML = '';

    if (this.trackCountBadgeEl) {
      this.trackCountBadgeEl.textContent = `${songs.length} TRACKS`;
    }

    if (this.selectedSongIndex >= songs.length) {
      this.selectedSongIndex = 0;
    }

    songs.forEach((song, idx) => {
      const item = document.createElement('div');
      item.className = `track-item ${idx === this.selectedSongIndex ? 'selected' : ''}`;

      const art = document.createElement('div');
      art.className = 'track-item-art';
      if (song.jacketUrl) {
        art.style.backgroundImage = `url("${encodeURI(song.jacketUrl)}")`;
        art.style.backgroundSize = 'cover';
        art.style.backgroundPosition = 'center';
      } else {
        art.style.background = `linear-gradient(135deg, ${song.jacketColor1}, ${song.jacketColor2})`;
      }

      const info = document.createElement('div');
      info.className = 'track-item-info';

      const title = document.createElement('div');
      title.className = 'track-item-title';
      title.textContent = song.title;

      if (song.artist.includes('結束バンド')) {
        const badge = document.createElement('span');
        badge.className = 'kessoku-badge';
        badge.textContent = song.album ? `★ ${song.album}` : '★ 結束BAND';
        badge.style.cssText = 'background: rgba(255, 107, 157, 0.25); color: #ff6b9d; border: 1px solid #ff6b9d; font-size: 0.65rem; padding: 2px 6px; border-radius: 3px; margin-left: 8px; font-weight: 800; display: inline-block; vertical-align: middle;';
        title.appendChild(badge);
      }

      const artist = document.createElement('div');
      artist.className = 'track-item-artist';
      artist.textContent = `${song.artist} // ${song.genre}`;

      info.appendChild(title);
      info.appendChild(artist);
      item.appendChild(art);
      item.appendChild(info);

      item.addEventListener('click', () => {
        this.selectedSongIndex = idx;
        this.trackListEl.querySelectorAll('.track-item').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        this.updateTrackDetails();
      });

      this.trackListEl.appendChild(item);
    });
  }

  private updateTrackDetails() {
    const songs = this.getFilteredSongs();
    const song = songs[this.selectedSongIndex] || songs[0];
    if (!song) return;

    if (song.jacketUrl) {
      this.jacketEl.style.backgroundImage = `url("${encodeURI(song.jacketUrl)}")`;
      this.jacketEl.style.backgroundSize = 'cover';
      this.jacketEl.style.backgroundPosition = 'center';
    } else {
      this.jacketEl.style.backgroundImage = 'none';
      this.jacketEl.style.background = `linear-gradient(135deg, ${song.jacketColor1}, ${song.jacketColor2})`;
    }
    this.titleEl.textContent = song.title;
    this.artistEl.textContent = song.artist;
    this.bpmEl.textContent = `BPM ${song.bpm}`;
    this.genreEl.textContent = song.genre;

    this.updateHighScoreDisplay();
  }

  private updateHighScoreDisplay() {
    const songs = this.getFilteredSongs();
    const song = songs[this.selectedSongIndex];
    if (!song) return;

    const recordKey = `RECORD_${song.id}_${this.keyMode}_${this.difficulty}`;
    try {
      const saved = localStorage.getItem(recordKey);
      if (saved) {
        const data = JSON.parse(saved);
        this.highscoreValEl.textContent = data.score.toLocaleString();
        this.highrankValEl.textContent = data.rank;
        return;
      }
    } catch {
      // ignore
    }
    this.highscoreValEl.textContent = '000,000';
    this.highrankValEl.textContent = '-';
  }
}
