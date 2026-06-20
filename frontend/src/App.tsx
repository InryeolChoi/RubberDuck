import { useEffect, useRef, useState } from "react";
import DuckCanvas, { type DuckHandle } from "./components/DuckCanvas";
import TodoView from "./components/TodoView";
import { guessMood, type Mood } from "./lib/persona";
import { useTodos } from "./lib/useTodos";
import { fetchWeather, type WeatherInfo } from "./lib/weather";
import WeatherCard from "./components/WeatherCard";
import "./App.css";

type View = "home" | "todo";

const CHIPS: { label: string; mood: Mood }[] = [
  { label: "하기 싫어 😤", mood: "rebel" },
  { label: "다 던져버려 🗑️", mood: "dump" },
  { label: "핑계 대줘 😏", mood: "excuse" },
  { label: "팩폭 해줘 🔥", mood: "roast" },
];

const GREETING = "왔어? 오늘은 또 뭐가 그렇게 하기 싫어서 왔니. 말해봐. 꽥.";

export default function App() {
  const [view, setView] = useState<View>("home");
  const [speech, setSpeech] = useState(GREETING);
  const [typed, setTyped] = useState(GREETING);
  const [popKey, setPopKey] = useState(0);
  const [thrown, setThrown] = useState(false);
  const [input, setInput] = useState("");
  const [micActive, setMicActive] = useState(false);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const duckRef = useRef<DuckHandle>(null);
  const recRef = useRef<{ start: () => void; stop: () => void } | null>(null);
  const { todos, loading, add, toggle, remove, edit, move, clearDone } = useTodos();

  // 날씨 가져오기(프론트 직접 조회) → 배경 전환 + 카드. 10분마다 갱신.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const w = await fetchWeather();
      if (alive && w) setWeather(w);
    };
    load();
    const timer = window.setInterval(load, 10 * 60 * 1000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  // 말풍선 타자 효과 + pop
  useEffect(() => {
    setPopKey((k) => k + 1);
    setTyped("");
    let i = 0;
    const timer = window.setInterval(() => {
      i += 1;
      setTyped(speech.slice(0, i));
      if (i >= speech.length) window.clearInterval(timer);
    }, 26);
    return () => window.clearInterval(timer);
  }, [speech]);

  // 음성 입력 (Web Speech API)
  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "ko-KR";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onstart = () => setMicActive(true);
    rec.onend = () => setMicActive(false);
    rec.onerror = () => setMicActive(false);
    rec.onresult = (e: SpeechRecognitionEventLike) => {
      let txt = "";
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      setInput(txt);
      const last = e.results[e.results.length - 1];
      if (last.isFinal && txt.trim()) {
        duckRef.current?.respond(guessMood(txt), txt.trim());
        setInput("");
      }
    };
    recRef.current = rec;
    return () => {
      try {
        rec.stop();
      } catch {
        /* noop */
      }
      recRef.current = null;
    };
  }, []);

  const toggleMic = () => {
    const rec = recRef.current;
    if (!rec) return;
    if (micActive) rec.stop();
    else
      try {
        rec.start();
      } catch {
        /* 이미 시작됨 */
      }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) {
      duckRef.current?.bounce();
      return;
    }
    duckRef.current?.respond(guessMood(text), text);
    setInput("");
  };

  const handleOpenTodo = () => setView("todo");
  const closeTodo = () => {
    duckRef.current?.goHome();
    setView("home");
  };

  return (
    <div className={`app view-${view}`}>
      <DuckCanvas
        ref={duckRef}
        className="duck-bg"
        compact={view === "todo"}
        weather={weather?.category ?? "clear"}
        onSpeak={setSpeech}
        onOpenTodo={handleOpenTodo}
        onThrownChange={setThrown}
      />

      {/* 날씨 카드 (우상단) — 할 일 화면에선 접기 버튼과 겹치지 않게 숨김 */}
      {view === "home" && <WeatherCard weather={weather} />}

      {/* 제목 (좌상단 고정) */}
      <div className="title">🦆 표독비서 — 다 던져버리는 러버덕</div>

      {/* 말풍선 (공유) */}
      <div key={popKey} className={`bubble pop bubble-${view}`} role="status">
        {typed}
      </div>

      {view === "home" && (
        <>
          <button className="colorBtn" onClick={() => duckRef.current?.nextColor()}>
            색 바꾸기 🎨
          </button>

          <div className="panel">
            <div className="quick">
              {CHIPS.map((c) => (
                <button key={c.mood} className="chip" onClick={() => duckRef.current?.respond(c.mood)}>
                  {c.label}
                </button>
              ))}
              <button className="chip" onClick={() => duckRef.current?.requestOpen()}>
                {thrown ? "🪃 주워오기" : "할 일 보기 📋"}
              </button>
            </div>
            <form className="inputbar" onSubmit={onSubmit}>
              <input
                value={input}
                maxLength={120}
                autoComplete="off"
                placeholder="뭐가 그렇게 하기 싫어? 말해봐…"
                onChange={(e) => setInput(e.target.value)}
              />
              <button
                type="button"
                className={`mic${micActive ? " rec" : ""}`}
                title="음성으로 말하기"
                aria-label="음성 입력"
                onClick={toggleMic}
              >
                🎤
              </button>
              <button className="send" type="submit">
                꽥!
              </button>
            </form>
          </div>
        </>
      )}

      {view === "todo" && (
        <div className="todo-overlay" role="dialog" aria-label="할 일">
          <button className="duck-collapse" onClick={closeTodo} aria-label="홈으로">
            ⤸ 접기
          </button>
          <div className="todo-overlay-card">
            <TodoView
              todos={todos}
              loading={loading}
              onAdd={add}
              onToggle={toggle}
              onRemove={remove}
              onEdit={edit}
              onMove={move}
              onClearDone={clearDone}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// 최소 타입(브라우저 Web Speech API)
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}
