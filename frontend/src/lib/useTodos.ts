import { useCallback, useEffect, useState } from "react";

// 백엔드 계약(SPEC.md §7.2, 실제 머지된 구현 기준)에 맞춘다.
//   GET    /api/tasks            → TaskRead[]
//   POST   /api/tasks            { title, importance, urgency, ... }
//   PATCH  /api/tasks/{id}       { title?, importance?, urgency?, status? }
//   DELETE /api/tasks/{id}
// 사분면은 저장하지 않고 importance×urgency(임계값 3)로 파생된 대문자 Q1~Q4를 쓴다.
export type Quadrant = "Q1" | "Q2" | "Q3" | "Q4";

type Status = "todo" | "doing" | "done";

// 프론트 화면용 모델 — 백엔드 TaskRead를 화면에 맞게 가공한 형태.
export interface Todo {
  id: string; // 서버 UUID
  title: string;
  done: boolean; // status === "done"
  quadrant: Quadrant; // 서버 파생값(대문자)
  importance: number; // 1~5
  urgency: number; // 1~5
  createdAt: number; // epoch ms (created_at ISO → 숫자)
}

// 백엔드 TaskRead 응답 형태(필요 필드만).
interface BackendTask {
  id: string;
  title: string;
  importance: number;
  urgency: number;
  quadrant: Quadrant;
  status: Status;
  created_at: string; // ISO-8601
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

// 사분면 → importance/urgency 점수(임계값 3 기준으로 명확히 파생되도록).
const QUADRANT_SCORE: Record<Quadrant, { importance: number; urgency: number }> = {
  Q1: { importance: 5, urgency: 5 }, // 중요 · 긴급
  Q2: { importance: 5, urgency: 1 }, // 중요 · 비긴급
  Q3: { importance: 1, urgency: 5 }, // 비중요 · 긴급
  Q4: { importance: 1, urgency: 1 }, // 비중요 · 비긴급
};

function toTodo(t: BackendTask): Todo {
  return {
    id: t.id,
    title: t.title,
    done: t.status === "done",
    quadrant: t.quadrant,
    importance: t.importance,
    urgency: t.urgency,
    createdAt: Date.parse(t.created_at) || Date.now(),
  };
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!API_BASE) {
      setTodos([]);
      setLoading(false);
      return;
    }
    try {
      const data = await api<BackendTask[]>("/api/tasks");
      setTodos(data.map(toTodo));
    } catch {
      setTodos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 최초 1회: 백엔드에서 할 일 목록 로드
  useEffect(() => {
    void reload();
  }, [reload]);

  const add = useCallback(
    async (title: string, quadrant: Quadrant = "Q1") => {
      const t = title.trim();
      if (!t || !API_BASE) return;
      const { importance, urgency } = QUADRANT_SCORE[quadrant];
      try {
        const created = await api<BackendTask>("/api/tasks", {
          method: "POST",
          body: JSON.stringify({ title: t, importance, urgency }),
        });
        setTodos((prev) => [toTodo(created), ...prev]);
      } catch {
        /* 생성 실패 무시 */
      }
    },
    [],
  );

  const patch = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      if (!API_BASE) return;
      try {
        const updated = await api<BackendTask>(`/api/tasks/${id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        setTodos((prev) => prev.map((t) => (t.id === id ? toTodo(updated) : t)));
      } catch {
        /* 수정 실패 무시 */
      }
    },
    [],
  );

  const toggle = useCallback(
    (id: string) => {
      const cur = todos.find((t) => t.id === id);
      if (!cur) return;
      void patch(id, { status: cur.done ? "todo" : "done" });
    },
    [todos, patch],
  );

  const remove = useCallback(async (id: string) => {
    if (!API_BASE) return;
    try {
      await api<void>(`/api/tasks/${id}`, { method: "DELETE" });
      setTodos((prev) => prev.filter((t) => t.id !== id));
    } catch {
      /* 삭제 실패 무시 */
    }
  }, []);

  const edit = useCallback(
    (id: string, title: string) => {
      const t = title.trim();
      if (!t) return;
      void patch(id, { title: t });
    },
    [patch],
  );

  const move = useCallback(
    (id: string, quadrant: Quadrant) => {
      void patch(id, QUADRANT_SCORE[quadrant]);
    },
    [patch],
  );

  const clearDone = useCallback(async () => {
    if (!API_BASE) return;
    const doneIds = todos.filter((t) => t.done).map((t) => t.id);
    await Promise.all(
      doneIds.map((id) =>
        api<void>(`/api/tasks/${id}`, { method: "DELETE" }).catch(() => undefined),
      ),
    );
    setTodos((prev) => prev.filter((t) => !t.done));
  }, [todos]);

  return { todos, loading, add, toggle, remove, edit, move, clearDone };
}
