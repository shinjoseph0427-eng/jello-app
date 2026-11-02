import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { useAuth } from '@/features/auth/AuthProvider';
import { listMoments, type Moment } from '@/features/jello/api';
import { colors, radius, space } from '@/theme/tokens';

export default function MomentsScreen() {
  const { session } = useAuth();
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => { try { setMoments(await listMoments()); } catch (error) { Alert.alert('Could not load moments', error instanceof Error ? error.message : 'Try again.'); } finally { setLoading(false); } }, []);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  return <Screen><ScrollView refreshControl={<RefreshControl refreshing={loading} tintColor={colors.apricot} onRefresh={() => { setLoading(true); void refresh(); }} />} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
    <SectionHeader title="Moments" detail="Private by default" />
    {loading && !moments.length ? <ActivityIndicator color={colors.apricot} /> : null}
    {!loading && !moments.length ? <View style={styles.empty}><Text style={styles.emptyTitle}>Your first moment starts in Camera.</Text><Text style={styles.emptyCopy}>Take one side, send it to a friend, and this space reveals the completed photo when they reply.</Text></View> : null}
    {moments.map((moment) => {
      const canReply = moment.status === 'waiting_for_friend' && moment.responder_id === session?.user.id;
      const status = moment.status === 'completed' ? 'Two Sides complete' : canReply ? 'Your side is waiting' : `Waiting for ${moment.other_display_name}`;
      const isColumn = moment.layout === 'top' || moment.layout === 'bottom';
      const sideOneFirst = moment.layout === 'left' || moment.layout === 'top';
      const sideOne = <View key="one" style={styles.half}>{moment.side_one_url ? <Image source={{ uri: moment.side_one_url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Text style={styles.waiting}>?</Text>}</View>;
      const sideTwo = <View key="two" style={[styles.half, styles.second]}>{moment.side_two_url ? <Image source={{ uri: moment.side_two_url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Text style={styles.waiting}>?</Text>}</View>;
      return <View key={moment.id} style={[styles.card, isColumn && styles.cardHorizontal]}>
        {sideOneFirst ? <>{sideOne}{sideTwo}</> : <>{sideTwo}{sideOne}</>}
        <View pointerEvents="none" style={isColumn ? styles.centerDividerHorizontal : styles.centerDividerVertical} />
        <View style={styles.meta}><View style={styles.metaCopy}><Text style={styles.name}>{moment.other_display_name}</Text><Text style={styles.time}>{status}</Text></View>{canReply ? <Pressable onPress={() => router.push({ pathname: '/reply/[id]', params: { id: moment.id, name: moment.other_display_name, layout: moment.layout, sideOneUrl: moment.side_one_url } })} style={styles.replyButton}><Text style={styles.replyText}>Reply</Text></Pressable> : null}</View>
      </View>;
    })}
  </ScrollView></Screen>;
}
const styles = StyleSheet.create({ content: { paddingTop: space.lg, paddingBottom: 120, gap: space.md }, card: { height: 430, marginHorizontal: space.md, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface, flexDirection: 'row', borderWidth: 1, borderColor: colors.hairline }, cardHorizontal: { flexDirection: 'column' }, half: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.peach }, second: { backgroundColor: colors.raised }, centerDividerVertical: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, backgroundColor: colors.hairline }, centerDividerHorizontal: { position: 'absolute', left: 0, right: 0, top: '50%', height: 1, backgroundColor: colors.hairline }, waiting: { color: colors.secondary, fontSize: 42, fontWeight: '300' }, meta: { position: 'absolute', left: 14, right: 14, bottom: 14, padding: 14, borderRadius: radius.md, backgroundColor: '#0B0B0CDD', flexDirection: 'row', alignItems: 'center', gap: 12 }, metaCopy: { flex: 1 }, name: { color: colors.text, fontSize: 17, fontWeight: '700' }, time: { color: colors.secondary, marginTop: 3, fontSize: 13 }, replyButton: { backgroundColor: colors.apricot, borderRadius: radius.pill, paddingHorizontal: 17, paddingVertical: 10 }, replyText: { color: '#211506', fontWeight: '800' }, empty: { marginHorizontal: space.md, padding: space.xl, borderRadius: radius.lg, backgroundColor: colors.surface }, emptyTitle: { color: colors.text, fontSize: 22, fontWeight: '800' }, emptyCopy: { color: colors.secondary, marginTop: 9, fontSize: 15, lineHeight: 22 } });
