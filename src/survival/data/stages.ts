export interface BossAction {
  id: string;
  dialogue: string;
  reactionPrompt: string; // 봇치의 뇌내 반응
  mentalDamage: number; // 방어 안 했을 때 멘탈 피해
  tags: string[];
}

export interface StageData {
  id: number;
  title: string;
  subtitle: string;
  location: string;
  bgGradient: string;
  boss: {
    name: string;
    role: string;
    avatarEmoji: string;
    description: string;
    introDialogue: string;
    clearDialogue: string;
    defeatDialogue: string; // 봇치 멘탈 0일 때
    actions: BossAction[];
  };
  bocchiVoicePool: {
    speak: string[];
    defend: string[];
    phone: string[];
    escapeFail: string[];
    escapeSuccess: string[];
    guitarHero: string[];
  };
}

export const STAGES: StageData[] = [
  {
    id: 1,
    title: "STAGE 1. 악기점의 시련",
    subtitle: "인싸 점원에게 기타줄 010 게이지 구매하기",
    location: "오차노미즈 악기 거리 - 뮤직 스토어",
    bgGradient: "linear-gradient(135deg, #1f1224 0%, #2f1737 50%, #15091a 100%)",
    boss: {
      name: "열정 점원 타나카",
      role: "악기점 베테랑 판매원 (MBTI: ENFP 추정)",
      avatarEmoji: "🎸",
      description: "눈이 마주치자마자 100만 볼트의 친화력과 스몰토크를 쏟아붓는 악기점의 지배자.",
      introDialogue: "어서오세요~! 편하게 둘러보세요! 혹시 찾으시는 부품이나 이펙터 있으신가요?!",
      clearDialogue: "아! 다다리오 010 게이지요! 재고 바로 있습니다! 포인트 적립은... 아 안 하셔도 돼요! 안녕히 가세요~!",
      defeatDialogue: "어... 손님...? 갑자기 구석에서 먼지처럼 굳으셨는데... 119 불러야 하나...?",
      actions: [
        {
          id: "smaltalk_1",
          dialogue: "손님! 기타 메고 계시네요! 혹시 무슨 모델 쓰세요? 깁슨 레스폴 커스텀?! 와 대박!",
          reactionPrompt: "(히이익?! 왜 갑자기 내 기타 스펙을 물어보는 거야?! 깁슨 아빠 건데 들키면 어쩌지?!)",
          mentalDamage: 18,
          tags: ["스몰토크", "과도한 칭찬"]
        },
        {
          id: "smaltalk_2",
          dialogue: "요즘 밴드 연습 중이신가요? 이번 주말에 라이브라도 있으신가 봐요! 멋지다~!",
          reactionPrompt: "(라.. 라이브?! 아냐! 난 방구석 벽장 속 기타 히어로일 뿐인데 왜 현실 밴드맨 취급을?!)",
          mentalDamage: 22,
          tags: ["폭풍 질문", "인싸 압박"]
        },
        {
          id: "smaltalk_3",
          dialogue: "이 코팅 스트링도 진짜 인기 많은데 한번 써보실래요? 톤이 아주 쨍~하고 오래 가거든요!",
          reactionPrompt: "(추천 상품 거절하기 난이도 SS급... 거절하면 이 사람 상처받는 거 아냐...?!)",
          mentalDamage: 20,
          tags: ["상품 권유", "거절 불가 압박"]
        },
        {
          id: "smaltalk_4",
          dialogue: "눈을 지그시 마주치며 방긋 웃는다: '편하게 말씀하세요! 저 안 물어요 하하!'",
          reactionPrompt: "(눈.. 눈 마주쳤어!! 망막이 타들어갈 것 같아!! 눈동자를 어디 둬야 해?!)",
          mentalDamage: 25,
          tags: ["아이컨택", "극딜"]
        }
      ]
    },
    bocchiVoicePool: {
      speak: [
        "그.. 그.. 다다리오 010... 주.. 세요...",
        "저.. 기타줄... 니.. 니켈 와운드... 로...",
        "그.. 그거.. 계산.. 흑...",
        "가.. 가격은... 카.. 카드로..."
      ],
      defend: [
        "점원의 시선을 피해 진열장의 픽 껍데기 성분표에 시선을 고정했다!",
        "바닥 타일의 줄눈 개수를 세며 필사적으로 고개를 끄덕였다!",
        "기타 가방 끈을 으스러지게 쥐어짜며 허공을 응시했다!"
      ],
      phone: [
        "아무도 연락 안 온 카톡 화면을 켜서 심각한 표정을 지었다. '마음이 조금 진정됐다...'",
        "유튜브 알고리즘에 뜬 '기타 속주 레슨' 썸네일을 보며 방구석의 평화를 떠올렸다."
      ],
      escapeFail: [
        "도망치려 했으나 '손님! 계산대 이쪽이에요!' 하고 점원이 친절하게 길을 막아섰다! (치명상)",
        "뒷걸음질 치다 앰프 스탠드에 발이 걸려 기우뚱했다! 수치심 폭발!"
      ],
      escapeSuccess: [
        "점원이 잠깐 뒤돌아 재고를 찾는 틈에 구석 진열대 뒤로 숨어 숨을 골랐다!"
      ],
      guitarHero: [
        "‘기타 히어로’ 모드 ON! 뇌내에서 Bpm 210 네오클래시컬 속주를 울리며 똑바로 말했다: '다다리오 010 EXL110 하나 주세요!!'"
      ]
    }
  },
  {
    id: 2,
    title: "STAGE 2. 지옥의 커스텀 카페",
    subtitle: "트렌디 카페 바리스타의 옵션 질문 세례 뚫고 주문하기",
    location: "시부야 뒷골목 - 힙스터 스페셜티 로스터리",
    bgGradient: "linear-gradient(135deg, #1b1c2b 0%, #202b3a 50%, #0e121a 100%)",
    boss: {
      name: "스타일리시 바리스타 레이",
      role: "전문 바리스타 (말투가 너무 세련되고 빠름)",
      avatarEmoji: "☕",
      description: "원두 원산지부터 우유 종류, 얼음 양, 시럽 펌프까지 0.5초마다 선택지를 들이미는 주문의 문지기.",
      introDialogue: "주문 도와드리겠습니다! 드시고 가시나요, 테이크아웃이신가요?",
      clearDialogue: "네, 따뜻한 카페라떼 오트 밀크로 변경, 테이크아웃 결제 완료되셨습니다! 닉네임 불러드릴게요~!",
      defeatDialogue: "저기... 손님? 텀블러 안고 바닥에 웅크리시면 곤란한데요... 앰뷸런스 부를까요...?!",
      actions: [
        {
          id: "cafe_1",
          dialogue: "원두는 베리류의 화사한 산미가 있는 에티오피아와 묵직한 고소함의 콜롬비아 중 어떤 걸로 고르시겠어요?",
          reactionPrompt: "(사.. 산미가 뭔데요... 고소한 건 또 뭐야... 그냥 쓴 검은 물 아니었어?!)",
          mentalDamage: 20,
          tags: ["원두 선택", "어려운 단어"]
        },
        {
          id: "cafe_2",
          dialogue: "우유는 일반 우유, 락토프리, 오트 밀크, 두유 중 변경 원하시는 옵션 있으세요?",
          reactionPrompt: "(우유가 네 종류나 있어?! 그냥 소에서 나온 거면 다 같은 거 아니었냐고?!)",
          mentalDamage: 22,
          tags: ["커스텀 세례", "멘붕"]
        },
        {
          id: "cafe_3",
          dialogue: "텀블러 가져오셨나요? 저희 에코 쿠폰 찍어드릴 텐데 앱 다운로드 받으셨나요?",
          reactionPrompt: "(앱?! 회원가입?! 전화번호 적으라고 하면 어쩌지?! 뒤에 대기 줄 생겼어 으아악!)",
          mentalDamage: 26,
          tags: ["뒤통수 시선", "사회적 압박"]
        },
        {
          id: "cafe_4",
          dialogue: "음료 픽업하실 때 불러드릴 닉네임이나 성함 하나만 알려주시겠어요? ^^",
          reactionPrompt: "(니.. 닉네임?! 여기서 '기타히어로'라고 말할 순 없잖아! 내 실명도 까먹을 것 같아!!)",
          mentalDamage: 28,
          tags: ["닉네임 공개처형", "최종보스급"]
        }
      ]
    },
    bocchiVoicePool: {
      speak: [
        "아.. 아메.. 아니 라떼... 아니 보통 걸로...",
        "그.. 그냥.. 아무거나.. 제.. 제일 싼 걸로...",
        "가.. 가..져갈게요...",
        "단.. 단맛 안 나게... 요..."
      ],
      defend: [
        "메뉴판 모니터의 조그만 영문 철자를 외우는 척하며 시선을 고정했다!",
        "카운터 앞 유리 쇼케이스 안의 마카롱에게 애절한 눈빛을 보냈다!",
        "에어팟에서 노이즈 캔슬링이 작동 중이라고 스스로를 세뇌했다!"
      ],
      phone: [
        "스마트폰 갤러리에 저장해 둔 '스타벅스 주문법 꿀팁 캡처'를 필사적으로 정독했다!",
        "결제 바코드를 미리 켜두며 '난 준비된 손님이다'라고 뇌내 최면을 걸었다."
      ],
      escapeFail: [
        "주문 취소하고 문으로 도망치려 했으나, 문 앞에 들어오려는 손님 무리와 딱 마주쳤다! (극심한 데미지)",
        "발을 헛디뎌 우산꽂이를 쓰러뜨릴 뻔했다! 카페 안의 모든 인싸들이 쳐다본다!"
      ],
      escapeSuccess: [
        "바리스타가 뒤돌아 에스프레소 머신 스팀을 뿜는 틈을 타 호흡을 골랐다!"
      ],
      guitarHero: [
        "결속밴드 리듬을 머릿속에 울리며 당당하게 외쳤다: '카페라떼 톨 사이즈, 오트 밀크로 테이크아웃이요!!'"
      ]
    }
  }
];

export interface AssistSkill {
  id: "kita" | "ryo" | "nijika";
  name: string;
  charName: string;
  avatar: string;
  costSP: number;
  description: string;
  used: boolean;
}

export const INITIAL_ASSISTS: AssistSkill[] = [
  {
    id: "kita",
    name: "키타앙~☆ 인싸 광역 섬광",
    charName: "키타 이쿠요",
    avatar: "/images/kita-chibi.png",
    costSP: 1,
    description: "인싸 오라로 점원의 눈을 멀게 하고 대신 쾌활하게 스몰토크를 나눠 진척도를 40% 올린다!",
    used: false
  },
  {
    id: "ryo",
    name: "료의 기행 & 잡초 쉴드",
    charName: "야마다 료",
    avatar: "/images/ryo-chibi.png",
    costSP: 1,
    description: "'돈 빌려줘 / 잡초 맛있어' 등의 엉뚱한 기행으로 상대를 당황시켜 2턴간 상대 공격력을 0으로 만든다!",
    used: false
  },
  {
    id: "nijika",
    name: "니지카의 대천사 케어",
    charName: "이지치 니지카",
    avatar: "/images/nijika-chibi.png",
    costSP: 1,
    description: "'봇치 짱, 괜찮아! 천천히 해!' 따뜻한 격려로 멘탈을 40 회복하고 용기 SP를 1 얻는다!",
    used: false
  }
];
