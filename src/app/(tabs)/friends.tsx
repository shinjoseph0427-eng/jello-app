import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeInviteButton } from '@/components/NativeInviteButton';
import { Screen } from '@/components/Screen';
import { getMyProfile, listFriends, listIncomingRequests, removeFriend, respondFriendRequest, searchPeople, sendFriendRequest, type Friend, type IncomingRequest } from '@/features/jello/api';
import { colors, radius, space } from '@/theme/tokens';

export default function FriendsScreen() {
  const params = useLocalSearchParams<{ username?: string }>();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<IncomingRequest[]>([]);
  const [me, setMe] = useState<Friend | null>(null);
  const [result, setResult] = useState<Friend | null>(null);
  const [query, setQuery] = useState(() => params.username ?? '');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const handledInvite = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const [nextFriends, nextRequests, profile] = await Promise.all([listFriends(), listIncomingRequests(), getMyProfile()]);
      setFriends(nextFriends); setRequests(nextRequests); setMe(profile);
    } catch (error) { Alert.alert('Friends unavailable', error instanceof Error ? error.message : 'Check your connection and try again.'); }
    finally { setRefreshing(false); }
  }, []);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const search = useCallback(async (value = query) => {
    const username = value.trim().replace(/^@/, '');
    if (username.length < 3) return;
    setBusy(true); setResult(null);
    try {
      const [person] = await searchPeople(username);
      setResult(person ?? null);
      if (!person) Alert.alert('Username not found', `No one is using @${username} yet.`);
    } catch (error) { Alert.alert('Search failed', error instanceof Error ? error.message : 'Try again.'); }
    finally { setBusy(false); }
  }, [query]);

  useEffect(() => { if (params.username && !handledInvite.current) { handledInvite.current = true; void search(params.username); } }, [params.username, search]);

  const add = async (person: Friend) => {
    setBusy(true);
    try { await sendFriendRequest(person.id); await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setResult(null); Alert.alert('Request sent', `${person.display_name} will see it at the top of Friends.`); }
    catch (error) { Alert.alert('Request not sent', error instanceof Error ? error.message : 'Try again.'); }
    finally { setBusy(false); }
  };
  const respond = async (request: IncomingRequest, accept: boolean) => {
    setBusy(true);
    try { await respondFriendRequest(request.request_id, accept); await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); await refresh(); }
    catch (error) { Alert.alert('Request not updated', error instanceof Error ? error.message : 'Try again.'); }
    finally { setBusy(false); }
  };
  const confirmRemove = (person: Friend) => {
    const perform = async () => { try { await removeFriend(person.id); await refresh(); } catch (error) { Alert.alert('Friend not removed', error instanceof Error ? error.message : 'Try again.'); } };
    if (Platform.OS === 'ios') ActionSheetIOS.showActionSheetWithOptions({ title: person.display_name, message: 'They will no longer be able to start new moments with you.', options: ['Cancel', 'Remove friend'], cancelButtonIndex: 0, destructiveButtonIndex: 1 }, (index) => { if (index === 1) void perform(); });
    else Alert.alert(`Remove ${person.display_name}?`, 'They will no longer be able to start new moments with you.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => void perform() }]);
  };
  const personRow = (person: Friend, action?: ReactNode, onLongPress?: () => void) => <Pressable key={person.id} onLongPress={onLongPress} style={({ pressed }) => [styles.person, pressed && styles.pressed]}><View style={styles.avatar}><Text style={styles.initial}>{person.display_name[0]?.toUpperCase()}</Text></View><View style={styles.personCopy}><Text style={styles.name}>{person.display_name}</Text><Text style={styles.username}>@{person.username}</Text></View>{action}</Pressable>;

  return <Screen><ScrollView refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.apricot} onRefresh={() => { setRefreshing(true); void refresh(); }} />} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <View style={styles.header}><View><Text style={styles.title}>Your people</Text><Text style={styles.subtitle}>Keep it close. Jello is for people you know.</Text></View><View style={styles.counter}><Text style={styles.counterValue}>{friends.length}</Text><Text style={styles.counterLimit}>/ 20</Text></View></View>

    <View style={styles.inviteCard}><View style={styles.inviteCopy}><Text style={styles.inviteTitle}>One photo needs two people.</Text><Text style={styles.inviteText}>{me ? `Share @${me.username} with someone close.` : 'Share your Jello with someone close.'}</Text></View>{me ? <NativeInviteButton username={me.username} /> : null}</View>

    <View style={styles.searchBlock}><Text style={styles.sectionTitle}>Add by username</Text><Text style={styles.sectionHint}>Enter the exact username a friend shared with you.</Text><View style={styles.searchRow}><Text style={styles.at}>@</Text><TextInput value={query} onChangeText={(value) => { setQuery(value.replace(/^@/, '')); setResult(null); }} onSubmitEditing={() => void search()} autoCapitalize="none" autoCorrect={false} returnKeyType="search" textContentType="username" placeholder="username" placeholderTextColor={colors.secondary} style={styles.search} /><Pressable disabled={busy || query.trim().length < 3} onPress={() => void search()} style={({ pressed }) => [styles.searchButton, pressed && styles.pressed, (busy || query.trim().length < 3) && styles.disabled]}><Text style={styles.searchButtonText}>Find</Text></Pressable></View>{result ? personRow(result, <Pressable disabled={busy} onPress={() => void add(result)} style={styles.addButton}><Text style={styles.addButtonText}>Add</Text></Pressable>) : null}</View>

    {requests.length > 0 ? <View style={styles.section}><View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Requests</Text><View style={styles.badge}><Text style={styles.badgeText}>{requests.length}</Text></View></View>{requests.map((request) => personRow(request, <View style={styles.requestActions}><Pressable disabled={busy} onPress={() => void respond(request, false)}><Text style={styles.notNow}>Not now</Text></Pressable><Pressable disabled={busy} onPress={() => void respond(request, true)} style={styles.addButton}><Text style={styles.addButtonText}>Accept</Text></Pressable></View>))}</View> : null}

    <View style={styles.section}><View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Friends</Text><Text style={styles.holdHint}>{friends.length ? 'Hold to manage' : ''}</Text></View>{friends.length ? friends.map((person) => personRow(person, undefined, () => confirmRemove(person))) : <View style={styles.empty}><View style={styles.twoDots}><View style={[styles.emptyDot, { backgroundColor: colors.apricot }]} /><View style={[styles.emptyDot, { backgroundColor: colors.lavender }]} /></View><Text style={styles.emptyTitle}>Start with one person</Text><Text style={styles.emptyText}>Share your username or enter theirs. Once they accept, you can make a Two Sides moment together.</Text></View>}</View>
  </ScrollView></Screen>;
}

const styles = StyleSheet.create({ content: { padding: space.lg, paddingBottom: 120, gap: 24 }, header: { paddingTop: 8, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }, title: { color: colors.text, fontSize: 34, fontWeight: '800', letterSpacing: -1.1 }, subtitle: { color: colors.secondary, fontSize: 15, lineHeight: 20, marginTop: 5, maxWidth: 270 }, counter: { flexDirection: 'row', alignItems: 'baseline', paddingBottom: 3 }, counterValue: { color: colors.apricot, fontSize: 28, fontWeight: '800' }, counterLimit: { color: colors.secondary, fontSize: 15, fontWeight: '600' }, inviteCard: { backgroundColor: colors.surface, borderRadius: 26, padding: 18, gap: 16, borderWidth: 1, borderColor: colors.hairline }, inviteCopy: { gap: 5 }, inviteTitle: { color: colors.text, fontSize: 21, fontWeight: '800', letterSpacing: -0.3 }, inviteText: { color: colors.secondary, fontSize: 15, lineHeight: 20 }, searchBlock: { gap: 9 }, section: { gap: 0 }, sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }, sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '700' }, sectionHint: { color: colors.secondary, fontSize: 14, lineHeight: 19 }, searchRow: { height: 52, flexDirection: 'row', alignItems: 'center', borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline, overflow: 'hidden' }, at: { color: colors.secondary, fontSize: 18, fontWeight: '700', paddingLeft: 15 }, search: { flex: 1, height: '100%', paddingHorizontal: 4, color: colors.text, fontSize: 17 }, searchButton: { height: 38, minWidth: 66, marginRight: 7, borderRadius: 11, backgroundColor: colors.apricot, alignItems: 'center', justifyContent: 'center' }, searchButtonText: { color: '#211506', fontSize: 15, fontWeight: '800' }, disabled: { opacity: 0.4 }, person: { minHeight: 70, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline, flexDirection: 'row', alignItems: 'center', gap: 13 }, pressed: { opacity: 0.58 }, avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lavender }, initial: { color: '#17110B', fontSize: 18, fontWeight: '800' }, personCopy: { flex: 1 }, name: { color: colors.text, fontSize: 17, fontWeight: '600' }, username: { color: colors.secondary, fontSize: 14, marginTop: 2 }, addButton: { backgroundColor: colors.apricot, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 9 }, addButtonText: { color: '#211506', fontWeight: '800' }, requestActions: { flexDirection: 'row', alignItems: 'center', gap: 13 }, notNow: { color: colors.secondary, fontWeight: '600' }, badge: { minWidth: 24, height: 24, paddingHorizontal: 7, borderRadius: 12, backgroundColor: colors.apricot, alignItems: 'center', justifyContent: 'center' }, badgeText: { color: '#211506', fontSize: 13, fontWeight: '800' }, holdHint: { color: colors.secondary, fontSize: 13 }, empty: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 34, borderRadius: 24, backgroundColor: colors.surface }, twoDots: { height: 48, flexDirection: 'row', alignItems: 'center', marginBottom: 15 }, emptyDot: { width: 42, height: 42, borderRadius: 21, marginHorizontal: -5, borderWidth: 3, borderColor: colors.surface }, emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '800' }, emptyText: { color: colors.secondary, fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: 7 } });
