import { useMemo, useState } from "react";
import type { Quadrant, Todo } from "../lib/useTodos";

interface TodoViewProps {
  todos: Todo[];
  loading: boolean;
  onAdd: (text: string, quadrant: Quadrant) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onEdit: (id: string, text: string) => void;
  onMove: (id: string, quadrant: Quadrant) => void;
  onClearDone: () => void;
}

const QUADRANTS: { key: Quadrant; title: string; hint: string; tone: string }[] = [
  { key: "q1", title: "지금 당장", hint: "중요 · 긴급", tone: "q1" },
  { key: "q2", title: "계획해서", hint: "중요 · 비긴급", tone: "q2" },
  { key: "q3", title: "넘겨버려", hint: "비중요 · 긴급", tone: "q3" },
  { key: "q4", title: "버려도 됨", hint: "비중요 · 비긴급", tone: "q4" },
];

const QUAD_LABEL: Record<Quadrant, string> = {
  q1: "지금 당장",
  q2: "계획해서",
  q3: "넘겨버려",
  q4: "버려도 됨",
  none: "받은 일",
};

function TodoItem({
  todo,
  onToggle,
  onRemove,
  onEdit,
  onMove,
}: {
  todo: Todo;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onEdit: (id: string, text: string) => void;
  onMove: (id: string, q: Quadrant) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(todo.text);

  const commit = () => {
    const t = draft.trim();
    if (t) onEdit(todo.id, t);
    else setDraft(todo.text);
    setEditing(false);
  };

  return (
    <li className={`todo-item${todo.done ? " is-done" : ""}`}>
      <button
        className="todo-check"
        aria-label={todo.done ? "완료 취소" : "완료"}
        onClick={() => onToggle(todo.id)}
      >
        {todo.done ? "✓" : ""}
      </button>

      {editing ? (
        <input
          className="todo-edit"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(todo.text);
              setEditing(false);
            }
          }}
        />
      ) : (
        <span className="todo-text" onDoubleClick={() => setEditing(true)} title="더블클릭하여 수정">
          {todo.text}
        </span>
      )}

      <div className="todo-actions">
        <select
          className="todo-move"
          value={todo.quadrant}
          onChange={(e) => onMove(todo.id, e.target.value as Quadrant)}
          aria-label="사분면 이동"
        >
          {(["none", "q1", "q2", "q3", "q4"] as Quadrant[]).map((q) => (
            <option key={q} value={q}>
              {QUAD_LABEL[q]}
            </option>
          ))}
        </select>
        <button className="todo-del" aria-label="삭제" onClick={() => onRemove(todo.id)}>
          ✕
        </button>
      </div>
    </li>
  );
}

export default function TodoView({
  todos,
  loading,
  onAdd,
  onToggle,
  onRemove,
  onEdit,
  onMove,
  onClearDone,
}: TodoViewProps) {
  const [text, setText] = useState("");

  const byQuad = useMemo(() => {
    const map: Record<Quadrant, Todo[]> = { q1: [], q2: [], q3: [], q4: [], none: [] };
    for (const t of todos) map[t.quadrant].push(t);
    return map;
  }, [todos]);

  const doneCount = todos.filter((t) => t.done).length;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd(text, "none");
    setText("");
  };

  return (
    <div className="todo-view">
      <header className="todo-head">
        <div>
          <h1 className="todo-title">할 일 매트릭스 🦆</h1>
          <p className="todo-sub">
            {loading
              ? "불러오는 중…"
              : `전체 ${todos.length} · 완료 ${doneCount}`}
          </p>
        </div>
        <button className="ghost-btn" onClick={onClearDone} disabled={loading || doneCount === 0}>
          완료 정리 🗑️
        </button>
      </header>

      <form className="todo-add" onSubmit={submit}>
        <input
          className="todo-add-input"
          placeholder="할 일을 적고 Enter… (드래그 말고 일단 던져)"
          value={text}
          disabled={loading}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="primary-btn" type="submit" disabled={loading}>
          추가
        </button>
      </form>

      {loading ? (
        <div className="todo-loading">
          <span className="todo-spinner" aria-hidden />
          데이터베이스에서 할 일을 끌어오는 중… 꽥.
        </div>
      ) : (
        <>
          {byQuad.none.length > 0 && (
            <section className="inbox">
              <h2 className="inbox-title">받은 일 · 아직 분류 안 됨</h2>
              <ul className="todo-list">
                {byQuad.none.map((t) => (
                  <TodoItem
                    key={t.id}
                    todo={t}
                    onToggle={onToggle}
                    onRemove={onRemove}
                    onEdit={onEdit}
                    onMove={onMove}
                  />
                ))}
              </ul>
            </section>
          )}

          <div className="matrix-frame">
            <div className="axis-corner" aria-hidden>
              긴급×중요
            </div>
            <div className="axis-top">
              <span>🔥 급한 일</span>
              <span>🌿 여유 있는 일</span>
            </div>
            <div className="axis-left">
              <span>⭐ 중요</span>
              <span>💤 덜 중요</span>
            </div>
            <div className="matrix">
              {QUADRANTS.map((q) => (
                <section key={q.key} className={`quad quad-${q.tone}`}>
                  <header className="quad-head">
                    <h2 className="quad-title">{q.title}</h2>
                    <span className="quad-hint">{q.hint}</span>
                  </header>
                  {byQuad[q.key].length === 0 ? (
                    <p className="quad-empty">비었어. 평화롭네. 꽥.</p>
                  ) : (
                    <ul className="todo-list">
                      {byQuad[q.key].map((t) => (
                        <TodoItem
                          key={t.id}
                          todo={t}
                          onToggle={onToggle}
                          onRemove={onRemove}
                          onEdit={onEdit}
                          onMove={onMove}
                        />
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
