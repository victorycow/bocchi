import { STAGES, INITIAL_ASSISTS, StageData, AssistSkill } from './data/stages';
import { sounds } from './engine/audio';

class SurvivalRPGGame {
  private currentStageIndex: number = 0;
  private currentStage: StageData = STAGES[0];
  private turn: number = 1;

  private mental: number = 100;
  private maxMental: number = 100;
  private progress: number = 0;
  private sp: number = 1;
  private maxSP: number = 3;

  private isDefending: boolean = false;
  private phoneCooldown: number = 0;
  private ryoStunTurns: number = 0;
  private assists: AssistSkill[] = [];
  private isBusy: boolean = false;

  // DOM Elements
  private screenTitle = document.getElementById('screen-title') as HTMLElement;
  private screenBattle = document.getElementById('screen-battle') as HTMLElement;

  private stageTitleEl = document.getElementById('stage-title') as HTMLElement;
  private stageLocationEl = document.getElementById('stage-location') as HTMLElement;
  private turnBadgeEl = document.getElementById('turn-badge') as HTMLElement;

  private bossAvatarEl = document.getElementById('boss-avatar') as HTMLElement;
  private bossNameEl = document.getElementById('boss-name') as HTMLElement;
  private bossRoleEl = document.getElementById('boss-role') as HTMLElement;
  private bossDialogueEl = document.getElementById('boss-dialogue') as HTMLElement;
  private progressTextEl = document.getElementById('progress-text') as HTMLElement;
  private progressBarEl = document.getElementById('progress-bar') as HTMLElement;

  private bocchiAvatarEl = document.getElementById('bocchi-avatar') as HTMLImageElement;
  private bocchiThoughtEl = document.getElementById('bocchi-thought') as HTMLElement;
  private mentalTextEl = document.getElementById('mental-text') as HTMLElement;
  private mentalBarEl = document.getElementById('mental-bar') as HTMLElement;
  private spTextEl = document.getElementById('sp-text') as HTMLElement;
  private spContainerEl = document.getElementById('sp-container') as HTMLElement;

  private shieldBadgeEl = document.getElementById('shield-badge') as HTMLElement;
  private phoneCooldownTagEl = document.getElementById('phone-cooldown-tag') as HTMLElement;
  private battleLogEl = document.getElementById('battle-log') as HTMLElement;
  private panicOverlayEl = document.getElementById('panic-overlay') as HTMLElement;

  // Buttons
  private btnStartGame = document.getElementById('btn-start-game') as HTMLButtonElement;
  private btnToggleSound = document.getElementById('btn-toggle-sound') as HTMLButtonElement;

  private cmdSpeak = document.getElementById('cmd-speak') as HTMLButtonElement;
  private cmdDefend = document.getElementById('cmd-defend') as HTMLButtonElement;
  private cmdPhone = document.getElementById('cmd-phone') as HTMLButtonElement;
  private cmdEscape = document.getElementById('cmd-escape') as HTMLButtonElement;
  private cmdGuitarHero = document.getElementById('cmd-guitar-hero') as HTMLButtonElement;

  private assistKita = document.getElementById('assist-kita') as HTMLButtonElement;
  private assistRyo = document.getElementById('assist-ryo') as HTMLButtonElement;
  private assistNijika = document.getElementById('assist-nijika') as HTMLButtonElement;

  // Modals
  private modalVictory = document.getElementById('modal-victory') as HTMLElement;
  private modalDefeat = document.getElementById('modal-defeat') as HTMLElement;
  private modalAllClear = document.getElementById('modal-allclear') as HTMLElement;
  private victoryBossTextEl = document.getElementById('victory-boss-text') as HTMLElement;
  private defeatDescTextEl = document.getElementById('defeat-desc-text') as HTMLElement;

  private btnNextStage = document.getElementById('btn-next-stage') as HTMLButtonElement;
  private btnVictoryTitle = document.getElementById('btn-victory-title') as HTMLButtonElement;
  private btnRetryStage = document.getElementById('btn-retry-stage') as HTMLButtonElement;
  private btnDefeatTitle = document.getElementById('btn-defeat-title') as HTMLButtonElement;
  private btnAllClearRestart = document.getElementById('btn-allclear-restart') as HTMLButtonElement;

  constructor() {
    this.initAssists();
    this.bindEvents();
  }

  private initAssists() {
    this.assists = JSON.parse(JSON.stringify(INITIAL_ASSISTS));
  }

  private bindEvents() {
    this.btnStartGame.addEventListener('click', () => {
      sounds.playClick();
      this.startStage(0);
    });

    this.btnToggleSound.addEventListener('click', () => {
      const muted = sounds.toggleMute();
      this.btnToggleSound.textContent = muted ? '🔇 소리 꺼짐' : '🔊 소리 켜짐';
    });

    // Commands
    this.cmdSpeak.addEventListener('click', () => this.handleAction('speak'));
    this.cmdDefend.addEventListener('click', () => this.handleAction('defend'));
    this.cmdPhone.addEventListener('click', () => this.handleAction('phone'));
    this.cmdEscape.addEventListener('click', () => this.handleAction('escape'));
    this.cmdGuitarHero.addEventListener('click', () => this.handleAction('guitarHero'));

    // Assists
    this.assistKita.addEventListener('click', () => this.handleAssist('kita'));
    this.assistRyo.addEventListener('click', () => this.handleAssist('ryo'));
    this.assistNijika.addEventListener('click', () => this.handleAssist('nijika'));

    // Modal buttons
    this.btnNextStage.addEventListener('click', () => {
      sounds.playClick();
      this.hideModals();
      if (this.currentStageIndex + 1 < STAGES.length) {
        this.startStage(this.currentStageIndex + 1);
      } else {
        this.showAllClear();
      }
    });

    this.btnVictoryTitle.addEventListener('click', () => {
      sounds.playClick();
      this.goToTitle();
    });

    this.btnRetryStage.addEventListener('click', () => {
      sounds.playClick();
      this.hideModals();
      this.startStage(this.currentStageIndex);
    });

    this.btnDefeatTitle.addEventListener('click', () => {
      sounds.playClick();
      this.goToTitle();
    });

    this.btnAllClearRestart.addEventListener('click', () => {
      sounds.playClick();
      this.hideModals();
      this.startStage(0);
    });
  }

  private goToTitle() {
    this.hideModals();
    this.screenBattle.classList.remove('active');
    this.screenTitle.classList.add('active');
    sounds.stopBGM();
  }

  private hideModals() {
    this.modalVictory.classList.remove('active');
    this.modalDefeat.classList.remove('active');
    this.modalAllClear.classList.remove('active');
    this.panicOverlayEl.classList.remove('active');
  }

  private startStage(stageIndex: number) {
    this.currentStageIndex = stageIndex;
    this.currentStage = STAGES[stageIndex];
    this.turn = 1;
    this.mental = 100;
    this.progress = 0;
    this.sp = 1;
    this.isDefending = false;
    this.phoneCooldown = 0;
    this.ryoStunTurns = 0;
    this.isBusy = false;
    this.initAssists();

    // Setup Stage UI
    this.stageTitleEl.textContent = this.currentStage.title;
    this.stageLocationEl.textContent = `${this.currentStage.location} - ${this.currentStage.subtitle}`;
    this.bossAvatarEl.textContent = this.currentStage.boss.avatarEmoji;
    this.bossNameEl.textContent = this.currentStage.boss.name;
    this.bossRoleEl.textContent = this.currentStage.boss.role;
    this.bossDialogueEl.textContent = `"${this.currentStage.boss.introDialogue}"`;

    this.bocchiAvatarEl.src = '/images/bocchi-nervous.png';
    this.bocchiThoughtEl.textContent = `(으으... 온몸에서 식은땀이 나기 시작했다... 벌써 심장이 쿵쾅거려...)`;

    // Reset log
    this.battleLogEl.innerHTML = '';
    this.addLog(`★ [${this.currentStage.title}] 돌입!`, 'log-system');
    this.addLog(`${this.currentStage.boss.name}: "${this.currentStage.boss.introDialogue}"`, 'log-boss');

    // Show Battle Screen
    this.screenTitle.classList.remove('active');
    this.screenBattle.classList.add('active');

    // Play Stage BGM
    const bgmTrack = stageIndex === 0 ? '/audio/03. Distortion!!.mp3' : '/audio/08. カラカラ.mp3';
    sounds.playBGM(bgmTrack);

    this.updateUI();
  }

  private addLog(text: string, className: string = '') {
    const p = document.createElement('div');
    p.className = `log-item ${className}`;
    p.textContent = text;
    this.battleLogEl.appendChild(p);
    this.battleLogEl.scrollTop = this.battleLogEl.scrollHeight;
  }

  private triggerScreenShake() {
    const card = document.getElementById('bocchi-card');
    if (card) {
      card.classList.remove('screen-shake');
      void card.offsetWidth; // trigger reflow
      card.classList.add('screen-shake');
    }
  }

  private updateUI() {
    this.turnBadgeEl.textContent = `TURN ${this.turn}`;

    // Mental bar
    const mentalPercent = Math.max(0, Math.min(100, this.mental));
    this.mentalBarEl.style.width = `${mentalPercent}%`;
    this.mentalTextEl.textContent = `${this.mental} / ${this.maxMental}`;

    // Progress bar
    const progressPercent = Math.max(0, Math.min(100, this.progress));
    this.progressBarEl.style.width = `${progressPercent}%`;
    this.progressTextEl.textContent = `${progressPercent}%`;

    // SP pips
    this.spTextEl.textContent = `${this.sp} / ${this.maxSP}`;
    const pips = this.spContainerEl.children;
    for (let i = 0; i < pips.length; i++) {
      if (i < this.sp) {
        pips[i].classList.add('active');
      } else {
        pips[i].classList.remove('active');
      }
    }

    // Shield status
    this.shieldBadgeEl.style.display = this.isDefending ? 'inline' : 'none';

    // Phone cooldown tag
    if (this.phoneCooldown > 0) {
      this.phoneCooldownTagEl.textContent = `쿨다운 ${this.phoneCooldown}턴 남음`;
      this.cmdPhone.disabled = true;
    } else {
      this.phoneCooldownTagEl.textContent = `멘탈 +25 회복 가능`;
      this.cmdPhone.disabled = false;
    }

    // Guitar Hero SP requirement
    this.cmdGuitarHero.disabled = this.sp < 2 || this.isBusy;

    // Bocchi expression & Panic overlay
    if (this.mental <= 35) {
      this.bocchiAvatarEl.src = '/images/bocchi-panic.png';
      this.panicOverlayEl.classList.add('active');
      sounds.playHeartbeat();
    } else {
      this.bocchiAvatarEl.src = '/images/bocchi-nervous.png';
      this.panicOverlayEl.classList.remove('active');
    }

    // Assists status
    const kita = this.assists.find(a => a.id === 'kita');
    const ryo = this.assists.find(a => a.id === 'ryo');
    const nijika = this.assists.find(a => a.id === 'nijika');

    this.assistKita.disabled = !!kita?.used || this.isBusy;
    this.assistRyo.disabled = !!ryo?.used || this.isBusy;
    this.assistNijika.disabled = !!nijika?.used || this.isBusy;

    // Command buttons disabled state
    this.cmdSpeak.disabled = this.isBusy;
    this.cmdDefend.disabled = this.isBusy;
    this.cmdEscape.disabled = this.isBusy;
  }

  // Handle Player Actions
  private handleAction(actionType: 'speak' | 'defend' | 'phone' | 'escape' | 'guitarHero') {
    if (this.isBusy) return;
    this.isBusy = true;
    this.updateUI();

    let playerEscapedSuccessfully = false;

    if (actionType === 'speak') {
      sounds.playStutter();
      const randomLine = this.getRandomItem(this.currentStage.bocchiVoicePool.speak);
      this.bocchiThoughtEl.textContent = `(흑... 용기를 쥐어짜서 중얼거렸다...)`;
      this.addLog(`봇치: "${randomLine}"`, 'log-bocchi');

      const gain = 25;
      this.progress = Math.min(100, this.progress + gain);
      this.mental = Math.max(0, this.mental - 10);
      this.addLog(`→ 주문/대화 진척도 +${gain}% (긴장으로 멘탈 -10)`, 'log-system');

    } else if (actionType === 'defend') {
      sounds.playDefend();
      this.isDefending = true;
      this.sp = Math.min(this.maxSP, this.sp + 1);
      const randomLine = this.getRandomItem(this.currentStage.bocchiVoicePool.defend);
      this.bocchiThoughtEl.textContent = `(${randomLine})`;
      this.addLog(`봇치는 방어 태세를 취했다: ${randomLine}`, 'log-bocchi');
      this.addLog(`→ 다음 상대 턴 멘탈 데미지 70% 경감! 용기 SP +1 충전!`, 'log-system');

    } else if (actionType === 'phone') {
      sounds.playHeal();
      this.phoneCooldown = 3;
      const healAmount = 25;
      this.mental = Math.min(this.maxMental, this.mental + healAmount);
      const randomLine = this.getRandomItem(this.currentStage.bocchiVoicePool.phone);
      this.bocchiThoughtEl.textContent = `(${randomLine})`;
      this.addLog(`봇치가 스마트폰을 켜며 위기를 모면했다: 멘탈 +${healAmount} 회복!`, 'log-bocchi');

    } else if (actionType === 'escape') {
      const isSuccess = Math.random() < 0.45;
      if (isSuccess) {
        sounds.playDefend();
        playerEscapedSuccessfully = true;
        const line = this.getRandomItem(this.currentStage.bocchiVoicePool.escapeSuccess);
        this.bocchiThoughtEl.textContent = `(${line})`;
        this.addLog(`도망치기 성공! ${line}`, 'log-bocchi');
        this.mental = Math.min(this.maxMental, this.mental + 10);
        this.addLog(`→ 한숨 돌리며 멘탈 +10 회복! 이번 턴 상대의 주의를 피했습니다.`, 'log-system');
      } else {
        sounds.playDamage();
        this.triggerScreenShake();
        const line = this.getRandomItem(this.currentStage.bocchiVoicePool.escapeFail);
        this.bocchiThoughtEl.textContent = `(도망치려다 들켰어... 수치심으로 폭사할 것 같아...)`;
        this.addLog(`도망치기 실패! ${line}`, 'log-boss');
        this.mental = Math.max(0, this.mental - 25);
        this.addLog(`→ 수치심 폭발로 멘탈 -25 피해!`, 'log-system');
      }

    } else if (actionType === 'guitarHero') {
      sounds.playGuitarRiff();
      this.sp -= 2;
      const line = this.getRandomItem(this.currentStage.bocchiVoicePool.guitarHero);
      this.bocchiThoughtEl.textContent = `(기타 솔로를 머릿속으로 연주하며... 각성했다!!)`;
      this.addLog(`🎸 각성: ${line}`, 'log-assist');
      this.progress = Math.min(100, this.progress + 45);
      this.mental = Math.min(this.maxMental, this.mental + 10);
      this.addLog(`→ '기타 히어로'의 위엄! 대화 진척도 +45%, 멘탈 +10 회복!`, 'log-system');
    }

    this.updateUI();

    // Check Victory
    if (this.progress >= 100) {
      setTimeout(() => this.triggerVictory(), 600);
      return;
    }

    // Check Defeat
    if (this.mental <= 0) {
      setTimeout(() => this.triggerDefeat(), 600);
      return;
    }

    // If player escaped successfully, skip boss attack
    if (playerEscapedSuccessfully) {
      this.endTurn();
      return;
    }

    // Boss Turn after delay
    setTimeout(() => {
      this.executeBossTurn();
    }, 750);
  }

  // Handle Kessoku Band Assists
  private handleAssist(assistId: 'kita' | 'ryo' | 'nijika') {
    if (this.isBusy) return;
    const assist = this.assists.find(a => a.id === assistId);
    if (!assist || assist.used) return;

    this.isBusy = true;
    assist.used = true;

    if (assistId === 'kita') {
      sounds.playVictory();
      this.progress = Math.min(100, this.progress + 40);
      this.bossDialogueEl.textContent = `"와~! 친구분이 정말 밝고 쾌활하시네요! 요청하신 대로 바로 해드릴게요!"`;
      this.bocchiThoughtEl.textContent = `(키.. 키타~앙! 눈부신 인싸 오라로 점원을 정화해 버렸어...!)`;
      this.addLog(`★ [키타 이쿠요 어시스트] "키타~앙! 저희 봇치 짱한테 잘 부탁드려요!"`, 'log-assist');
      this.addLog(`→ 점원이 인싸 아우라에 매혹되어 주문 진척도 +40%!`, 'log-system');

    } else if (assistId === 'ryo') {
      sounds.playDefend();
      this.ryoStunTurns = 2;
      this.bossDialogueEl.textContent = `"...네?! 기타줄 살 돈으로 돈까스 사달라고요?! 잡초 맛이 산뜻하다고요...??"`;
      this.bocchiThoughtEl.textContent = `(료 선배가 상상도 못 한 기행을 저질러서 점원 분이 버그 났어...)`;
      this.addLog(`★ [야마다 료 어시스트] "기타줄 대신 밥 사줘. 그리고 잡초 토핑 되나?"`, 'log-assist');
      this.addLog(`→ 점원이 극심한 혼란에 빠졌습니다! 2턴간 공격력 0 무력화!`, 'log-system');

    } else if (assistId === 'nijika') {
      sounds.playHeal();
      this.mental = Math.min(this.maxMental, this.mental + 45);
      this.sp = Math.min(this.maxSP, this.sp + 1);
      this.bossDialogueEl.textContent = `"천천히 말씀하셔도 되니 편하게 골라주세요~"`;
      this.bocchiThoughtEl.textContent = `(니지카 짱의 상냥한 미소에 멘탈이 사르르 녹아내린다... 여신인가?)`;
      this.addLog(`★ [이지치 니지카 어시스트] "히토리 짱, 괜찮아! 결속밴드가 뒤에 있잖아!"`, 'log-assist');
      this.addLog(`→ 따뜻한 위로로 멘탈 +45 회복! 용기 SP +1 획득!`, 'log-system');
    }

    this.updateUI();

    // Check Victory
    if (this.progress >= 100) {
      setTimeout(() => this.triggerVictory(), 600);
      return;
    }

    // After assist, boss turn follows unless stunned
    setTimeout(() => {
      this.executeBossTurn();
    }, 800);
  }

  // Boss Turn Execution
  private executeBossTurn() {
    if (this.ryoStunTurns > 0) {
      this.ryoStunTurns--;
      this.addLog(`[상대 턴] 점원이 료의 기행을 이해하려고 뇌정지 상태에 빠져 있습니다. (피해 없음)`, 'log-boss');
      this.endTurn();
      return;
    }

    const bossAction = this.getRandomItem(this.currentStage.boss.actions);
    this.bossDialogueEl.textContent = `"${bossAction.dialogue}"`;
    this.bocchiThoughtEl.textContent = bossAction.reactionPrompt;

    let dmg = bossAction.mentalDamage;
    if (this.isDefending) {
      dmg = Math.round(dmg * 0.3);
      this.isDefending = false;
      this.addLog(`눈 피하기 방어로 데미지 대폭 반감!`, 'log-assist');
    }

    sounds.playDamage();
    this.triggerScreenShake();
    this.mental = Math.max(0, this.mental - dmg);

    this.addLog(`[${this.currentStage.boss.name}] "${bossAction.dialogue}" (멘탈 -${dmg})`, 'log-boss');

    this.updateUI();

    if (this.mental <= 0) {
      setTimeout(() => this.triggerDefeat(), 600);
      return;
    }

    this.endTurn();
  }

  private endTurn() {
    this.turn++;
    if (this.phoneCooldown > 0) {
      this.phoneCooldown--;
    }
    this.isBusy = false;
    this.updateUI();
  }

  private triggerVictory() {
    sounds.stopBGM();
    sounds.playVictory();
    this.bocchiAvatarEl.src = '/images/bocchi-relief.png';
    this.bossDialogueEl.textContent = `"${this.currentStage.boss.clearDialogue}"`;
    this.bocchiThoughtEl.textContent = `(해... 해냈다...! 결제까지 완료했어... 어서 집으로 도망가자...!)`;
    this.victoryBossTextEl.textContent = `"${this.currentStage.boss.clearDialogue}"\n\n결제를 무사히 마치고 가게를 전력 질주로 탈출했습니다!`;
    this.modalVictory.classList.add('active');
  }

  private triggerDefeat() {
    sounds.stopBGM();
    sounds.playDefeat();
    this.bocchiAvatarEl.src = '/images/bocchi-panic.png';
    this.bossDialogueEl.textContent = `"${this.currentStage.boss.defeatDialogue}"`;
    this.defeatDescTextEl.textContent = `봇치의 멘탈이 0이 되었습니다!\n'${this.currentStage.boss.name}'의 맹공을 버티지 못하고, 승인욕구 몬스터로 변신해 괴성을 지르며 먼지가 되어 사라졌습니다...`;
    this.modalDefeat.classList.add('active');
  }

  private showAllClear() {
    sounds.stopBGM();
    sounds.playVictory();
    this.modalAllClear.classList.add('active');
  }

  private getRandomItem<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }
}

// Instantiate game on page load
window.addEventListener('DOMContentLoaded', () => {
  new SurvivalRPGGame();
});
