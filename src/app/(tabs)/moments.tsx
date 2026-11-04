import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { useAuth } from '@/features/auth/AuthProvider';
import { blockUser, listMoments, reportMoment, setMomentPublicConsent, type Moment } from '@/features/jello/api';
import { syncLatestMomentToWidget } from '@/features/widgets/syncWidget';
import { colors, radius, space } from '@/theme/tokens';

export default function MomentsScreen() {
  const { session } = useAuth();
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try { const next = await listMoments(); setMoments(next); void syncLatestMomentToWidget(next).catch(() => undefined); }
    catch (error) { Alert.alert('Could not load moments', error instanceof Error ? error.message : 'Try again.'); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const setPublic = async (moment: Moment, consent: boolean, caption?: string) => {
    try {
      const state = await setMomentPublicConsent(moment.id, consent, caption);
      await refresh();
      if (!consent) Alert.alert('Moment is private', 'Your approval was removed immediately.');
      else if (state === 'public') Alert.alert('Moment is public', 'Both people approved. Either person can make it private at any time.');
      else Alert.alert('Approval sent', `${moment.other_display_name} must approve before anyone else can see it.`);
    } catch (error) { Alert.alert('Could not update sharing', error instanceof Error ? error.message : 'Try again.'); }
  };
  const publicOptions = (moment: Moment) => {
    if (moment.approved_by_me) {
      Alert.alert(moment.visibility === 'public' ? 'Public moment' : 'Approval pending', moment.visibility === 'public' ? 'Anyone signed into Jello can discover this moment.' : `Waiting for ${moment.other_display_name}. It is still private.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Make private', style: 'destructive', onPress: () => void setPublic(moment, false) }]);
      return;
    }
    const approve = (caption?: string) => Alert.alert('Share publicly?', 'Both photos and both display names may appear in Discover. You can make it private later.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Approve', onPress: () => void setPublic(moment, true, caption) }]);
    if (Platform.OS === 'ios') Alert.prompt('Public caption', 'Optional. It appears after both people approve.', (caption) => approve(caption.trim()), 'plain-text', moment.public_caption ?? '', 'default');
    else approve(moment.public_caption ?? undefined);
  };
  const safetyOptions = (moment: Moment) => Alert.alert(moment.other_display_name, 'Safety options', [{ text: 'Cancel', style: 'cancel' }, { text: 'Report', onPress: () => void reportMoment(moment.id, 'other').then(() => Alert.alert('Report received', 'You can also block this person immediately.')).catch((error) => Alert.alert('Report not sent', error instanceof Error ? error.message : 'Try again.')) }, { text: 'Block', style: 'destructive', onPress: () => { const targetId = moment.initiator_id === session?.user.id ? moment.responder_id : moment.initiator_id; void blockUser(targetId).then(refresh).catch((error) => Alert.alert('Could not block', error instanceof Error ? error.message : 'Try again.')); } }]);

  return <Screen><ScrollView refreshControl={<RefreshControl refreshing={loading} tintColor={colors.apricot} onRefresh={() => { setLoading(true); void refresh(); }} />} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
    <SectionHeader title="Moments" detail="Private by default" />
    <Pressable onPress={() => router.push('/discover')} style={styles.discover}><Text style={styles.discoverText}>Discover public moments</Text><Text style={styles.discoverArrow}>›</Text></Pressable>
    {loading && !moments.length ? <ActivityIndicator color={colors.apricot} /> : null}
    {!loading && !moments.length ? <View style={styles.empty}><Text style={styles.emptyTitle}>Your first moment starts in Camera.</Text><Text style={styles.emptyCopy}>Take one side, send it to a friend, and this space reveals the completed photo when they reply.</Text></View> : null}
    {moments.map((moment) => {
      const canReply = moment.status === 'waiting_for_friend' && moment.responder_id === session?.user.id;
      const status = moment.status === 'completed' ? 'Two Sides complete' : canReply ? 'Your side is waiting' : `Waiting for ${moment.other_display_name}`;
      const isColumn = moment.layout === 'top' || moment.layout === 'bottom';
      const sideOneFirst = moment.layout === 'left' || moment.layout === 'top';
      const sideOne = <View key="one" style={styles.half}>{moment.side_one_url ? <Image source={{ uri: moment.side_one_url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Text style={styles.waiting}>?</Text>}</View>;
      const sideTwo = <View key="two" style={[styles.half, styles.second]}>{moment.side_two_url ? <Image source={{ uri: moment.side_two_url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Text style={styles.waiting}>?</Text>}</View>;
      const sharingLabel = moment.visibility === 'public' ? 'Public' : moment.approved_by_me ? 'Waiting' : moment.approved_by_other ? 'Approve?' : 'Private';
      return <Pressable key={moment.id} onLongPress={() => safetyOptions(moment)} style={[styles.card, isColumn && styles.cardHorizontal]}>
        {sideOneFirst ? <>{sideOne}{sideTwo}</> : <>{sideTwo}{sideOne}</>}
        <View pointerEvents="none" style={isColumn ? styles.centerDividerHorizontal : styles.centerDividerVertical} />
        <View style={styles.meta}><View style={styles.metaCopy}><Text style={styles.name}>{moment.other_display_name}</Text><Text style={styles.time}>{status}</Text></View>
          {moment.status === 'completed' ? <Pressable onPress={() => publicOptions(moment)} style={[styles.shareButton, moment.visibility === 'public' && styles.shareButtonOn]}><SymbolView name={moment.visibility === 'public' ? 'globe' : 'lock.fill'} tintColor={moment.visibility === 'public' ? '#211506' : colors.text} size={13} /><Text style={[styles.shareText, moment.visibility === 'public' && styles.shareTextOn]}>{sharingLabel}</Text></Pressable> : null}
          {canReply ? <Pressable onPress={() => router.push({ pathname: '/reply/[id]', params: { id: moment.id, name: moment.other_display_name, layout: moment.layout, sideOneUrl: moment.side_one_url } })} style={styles.replyButton}><Text style={styles.replyText}>Reply</Text></Pressable> : null}
        </View>
      </Pressable>;
    })}
  </ScrollView></Screen>;
}
const styles = StyleSheet.create({
  content: { paddingTop: space.lg, paddingBottom: 120, gap: space.md }, discover: { marginHorizontal: space.md, minHeight: 54, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center' }, discoverText: { color: colors.text, fontWeight: '700', fontSize: 15, flex: 1 }, discoverArrow: { color: colors.apricot, fontSize: 28 },
  card: { height: 430, marginHorizontal: space.md, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface, flexDirection: 'row', borderWidth: 1, borderColor: colors.hairline }, cardHorizontal: { flexDirection: 'column' }, half: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.peach }, second: { backgroundColor: colors.raised }, centerDividerVertical: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, backgroundColor: colors.hairline }, centerDividerHorizontal: { position: 'absolute', left: 0, right: 0, top: '50%', height: 1, backgroundColor: colors.hairline }, waiting: { color: colors.secondary, fontSize: 42, fontWeight: '300' },
  meta: { position: 'absolute', left: 14, right: 14, bottom: 14, padding: 14, borderRadius: radius.md, backgroundColor: '#0B0B0CDD', flexDirection: 'row', alignItems: 'center', gap: 8 }, metaCopy: { flex: 1 }, name: { color: colors.text, fontSize: 17, fontWeight: '700' }, time: { color: colors.secondary, marginTop: 3, fontSize: 13 }, shareButton: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.hairline, borderRadius: radius.pill, paddingHorizontal: 11 }, shareButtonOn: { backgroundColor: colors.apricot, borderColor: colors.apricot }, shareText: { color: colors.text, fontSize: 12, fontWeight: '800' }, shareTextOn: { color: '#211506' }, replyButton: { backgroundColor: colors.apricot, borderRadius: radius.pill, paddingHorizontal: 17, paddingVertical: 10 }, replyText: { color: '#211506', fontWeight: '800' },
  empty: { marginHorizontal: space.md, padding: space.xl, borderRadius: radius.lg, backgroundColor: colors.surface }, emptyTitle: { color: colors.text, fontSize: 22, fontWeight: '800' }, emptyCopy: { color: colors.secondary, marginTop: 9, fontSize: 15, lineHeight: 22 },
});
