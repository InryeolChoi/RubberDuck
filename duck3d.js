import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// ===================== 씬 기본 =====================
const canvas = document.getElementById("app");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf3dcc2);
scene.fog = new THREE.Fog(0xf3dcc2, 16, 34);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 2.6, 9);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 5.5;
controls.maxDistance = 15;
controls.maxPolarAngle = Math.PI * 0.54;
controls.target.set(0, 1.4, 0);

// ===================== 조명 =====================
scene.add(new THREE.HemisphereLight(0xfff4e0, 0xc89a66, 1.0));
const sun = new THREE.DirectionalLight(0xfff2d6, 1.5);
sun.position.set(5, 10, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { near: 1, far: 30, left: -8, right: 8, top: 8, bottom: -8 });
scene.add(sun);
const rim = new THREE.DirectionalLight(0xffd9a0, 0.5);
rim.position.set(-6, 4, -5);
scene.add(rim);

// ===================== 재질 =====================
const DUCK_COLORS = [0xffd83d, 0xff7a5c, 0x8ad6ff, 0xb6f06a, 0xe6e6e6, 0xc59cff];
let colorIdx = 0;
const bodyMat = new THREE.MeshStandardMaterial({ color: DUCK_COLORS[0], roughness: 0.4 });
const beakMat = new THREE.MeshStandardMaterial({ color: 0xff8a23, roughness: 0.45 });
const eyeMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.25 });
const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15 });
const cheekMat = new THREE.MeshStandardMaterial({ color: 0xff9db0, roughness: 0.6, transparent: true, opacity: 0.32 });
const browMat = new THREE.MeshStandardMaterial({ color: 0x6a4e00, roughness: 0.5 });

// ===================== 오리 만들기 (표독스러운 버전) =====================
const duck = new THREE.Group();

// 몸통
const body = new THREE.Mesh(new THREE.SphereGeometry(1.35, 48, 48), bodyMat);
body.scale.set(1.15, 1.0, 1.1);
body.position.y = 1.0;
body.castShadow = true;
duck.add(body);

// 작은 손(날개) — 팔짱/삿대질용
function makeHand(side) {
  const h = new THREE.Mesh(new THREE.SphereGeometry(0.42, 28, 28), bodyMat);
  h.scale.set(0.5, 0.9, 0.7);
  h.castShadow = true;
  const pivot = new THREE.Group();
  pivot.position.set(side * 1.35, 1.15, 0.2);
  h.position.set(side * 0.1, -0.2, 0);
  pivot.add(h);
  duck.add(pivot);
  return pivot;
}
const handL = makeHand(-1);
const handR = makeHand(1);

// 머리 그룹
const head = new THREE.Group();
head.position.set(0, 2.5, 0);
duck.add(head);

const headMesh = new THREE.Mesh(new THREE.SphereGeometry(1.15, 48, 48), bodyMat);
headMesh.castShadow = true;
head.add(headMesh);

// 부리 (삐딱한 비웃음)
const beak = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.05, 24), beakMat);
beak.rotation.x = Math.PI / 2;
beak.rotation.z = Math.PI + 0.14;       // 살짝 삐딱하게
beak.position.set(0.05, -0.12, 1.05);
beak.scale.set(1.2, 1, 0.7);
head.add(beak);

// 머리 위 삐죽 머리카락
const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.7, 12), bodyMat);
tuft.position.set(0, 1.15, 0);
tuft.rotation.z = -0.25;
head.add(tuft);

// 눈 (살짝 내리깐 거만한 눈)
function makeEye(xSign) {
  const g = new THREE.Group();
  const white = new THREE.Mesh(new THREE.SphereGeometry(0.34, 28, 28), whiteMat);
  white.scale.set(1, 0.78, 1);                 // 눈을 가늘게
  const black = new THREE.Mesh(new THREE.SphereGeometry(0.2, 28, 28), eyeMat);
  black.position.set(0, -0.04, 0.18);
  const glint = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), whiteMat);
  glint.position.set(0.08, 0.04, 0.3);
  // 내리깐 윗꺼풀 (몸 색)
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.36, 0.22), bodyMat);
  lid.position.set(0, 0.26, 0.16);
  lid.rotation.z = xSign * 0.42;               // 안쪽으로 치켜뜬 각
  g.add(white, black, glint, lid);
  g.position.set(xSign * 0.46, 0.3, 0.95);
  return { group: g, black };
}
const eyeL = makeEye(-1);
const eyeR = makeEye(1);
head.add(eyeL.group, eyeR.group);

// 사나운 눈썹 (안쪽이 아래로 = 화남)
function makeBrow(xSign) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.11, 0.14), browMat);
  b.position.set(xSign * 0.46, 0.66, 0.95);
  b.rotation.z = xSign * 0.5;                   // 안쪽 끝이 아래로 (찡그림)
  return b;
}
head.add(makeBrow(-1), makeBrow(1));

// 볼터치 (옅게)
function makeCheek(xSign) {
  const c = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), cheekMat);
  c.position.set(xSign * 0.8, -0.14, 0.76);
  c.rotation.y = xSign * 0.4;
  return c;
}
head.add(makeCheek(-1), makeCheek(1));

scene.add(duck);

// ===================== 책상 =====================
const desk = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 0.6, 48), new THREE.MeshStandardMaterial({ color: 0xb5763f, roughness: 0.8 }));
desk.position.y = -0.1;
desk.receiveShadow = true;
scene.add(desk);
const deskTop = new THREE.Mesh(new THREE.CircleGeometry(6, 48), new THREE.MeshStandardMaterial({ color: 0xc98a52, roughness: 0.7 }));
deskTop.rotation.x = -Math.PI / 2;
deskTop.position.y = 0.21;
deskTop.receiveShadow = true;
scene.add(deskTop);

// ===================== 투두리스트 종이 (집어던질 대상) =====================
const paper = new THREE.Group();
const sheetMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide });
const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.7), sheetMat);
sheet.castShadow = true;
paper.add(sheet);
// 빨간 헤더줄
const head1 = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.12), new THREE.MeshStandardMaterial({ color: 0xe23b3b }));
head1.position.set(0, 0.62, 0.01);
paper.add(head1);
// 체크박스 + 줄
for (let i = 0; i < 4; i++) {
  const box = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), new THREE.MeshStandardMaterial({ color: 0x888888 }));
  box.position.set(-0.45, 0.28 - i * 0.32, 0.01);
  const line = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.07), new THREE.MeshStandardMaterial({ color: 0xbbbbbb }));
  line.position.set(0.12, 0.28 - i * 0.32, 0.01);
  paper.add(box, line);
}
const REST = { pos: new THREE.Vector3(2.4, 0.26, 1.6), rot: new THREE.Euler(-Math.PI / 2 + 0.18, 0, -0.3) };
const HOLD = { pos: new THREE.Vector3(1.0, 2.35, 1.9), rot: new THREE.Euler(0.12, -0.25, 0) };
paper.position.copy(REST.pos);
paper.rotation.copy(REST.rot);
scene.add(paper);

// 주변에 떨어진(구겨진) 투두 종이들 — 클릭하면 오리가 집어들고 할 일 화면이 열림
const clickablePapers = [paper];
[[-2.7, 0.32, 1.3], [3.2, 0.32, -1.4], [-1.5, 0.32, 2.7]].forEach((p) => {
  const ball = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.3, 0),
    new THREE.MeshStandardMaterial({ color: 0xfaf6ec, roughness: 1, flatShading: true })
  );
  ball.position.set(p[0], p[1], p[2]);
  ball.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
  ball.castShadow = true;
  scene.add(ball);
  clickablePapers.push(ball);
});

let holding = false, paperThrown = false, fetching = false;

// ===================== 대사 (표독스러운 빌런 비서) =====================
const LINES = {
  rebel: [
    "그래, 하지 마! 그딴 거 안 해도 안 죽어. 꽥!",
    "하기 싫으면 안 하는 거야. 세상 안 망해.",
    "오늘 할 일? 방금 내가 다 던져버렸어. 없던 일 🗑️",
    "미루는 것도 능력이야. 넌 천재라니까.",
    "사장 오면 내가 꽥 해줄게. 넌 그냥 누워.",
  ],
  dump: [
    "투두리스트? 그게 뭔데. 방금 버렸어.",
    "다 던졌어! 책상 깨끗하지? 꽥꽥!",
    "할 일 0개. 마음의 평화 100%.",
    "걱정 마, 어차피 내일의 네가 알아서 해.",
    "버린 건 후회 안 해. 던지는 게 국룰이야.",
  ],
  excuse: [
    "오늘은 수성 역행이라 일하면 안 돼.",
    "비 올 것 같잖아. 비 오는 날은 쉬는 게 국룰.",
    "어제 너무 열심히 했어. 오늘은 보상휴가야.",
    "컨디션 난조. 의사(나)가 휴식 처방함.",
    "별자리 운세가 '움직이지 말라'고 했어.",
  ],
  roast: [
    "그렇게 미룰 거면서 왜 스트레스는 받아? 꽥.",
    "할 거야 말 거야. 어차피 또 미룰 거잖아.",
    "걱정할 시간에 5분만 해. 아님 깔끔하게 놀든가.",
    "핑계 레퍼토리 다 외웠어. 새로운 거 없니?",
    "한숨 쉴 힘으로 한 줄이라도 써. 꽥.",
  ],
  default: [
    "흥. 그래서 어쩌라고. 꽥.",
    "오~ 대단한 고민이네. (영혼 없음)",
    "그거? 안 중요해. 던져.",
    "알겠어 알겠어. 일단 누워.",
    "그 정도로 호들갑이야? 별거 아냐.",
  ],
};
const KEYWORDS = [
  { mood: "dump", words: ["던져", "버려", "다 싫", "포기", "때려치", "갈아엎", "다 관둬"] },
  { mood: "rebel", words: ["하기 싫", "하기싫", "귀찮", "못하겠", "안 할래", "안할래", "도망", "쉬고", "놀고", "눕고"] },
  { mood: "excuse", words: ["핑계", "빠지", "째", "땡땡이", "변명"] },
  { mood: "roast", words: ["팩폭", "잔소리", "혼내", "따끔", "정신", "현실"] },
];
const pick = (a) => a[(Math.random() * a.length) | 0];
function guessMood(text) {
  const t = text.toLowerCase();
  for (const k of KEYWORDS) if (k.words.some((w) => t.includes(w))) return k.mood;
  return "default";
}

// 말풍선 타자 효과
const bubble = document.getElementById("bubble");
const bubbleText = document.getElementById("bubbleText");
let typingTimer = null;
function speak(text) {
  clearInterval(typingTimer);
  bubble.classList.remove("pop"); void bubble.offsetWidth; bubble.classList.add("pop");
  bubbleText.textContent = "";
  let i = 0;
  typingTimer = setInterval(() => {
    bubbleText.textContent = text.slice(0, ++i);
    if (i >= text.length) clearInterval(typingTimer);
  }, 26);
}

// 사운드 (사나운 꽥)
let audioCtx;
function squeak(angry = true) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = angry ? "sawtooth" : "triangle";
    o.frequency.setValueAtTime(520, audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1100, audioCtx.currentTime + 0.06);
    o.frequency.exponentialRampToValueAtTime(360, audioCtx.currentTime + 0.22);
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.22, audioCtx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.26);
    o.connect(g).connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + 0.27);
  } catch (_) {}
}

// 투두리스트 집어던지기
let throwing = false, throwP = 0;
const throwDir = new THREE.Vector3();
let throwSpin = 0;
function throwList() {
  if (throwing) return;
  holding = false; closeTodo();
  throwing = true; throwP = 0;
  throwDir.set(Math.random() * 1.6 - 0.2, 0, Math.random() * 0.6 + 0.5).normalize();
  throwSpin = (Math.random() < 0.5 ? -1 : 1) * 0.5;
}

// 반응 처리
let busy = false, glare = 0, squashT = 0;
function respond(mood) {
  if (busy) return;
  busy = true; glare = 1;
  speak("하—. 또 시작이네. 꽥.");
  setTimeout(() => {
    squashT = 1;
    squeak(true);
    if (mood === "rebel" || mood === "dump") throwList();
    speak(pick(LINES[mood] || LINES.default));
    busy = false;
  }, 850);
}

document.getElementById("form").addEventListener("submit", (e) => {
  e.preventDefault();
  const v = document.getElementById("msg");
  const text = v.value.trim();
  if (!text) { squashT = 1; squeak(true); return; }
  respond(guessMood(text));
  v.value = "";
});
document.getElementById("quick").addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if (btn && btn.dataset.mood) respond(btn.dataset.mood);
});
document.getElementById("colorBtn").addEventListener("click", () => {
  colorIdx = (colorIdx + 1) % DUCK_COLORS.length;
  bodyMat.color.setHex(DUCK_COLORS[colorIdx]);
});

// ===================== 투두리스트 (생산성) =====================
const STORE_KEY = "worryduck_todos";
let todos = [];
try { todos = JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch (_) { todos = []; }
const todoModal = document.getElementById("todoModal");
const todoListEl = document.getElementById("todoList");
const todoCountEl = document.getElementById("todoCount");
const todoBtn = document.getElementById("todoBtn");

function saveTodos() { try { localStorage.setItem(STORE_KEY, JSON.stringify(todos)); } catch (_) {} }
function remaining() { return todos.filter((t) => !t.done).length; }
function renderTodos() {
  todoListEl.innerHTML = "";
  if (todos.length === 0) {
    const li = document.createElement("li");
    li.className = "todo-empty";
    li.textContent = "할 일이 없어! …진짜 없는 거 맞아? 🦆";
    todoListEl.appendChild(li);
  } else {
    todos.forEach((t, idx) => {
      const li = document.createElement("li");
      if (t.done) li.classList.add("done");
      const chk = document.createElement("div");
      chk.className = "chk"; chk.textContent = t.done ? "✓" : "";
      chk.onclick = () => { t.done = !t.done; saveTodos(); renderTodos(); };
      const txt = document.createElement("div");
      txt.className = "txt"; txt.textContent = t.text;
      const del = document.createElement("button");
      del.className = "del"; del.textContent = "×";
      del.onclick = () => { todos.splice(idx, 1); saveTodos(); renderTodos(); };
      li.append(chk, txt, del);
      todoListEl.appendChild(li);
    });
  }
  const r = remaining();
  todoCountEl.textContent = `${r}개 남음`;
  updateTodoBtn();
}

function updateTodoBtn() {
  if (paperThrown) { todoBtn.textContent = "🪃 주워오기"; return; }
  const r = remaining();
  todoBtn.textContent = r > 0 ? `할 일 보기 (${r}) 📋` : "할 일 보기 📋";
}

// 날아간 투두리스트 주워오기 (잠깐 사라졌다가 다시 등장)
function fetchPaper() {
  if (!paperThrown || fetching) return;
  fetching = true;
  if (!busy) speak("에휴… 알겠어, 주워올게. 꽥.");
  squashT = 1;
  setTimeout(() => {                 // 잠깐 사라졌다가
    paper.position.copy(REST.pos);
    paper.position.y += 1.6;         // 위에서 툴 떨어지며 복귀
    paper.rotation.copy(REST.rot);
    sheetMat.opacity = 1; sheetMat.transparent = false;
    paper.visible = true;
    paperThrown = false; fetching = false;
    updateTodoBtn();
    setTimeout(() => { if (!paperThrown) openTodo(); }, 650);
  }, 700);
}

function openTodo() {
  if (paperThrown) { fetchPaper(); return; }   // 던져졌으면 먼저 주워오기
  holding = true;
  if (!busy) speak("굳이 보겠다고? …알았어, 집어줄게. 꽥.");
  setTimeout(() => {
    renderTodos();
    todoModal.hidden = false;
    document.getElementById("todoInput").focus();
  }, 480);
}
function closeTodo() {
  if (todoModal.hidden) return;
  todoModal.hidden = true;
  holding = false;
}

document.getElementById("todoForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("todoInput");
  const v = input.value.trim();
  if (!v) return;
  todos.push({ text: v, done: false });
  saveTodos(); renderTodos();
  input.value = "";
});
document.getElementById("todoClose").addEventListener("click", closeTodo);
todoModal.addEventListener("click", (e) => { if (e.target === todoModal) closeTodo(); });
document.getElementById("todoClear").addEventListener("click", () => {
  todos = todos.filter((t) => !t.done); saveTodos(); renderTodos();
});
todoBtn.addEventListener("click", openTodo);
addEventListener("keydown", (e) => { if (e.key === "Escape") closeTodo(); });
renderTodos();

// ===================== 음성 입력 =====================
function setupMic(btn, input, onFinal) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR || !btn) { if (btn) btn.style.display = "none"; return; }
  const rec = new SR();
  rec.lang = "ko-KR";
  rec.interimResults = true;
  rec.continuous = false;
  let active = false;
  btn.addEventListener("click", () => {
    if (active) { rec.stop(); return; }
    try { rec.start(); } catch (_) {}
  });
  rec.onstart = () => { active = true; btn.classList.add("rec"); };
  rec.onend = () => { active = false; btn.classList.remove("rec"); };
  rec.onerror = () => { active = false; btn.classList.remove("rec"); };
  rec.onresult = (e) => {
    let txt = "";
    for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
    input.value = txt;
    const last = e.results[e.results.length - 1];
    if (last.isFinal && onFinal) onFinal(txt.trim());
  };
}
setupMic(document.getElementById("micMsg"), document.getElementById("msg"), (txt) => {
  if (txt) { respond(guessMood(txt)); document.getElementById("msg").value = ""; }
});
setupMic(document.getElementById("micTodo"), document.getElementById("todoInput"), (txt) => {
  if (txt) { todos.push({ text: txt, done: false }); saveTodos(); renderTodos(); document.getElementById("todoInput").value = ""; }
});

// ===================== 클릭 / 시선 =====================
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downPos = null;
canvas.addEventListener("pointerdown", (e) => (downPos = { x: e.clientX, y: e.clientY }));
canvas.addEventListener("pointerup", (e) => {
  if (!downPos) return;
  const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
  downPos = null;
  if (moved > 6) return;
  pointer.x = (e.clientX / innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  // 떨어진 투두 종이 클릭 → 오리가 집어 들고 할 일 화면 열기
  if (raycaster.intersectObjects(clickablePapers, true).length > 0) {
    squashT = 1; squeak(true);
    openTodo();
    return;
  }
  if (raycaster.intersectObject(duck, true).length > 0) {
    squashT = 1; glare = 1; squeak(true);
    if (!busy) speak(pick(LINES.default));
  }
});

const lookTarget = new THREE.Vector2(0, 0);
addEventListener("pointermove", (e) => {
  lookTarget.x = (e.clientX / innerWidth) * 2 - 1;
  lookTarget.y = -(e.clientY / innerHeight) * 2 + 1;
});

// ===================== 리사이즈 =====================
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

// ===================== 애니메이션 =====================
const clock = new THREE.Clock();
function animate() {
  const t = clock.getElapsedTime();

  // 둥실 (살짝 거만하게 흔들)
  duck.position.y = Math.sin(t * 1.5) * 0.1;
  duck.rotation.z = Math.sin(t * 1.5) * 0.025;

  // 머리: 평소 까딱 / 글레어(쏘아보기) 시 홱
  if (glare > 0) glare = Math.max(0, glare - 0.02);
  const glareTilt = Math.sin(glare * Math.PI) * 0.12;
  head.rotation.z = Math.sin(t * 1.5) * 0.04 - glareTilt;
  head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, lookTarget.x * 0.4, 0.06);
  head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, -lookTarget.y * 0.12 + glare * 0.1, 0.06);

  // 눈동자 추적
  const lx = lookTarget.x * 0.07, ly = lookTarget.y * 0.06;
  [eyeL, eyeR].forEach((e) => { e.black.position.x = lx; e.black.position.y = -0.04 + ly; });

  // 손: 평소 깐족 / 던질 때 휙
  const hf = throwing ? Math.sin(throwP * Math.PI) * 1.3 : Math.sin(t * 1.5) * 0.16;
  handL.rotation.z = 0.2 + Math.sin(t * 1.5) * 0.16;
  handR.rotation.z = -0.2 - hf;
  if (holding && !throwing) handR.rotation.z = THREE.MathUtils.lerp(handR.rotation.z, -1.05, 0.15);

  // 끄덕/말랑
  if (squashT > 0) {
    squashT = Math.max(0, squashT - 0.04);
    const s = Math.sin(squashT * Math.PI) * 0.15;
    body.scale.set(1.15 + s, 1.0 - s, 1.1 + s);
    head.position.y = 2.5 - Math.sin(squashT * Math.PI) * 0.16;
  } else {
    body.scale.set(1.15, 1.0, 1.1);
    head.position.y = 2.5;
  }

  // 투두리스트 날아가기
  if (throwing) {
    throwP = Math.min(1, throwP + 0.022);
    const p = throwP;
    paper.position.set(
      REST.pos.x + throwDir.x * p * 8,
      REST.pos.y + Math.sin(p * Math.PI) * 4 + p * 1.5,
      REST.pos.z + throwDir.z * p * 5
    );
    paper.rotation.z += throwSpin;
    paper.rotation.x += throwSpin * 0.6;
    sheetMat.opacity = p > 0.55 ? Math.max(0, 1 - (p - 0.55) / 0.45) : 1;
    sheetMat.transparent = true;
    if (p >= 1) {                 // 던져버려서 화면에서 완전히 사라짐
      throwing = false; throwP = 0;
      paper.visible = false;
      paperThrown = true;
      closeTodo();
      updateTodoBtn();
    }
  } else if (!paperThrown) {
    // 평소: 집어들면 손 위로, 아니면 책상으로 슬근 복귀
    const goal = holding ? HOLD : REST;
    paper.position.lerp(goal.pos, 0.15);
    paper.rotation.x += (goal.rot.x - paper.rotation.x) * 0.15;
    paper.rotation.y += (goal.rot.y - paper.rotation.y) * 0.15;
    paper.rotation.z += (goal.rot.z - paper.rotation.z) * 0.15;
  }

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

// 첫 인사
setTimeout(() => speak("왔어? 오늘은 또 뭐가 그렇게 하기 싫어서 왔니. 말해봐. 꽥."), 500);
