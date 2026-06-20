import { useCallback, useEffect, useState } from "react";

export type Quadrant = "q1" | "q2" | "q3" | "q4" | "none";

export interface Todo {
  id: string;
  text: string;
  done: boolean;
  quadrant: Quadrant;
  createdAt: number;
}

const STORE_KEY = "rubberduck_todos";

// 백엔드/DB가 아직 없으므로 목 데이터로 대체한다.
// 추후 GET /tasks 응답으로 교체하면 된다.
const MOCK_TODOS: Omit<Todo, "id" | "createdAt">[] = [
  { text: "내일 발표 자료 마무리", done: false, quadrant: "q1" },
  { text: "고객사 긴급 버그 회신", done: false, quadrant: "q1" },
  { text: "다음 분기 로드맵 작성", done: false, quadrant: "q2" },
  { text: "운동 루틴 다시 시작", done: false, quadrant: "q2" },
  { text: "회식 장소 예약 전화", done: false, quadrant: "q3" },
  { text: "사내 설문 응답하기", done: false, quadrant: "q3" },
  { text: "밀린 영상 몰아보기", done: true, quadrant: "q4" },
  { text: "안 쓰는 앱 알림 끄기", done: false, quadrant: "q4" },
  { text: "분류 안 한 잡일 메모", done: false, quadrant: "none" },
];

function load(): Todo[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Todo[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// DB에서 가져오는 느낌으로 살짝 지연을 준다.
// 저장된 데이터가 있으면 그걸, 없으면 목 데이터를 돌려준다.
function fetchTodos(): Promise<Todo[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const stored = load();
      if (stored.length) {
        resolve(stored);
        return;
      }
      const now = Date.now();
      resolve(
        MOCK_TODOS.map((m, i) => ({ ...m, id: uid(), createdAt: now + i })),
      );
    }, 650);
  });
}

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);

  // 최초 1회: DB에서 가져오는 느낌으로 목 데이터 로드
  useEffect(() => {
    let alive = true;
    fetchTodos().then((data) => {
      if (!alive) return;
      setTodos(data);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  // 로딩이 끝난 뒤에만 저장 (빈 배열로 덮어쓰지 않도록)
  useEffect(() => {
    if (loading) return;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(todos));
    } catch {
      /* 저장 실패 무시 */
    }
  }, [todos, loading]);

  const add = useCallback((text: string, quadrant: Quadrant = "none") => {
    const t = text.trim();
    if (!t) return;
    setTodos((prev) => [
      ...prev,
      { id: uid(), text: t, done: false, quadrant, createdAt: Date.now() },
    ]);
  }, []);

  const toggle = useCallback((id: string) => {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }, []);

  const remove = useCallback((id: string) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const edit = useCallback((id: string, text: string) => {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, text } : t)));
  }, []);

  const move = useCallback((id: string, quadrant: Quadrant) => {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, quadrant } : t)));
  }, []);

  const clearDone = useCallback(() => {
    setTodos((prev) => prev.filter((t) => !t.done));
  }, []);

  return { todos, loading, add, toggle, remove, edit, move, clearDone };
}
