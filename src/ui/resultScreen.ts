import { PlayResult } from '../engine/types';

export class ResultScreenUI {
  private statusTextEl: HTMLElement;
  private trackInfoEl: HTMLElement;
  private rankBadgeEl: HTMLElement;
  private finalScoreEl: HTMLElement;
  private accuracyEl: HTMLElement;

  private cnt100El: HTMLElement;
  private cnt90El: HTMLElement;
  private cnt80El: HTMLElement;
  private cnt70El: HTMLElement;
  private cnt50El: HTMLElement;
  private cntMissEl: HTMLElement;
  private maxComboEl: HTMLElement;

  private retryBtn: HTMLElement;
  private selectBtn: HTMLElement;

  private speakerNameEl: HTMLElement | null;
  private speakerTextEl: HTMLElement | null;
  private speakerImgEl: HTMLImageElement | null;

  private onRetryCallback: (() => void) | null = null;
  private onSelectCallback: (() => void) | null = null;

  constructor() {
    this.statusTextEl = document.getElementById('result-status-text')!;
    this.trackInfoEl = document.getElementById('result-track-info')!;
    this.rankBadgeEl = document.getElementById('result-rank-badge')!;
    this.finalScoreEl = document.getElementById('result-final-score')!;
    this.accuracyEl = document.getElementById('result-accuracy')!;

    this.cnt100El = document.getElementById('res-cnt-100')!;
    this.cnt90El = document.getElementById('res-cnt-90')!;
    this.cnt80El = document.getElementById('res-cnt-80')!;
    this.cnt70El = document.getElementById('res-cnt-70')!;
    this.cnt50El = document.getElementById('res-cnt-50')!;
    this.cntMissEl = document.getElementById('res-cnt-miss')!;
    this.maxComboEl = document.getElementById('res-max-combo')!;

    this.speakerNameEl = document.getElementById('result-speaker-name');
    this.speakerTextEl = document.getElementById('result-speaker-text');
    this.speakerImgEl = document.getElementById('result-character-img') as HTMLImageElement | null;

    this.retryBtn = document.getElementById('btn-result-retry')!;
    this.selectBtn = document.getElementById('btn-result-select')!;

    this.setupEvents();
  }

  public onRetry(cb: () => void) {
    this.onRetryCallback = cb;
  }

  public onSelect(cb: () => void) {
    this.onSelectCallback = cb;
  }

  public showResult(result: PlayResult, songId: string) {
    this.statusTextEl.textContent = result.isClear ? 'LIVE PERFORMANCE CLEAR!' : 'LIVE FAILED...';
    this.statusTextEl.style.color = result.isClear ? '#ff6b9d' : '#ff4365';

    this.trackInfoEl.textContent = `${result.songTitle} // ${result.keyMode} ${result.difficulty}`;
    this.rankBadgeEl.textContent = result.rank;
    this.finalScoreEl.textContent = result.score.toLocaleString();
    this.accuracyEl.textContent = `ACCURACY ${result.accuracy.toFixed(2)}%`;

    this.cnt100El.textContent = result.counts.MAX100.toString();
    this.cnt90El.textContent = result.counts['90'].toString();
    this.cnt80El.textContent = result.counts['80'].toString();
    this.cnt70El.textContent = result.counts['70'].toString();
    this.cnt50El.textContent = result.counts['50'].toString();
    this.cntMissEl.textContent = result.counts.MISS.toString();
    this.maxComboEl.textContent = result.maxCombo.toString();

    // 결속밴드 캐릭터 코멘트 출력
    this.updateCharacterComment(result.isClear, result.rank);

    // 하이스코어 갱신
    this.saveRecord(songId, result);
  }

  private updateCharacterComment(isClear: boolean, rank: string) {
    if (!this.speakerNameEl || !this.speakerTextEl) return;

    interface Quote { speaker: string; text: string; image?: string }
    const quoteMap: Record<string, Quote[]> = {
      SSS: [
        { speaker: '🎤 키타 이쿠요', text: '“키타앙~!✨ 정말 눈부실 정도로 완벽했어요! 역시 최고의 기타 히어로예요!”', image: 'kita-chibi.png' },
        { speaker: '🥁 이지치 니지카', text: '“대박...! 온몸에 소름이 돋았어! 다음 STARRY 정기 라이브 오프닝 곡으로 서자!”', image: 'nijika-chibi.png' }
      ],
      SS: [
        { speaker: '🥁 이지치 니지카', text: '“와아, 정말 훌륭해! 오늘 관객분들 환호성도 완전 폭발적이었어!”', image: 'nijika-chibi.png' },
        { speaker: '🎸 야마다 료', text: '“흠... 제법이잖아. 나한테 맛있는 카레 사주면 베이스 세션 해줄게.”', image: 'ryo-chibi.png' }
      ],
      S: [
        { speaker: '🎸 야마다 료', text: '“좋은 그루브였어. 록스피릿이 느껴지는 연주였네.”', image: 'ryo-chibi.png' },
        { speaker: '🎤 키타 이쿠요', text: '“히토리 쨩의 멋진 연주에 저도 모르게 푹 빠져버렸어요!”', image: 'kita-chibi.png' }
      ],
      A: [
        { speaker: '🎸 고토 히토리', text: '“아, 저... 그래도 무대에서 기절 안 하고 완주해서... 다행이에요...”', image: 'bocchi-relief.png' },
        { speaker: '🥁 이지치 니지카', text: '“좋아 좋아! 조금만 더 합을 맞추면 다음엔 훨씬 더 완벽할 거야!”', image: 'nijika-chibi.png' }
      ],
      B: [
        { speaker: '🎸 고토 히토리', text: '“손이 덜덜 떨려서... 어떻게 연주했는지도 잘 모르겠어요... 으으...”', image: 'bocchi-nervous.png' },
        { speaker: '🎤 키타 이쿠요', text: '“수고 많으셨어요! 다음 곡도 우리 다 함께 힘내봐요!”', image: 'kita-chibi.png' }
      ],
      C: [
        { speaker: '🎸 고토 히토리', text: '“으아아악-!! 관객분들이 날 쳐다보고 있어... 쓰레기통으로 들어가고 싶어어어-!!”', image: 'bocchi-panic.png' }
      ],
      FAIL: [
        { speaker: '🎸 고토 히토리', text: '“히익... 무대 위에서 먼지가 되어 증발해버릴 것 같아요... 죄송합니다아아...”', image: 'bocchi-panic.png' },
        { speaker: '🥁 이지치 니지카', text: '“괜찮아 히토리! 라이브에서는 누구든 실수할 수 있어. 한 번 더 해보자!”', image: 'nijika-chibi.png' }
      ]
    };

    const key = isClear ? (quoteMap[rank] ? rank : 'A') : 'FAIL';
    const list = quoteMap[key] || quoteMap['A'];
    const chosen = list[Math.floor(Math.random() * list.length)];

    this.speakerNameEl.textContent = chosen.speaker;
    this.speakerTextEl.textContent = chosen.text;

    // 캐릭터 반응 이미지 동적 로딩 (.png, .webp, .jpg, .jpeg 유연하게 자동 감지)
    if (this.speakerImgEl) {
      if (chosen.image) {
        const baseName = chosen.image.replace(/\.(png|jpe?g|webp)$/i, '');
        const candidateExts = ['.png', '.webp', '.jpg', '.jpeg'];
        let candidateIdx = 0;

        const tryLoadNext = () => {
          if (candidateIdx >= candidateExts.length) {
            if (this.speakerImgEl) this.speakerImgEl.style.display = 'none';
            return;
          }
          const currentPath = `/images/${baseName}${candidateExts[candidateIdx++]}`;
          const testImg = new Image();
          testImg.onload = () => {
            if (this.speakerImgEl) {
              this.speakerImgEl.src = currentPath;
              this.speakerImgEl.style.display = 'block';
            }
          };
          testImg.onerror = () => {
            tryLoadNext();
          };
          testImg.src = currentPath;
        };

        tryLoadNext();
      } else {
        this.speakerImgEl.style.display = 'none';
      }
    }

    this.speakerNameEl.textContent = chosen.speaker;
    this.speakerTextEl.textContent = chosen.text;
  }

  private setupEvents() {
    this.retryBtn.addEventListener('click', () => {
      if (this.onRetryCallback) this.onRetryCallback();
    });

    this.selectBtn.addEventListener('click', () => {
      if (this.onSelectCallback) this.onSelectCallback();
    });
  }

  private saveRecord(songId: string, result: PlayResult) {
    const recordKey = `RECORD_${songId}_${result.keyMode}_${result.difficulty}`;
    try {
      const saved = localStorage.getItem(recordKey);
      let bestScore = 0;
      if (saved) {
        const prev = JSON.parse(saved);
        bestScore = prev.score || 0;
      }

      if (result.score > bestScore) {
        localStorage.setItem(recordKey, JSON.stringify({
          score: result.score,
          rank: result.rank,
          accuracy: result.accuracy
        }));
      }
    } catch {
      // ignore
    }
  }
}
