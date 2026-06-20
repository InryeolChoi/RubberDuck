import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { getDuckReply } from "../lib/duckApi";
import { type Mood, pickLine } from "../lib/persona";
import { WEATHER_PALETTES, type WeatherCategory } from "../lib/weather";

export interface DuckHandle {
  /** 입력/칩에 반응 — 노려보기→말랑→꽥, rebel/dump면 투두 종이 집어던지기 */
  respond: (mood: Mood, message?: string) => void;
  /** 투두 종이를 집어들고(또는 던졌으면 주워와서) 할 일 화면 열기 */
  requestOpen: () => void;
  /** 투두 종이 집어던지기 */
  throwList: () => void;
  /** 몸 색 순환 */
  nextColor: () => void;
  /** 말랑 + 꽥 */
  bounce: () => void;
  /** 할 일 화면 닫을 때: 종이를 책상으로 되돌림 */
  goHome: () => void;
  /** 던져진 상태 여부 */
  isThrown: () => boolean;
}

interface DuckCanvasProps {
  className?: string;
  /** 작은 위젯(좌하단) 모드 */
  compact?: boolean;
  /** 날씨에 따른 배경 카테고리 */
  weather?: WeatherCategory;
  onSpeak?: (text: string) => void;
  onOpenTodo?: () => void;
  onThrownChange?: (thrown: boolean) => void;
}

const DUCK_COLORS = [0xffd83d, 0xff7a5c, 0x8ad6ff, 0xb6f06a, 0xe6e6e6, 0xc59cff];

const DuckCanvas = forwardRef<DuckHandle, DuckCanvasProps>(
  ({ className, compact, weather, onSpeak, onOpenTodo, onThrownChange }, ref) => {
    const mountRef = useRef<HTMLDivElement>(null);
    const apiRef = useRef<DuckHandle | null>(null);
    const compactRef = useRef(!!compact);
    const weatherRef = useRef<WeatherCategory>(weather ?? "clear");

    // 콜백을 ref에 보관(마운트 1회 effect 안에서 최신 값 사용)
    const onSpeakRef = useRef(onSpeak);
    const onOpenTodoRef = useRef(onOpenTodo);
    const onThrownChangeRef = useRef(onThrownChange);
    onSpeakRef.current = onSpeak;
    onOpenTodoRef.current = onOpenTodo;
    onThrownChangeRef.current = onThrownChange;

    useEffect(() => {
      compactRef.current = !!compact;
    }, [compact]);

    useEffect(() => {
      if (weather) weatherRef.current = weather;
    }, [weather]);

    useImperativeHandle(ref, () => ({
      respond: (mood, message) => apiRef.current?.respond(mood, message),
      requestOpen: () => apiRef.current?.requestOpen(),
      throwList: () => apiRef.current?.throwList(),
      nextColor: () => apiRef.current?.nextColor(),
      bounce: () => apiRef.current?.bounce(),
      goHome: () => apiRef.current?.goHome(),
      isThrown: () => apiRef.current?.isThrown() ?? false,
    }));

    useEffect(() => {
      const mount = mountRef.current;
      if (!mount) return;

      // ===================== 씬 기본 =====================
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.domElement.style.display = "block";
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf3dcc2);
      scene.fog = new THREE.Fog(0xf3dcc2, 16, 34);

      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      camera.position.set(0, 2.6, 9);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = 5.5;
      controls.maxDistance = 15;
      controls.maxPolarAngle = Math.PI * 0.54;
      controls.target.set(0, 1.4, 0);

      // ===================== 조명 =====================
      const hemi = new THREE.HemisphereLight(0xfff4e0, 0xc89a66, 1.0);
      scene.add(hemi);
      const sun = new THREE.DirectionalLight(0xfff2d6, 1.5);
      sun.position.set(5, 10, 6);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      Object.assign(sun.shadow.camera, { near: 1, far: 30, left: -8, right: 8, top: 8, bottom: -8 });
      scene.add(sun);
      const rim = new THREE.DirectionalLight(0xffd9a0, 0.5);
      rim.position.set(-6, 4, -5);
      scene.add(rim);

      // ===================== 강수 입자(비/눈) =====================
      // 어둡게 만드는 대신, 날씨를 떨어지는 오브젝트로 표현한다.
      const PRECIP_AREA = { x: 13, yTop: 16, yBottom: -1, z: 9 };
      const makePrecip = (count: number, size: number, color: number, opacity: number) => {
        const positions = new Float32Array(count * 3);
        const speeds = new Float32Array(count);
        for (let i = 0; i < count; i++) {
          positions[i * 3] = (Math.random() - 0.5) * PRECIP_AREA.x * 2;
          positions[i * 3 + 1] = Math.random() * (PRECIP_AREA.yTop - PRECIP_AREA.yBottom) + PRECIP_AREA.yBottom;
          positions[i * 3 + 2] = (Math.random() - 0.5) * PRECIP_AREA.z * 2;
          speeds[i] = 0.6 + Math.random() * 0.8;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.PointsMaterial({
          color,
          size,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          sizeAttenuation: true,
        });
        const pts = new THREE.Points(geo, mat);
        pts.frustumCulled = false;
        pts.userData.speeds = speeds;
        pts.userData.targetOpacity = opacity;
        scene.add(pts);
        return pts;
      };
      const rain = makePrecip(700, 0.09, 0xbcd2e6, 0.55);
      const snow = makePrecip(450, 0.16, 0xffffff, 0.9);

      // ===================== 재질 =====================
      let colorIdx = 0;
      const bodyMat = new THREE.MeshStandardMaterial({ color: DUCK_COLORS[0], roughness: 0.4 });
      const beakMat = new THREE.MeshStandardMaterial({ color: 0xff8a23, roughness: 0.45 });
      const eyeMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.25 });
      const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15 });
      const cheekMat = new THREE.MeshStandardMaterial({ color: 0xff9db0, roughness: 0.6, transparent: true, opacity: 0.32 });
      const browMat = new THREE.MeshStandardMaterial({ color: 0x6a4e00, roughness: 0.5 });

      // ===================== 오리 (표독스러운 버전) =====================
      const duck = new THREE.Group();

      const body = new THREE.Mesh(new THREE.SphereGeometry(1.35, 48, 48), bodyMat);
      body.scale.set(1.15, 1.0, 1.1);
      body.position.y = 1.0;
      body.castShadow = true;
      duck.add(body);

      const makeHand = (side: number) => {
        const h = new THREE.Mesh(new THREE.SphereGeometry(0.42, 28, 28), bodyMat);
        h.scale.set(0.5, 0.9, 0.7);
        h.castShadow = true;
        const pivot = new THREE.Group();
        pivot.position.set(side * 1.35, 1.15, 0.2);
        h.position.set(side * 0.1, -0.2, 0);
        pivot.add(h);
        duck.add(pivot);
        return pivot;
      };
      const handL = makeHand(-1);
      const handR = makeHand(1);

      const head = new THREE.Group();
      head.position.set(0, 2.5, 0);
      duck.add(head);

      const headMesh = new THREE.Mesh(new THREE.SphereGeometry(1.15, 48, 48), bodyMat);
      headMesh.castShadow = true;
      head.add(headMesh);

      const beak = new THREE.Group();
      // 윗부리: 넓고 납작하게
      const upperBill = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 24), beakMat);
      upperBill.scale.set(1.5, 0.4, 1.2);
      upperBill.position.set(0, 0, 0.35);
      upperBill.castShadow = true;
      beak.add(upperBill);
      // 아랫부리: 살짝 짧고 얇게 (사이에 입선)
      const lowerBill = new THREE.Mesh(new THREE.SphereGeometry(0.46, 32, 24), beakMat);
      lowerBill.scale.set(1.28, 0.3, 1.0);
      lowerBill.position.set(0, -0.19, 0.3);
      beak.add(lowerBill);
      // 콧구멍 2개
      const nostrilGeo = new THREE.SphereGeometry(0.045, 12, 12);
      [-0.17, 0.17].forEach((nx) => {
        const n = new THREE.Mesh(nostrilGeo, eyeMat);
        n.position.set(nx, 0.15, 0.45);
        beak.add(n);
      });
      beak.position.set(0, -0.1, 0.98);
      head.add(beak);

      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.7, 12), bodyMat);
      tuft.position.set(0, 1.15, 0);
      tuft.rotation.z = -0.25;
      head.add(tuft);

      const makeEye = (xSign: number) => {
        const g = new THREE.Group();
        const white = new THREE.Mesh(new THREE.SphereGeometry(0.34, 28, 28), whiteMat);
        white.scale.set(1, 0.78, 1);
        const black = new THREE.Mesh(new THREE.SphereGeometry(0.2, 28, 28), eyeMat);
        black.position.set(0, -0.04, 0.18);
        const glint = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), whiteMat);
        glint.position.set(0.08, 0.04, 0.3);
        const lid = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.36, 0.22), bodyMat);
        lid.position.set(0, 0.26, 0.16);
        lid.rotation.z = xSign * 0.42;
        g.add(white, black, glint, lid);
        g.position.set(xSign * 0.46, 0.3, 0.95);
        return { group: g, black };
      };
      const eyeL = makeEye(-1);
      const eyeR = makeEye(1);
      head.add(eyeL.group, eyeR.group);

      const makeBrow = (xSign: number) => {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.11, 0.14), browMat);
        b.position.set(xSign * 0.46, 0.66, 0.95);
        b.rotation.z = xSign * 0.5;
        return b;
      };
      head.add(makeBrow(-1), makeBrow(1));

      const makeCheek = (xSign: number) => {
        const c = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), cheekMat);
        c.position.set(xSign * 0.8, -0.14, 0.76);
        c.rotation.y = xSign * 0.4;
        return c;
      };
      head.add(makeCheek(-1), makeCheek(1));

      scene.add(duck);

      // ===================== 욕조 + 물 (오리가 떠 있는 바닥) =====================
      // 나무 책상 대신, 러버덕에 어울리는 욕조와 물로 표현.
      const tub = new THREE.Mesh(
        new THREE.CylinderGeometry(6, 5.4, 0.9, 56),
        new THREE.MeshStandardMaterial({ color: 0xf3f6fa, roughness: 0.5, metalness: 0.05 })
      );
      tub.position.y = -0.25;
      tub.receiveShadow = true;
      scene.add(tub);

      // 욕조 테두리(흰 도자기 링)
      const tubRim = new THREE.Mesh(
        new THREE.TorusGeometry(5.85, 0.22, 16, 64),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.1 })
      );
      tubRim.rotation.x = -Math.PI / 2;
      tubRim.position.y = 0.26;
      tubRim.receiveShadow = true;
      tubRim.castShadow = true;
      scene.add(tubRim);

      // 물 표면 (옅은 파랑)
      const waterMat = new THREE.MeshStandardMaterial({
        color: 0xbfe6f5,
        roughness: 0.16,
        metalness: 0.28,
        transparent: true,
        opacity: 0.82,
      });
      const water = new THREE.Mesh(new THREE.CircleGeometry(5.8, 64), waterMat);
      water.rotation.x = -Math.PI / 2;
      water.position.y = 0.14;
      water.receiveShadow = true;
      scene.add(water);

      // 수면 잔물결(확장하며 사라지는 링) — 비 올 때 더 활발해진다.
      const rippleGeo = new THREE.RingGeometry(0.5, 0.82, 48);
      const ripples: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; speed: number }[] = [];
      for (let i = 0; i < 9; i++) {
        const mat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const m = new THREE.Mesh(rippleGeo, mat);
        m.rotation.x = -Math.PI / 2;
        m.position.y = 0.17;
        const reset = () => {
          const ang = Math.random() * Math.PI * 2;
          const dist = Math.random() * 4.4;
          m.position.x = Math.cos(ang) * dist;
          m.position.z = Math.sin(ang) * dist;
        };
        reset();
        m.userData.reset = reset;
        m.userData.offset = Math.random() * 1.8;
        m.userData.prevLife = 0;
        scene.add(m);
        ripples.push({ mesh: m, mat, speed: 0.5 + Math.random() * 0.45 });
      }

      // 물에 떠 있는 비누 거품 몇 개
      const bubbleMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.1,
        metalness: 0.1,
        transparent: true,
        opacity: 0.5,
      });
      for (let i = 0; i < 7; i++) {
        const r = 0.18 + Math.random() * 0.22;
        const ang = Math.random() * Math.PI * 2;
        const dist = 2.6 + Math.random() * 2.6;
        const bubble = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 16), bubbleMat);
        bubble.position.set(Math.cos(ang) * dist, 0.16 + r * 0.4, Math.sin(ang) * dist);
        bubble.scale.y = 0.6;
        scene.add(bubble);
      }

      // ===================== 투두리스트 종이 (집어던질 대상) =====================
      const paper = new THREE.Group();
      const sheetMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide });
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.7), sheetMat);
      sheet.castShadow = true;
      paper.add(sheet);
      const head1 = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.12), new THREE.MeshStandardMaterial({ color: 0xe23b3b }));
      head1.position.set(0, 0.62, 0.01);
      paper.add(head1);
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

      // 주변에 떨어진(구겨진) 투두 종이들 — 클릭하면 오리가 집어들고 할 일 화면 열림
      const clickablePapers: THREE.Object3D[] = [paper];
      ([[-2.7, 0.32, 1.3], [3.2, 0.32, -1.4], [-1.5, 0.32, 2.7]] as const).forEach((p) => {
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

      // ===================== 상태 =====================
      let holding = false;
      let paperThrown = false;
      let fetching = false;
      let throwing = false;
      let throwP = 0;
      let throwSpin = 0;
      const throwDir = new THREE.Vector3();
      let busy = false;
      let glare = 0;
      let squashT = 0;

      const setThrown = (v: boolean) => {
        paperThrown = v;
        onThrownChangeRef.current?.(v);
      };

      // 말풍선(타자효과는 App에서) — 여기선 전체 문장 전달
      const speak = (text: string) => onSpeakRef.current?.(text);

      // 사운드 (사나운 꽥)
      let audioCtx: AudioContext | null = null;
      const squeak = (angry = true) => {
        try {
          audioCtx = audioCtx || new AudioContext();
          const ctx = audioCtx;
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = angry ? "sawtooth" : "triangle";
          o.frequency.setValueAtTime(520, ctx.currentTime);
          o.frequency.exponentialRampToValueAtTime(1100, ctx.currentTime + 0.06);
          o.frequency.exponentialRampToValueAtTime(360, ctx.currentTime + 0.22);
          g.gain.setValueAtTime(0.0001, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.26);
          o.connect(g).connect(ctx.destination);
          o.start();
          o.stop(ctx.currentTime + 0.27);
        } catch {
          /* 오디오 미지원 무시 */
        }
      };

      // 투두리스트 집어던지기
      const throwList = () => {
        if (throwing) return;
        holding = false;
        throwing = true;
        throwP = 0;
        throwDir.set(Math.random() * 1.6 - 0.2, 0, Math.random() * 0.6 + 0.5).normalize();
        throwSpin = (Math.random() < 0.5 ? -1 : 1) * 0.5;
      };

      // 날아간 투두리스트 주워오기
      const fetchPaper = () => {
        if (!paperThrown || fetching) return;
        fetching = true;
        if (!busy) speak("에휴… 알겠어, 주워올게. 꽥.");
        squashT = 1;
        window.setTimeout(() => {
          paper.position.copy(REST.pos);
          paper.position.y += 1.6;
          paper.rotation.copy(REST.rot);
          sheetMat.opacity = 1;
          sheetMat.transparent = false;
          paper.visible = true;
          setThrown(false);
          fetching = false;
          window.setTimeout(() => {
            if (!paperThrown) onOpenTodoRef.current?.();
          }, 650);
        }, 700);
      };

      // 할 일 열기(집어드는 연출)
      const requestOpen = () => {
        if (paperThrown) {
          fetchPaper();
          return;
        }
        holding = true;
        if (!busy) speak("굳이 보겠다고? …알았어, 집어줄게. 꽥.");
        window.setTimeout(() => onOpenTodoRef.current?.(), 480);
      };

      // 반응 처리
      const respond = (mood: Mood, message?: string) => {
        if (busy) return;
        busy = true;
        glare = 1;
        speak("하—. 또 시작이네. 꽥.");
        window.setTimeout(async () => {
          squashT = 1;
          squeak(true);
          if (mood === "rebel" || mood === "dump") throwList();
          const reply = message ? await getDuckReply(message, mood) : pickLine(mood);
          speak(reply);
          busy = false;
        }, 850);
      };

      const nextColor = () => {
        colorIdx = (colorIdx + 1) % DUCK_COLORS.length;
        bodyMat.color.setHex(DUCK_COLORS[colorIdx]);
      };

      const bounce = () => {
        squashT = 1;
        squeak(true);
      };

      const goHome = () => {
        holding = false;
      };

      apiRef.current = {
        respond,
        requestOpen,
        throwList,
        nextColor,
        bounce,
        goHome,
        isThrown: () => paperThrown,
      };

      // ===================== 클릭 / 시선 =====================
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let downPos: { x: number; y: number } | null = null;

      const relCoords = (clientX: number, clientY: number) => {
        const rect = renderer.domElement.getBoundingClientRect();
        return {
          x: ((clientX - rect.left) / rect.width) * 2 - 1,
          y: -((clientY - rect.top) / rect.height) * 2 + 1,
        };
      };

      const onPointerDown = (e: PointerEvent) => {
        downPos = { x: e.clientX, y: e.clientY };
      };
      const onPointerUp = (e: PointerEvent) => {
        if (!downPos) return;
        const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
        downPos = null;
        if (moved > 6) return;
        const c = relCoords(e.clientX, e.clientY);
        pointer.set(c.x, c.y);
        raycaster.setFromCamera(pointer, camera);
        if (raycaster.intersectObjects(clickablePapers, true).length > 0) {
          squashT = 1;
          squeak(true);
          requestOpen();
          return;
        }
        if (raycaster.intersectObject(duck, true).length > 0) {
          squashT = 1;
          glare = 1;
          squeak(true);
          if (!busy) speak(pickLine("default"));
        }
      };
      renderer.domElement.addEventListener("pointerdown", onPointerDown);
      renderer.domElement.addEventListener("pointerup", onPointerUp);

      const lookTarget = new THREE.Vector2(0, 0);
      const onPointerMove = (e: PointerEvent) => {
        const c = relCoords(e.clientX, e.clientY);
        lookTarget.set(c.x, c.y);
      };
      window.addEventListener("pointermove", onPointerMove);

      // ===================== 리사이즈 =====================
      const resize = () => {
        const w = mount.clientWidth || 1;
        const h = mount.clientHeight || 1;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      const ro = new ResizeObserver(resize);
      ro.observe(mount);
      resize();

      // ===================== 애니메이션 =====================
      // compact(할 일) 모드: 오리를 정면으로 보면서 화면 왼쪽 아래에 작게 배치
      const FRONT_CAM = new THREE.Vector3(0, 1.95, 7.2);
      const FRONT_TGT = new THREE.Vector3(0, 1.7, 0);
      let hadViewOffset = false;
      const clock = new THREE.Clock();
      let raf = 0;
      const tmpCol = new THREE.Color();
      const animate = () => {
        const t = clock.getElapsedTime();

        // 날씨에 따른 배경/안개/조명 톤 부드럽게 전환
        const pal = WEATHER_PALETTES[weatherRef.current];
        (scene.background as THREE.Color).lerp(tmpCol.setHex(pal.background), 0.05);
        if (scene.fog) scene.fog.color.lerp(tmpCol.setHex(pal.fog), 0.05);
        hemi.color.lerp(tmpCol.setHex(pal.hemiSky), 0.05);
        hemi.groundColor.lerp(tmpCol.setHex(pal.hemiGround), 0.05);
        sun.color.lerp(tmpCol.setHex(pal.sun), 0.05);
        sun.intensity += (pal.sunIntensity - sun.intensity) * 0.05;

        // 강수 입자 업데이트: 비/뇌우 → 비, 눈 → 눈. 그 외엔 서서히 사라짐.
        const cat = weatherRef.current;
        const rainOn = cat === "rain" || cat === "storm";
        const snowOn = cat === "snow";
        const rainMat = rain.material as THREE.PointsMaterial;
        const snowMat = snow.material as THREE.PointsMaterial;
        rainMat.opacity += ((rainOn ? rain.userData.targetOpacity : 0) - rainMat.opacity) * 0.06;
        snowMat.opacity += ((snowOn ? snow.userData.targetOpacity : 0) - snowMat.opacity) * 0.06;
        rain.visible = rainMat.opacity > 0.01;
        snow.visible = snowMat.opacity > 0.01;
        if (rain.visible) {
          const p = rain.geometry.attributes.position as THREE.BufferAttribute;
          const arr = p.array as Float32Array;
          const sp = rain.userData.speeds as Float32Array;
          const fast = cat === "storm" ? 1.5 : 1;
          for (let i = 0; i < sp.length; i++) {
            arr[i * 3 + 1] -= sp[i] * 0.22 * fast;
            arr[i * 3] -= 0.022 * fast;
            if (arr[i * 3 + 1] < PRECIP_AREA.yBottom) {
              arr[i * 3 + 1] = PRECIP_AREA.yTop;
              arr[i * 3] = (Math.random() - 0.5) * PRECIP_AREA.x * 2;
            }
          }
          p.needsUpdate = true;
        }
        if (snow.visible) {
          const p = snow.geometry.attributes.position as THREE.BufferAttribute;
          const arr = p.array as Float32Array;
          const sp = snow.userData.speeds as Float32Array;
          for (let i = 0; i < sp.length; i++) {
            arr[i * 3 + 1] -= sp[i] * 0.07;
            arr[i * 3] += Math.sin(t * 0.8 + i) * 0.012;
            if (arr[i * 3 + 1] < PRECIP_AREA.yBottom) {
              arr[i * 3 + 1] = PRECIP_AREA.yTop;
              arr[i * 3] = (Math.random() - 0.5) * PRECIP_AREA.x * 2;
            }
          }
          p.needsUpdate = true;
        }

        // 수면 잔물결: 링이 퍼지며 사라지고, 비/뇌우 땐 더 또렷하게.
        const rippleStrength = rainOn ? 0.95 : 0.6;
        const RIPPLE_CYCLE = 1.9;
        for (const r of ripples) {
          const life = ((t * r.speed + r.mesh.userData.offset) % RIPPLE_CYCLE) / RIPPLE_CYCLE;
          if (life < (r.mesh.userData.prevLife as number)) (r.mesh.userData.reset as () => void)();
          r.mesh.userData.prevLife = life;
          const s = 0.3 + life * 1.9;
          r.mesh.scale.set(s, s, s);
          r.mat.opacity = (1 - life) * rippleStrength;
        }

        duck.position.y = Math.sin(t * 1.5) * 0.1;
        duck.rotation.z = Math.sin(t * 1.5) * 0.025;

        if (glare > 0) glare = Math.max(0, glare - 0.02);
        const glareTilt = Math.sin(glare * Math.PI) * 0.12;
        head.rotation.z = Math.sin(t * 1.5) * 0.04 - glareTilt;
        head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, lookTarget.x * 0.4, 0.06);
        head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, -lookTarget.y * 0.12 + glare * 0.1, 0.06);

        const lx = lookTarget.x * 0.07;
        const ly = lookTarget.y * 0.06;
        [eyeL, eyeR].forEach((e) => {
          e.black.position.x = lx;
          e.black.position.y = -0.04 + ly;
        });

        const hf = throwing ? Math.sin(throwP * Math.PI) * 1.3 : Math.sin(t * 1.5) * 0.16;
        handL.rotation.z = 0.2 + Math.sin(t * 1.5) * 0.16;
        handR.rotation.z = -0.2 - hf;
        if (holding && !throwing) handR.rotation.z = THREE.MathUtils.lerp(handR.rotation.z, -1.05, 0.15);

        if (squashT > 0) {
          squashT = Math.max(0, squashT - 0.04);
          const s = Math.sin(squashT * Math.PI) * 0.15;
          body.scale.set(1.15 + s, 1.0 - s, 1.1 + s);
          head.position.y = 2.5 - Math.sin(squashT * Math.PI) * 0.16;
        } else {
          body.scale.set(1.15, 1.0, 1.1);
          head.position.y = 2.5;
        }

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
          if (p >= 1) {
            throwing = false;
            throwP = 0;
            paper.visible = false;
            setThrown(true);
          }
        } else if (!paperThrown) {
          const goal = holding ? HOLD : REST;
          paper.position.lerp(goal.pos, 0.15);
          paper.rotation.x += (goal.rot.x - paper.rotation.x) * 0.15;
          paper.rotation.y += (goal.rot.y - paper.rotation.y) * 0.15;
          paper.rotation.z += (goal.rot.z - paper.rotation.z) * 0.15;
        }

        // 카메라: 일반(오빗) vs 위젯(정면·왼쪽 아래로 작게)
        if (compactRef.current) {
          controls.enabled = false;
          camera.position.lerp(FRONT_CAM, 0.12);
          controls.target.lerp(FRONT_TGT, 0.12);
          const cw = mount.clientWidth || 1;
          const ch = mount.clientHeight || 1;
          const F = 1.95; // 클수록 더 작게(줌아웃) — 오리를 더 작게
          // 오리(화면 중앙 투영)를 좌하단으로 옮기기 위한 뷰 오프셋
          camera.setViewOffset(F * cw, F * ch, cw * (F / 2 - 0.13), ch * (F / 2 - 0.74), cw, ch);
          camera.lookAt(controls.target);
          hadViewOffset = true;
        } else {
          controls.enabled = true;
          if (hadViewOffset) {
            camera.clearViewOffset();
            hadViewOffset = false;
          }
          controls.update();
        }

        renderer.render(scene, camera);
        raf = requestAnimationFrame(animate);
      };
      animate();

      // ===================== 정리 =====================
      return () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        controls.dispose();
        renderer.domElement.removeEventListener("pointerdown", onPointerDown);
        renderer.domElement.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointermove", onPointerMove);
        renderer.dispose();
        scene.traverse((obj) => {
          const m = obj as THREE.Mesh;
          if (m.geometry) m.geometry.dispose();
          const mat = m.material as THREE.Material | THREE.Material[] | undefined;
          if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
          else mat?.dispose();
        });
        if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
        apiRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <div ref={mountRef} className={className} />;
  }
);

DuckCanvas.displayName = "DuckCanvas";
export default DuckCanvas;
