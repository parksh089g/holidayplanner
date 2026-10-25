/** @vitest-environment jsdom */
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../src/App';
import { clearHolidayCache } from '../../src/data/holidays';
import {
  getProfile,
  listCustomHolidays,
  listLeaveEntries,
  listManualGrants,
  putLeaveEntry,
  saveProfile,
} from '../../src/db/repo';
import { readFileText } from '../../src/lib/download';
import { holidayFiles } from '../core/fixtures';
import { leave, resetDb, sampleProfile } from '../db/fixtures';

/** 내려받은 파일들 (이름, 내용) */
let downloads: { name: string; blob: Blob }[] = [];

beforeEach(async () => {
  await resetDb();
  clearHolidayCache();
  downloads = [];
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 23, 10, 0)); // 2026-10-23
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const year = Number(/(\d{4})\.json$/.exec(url)?.[1]);
      const file = holidayFiles.find((f) => f.year === year);
      return file
        ? { ok: true, status: 200, json: async () => file }
        : { ok: false, status: 404, json: async () => ({}) };
    }),
  );
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  // jsdom에는 다운로드가 없어서 만든 파일을 붙잡아요.
  const blobs = new Map<string, Blob>();
  URL.createObjectURL = vi.fn((blob: Blob) => {
    const url = `blob:test/${blobs.size}`;
    blobs.set(url, blob);
    return url;
  });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push({ name: this.download, blob: blobs.get(this.href)! });
  });
  await saveProfile(sampleProfile({ onboardedAt: '2026-10-01T00:00:00.000Z' }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function renderSettings() {
  render(
    <MemoryRouter initialEntries={['/settings']}>
      <AppRoutes />
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { level: 1, name: '설정' });
}

const section = async (title: string) =>
  (await screen.findByRole('heading', { level: 2, name: title })).closest('section')!;
const type = (root: HTMLElement, label: string, value: string) =>
  fireEvent.change(within(root).getByLabelText(label), { target: { value } });

describe('프로필·테마 (SPEC §8.6)', () => {
  it('근무시간을 고쳐 저장하고, 잘못된 값은 막아요', async () => {
    await renderSettings();
    const profile = await section('프로필');
    expect(profile.textContent).toContain('현재 연차 기간 2026.03.02–2027.03.01, 발생 17일');
    type(profile, '점심 시작', '18:30');
    type(profile, '점심 끝', '19:30');
    fireEvent.click(within(profile).getByRole('button', { name: '프로필 저장' }));
    expect(within(profile).getByRole('alert').textContent).toBe(
      '점심시간은 근무시간 안에 있어야 해요.',
    );

    type(profile, '점심 시작', '12:30');
    type(profile, '점심 끝', '13:30');
    type(profile, '퇴근', '18:30');
    fireEvent.click(within(profile).getByRole('button', { name: '프로필 저장' }));
    await within(profile).findByText('프로필을 저장했어요.');
    expect(await getProfile()).toMatchObject({
      workEnd: '18:30',
      lunchStart: '12:30',
      lunchEnd: '13:30',
    });
  });

  it('입사일을 바꾸면 현재 연차 기간을 다시 보여주고 저장해요', async () => {
    await renderSettings();
    const profile = await section('프로필');
    type(profile, '입사일', '2026-06-01');
    expect(profile.textContent).toContain('현재 연차 기간 2026.06.01–2027.05.31, 발생 4일');
    fireEvent.click(within(profile).getByRole('button', { name: '프로필 저장' }));
    await within(profile).findByText('프로필을 저장했어요.');
    expect((await getProfile())?.hireDate).toBe('2026-06-01');
  });

  it('테마를 고르면 프로필에 저장하고 바로 적용해요', async () => {
    await renderSettings();
    fireEvent.click(within(await section('테마')).getByRole('radio', { name: '어둡게' }));
    await waitFor(async () => expect((await getProfile())?.theme).toBe('dark'));
    await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(true));
  });
});

describe('수동 보정·회사 휴무일', () => {
  it('음수(감액) 보정을 추가하고 지워요. 소멸일은 1년 뒤 전날로 채워 둬요', async () => {
    await renderSettings();
    const grants = await section('수동 보정');
    type(grants, '발생일', '2026-03-02');
    expect((within(grants).getByLabelText('소멸일') as HTMLInputElement).value).toBe('2027-03-01');
    type(grants, '일수', '0');
    fireEvent.click(within(grants).getByRole('button', { name: '수동 보정 추가' }));
    expect(within(grants).getByRole('alert').textContent).toContain('0.25일 단위');

    type(grants, '일수', '-1');
    type(grants, '보정 메모', '출근율 감액');
    fireEvent.click(within(grants).getByRole('button', { name: '수동 보정 추가' }));
    await within(grants).findByText('수동 보정을 추가했어요: -1일');
    expect(await listManualGrants()).toEqual([
      expect.objectContaining({
        grantDate: '2026-03-02',
        expireDate: '2027-03-01',
        quarters: -4,
        memo: '출근율 감액',
      }),
    ]);

    fireEvent.click(
      await within(grants).findByRole('button', { name: '2026.03.02–2027.03.01 -1일 삭제' }),
    );
    await within(grants).findByText('수동 보정을 지웠어요.');
    expect(await listManualGrants()).toEqual([]);
  });

  it('회사 휴무일을 추가하고 지워요', async () => {
    await renderSettings();
    const company = await section('회사 휴무일');
    type(company, '날짜', '2026-04-15');
    fireEvent.click(within(company).getByRole('button', { name: '회사 휴무일 추가' }));
    expect((await within(company).findByRole('alert')).textContent).toBe(
      '휴무일 이름을 입력해 주세요.',
    );
    type(company, '이름', '창립기념일');
    fireEvent.click(within(company).getByRole('button', { name: '회사 휴무일 추가' }));
    await within(company).findByText('회사 휴무일을 추가했어요: 창립기념일');
    expect(await listCustomHolidays()).toEqual([
      { date: '2026-04-15', name: '창립기념일', kind: 'company' },
    ]);
    fireEvent.click(
      await within(company).findByRole('button', { name: '2026년 4/15(수) 창립기념일 삭제' }),
    );
    await within(company).findByText('회사 휴무일을 지웠어요.');
    expect(await listCustomHolidays()).toEqual([]);
  });
});

describe('백업 (SPEC §6)', () => {
  it('내보내기는 holidayplanner-backup-YYYYMMDD.json으로 내려받아요', async () => {
    await putLeaveEntry(leave('a', '2026-10-26'));
    await renderSettings();
    fireEvent.click(within(await section('백업')).getByRole('button', { name: '내보내기' }));
    await screen.findByText(/백업 파일을 내려받았어요/);
    expect(downloads.map((d) => d.name)).toEqual(['holidayplanner-backup-20261023.json']);
    const json = JSON.parse(await readFileText(downloads[0].blob));
    expect(json).toMatchObject({ app: 'holidayplanner', schemaVersion: 1 });
    expect(json.leaveEntries.map((e: { id: string }) => e.id)).toEqual(['a']);
  });

  async function pickFile(content: string) {
    const backupSection = await section('백업');
    const file = new File([content], 'backup.json', { type: 'application/json' });
    fireEvent.change(within(backupSection).getByLabelText('백업 파일 고르기'), {
      target: { files: [file] },
    });
    return backupSection;
  }

  const otherBackup = {
    app: 'holidayplanner',
    schemaVersion: 1,
    exportedAt: '2026-09-30T21:15:00+09:00',
    profile: sampleProfile({ hireDate: '2019-05-07', onboardedAt: '2026-09-01T00:00:00.000Z' }),
    leaveGrants: [],
    leaveEntries: [leave('x', '2026-11-02'), leave('y', '2026-11-03')],
    workLogs: [],
    customHolidays: [],
  };

  it('가져오기는 확인을 받고, 지금 데이터를 먼저 내보낸 뒤 전체를 바꿔요', async () => {
    await putLeaveEntry(leave('mine', '2026-10-26'));
    await renderSettings();
    await pickFile(JSON.stringify(otherBackup));
    const dialog = await screen.findByRole('dialog', { name: '이 백업으로 바꿀까요?' });
    expect(dialog.textContent).toContain('2026.09.30 21:15에 만든 백업이에요.');
    expect(dialog.textContent).toContain('휴가 2건, 근무 기록 0건, 수동 보정 0건, 회사 휴무일 0건');
    fireEvent.click(within(dialog).getByRole('button', { name: '바꾸기' }));

    await screen.findByText(/백업으로 바꿨어요/);
    expect(downloads.map((d) => d.name)).toEqual([
      'holidayplanner-backup-20261023-before-import.json',
    ]);
    const before = JSON.parse(await readFileText(downloads[0].blob));
    expect(before.leaveEntries.map((e: { id: string }) => e.id)).toEqual(['mine']);
    expect((await getProfile())?.hireDate).toBe('2019-05-07');
    expect((await listLeaveEntries()).map((e) => e.id)).toEqual(['x', 'y']);
    // 프로필 입력칸도 가져온 값으로 바뀌어요.
    await waitFor(async () =>
      expect(
        (within(await section('프로필')).getByLabelText('입사일') as HTMLInputElement).value,
      ).toBe('2019-05-07'),
    );
  });

  it('취소하면 아무것도 바꾸지 않아요', async () => {
    await putLeaveEntry(leave('mine', '2026-10-26'));
    await renderSettings();
    await pickFile(JSON.stringify(otherBackup));
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: '취소' }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(downloads).toEqual([]);
    expect((await listLeaveEntries()).map((e) => e.id)).toEqual(['mine']);
  });

  it.each([
    ['JSON이 아닌 파일', 'not json', '파일을 읽지 못했어요.'],
    ['다른 앱의 파일', JSON.stringify({ app: 'other' }), '연차 플래너 백업 파일이 아니에요.'],
    [
      '새 버전 앱의 백업',
      JSON.stringify({ ...otherBackup, schemaVersion: 2 }),
      '더 새로운 버전의 앱에서 만든 백업이에요.',
    ],
  ])('%s은 가져오지 않고 알려줘요', async (_, content, message) => {
    await renderSettings();
    const backupSection = await pickFile(content);
    expect((await within(backupSection).findByRole('alert')).textContent).toContain(message);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('전체 초기화·앱 정보', () => {
  it('"초기화"를 입력해야 지울 수 있고, 지우면 온보딩으로 가요', async () => {
    await putLeaveEntry(leave('a', '2026-10-26'));
    await renderSettings();
    fireEvent.click(
      within(await section('전체 초기화')).getByRole('button', { name: '전체 초기화' }),
    );
    const dialog = await screen.findByRole('dialog', { name: '모든 데이터를 지울까요?' });
    const confirm = within(dialog).getByRole('button', {
      name: '모두 지우기',
    }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    type(dialog, '확인하려면 "초기화"를 입력해 주세요', '초기');
    expect(confirm.disabled).toBe(true);
    type(dialog, '확인하려면 "초기화"를 입력해 주세요', '초기화');
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    expect(
      await screen.findByRole('heading', { level: 1, name: '연차 플래너 시작하기' }),
    ).toBeTruthy();
    expect(await getProfile()).toBeUndefined();
    expect(await listLeaveEntries()).toEqual([]);
  });

  it('공휴일 데이터 상태와 앱 버전을 보여줘요', async () => {
    await renderSettings();
    const about = await section('공휴일 데이터 · 앱 정보');
    await waitFor(() => expect(about.textContent).toContain('2026년 공휴일공휴일 데이터 확인 중'));
    expect(about.textContent).toContain('2027년 공휴일공휴일 데이터 확인 중');
    expect(about.textContent).toMatch(/앱 버전v\d+\.\d+\.\d+/);
  });
});
