// 오리 응답 생성. 백엔드(FastAPI + Copilot SDK)가 준비되면 그쪽을 호출하고,
// 실패하거나 미설정이면 로컬 폴백 대사를 사용한다.
// 백엔드 담당과 합의할 API 계약:
//   POST {VITE_API_BASE_URL}/api/duck/reply
//   req:  { "message": string, "mood": string }
//   res:  { "reply": string }
import { guessMood, pickLine, type Mood } from "./persona";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export async function getDuckReply(message: string, mood?: Mood): Promise<string> {
  const m = mood ?? guessMood(message);
  if (!API_BASE) return pickLine(m); // 백엔드 미설정 → 폴백

  try {
    const res = await fetch(`${API_BASE}/api/duck/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, mood: m }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { reply?: string };
    return data.reply?.trim() || pickLine(m);
  } catch {
    return pickLine(m); // 네트워크/서버 오류 → 폴백
  }
}
