/**
 * 할 일(Task)에 붙이는 세밀한 구분 태그.
 * 사분면(quadrant) 색이 "큰 틀"이라면, 태그는 같은 칸 안에서도
 * 강조·우선순위·분류를 더 세밀하게 표현하기 위한 포인트 색이다.
 *
 * - group 'priority': 우선순위/강조 (한 할 일에 여러 개 가능하나 1~2개 권장)
 * - group 'category': 일의 종류 (보통 1개)
 */

export type TagGroup = 'priority' | 'category';

export type TagId =
  // priority
  | 'deadline'
  | 'key'
  | 'quick'
  | 'blocked'
  | 'delegate'
  | 'someday'
  // category
  | 'work'
  | 'personal'
  | 'study'
  | 'health';

export interface TaskTag {
  id: TagId;
  /** 화면 표시 이름 */
  label: string;
  group: TagGroup;
  /** 강조색(글자/테두리) */
  color: string;
  /** 배경색(칩 배경) */
  bg: string;
  /** 아이콘(이모지) */
  icon: string;
  /** 의미 설명 */
  description: string;
}

export const TAGS: Record<TagId, TaskTag> = {
  // ── 우선순위 / 강조 ──────────────────────────────
  deadline: {
    id: 'deadline',
    label: '마감임박',
    group: 'priority',
    color: '#b91c1c', // red-700
    bg: '#fee2e2', // red-100
    icon: '🔥',
    description: '마감이 임박해 가장 먼저 봐야 하는 일',
  },
  key: {
    id: 'key',
    label: '핵심',
    group: 'priority',
    color: '#b45309', // amber-700
    bg: '#fef3c7', // amber-100
    icon: '⭐',
    description: '성과에 큰 영향을 주는 핵심 과제',
  },
  quick: {
    id: 'quick',
    label: '빠른처리',
    group: 'priority',
    color: '#0f766e', // teal-700
    bg: '#ccfbf1', // teal-100
    icon: '⚡',
    description: '몇 분 안에 끝낼 수 있는 일 (바로 처리)',
  },
  blocked: {
    id: 'blocked',
    label: '대기/막힘',
    group: 'priority',
    color: '#6d28d9', // violet-700
    bg: '#ede9fe', // violet-100
    icon: '⛔',
    description: '다른 사람/조건 때문에 지금은 진행 불가',
  },
  delegate: {
    id: 'delegate',
    label: '위임가능',
    group: 'priority',
    color: '#0369a1', // sky-700
    bg: '#e0f2fe', // sky-100
    icon: '🤝',
    description: '내가 아니어도 되는 일 (위임 후보)',
  },
  someday: {
    id: 'someday',
    label: '언젠가',
    group: 'priority',
    color: '#4b5563', // gray-600
    bg: '#f3f4f6', // gray-100
    icon: '💤',
    description: '급하지 않고 미뤄도 되는 일',
  },

  // ── 분류 / 종류 ─────────────────────────────────
  work: {
    id: 'work',
    label: '업무',
    group: 'category',
    color: '#4338ca', // indigo-700
    bg: '#e0e7ff', // indigo-100
    icon: '💼',
    description: '직무/업무 관련',
  },
  personal: {
    id: 'personal',
    label: '개인',
    group: 'category',
    color: '#15803d', // green-700
    bg: '#dcfce7', // green-100
    icon: '🏠',
    description: '개인 생활/집안일',
  },
  study: {
    id: 'study',
    label: '학습',
    group: 'category',
    color: '#1d4ed8', // blue-700
    bg: '#dbeafe', // blue-100
    icon: '📚',
    description: '공부/자기계발',
  },
  health: {
    id: 'health',
    label: '건강',
    group: 'category',
    color: '#be123c', // rose-700
    bg: '#ffe4e6', // rose-100
    icon: '🩺',
    description: '운동/건강/휴식',
  },
};

export const PRIORITY_TAGS: TaskTag[] = Object.values(TAGS).filter(
  (t) => t.group === 'priority',
);

export const CATEGORY_TAGS: TaskTag[] = Object.values(TAGS).filter(
  (t) => t.group === 'category',
);

/** id 목록으로 태그 객체를 안전하게 조회한다. */
export function getTags(ids: readonly TagId[]): TaskTag[] {
  return ids.map((id) => TAGS[id]).filter(Boolean);
}
