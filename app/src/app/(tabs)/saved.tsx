import React, { useState } from 'react';
import { Alert, TextInput, View } from 'react-native';

import { ItemCard } from '../../components/ItemCard';
import { Screen } from '../../components/Screen';
import { Button, Empty, Txt, useUi } from '../../components/ui';
import { dateLabel } from '../../lib/time';
import { useBrief } from '../../store';
import { R } from '../../theme';

export default function Saved() {
  const { t, fs } = useUi();
  const { bookmarks, setNote, removeBookmark } = useBrief();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  return (
    <Screen title="저장" subtitle={`${bookmarks.length}개 · 별표로 저장하고 메모를 남겨요`}>
      {bookmarks.length === 0 ? <Empty icon="bookmark-outline" title="저장한 소식이 없어요" hint="카드의 북마크 버튼을 누르거나 카드를 길게 눌러 저장해 보세요. 원문이 지워져도 남아 있어요." /> : null}
      {bookmarks.map((b) => (
        <View key={b.key} style={{ gap: 6 }}>
          <Txt size={12} color={t.faint}>{dateLabel(b.editionDate)} · {b.flag} {b.regionName}</Txt>
          <ItemCard edition={{ id: b.editionId, date: b.editionDate }} region={{ code: b.regionCode, name: b.regionName, flag: b.flag }} item={b.item} compact />
          {editing === b.key ? (
            <View style={{ gap: 8 }}>
              <TextInput value={draft} onChangeText={setDraft} multiline placeholder="메모" placeholderTextColor={t.faint} maxLength={500} accessibilityLabel="메모 입력"
                style={{ minHeight: 70, borderRadius: R.md, backgroundColor: t.input, padding: 12, color: t.text, fontSize: fs(15), textAlignVertical: 'top' }} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}><Button title="메모 저장" onPress={async () => { await setNote(b.key, draft); setEditing(null); }} /></View>
                <View style={{ flex: 1 }}><Button title="취소" kind="soft" onPress={() => setEditing(null)} /></View>
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <View style={{ flex: 1 }}>{b.note ? <Txt size={14} color={t.sub}>📝 {b.note}</Txt> : <Txt size={13} color={t.faint}>메모 없음</Txt>}</View>
              <Txt size={13} bold color={t.primary} onPress={() => { setDraft(b.note); setEditing(b.key); }}>{b.note ? '메모 수정' : '메모 추가'}</Txt>
              <Txt size={13} bold color={t.danger} onPress={() => Alert.alert('저장을 삭제할까요?', b.item.title, [{ text: '취소', style: 'cancel' }, { text: '삭제', style: 'destructive', onPress: () => removeBookmark(b.key) }])}>삭제</Txt>
            </View>
          )}
        </View>
      ))}
    </Screen>
  );
}
