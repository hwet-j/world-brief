/** 데이터 소스(GitHub 저장소) 주소 만들기와 ETag 조건부 읽기. fetch 는 주입해서 테스트한다 */
export interface Src { owner: string; repo: string; branch: string; token?: string | null }

const SAFE = /^[A-Za-z0-9._-]+$/;
export const validSrc = (s: Pick<Src, 'owner' | 'repo' | 'branch'>) => SAFE.test(s.owner) && SAFE.test(s.repo) && /^[A-Za-z0-9._/-]+$/.test(s.branch);

/** 토큰이 있으면 API(비공개 저장소 가능), 없으면 raw 주소 */
export function buildRequest(src: Src, path: string): { url: string; headers: Record<string, string> } {
  if (!validSrc(src)) throw new Error('저장소 설정이 올바르지 않아요');
  if (path.includes('..') || path.startsWith('/')) throw new Error('경로가 올바르지 않아요');
  if (src.token) {
    return {
      url: `https://api.github.com/repos/${src.owner}/${src.repo}/contents/${path}?ref=${encodeURIComponent(src.branch)}`,
      headers: { Accept: 'application/vnd.github.raw+json', Authorization: `Bearer ${src.token}`, 'X-GitHub-Api-Version': '2022-11-28' },
    };
  }
  return { url: `https://raw.githubusercontent.com/${src.owner}/${src.repo}/${src.branch}/${path}`, headers: { Accept: 'application/json' } };
}

export type FetchResult<T> =
  | { status: 'ok'; data: T; etag: string | null }
  | { status: 'notModified' }
  | { status: 'notFound' }
  | { status: 'error'; message: string };

type FetchFn = (url: string, init?: { headers?: Record<string, string> }) => Promise<{ status: number; ok: boolean; headers: { get(n: string): string | null }; text(): Promise<string> }>;

export async function fetchJson(fetchFn: FetchFn, src: Src, path: string, etag?: string | null): Promise<FetchResult<unknown>> {
  let req;
  try { req = buildRequest(src, path); } catch (e) { return { status: 'error', message: (e as Error).message }; }
  try {
    const res = await fetchFn(req.url, { headers: { ...req.headers, ...(etag ? { 'If-None-Match': etag } : {}) } });
    if (res.status === 304) return { status: 'notModified' };
    if (res.status === 404) return { status: 'notFound' };
    if (res.status === 401 || res.status === 403) return { status: 'error', message: res.status === 401 ? '토큰이 올바르지 않아요' : '접근이 거부됐어요 (비공개 저장소면 설정에서 토큰을 입력하세요)' };
    if (!res.ok) return { status: 'error', message: `서버 응답 오류 (${res.status})` };
    const text = await res.text();
    try {
      return { status: 'ok', data: JSON.parse(text), etag: res.headers.get('etag') };
    } catch {
      return { status: 'error', message: '데이터 형식이 올바르지 않아요' };
    }
  } catch {
    return { status: 'error', message: '네트워크에 연결할 수 없어요' };
  }
}
