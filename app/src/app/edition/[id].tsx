import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';

import { EditionView } from '../../components/EditionView';
import { Screen } from '../../components/Screen';
import { Empty, Skeleton } from '../../components/ui';
import type { Edition } from '../../lib/types';
import { useBrief } from '../../store';

export default function EditionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEdition, ready } = useBrief();
  const [ed, setEd] = useState<Edition | null | undefined>(undefined);
  useEffect(() => {
    if (!ready || !id) return;
    getEdition(String(id)).then(setEd);
  }, [id, ready, getEdition]);
  return (
    <Screen topInset={false} title={undefined}>
      <Stack.Screen options={{ title: ed ? `${ed.date} ${ed.slot === 'am' ? '아침' : '저녁'}` : '브리핑' }} />
      {ed === undefined ? <Skeleton lines={6} height={18} /> : ed ? <EditionView edition={ed} /> : <Empty icon="cloud-offline-outline" title="이 브리핑을 불러올 수 없어요" hint="네트워크를 확인하고 다시 시도해 주세요." />}
    </Screen>
  );
}
