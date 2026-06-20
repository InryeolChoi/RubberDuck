(() => {
  "use strict";

  const duckWrap = document.getElementById("duckWrap");
  const bubble = document.getElementById("bubble");
  const bubbleText = document.getElementById("bubbleText");
  const form = document.getElementById("form");
  const msg = document.getElementById("msg");
  const quick = document.getElementById("quick");

  const pupils = document.querySelectorAll(".pupil");
  const glints = document.querySelectorAll(".glint");
  const lids = document.querySelectorAll(".lid");

  // ---------- 응답 대사 (멍청하지만 다정한 비서 컨셉) ----------
  const LINES = {
    cheer: [
      "넌 생각보다 훨씬 잘하고 있어. 꽥!",
      "오늘의 너, 이미 충분히 멋져. 어깨 펴!",
      "한 걸음이면 돼. 나머지는 내가 응원할게 💪",
      "실수해도 괜찮아. 나도 맨날 부리로 키보드 눌러 🦆",
      "넌 할 수 있어! 내가 보증할게. (근거는 없지만 확신은 있어)",
    ],
    todo: [
      "좋아! 제일 작고 쉬운 일부터 하나만 골라보자.",
      "딱 25분만 집중! 그다음엔 나랑 같이 쉬자 🫧",
      "할 일은 3개까지만. 욕심은 내가 대신 부려줄게.",
      "지금 당장 안 해도 되는 건 잠깐 미뤄도 돼. 꽥.",
      "끝낸 일 하나에 '참 잘했어요' 도장 쾅! 찍어줄게.",
    ],
    listen: [
      "응, 듣고 있어. 천천히 다 말해도 돼.",
      "그랬구나… 그럴 만했네. 토닥토닥.",
      "음… 꽥. (고개를 끄덕이며 진지하게 듣는 중)",
      "말하다 보면 정리될 거야. 난 여기 계속 있을게.",
      "네 얘기, 하나도 안 시시해. 더 말해줘.",
    ],
    calm: [
      "후—. 나랑 같이 숨 쉬자. 들이쉬고… 내쉬고…",
      "걱정의 90%는 안 일어난대. 나머지는 내가 막아줄게.",
      "지금 이 순간엔 아무 일도 안 일어나고 있어. 안전해.",
      "불안은 네가 약해서가 아니야. 신경 쓴다는 증거야.",
      "어깨에 힘 빼. 무거운 건 잠깐 나한테 맡겨 🦆",
    ],
    default: [
      "오, 그거 중요해 보인다. 같이 생각해보자!",
      "꽥꽥! 일단 적어둔 것만으로도 절반은 한 거야.",
      "흠흠… (다 아는 척했지만 사실 잘 모름) 그래도 응원해!",
      "좋은 고민이야. 너답게 풀어가면 돼.",
      "메모 완료! 까먹으면 내가 옆에서 꽥 해줄게.",
    ],
  };

  // 키워드로 분위기 추측
  const KEYWORDS = [
    { mood: "calm", words: ["불안", "걱정", "무서", "떨려", "긴장", "두려", "스트레스", "힘들", "지쳐", "번아웃"] },
    { mood: "todo", words: ["할 일", "해야", "마감", "todo", "일정", "정리", "계획", "업무", "과제", "데드라인"] },
    { mood: "cheer", words: ["응원", "힘내", "파이팅", "화이팅", "잘하고", "자신"] },
  ];

  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  function guessMood(text) {
    const t = text.toLowerCase();
    for (const k of KEYWORDS) {
      if (k.words.some((w) => t.includes(w))) return k.mood;
    }
    return "default";
  }

  // ---------- 말풍선 표시 ----------
  let typingTimer = null;
  function speak(text) {
    clearInterval(typingTimer);
    bubble.classList.remove("pop");
    void bubble.offsetWidth;
    bubble.classList.add("pop");
    // 타자 효과
    bubbleText.textContent = "";
    let i = 0;
    typingTimer = setInterval(() => {
      bubbleText.textContent = text.slice(0, ++i);
      if (i >= text.length) clearInterval(typingTimer);
    }, 28);
  }

  // ---------- 사운드 ----------
  let audioCtx;
  function squeak() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(680, audioCtx.currentTime);
      o.frequency.exponentialRampToValueAtTime(1400, audioCtx.currentTime + 0.08);
      o.frequency.exponentialRampToValueAtTime(560, audioCtx.currentTime + 0.2);
      g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.22, audioCtx.currentTime + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.24);
      o.connect(g).connect(audioCtx.destination);
      o.start();
      o.stop(audioCtx.currentTime + 0.25);
    } catch (_) {}
  }

  // ---------- 듣는 연출 → 대답 ----------
  let busy = false;
  function respond(mood, userText) {
    if (busy) return;
    busy = true;
    duckWrap.classList.add("listening");
    speak("음… 듣고 있어 🦆");
    const lines = LINES[mood] || LINES.default;
    setTimeout(() => {
      duckWrap.classList.remove("listening");
      duckWrap.classList.remove("nodyes");
      void duckWrap.offsetWidth;
      duckWrap.classList.add("nodyes");
      squeak();
      speak(pick(lines));
      busy = false;
    }, 1100);
  }

  // ---------- 폼 제출 ----------
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = msg.value.trim();
    if (!text) { duckClick(); return; }
    respond(guessMood(text), text);
    msg.value = "";
  });

  // 빠른 버튼
  quick.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    respond(btn.dataset.mood);
  });

  // ---------- 오리 직접 클릭 ----------
  function duckClick() {
    duckWrap.classList.remove("squeeze");
    void duckWrap.offsetWidth;
    duckWrap.classList.add("squeeze");
    squeak();
    if (!busy) speak(pick(LINES.default));
  }
  duckWrap.addEventListener("click", duckClick);

  // ---------- 눈동자 추적 ----------
  const EYES = [
    { el: pupils[0], gl: glints[0], cx: 122, cy: 118 },
    { el: pupils[1], gl: glints[1], cx: 220, cy: 116 },
  ];
  window.addEventListener("pointermove", (e) => {
    const svg = document.getElementById("duckSvg").getBoundingClientRect();
    EYES.forEach((eye) => {
      const ex = svg.left + (eye.cx / 340) * svg.width;
      const ey = svg.top + (eye.cy / 340) * svg.height;
      const ang = Math.atan2(e.clientY - ey, e.clientX - ex);
      const dist = Math.min(8, Math.hypot(e.clientX - ex, e.clientY - ey) / 22);
      const ox = Math.cos(ang) * dist, oy = Math.sin(ang) * dist;
      eye.el.setAttribute("transform", `translate(${ox} ${oy})`);
      eye.gl.setAttribute("transform", `translate(${ox * 0.6} ${oy * 0.6})`);
    });
  });

  // ---------- 깜빡임 ----------
  function blink() {
    lids.forEach((l) => {
      const x = l.getAttribute("x");
      l.setAttribute("height", "60");
      l.setAttribute("y", "88");
    });
    setTimeout(() => lids.forEach((l) => {
      l.setAttribute("height", "0");
      l.setAttribute("y", "118");
    }), 130);
  }
  (function loop() {
    setTimeout(() => { blink(); loop(); }, 2400 + Math.random() * 3200);
  })();

  // 첫 인사
  setTimeout(() => speak("안녕! 나는 꽥비서야. 오늘 뭐가 제일 신경 쓰여?"), 400);
})();
