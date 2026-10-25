/** 'YYYY-MM-DD' 형식의 날짜 문자열 (로컬 날짜). */
export type ISODate = string;

/** 휴가 일수는 0.25일 단위 정수로 다뤄요. 1일 = 4, 반차 = 2, 반반차 = 1. */
export const QUARTERS_PER_DAY = 4;

// ── 연차 부여 (SPEC §5.1, §5.2) ──

export interface AutoGrant {
  /** 'auto-m-3', 'auto-y-1'처럼 결정적인 ID */
  id: string;
  kind: 'monthly' | 'annual';
  grantDate: ISODate;
  /** 이 날까지 사용할 수 있어요 (포함). */
  expireDate: ISODate;
  quarters: number;
  /** monthly는 0, annual은 근속연수 n */
  serviceYear: number;
}
