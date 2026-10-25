/**
 * 브라우저가 저장 공간이 부족할 때 데이터를 임의로 지우지 않도록 요청해요 (SPEC §6).
 * 지원하지 않거나 거절되면 false예요. 앱 동작은 그대로예요.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    const storage = navigator.storage;
    if (!storage?.persist) return false;
    if (await storage.persisted?.()) return true;
    return await storage.persist();
  } catch {
    return false;
  }
}
