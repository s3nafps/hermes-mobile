// Web storage: localStorage. It holds only gateway addresses. Session cookies
// are managed by the browser, and no credential is written here.
export async function getItem(key: string): Promise<string | null> {
  return typeof window === 'undefined' ? null : window.localStorage.getItem(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
}
