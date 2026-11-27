import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, Switch, TextInput, View } from 'react-native';

import { Screen } from '../../components/Screen';
import { Button, Card, Chip, SectionTitle, Txt, useUi } from '../../components/ui';
import { knownRegions, orderRegions } from '../../lib/group';
import { formatBytes } from '../../lib/misc';
import { applyDailyReminder } from '../../lib/notify';
import { validSrc } from '../../lib/source';
import type { FontScale, ThemeMode } from '../../lib/types';
import { useBrief } from '../../store';
import { R } from '../../theme';

const FONTS: [FontScale, string][] = [['small', '작게'], ['normal', '보통'], ['large', '크게'], ['xlarge', '아주 크게']];
const THEMES: [ThemeMode, string][] = [['system', '시스템'], ['light', '라이트'], ['dark', '다크']];
const INTERVALS = [15, 30, 60, 180];
const KEEPS = [30, 90, 180];

function Field({ label, value, onChange, secure, placeholder }: { label: string; value: string; onChange: (v: string) => void; secure?: boolean; placeholder?: string }) {
  const { t, fs } = useUi();
  return (
    <View style={{ gap: 4 }}>
      <Txt size={12} color={t.sub} bold>{label}</Txt>
      <TextInput value={value} onChangeText={onChange} secureTextEntry={secure} autoCapitalize="none" autoCorrect={false} placeholder={placeholder} placeholderTextColor={t.faint} accessibilityLabel={label}
        style={{ minHeight: 44, borderRadius: R.sm, backgroundColor: t.input, paddingHorizontal: 12, color: t.text, fontSize: fs(15) }} />
    </View>
  );
}

export default function Settings() {
  const { t } = useUi();
  const { prefs, setPrefs, hasToken, setToken, removeToken, editions, index, status, cache, clearCache, refresh, latest } = useBrief();
  const [owner, setOwner] = useState(prefs.owner);
  const [repo, setRepo] = useState(prefs.repo);
  const [branch, setBranch] = useState(prefs.branch);
  const [tok, setTok] = useState('');
  const [stats, setStats] = useState({ editions: 0, bytes: 0 });
  const reload = useCallback(() => { cache().then(setStats); }, [cache]);
  useEffect(reload, [reload, editions.length]);

  const regions = orderRegions(knownRegions(editions) as never, prefs, true) as { code: string; name: string; flag: string }[];
  const move = (code: string, dir: -1 | 1) => {
    const codes = regions.map((r) => r.code);
    const i = codes.indexOf(code), j = i + dir;
    if (j < 0 || j >= codes.length) return;
    [codes[i], codes[j]] = [codes[j], codes[i]];
    setPrefs({ regionOrder: codes });
  };
  const toggleRegion = (code: string) => setPrefs({ hiddenRegions: prefs.hiddenRegions.includes(code) ? prefs.hiddenRegions.filter((c) => c !== code) : [...prefs.hiddenRegions, code] });
  const saveRepo = async () => {
    const next = { owner: owner.trim(), repo: repo.trim(), branch: branch.trim() };
    if (!validSrc(next)) return Alert.alert('저장소 설정이 올바르지 않아요', '소유자·저장소·브랜치에는 영문, 숫자, . _ - 만 쓸 수 있어요.');
    await setPrefs(next);
    await clearCache();
    Alert.alert('저장했어요', '새 저장소에서 다시 불러와요.');
  };
  const notify = async (patch: Partial<typeof prefs>) => {
    const next = { ...prefs, ...patch };
    const r = await applyDailyReminder(next);
    if (!r.ok) { Alert.alert('알림을 켤 수 없어요', r.reason); await setPrefs({ ...patch, notify: false }); return; }
    await setPrefs(patch);
  };

  return (
    <Screen title="설정">
      <SectionTitle>데이터 저장소</SectionTitle>
      <Card style={{ gap: 10 }}>
        <Txt size={13} color={t.sub}>Claude Code 예약 작업이 요약해 이 GitHub 저장소에 올리면, 앱은 그 파일만 읽어요. 이 앱은 AI API 를 쓰지 않아서 비용이 들지 않아요. (GitHub 의 공개 파일은 반영까지 5분쯤 걸릴 수 있어요.)</Txt>
        <Field label="소유자" value={owner} onChange={setOwner} />
        <Field label="저장소" value={repo} onChange={setRepo} />
        <Field label="브랜치" value={branch} onChange={setBranch} />
        <Button title="저장소 변경 적용" kind="soft" onPress={saveRepo} />
        <Field label={hasToken ? 'GitHub 토큰 (저장됨 — 새로 입력하면 교체)' : 'GitHub 토큰 (비공개 저장소일 때만, 선택)'} value={tok} onChange={setTok} secure placeholder="github_pat_…" />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Button title="토큰 저장" kind="soft" disabled={!tok.trim()} onPress={async () => { await setToken(tok); setTok(''); refresh({ force: true }); }} /></View>
          {hasToken ? <View style={{ flex: 1 }}><Button title="토큰 삭제" kind="danger" onPress={async () => { await removeToken(); refresh({ force: true }); }} /></View> : null}
        </View>
        <Txt size={12} color={t.faint}>토큰은 이 기기의 보안 저장소에만 보관되고 읽기 전용(Contents: Read) 권한이면 충분해요.</Txt>
      </Card>

      <SectionTitle>관심 지역</SectionTitle>
      <Card style={{ gap: 8 }}>
        <Txt size={13} color={t.sub}>끄면 오늘 화면에서 숨겨지고, 화살표로 순서를 바꿔요.</Txt>
        {regions.map((r, i) => (
          <View key={r.code} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}>
            <Txt size={20}>{r.flag}</Txt>
            <Txt style={{ flex: 1 } as never} color={prefs.hiddenRegions.includes(r.code) ? t.faint : t.text}>{r.name}</Txt>
            <Pressable accessibilityLabel={`${r.name} 위로`} onPress={() => move(r.code, -1)} disabled={i === 0} hitSlop={8}><Txt size={18} color={i === 0 ? t.line : t.primary}>▲</Txt></Pressable>
            <Pressable accessibilityLabel={`${r.name} 아래로`} onPress={() => move(r.code, 1)} disabled={i === regions.length - 1} hitSlop={8}><Txt size={18} color={i === regions.length - 1 ? t.line : t.primary}>▼</Txt></Pressable>
            <Switch value={!prefs.hiddenRegions.includes(r.code)} onValueChange={() => toggleRegion(r.code)} />
          </View>
        ))}
      </Card>

      <SectionTitle>화면</SectionTitle>
      <Card style={{ gap: 10 }}>
        <Txt size={13} bold color={t.sub}>글자 크기</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{FONTS.map(([k, l]) => <Chip key={k} label={l} on={prefs.fontScale === k} onPress={() => setPrefs({ fontScale: k })} />)}</View>
        <Txt size={13} bold color={t.sub}>테마</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{THEMES.map(([k, l]) => <Chip key={k} label={l} on={prefs.theme === k} onPress={() => setPrefs({ theme: k })} />)}</View>
      </Card>

      <SectionTitle>새로고침 · 알림</SectionTitle>
      <Card style={{ gap: 10 }}>
        <Txt size={13} bold color={t.sub}>앱을 열 때 새로 확인하는 간격</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{INTERVALS.map((m) => <Chip key={m} label={m >= 60 ? `${m / 60}시간` : `${m}분`} on={prefs.refreshMinutes === m} onPress={() => setPrefs({ refreshMinutes: m })} />)}</View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Txt bold>오늘의 브리핑 알림</Txt>
            <Txt size={12} color={t.sub}>매일 정한 시각에 알려 줘요. 예약 작업이 올리는 시각(아침 7시대) 이후로 맞추세요.</Txt>
          </View>
          <Switch value={prefs.notify} onValueChange={(v) => notify({ notify: v })} />
        </View>
        {prefs.notify ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Chip label="− 10분" onPress={() => { const m = prefs.notifyHour * 60 + prefs.notifyMinute - 10; const c = (m + 1440) % 1440; notify({ notifyHour: Math.floor(c / 60), notifyMinute: c % 60 }); }} />
            <Txt bold size={18}>{String(prefs.notifyHour).padStart(2, '0')}:{String(prefs.notifyMinute).padStart(2, '0')}</Txt>
            <Chip label="+ 10분" onPress={() => { const m = prefs.notifyHour * 60 + prefs.notifyMinute + 10; const c = m % 1440; notify({ notifyHour: Math.floor(c / 60), notifyMinute: c % 60 }); }} />
          </View>
        ) : null}
      </Card>

      <SectionTitle>저장 공간</SectionTitle>
      <Card style={{ gap: 10 }}>
        <Txt>저장된 회차 {stats.editions}개 · {formatBytes(stats.bytes)}</Txt>
        <Txt size={13} bold color={t.sub}>보관할 최근 회차 수</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{KEEPS.map((k) => <Chip key={k} label={`${k}회`} on={prefs.keepEditions === k} onPress={() => setPrefs({ keepEditions: k })} />)}</View>
        <Button title="캐시 지우고 다시 받기" kind="danger" onPress={() => Alert.alert('캐시를 지울까요?', '저장한(북마크) 소식은 지워지지 않아요.', [{ text: '취소', style: 'cancel' }, { text: '지우기', style: 'destructive', onPress: async () => { await clearCache(); reload(); } }])} />
      </Card>

      <SectionTitle>앱 정보</SectionTitle>
      <Card style={{ gap: 4 }}>
        <Txt>World Brief 1.0.0</Txt>
        <Txt size={13} color={t.sub}>최신 회차: {index?.latest ?? latest?.id ?? '없음'}</Txt>
        <Txt size={13} color={t.sub}>데이터 형식 버전: {latest?.schemaVersion ?? index?.schemaVersion ?? '-'}</Txt>
        <Txt size={13} color={t.sub}>데이터: {prefs.owner}/{prefs.repo}@{prefs.branch}{status.offline ? ' (오프라인)' : ''}</Txt>
        <Txt size={12} color={t.faint}>뉴스는 Claude Code 예약 작업이 여러 출처를 읽고 요약한 것이에요. 사실 확인이 덜 된 내용은 「미확인 포함」으로 표시돼요. 중요한 결정 전에는 원문을 확인하세요.</Txt>
      </Card>
    </Screen>
  );
}
