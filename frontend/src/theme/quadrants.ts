/**
 * 아이젠하워 매트릭스 4분할(quadrant)의 색/문구 테마.
 * 중요도(importance)와 급함(urgency)으로 파생되는 Q1~Q4를 화면에서 색으로 구분한다.
 */

export type QuadrantId = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export interface QuadrantTheme {
  id: QuadrantId;
  /** 사분면 정의 (중요도 × 급함) */
  title: string;
  /** 권장 행동 */
  action: string;
  /** 강조색(accent) */
  color: string;
  /** 배경색 */
  bg: string;
  /** 테두리색 */
  border: string;
  /** 본문 텍스트 색 */
  text: string;
}

export const QUADRANTS: Record<QuadrantId, QuadrantTheme> = {
  Q1: {
    id: 'Q1',
    title: '중요 & 급함',
    action: '즉시 처리',
    color: '#dc2626', // red-600
    bg: '#fef2f2', // red-50
    border: '#fecaca', // red-200
    text: '#7f1d1d', // red-900
  },
  Q2: {
    id: 'Q2',
    title: '중요 & 비급함',
    action: '계획 세우기',
    color: '#2563eb', // blue-600
    bg: '#eff6ff', // blue-50
    border: '#bfdbfe', // blue-200
    text: '#1e3a8a', // blue-900
  },
  Q3: {
    id: 'Q3',
    title: '비중요 & 급함',
    action: '위임 / 빠르게',
    color: '#d97706', // amber-600
    bg: '#fffbeb', // amber-50
    border: '#fde68a', // amber-200
    text: '#78350f', // amber-900
  },
  Q4: {
    id: 'Q4',
    title: '비중요 & 비급함',
    action: '줄이기 / 제거',
    color: '#6b7280', // gray-500
    bg: '#f9fafb', // gray-50
    border: '#e5e7eb', // gray-200
    text: '#374151', // gray-700
  },
};

/** 중요도·급함(1~5)으로 사분면을 파생한다. 임계값 3 기준. */
export function deriveQuadrant(importance: number, urgency: number): QuadrantId {
  const important = importance >= 3;
  const urgent = urgency >= 3;
  if (important && urgent) return 'Q1';
  if (important && !urgent) return 'Q2';
  if (!important && urgent) return 'Q3';
  return 'Q4';
}

export const QUADRANT_ORDER: QuadrantId[] = ['Q1', 'Q2', 'Q3', 'Q4'];
