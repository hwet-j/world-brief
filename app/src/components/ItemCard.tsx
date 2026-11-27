import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React from 'react';
import { Alert, Pressable, Share, Text, View } from 'react-native';

import { isHttps } from '../lib/parse';
import { highlightRanges } from '../lib/search';
import { shareText } from '../lib/share';
import type { Item, Region } from '../lib/types';
import { useBrief } from '../store';
import { R } from '../theme';
import { Badge, Card, Txt, useUi } from './ui';

/** 검색어가 있으면 그 부분을 강조해 그린다 */
function Hl({ text, query, size, color, bold }: { text: string; query?: string; size: number; color?: string; bold?: boolean }) {
  const { t, fs } = useUi();
  const ranges = query ? highlightRanges(text, query) : [];
  if (!ranges.length) return <Txt size={size} color={color} bold={bold}>{text}</Txt>;
  const parts: React.ReactNode[] = [];
  let at = 0;
  ranges.forEach(([a, b], i) => {
    if (a > at) parts.push(text.slice(at, a));
    parts.push(<Text key={i} style={{ backgroundColor: t.warnSoft, color: t.text }}>{text.slice(a, b)}</Text>);
    at = b;
  });
  if (at < text.length) parts.push(text.slice(at));
  return <Text style={{ fontSize: fs(size), lineHeight: fs(size) * 1.45, color: color ?? t.text, fontWeight: bold ? '700' : '400' }}>{parts}</Text>;
}

export async function openLink(url: string) {
  if (!isHttps(url)) return Alert.alert('열 수 없는 링크예요', 'https 주소만 열 수 있어요.');
  try { await WebBrowser.openBrowserAsync(url); } catch { Alert.alert('링크를 열 수 없어요'); }
}

export function ItemCard({ edition, region, item, query, compact }: { edition: { id: string; date: string }; region: Pick<Region, 'code' | 'name' | 'flag'>; item: Item; query?: string; compact?: boolean }) {
  const { t, fs } = useUi();
  const { isBookmarked, toggleBookmark } = useBrief();
  const saved = isBookmarked(edition.id, item.id);
  const toggle = async () => { await toggleBookmark(edition, region, item); };
  const dots = [1, 2, 3].map((n) => <View key={n} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: n <= item.importance ? t.primary : t.line }} />);
  return (
    <Card onLongPress={toggle} label={item.title} style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View accessibilityLabel={`중요도 ${item.importance}`} style={{ flexDirection: 'row', gap: 3 }}>{dots}</View>
        {item.isUpdate ? <Badge label="후속" tone="primary" /> : null}
        {item.confidence === 'low' ? <Badge label="미확인 포함" tone="warn" /> : item.confidence === 'medium' ? <Badge label="단일 출처" /> : null}
        <View style={{ flex: 1 }} />
        <Pressable accessibilityRole="button" accessibilityLabel={saved ? '저장 해제' : '저장'} onPress={toggle} hitSlop={10}>
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={22} color={saved ? t.primary : t.faint} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="공유" onPress={() => Share.share({ message: shareText(item, region, edition.date) })} hitSlop={10}>
          <Ionicons name="share-outline" size={22} color={t.faint} />
        </Pressable>
      </View>
      <Hl text={item.title} query={query} size={compact ? 16 : 17} bold />
      <Hl text={item.summary} query={query} size={15} color={t.text} />
      {item.whyItMatters ? (
        <View style={{ borderLeftWidth: 3, borderLeftColor: t.primary, paddingLeft: 10 }}>
          <Txt size={14} color={t.sub}><Text style={{ fontWeight: '800', color: t.primary }}>왜 중요한가 </Text>{item.whyItMatters}</Txt>
        </View>
      ) : null}
      {item.tags.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {item.tags.map((tag) => (
            <Pressable key={tag} accessibilityRole="button" accessibilityLabel={`${tag} 이슈 추적`} onPress={() => router.push({ pathname: '/tag/[tag]', params: { tag } })} hitSlop={4}
              style={{ backgroundColor: t.input, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: t.sub, fontSize: fs(12), fontWeight: '600' }}>#{tag}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {item.sources.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {item.sources.map((s) => (
            <Pressable key={s.url} accessibilityRole="link" accessibilityLabel={`${s.name} 원문 열기`} onPress={() => openLink(s.url)} hitSlop={4}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: t.line, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Ionicons name="open-outline" size={13} color={t.primary} />
              <Text style={{ color: t.primary, fontSize: fs(12), fontWeight: '700' }}>{s.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Card>
  );
}
