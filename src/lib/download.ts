/** JSON을 파일로 내려받게 해요. */
export function downloadJson(fileName: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // 다운로드가 시작된 뒤에 풀어요.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 고른 파일을 글자로 읽어요 (File.text()가 없는 환경도 있어서 FileReader를 써요). */
export function readFileText(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
