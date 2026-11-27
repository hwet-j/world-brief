import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { ItemCard } from '../../../components/ItemCard';
import { Screen } from '../../../components/Screen';
import { Chip, Empty, Skeleton, Txt, useUi } from '../../../components/ui';
import { groupByTopic, orderRegions, TOPIC_ICON } from '../../../lib/group';
import type { Edition } from '../../../lib/types';
import { useBrief } from '../../../store';

export default function RegionScreen() {
  const { t, prefs } = useUi();
  const { editionId, code } = useLocalSearchParams<{ editionId: string; code: string }>();
  const { getEdition, ready } = useBrief();
  const [ed, setEd] = useState<Edition | null | undefined>(undefined);
  useEffect(() => {
    if (ready && editionId) getEdition(String(editionId)).then(setEd);
  }, [editionId, ready, getEdition]);

  const region = ed?.regions.find((r) => r.code === code);
  const regions = ed ? orderRegions(ed.regions, prefs, true) : [];
  return (
    <Screen topInset={false}>
      <Stack.Screen options={{ title: region ? `${region.flag} ${region.name}` : '지역 브리핑' }} />
      {ed === undefined ? <Skeleton lines={6} height={18} /> : null}
      {ed === null ? <Empty icon="cloud-offline-outline" title="불러올 수 없어요" /> : null}
      {ed ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {regions.map((r) => <Chip key={r.code} icon={r.flag} label={r.name} on={r.code === code} onPress={() => router.replace({ pathname: '/region/[editionId]/[code]', params: { editionId: ed.id, code: r.code } })} />)}
          </ScrollView>
          {!region ? <Empty title="이 지역은 이번 회차에 없어요" /> : (
            <>
              {region.summary ? <Txt color={t.sub}>{region.summary}</Txt> : null}
              {groupByTopic(region.items).map((g) => (
                <View key={g.topic} style={{ gap: 10 }}>
                  <Txt size={16} bold>{TOPIC_ICON[g.topic]} {g.label}</Txt>
                  {g.items.map((it) => <ItemCard key={it.id} edition={ed} region={region} item={it} />)}
                </View>
              ))}
            </>
          )}
        </>
      ) : null}
    </Screen>
  );
}
