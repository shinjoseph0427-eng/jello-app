import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View, type ViewToken } from 'react-native';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/features/auth/AuthProvider';
import { listPublicMoments, recordPublicMomentImpressions, reportMoment, setMomentPublicConsent, togglePublicMomentLike, type PublicMoment } from '@/features/jello/api';
import { colors, radius, space } from '@/theme/tokens';

const viewabilityConfig = { itemVisiblePercentThreshold: 60, minimumViewTime: 800 };

export default function DiscoverScreen() {
  const { session } = useAuth();
  const [moments, setMoments] = useState<PublicMoment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const hasMore = useRef(true);
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken<PublicMoment>[] }) => {
    const ids = viewableItems.flatMap((entry) => entry.item?.id ? [entry.item.id] : []);
    void recordPublicMomentImpressions(ids).catch(() => undefined);
  }, []);
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try { const next = await listPublicMoments(); setMoments(next); hasMore.current = next.length === 20; }
    catch (error) { Alert.alert('Could not load Discover', error instanceof Error ? error.message : 'Try again.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const loadMore = async () => {
    if (loadingMore || !hasMore.current || !moments.length) return;
    setLoadingMore(true);
    try {
      const next = await listPublicMoments(moments.length);
      setMoments((current) => [...current, ...next.filter((item) => !current.some((existing) => existing.id === item.id))]);
      hasMore.current = next.length === 20;
    } finally { setLoadingMore(false); }
  };
  const like = async (moment: PublicMoment) => {
    const optimistic = !moment.liked_by_me;
    setMoments((current) => current.map((item) => item.id === moment.id ? { ...item, liked_by_me: optimistic, like_count: Math.max(0, item.like_count + (optimistic ? 1 : -1)) } : item));
    try {
      const actual = await togglePublicMomentLike(moment.id);
      if (actual !== optimistic) await refresh();
    } catch { await refresh(); }
  };
  const options = (moment: PublicMoment) => {
    const mine = session?.user.id === moment.initiator_id || session?.user.id === moment.responder_id;
    if (mine) Alert.alert('Your public moment', 'Either participant can make it private immediately.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Make private', style: 'destructive', onPress: () => void setMomentPublicConsent(moment.id, false).then(refresh).catch(() => Alert.alert('Could not update')) }]);
    else Alert.alert('Public moment', 'Report content that violates Jello safety rules.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Report', style: 'destructive', onPress: () => void reportMoment(moment.id, 'other').then(() => Alert.alert('Report received')).catch(() => Alert.alert('Could not report')) }]);
  };

  return <Screen><FlatList
    data={moments}
    keyExtractor={(item) => item.id}
    contentContainerStyle={styles.content}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.apricot} />}
    onEndReached={() => void loadMore()}
    onEndReachedThreshold={0.6}
    viewabilityConfig={viewabilityConfig}
    onViewableItemsChanged={onViewableItemsChanged}
    ListHeaderComponent={<View style={styles.header}><Pressable onPress={() => router.back()} hitSlop={12}><Text style={styles.back}>‹</Text></Pressable><View><Text style={styles.title}>Discover</Text><Text style={styles.subtitle}>Shared by both people</Text></View><View style={styles.spacer} /></View>}
    ListEmptyComponent={loading ? <ActivityIndicator color={colors.apricot} /> : <View style={styles.empty}><SymbolView name="globe" tintColor={colors.secondary} size={34} /><Text style={styles.emptyTitle}>Nothing public yet.</Text><Text style={styles.emptyCopy}>A moment appears here only after both people approve it.</Text></View>}
    ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footer} color={colors.apricot} /> : null}
    renderItem={({ item: moment }) => {
      const vertical = moment.layout === 'top' || moment.layout === 'bottom';
      const first = moment.layout === 'left' || moment.layout === 'top';
      const one = <Image key="one" source={{ uri: moment.side_one_url }} style={styles.side} contentFit="cover" transition={150} />;
      const two = <Image key="two" source={{ uri: moment.side_two_url }} style={styles.side} contentFit="cover" transition={150} />;
      return <Pressable onLongPress={() => options(moment)} style={styles.card}><View style={[styles.photo, vertical && styles.vertical]}>{first ? <>{one}{two}</> : <>{two}{one}</>}</View><View style={styles.meta}><View style={styles.copy}><Text style={styles.names}>{moment.initiator_name} + {moment.responder_name}</Text>{moment.caption ? <Text style={styles.caption}>{moment.caption}</Text> : null}</View><Pressable accessibilityRole="button" accessibilityLabel={moment.liked_by_me ? 'Unlike moment' : 'Like moment'} onPress={() => void like(moment)} hitSlop={10} style={styles.like}><SymbolView name={moment.liked_by_me ? 'heart.fill' : 'heart'} tintColor={moment.liked_by_me ? colors.apricot : colors.secondary} size={24} /><Text style={styles.count}>{moment.like_count}</Text></Pressable></View></Pressable>;
    }}
  /></Screen>;
}
const styles = StyleSheet.create({
  content: { paddingBottom: 100, gap: 20 }, header: { height: 76, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, back: { color: colors.text, fontSize: 38 }, title: { color: colors.text, fontSize: 22, fontWeight: '900', textAlign: 'center' }, subtitle: { color: colors.secondary, fontSize: 12, marginTop: 2 }, spacer: { width: 24 }, card: { marginHorizontal: space.md, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface }, photo: { height: 400, flexDirection: 'row' }, vertical: { flexDirection: 'column' }, side: { flex: 1 }, meta: { flexDirection: 'row', alignItems: 'center', padding: 16 }, copy: { flex: 1 }, names: { color: colors.text, fontSize: 16, fontWeight: '800' }, caption: { color: colors.secondary, fontSize: 14, marginTop: 5 }, like: { minWidth: 56, gap: 3, alignItems: 'center' }, count: { color: colors.secondary, fontSize: 12 }, empty: { padding: 28, margin: 18, alignItems: 'center', borderRadius: radius.lg, backgroundColor: colors.surface }, emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 12 }, emptyCopy: { color: colors.secondary, marginTop: 8, lineHeight: 21, textAlign: 'center' }, footer: { margin: 20 },
});
