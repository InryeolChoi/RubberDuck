import { useEffect, useRef, useState } from "react";
import type { WeatherInfo } from "../lib/weather";

interface WeatherCardProps {
  weather: WeatherInfo | null;
}

// 왜 러버덕이 생산성에 도움이 되는지 설명.
const WHY_POINTS: { title: string; body: string }[] = [
  {
    title: "🗣️ 설명하면 막힌 게 풀린다",
    body: "막힐 때 사람이 아니라 고무 오리에게 문제를 소리 내어 설명하면, 머릿속에서 엉켜 있던 논리가 말로 정리되면서 스스로 답을 찾게 돼. ‘러버덕 디버깅’이라고 부르는, 개발자들이 실제로 쓰는 방법이야.",
  },
  {
    title: "🔥 가끔은 자극이 필요하다",
    body: "표독비서는 마냥 다정하지만은 않아. 핑계를 대면 팩폭하고, 미루면 다 던져버리라고 다그쳐. 적당한 긴장과 외부 자극은 미루기를 끊고 행동에 옮기게 만드는 트리거가 돼.",
  },
  {
    title: "🌤️ 환경이 집중을 만든다",
    body: "지금 날씨에 맞춰 배경이 바뀌는 건 단순한 장식이 아니야. ‘지금 여기’의 감각을 주는 작은 환경 신호가 몰입(present mind)을 돕고, 할 일에 다시 닻을 내리게 해줘.",
  },
];

export default function WeatherCard({ weather }: WeatherCardProps) {
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  // 바깥 클릭 / ESC 로 닫기
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="weather-wrap" ref={popRef}>
      <div className="weather-card" role="status" aria-label="현재 날씨">
        <span className="weather-emoji" aria-hidden>
          {weather?.emoji ?? "🌡️"}
        </span>
        <span className="weather-text">
          <span className="weather-temp">
            {weather?.temperatureC != null ? `${weather.temperatureC}°` : "--°"}
          </span>
          <span className="weather-cond">{weather?.condition ?? "날씨 확인 중…"}</span>
        </span>
      </div>

      <button
        type="button"
        className={`weather-help${open ? " active" : ""}`}
        aria-label="이게 왜 생산성에 도움이 되나요?"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title="이게 왜 도움이 되지?"
      >
        ?
      </button>

      {open && (
        <div className="weather-popover" role="dialog" aria-label="러버덕이 생산성에 도움이 되는 이유">
          <div className="weather-popover-head">
            <strong>왜 도움이 될까? 🦆</strong>
            <button className="weather-popover-x" aria-label="닫기" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>
          <ul className="weather-why">
            {WHY_POINTS.map((p) => (
              <li key={p.title}>
                <span className="weather-why-title">{p.title}</span>
                <span className="weather-why-body">{p.body}</span>
              </li>
            ))}
          </ul>
          <p className="weather-why-foot">막히면? 그냥 나한테 말해봐. 꽥.</p>
        </div>
      )}
    </div>
  );
}
