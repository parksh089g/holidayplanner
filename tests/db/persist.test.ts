import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestPersistentStorage } from '../../src/db/persist';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('requestPersistentStorage', () => {
  it('영구 저장을 요청하고 결과를 돌려줘요', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('navigator', {
      storage: { persisted: vi.fn().mockResolvedValue(false), persist },
    });
    expect(await requestPersistentStorage()).toBe(true);
    expect(persist).toHaveBeenCalledOnce();
  });

  it('이미 영구 저장이면 다시 요청하지 않아요', async () => {
    const persist = vi.fn();
    vi.stubGlobal('navigator', {
      storage: { persisted: vi.fn().mockResolvedValue(true), persist },
    });
    expect(await requestPersistentStorage()).toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it('브라우저가 지원하지 않으면 false예요', async () => {
    vi.stubGlobal('navigator', {});
    expect(await requestPersistentStorage()).toBe(false);
  });

  it('요청이 실패해도 앱을 멈추지 않고 false예요', async () => {
    vi.stubGlobal('navigator', {
      storage: { persist: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    expect(await requestPersistentStorage()).toBe(false);
  });
});
