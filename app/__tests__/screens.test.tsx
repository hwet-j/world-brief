/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock 이후에 화면을 불러오려고 require 를 쓴다 */
/**
 * 화면 스모크 테스트: 가짜 저장소(픽스처)로 모든 화면이 예외 없이 그려지는지 확인한다.
 * (기기에서 처음 열었을 때 흔한 런타임 오류 — 훅 순서, undefined 접근, 잘못된 import — 를 잡는 용도)
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';

import { makeBookmark } from '../src/lib/share';
import { DEFAULT_PREFS } from '../src/lib/types';
import { allEditions, edition, indexFixture } from './helpers';

const eds = allEditions();
const b = edition('b');
let mockParams: Record<string, string> = {};
const mockStore = {
  ready: true, prefs: DEFAULT_PREFS, setPrefs: jest.fn(async () => {}), hasToken: false, setToken: jest.fn(), removeToken: jest.fn(),
  index: indexFixture(), editions: eds, latest: eds[0],
  status: { refreshing: false, offline: false, error: undefined as string | undefined, fetchedAt: '2026-11-27T10:00:00Z', futureSchema: false, warnings: [] as string[] },
  hasNew: true, markSeen: jest.fn(), refresh: jest.fn(async () => {}),
  getEdition: jest.fn(async (id: string) => eds.find((e) => e.id === id) ?? null),
  bookmarks: [makeBookmark(b, b.regions[0], b.regions[0].items[0], '메모 내용')],
  isBookmarked: jest.fn((e: string, i: string) => e === '2026-11-27-am' && i === 'kr-1'),
  toggleBookmark: jest.fn(async () => true), setNote: jest.fn(), removeBookmark: jest.fn(),
  cache: jest.fn(async () => ({ editions: 3, bytes: 20_000 })), clearCache: jest.fn(async () => {}),
};

jest.mock('../src/store', () => ({ useBrief: () => mockStore, BriefProvider: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn() },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (cb: () => void) => { require('react').useEffect(cb, [cb]); },
  Stack: Object.assign(() => null, { Screen: () => null }),
  Tabs: Object.assign(() => null, { Screen: () => null }),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('expo-notifications', () => ({ AndroidImportance: { DEFAULT: 3 }, SchedulableTriggerInputTypes: { DAILY: 'daily' } }));
jest.mock('expo-sqlite', () => ({}));
jest.mock('expo-secure-store', () => ({}));

const render = async (el: React.ReactElement) => {
  let r!: renderer.ReactTestRenderer;
  await act(async () => { r = renderer.create(el); });
  return r;
};
const collect = (n: unknown): string => (n == null ? '' : typeof n === 'string' ? n : Array.isArray(n) ? n.map(collect).join('') : collect((n as { children?: unknown }).children));
const text = (r: renderer.ReactTestRenderer) => collect(r.toJSON());
/** 글자로 버튼(onPress 가 있는 노드)을 찾아 누른다 */
const instText = (n: renderer.ReactTestInstance | string): string => (typeof n === 'string' ? n : n.children.map(instText).join(''));
const press = async (r: renderer.ReactTestRenderer, label: string) => {
  const node = r.root.findAll((n) => typeof n.props.onPress === 'function' && instText(n).includes(label))[0];
  if (!node) throw new Error(`버튼을 못 찾음: ${label}`);
  await act(async () => { node.props.onPress(); });
};

beforeAll(() => { jest.useFakeTimers().setSystemTime(new Date('2026-11-27T12:00:00+09:00')); });
afterAll(() => { jest.useRealTimers(); });
beforeEach(() => { mockParams = {}; mockStore.status = { ...mockStore.status, refreshing: false, offline: false, futureSchema: false, warnings: [] }; mockStore.latest = eds[0]; });

test('오늘: 헤드라인·지역 카드·이번 주 주목', async () => {
  const Today = require('../src/app/(tabs)/index').default;
  const r = await render(<Today />);
  const t = text(r);
  expect(t).toContain('World Brief');
  expect(t).toContain('오늘의 핵심');
  expect(t).toContain('대한민국');
  r.unmount();
  mockStore.latest = b;
  const r2 = await render(<Today />);
  expect(text(r2)).toContain('이번 주 주목');
  expect(text(r2)).toContain('가상의 정상회담');
  expect(text(r2)).not.toContain('이미 지난 일정');
  await press(r2, '미국');
  expect(text(r2)).toContain('미국');
});

test('오늘: 첫 실행(데이터 없음)·오프라인·오류·새 형식 배너', async () => {
  const Today = require('../src/app/(tabs)/index').default;
  mockStore.latest = null as never;
  expect(text(await render(<Today />))).toContain('아직 올라온 브리핑이 없어요');
  mockStore.status = { ...mockStore.status, offline: true, error: '네트워크에 연결할 수 없어요', futureSchema: true, warnings: ['w'] };
  mockStore.latest = eds[0];
  const t = text(await render(<Today />));
  expect(t).toContain('저장된 브리핑을 보여 드려요');
  expect(t).toContain('앱 업데이트가 필요');
  expect(t).toContain('건너뛰었어요');
});

test('보관함: 날짜별 목록과 검색(결과·없음)', async () => {
  const Archive = require('../src/app/(tabs)/archive').default;
  const r = await render(<Archive />);
  expect(text(r)).toContain('11월 27일 (금)');
  expect(text(r)).toContain('저녁');
  const input = r.root.findByProps({ accessibilityLabel: '브리핑 검색' });
  await act(async () => { input.props.onChangeText('반도체'); });
  expect(text(r)).toContain('3건');
  await act(async () => { input.props.onChangeText('zzzz없음'); });
  expect(text(r)).toContain('검색 결과가 없어요');
});

test('모아보기: 주제별·이슈 추적·지역 비교', async () => {
  const Explore = require('../src/app/(tabs)/explore').default;
  const r = await render(<Explore />);
  expect(text(r)).toContain('주제별');
  await press(r, '이슈 추적');
  expect(text(r)).toContain('#반도체');
  await press(r, '지역 비교');
  expect(text(r)).toContain('vs');
  mockStore.latest = null as never;
  expect(text(await render(<Explore />))).toContain('아직 볼 브리핑이 없어요');
});

test('저장·설정·회차·지역·태그 화면', async () => {
  expect(text(await render(React.createElement(require('../src/app/(tabs)/saved').default)))).toContain('메모 내용');
  mockStore.bookmarks = [];
  expect(text(await render(React.createElement(require('../src/app/(tabs)/saved').default)))).toContain('저장한 소식이 없어요');
  expect(text(await render(React.createElement(require('../src/app/(tabs)/settings').default)))).toContain('데이터 저장소');

  mockParams = { id: '2026-11-27-am' };
  const Ed = require('../src/app/edition/[id]').default;
  expect(text(await render(<Ed />))).toContain('11월 27일 아침 브리핑');
  mockParams = { id: 'nope' };
  expect(text(await render(<Ed />))).toContain('불러올 수 없어요');

  mockParams = { editionId: '2026-11-27-am', code: 'KR' };
  const Reg = require('../src/app/region/[editionId]/[code]').default;
  const t = text(await render(<Reg />));
  expect(t).toContain('경제');
  expect(t).toContain('후속');
  expect(t).toContain('왜 중요한가');
  mockParams = { editionId: '2026-11-27-am', code: 'ZZ' };
  expect(text(await render(<Reg />))).toContain('이번 회차에 없어요');

  mockParams = { tag: '반도체' };
  const Tag = require('../src/app/tag/[tag]').default;
  expect(text(await render(<Tag />))).toContain('11월 26일');
  mockParams = { tag: '없는태그' };
  expect(text(await render(<Tag />))).toContain('없어요');
});
