import * as Contacts from 'expo-contacts/legacy';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActionSheetIOS, Alert, Linking, Modal, Platform, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { blockUser, createFriendInvite, getMyProfile, listFriends, listIncomingRequests, removeFriend, respondFriendRequest, searchPeople, sendFriendRequest, type Friend, type IncomingRequest } from '@/features/jello/api';
import { colors, radius, space } from '@/theme/tokens';

export default function FriendsScreen() {
  const params = useLocalSearchParams<{ username?: string }>();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<IncomingRequest[]>([]);
  const [contacts, setContacts] = useState<Contacts.ExistingContact[]>([]);
  const [me, setMe] = useState<Friend | null>(null);
  const [result, setResult] = useState<Friend | null>(null);
  const [query, setQuery] = useState(() => params.username ?? '');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [permissionSheet, setPermissionSheet] = useState(false);
  const handledInvite = useRef(false);

  const loadContacts = useCallback(async () => {
    const response = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers], sort: Contacts.SortTypes.FirstName });
    setContacts(response.data.filter((contact) => Boolean(contact.name)));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [nextFriends, nextRequests, profile] = await Promise.all([listFriends(), listIncomingRequests(), getMyProfile()]);
      setFriends(nextFriends); setRequests(nextRequests); setMe(profile);
      const permission = await Contacts.getPermissionsAsync();
      if (permission.granted) await loadContacts();
    } catch (error) { Alert.alert('Friends unavailable', error instanceof Error ? error.message : 'Check your connection and try again.'); }
    finally { setRefreshing(false); }
  }, [loadContacts]);

  const requestContacts = async () => {
    setPermissionSheet(false);
    const permission = await Contacts.requestPermissionsAsync();
    if (permission.granted) await loadContacts();
    else if (!permission.canAskAgain) Alert.alert('Contacts are off', 'Enable Contacts for Jello in iPhone Settings to find people you know.', [{ text: 'Not now', style: 'cancel' }, { text: 'Open Settings', onPress: () => void Linking.openSettings() }]);
  };

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const search = useCallback(async (value = query) => {
    const username = value.trim().replace(/^@/, '');
    if (username.length < 3) return;
    setBusy(true); setResult(null);
    try {
      const [person] = await searchPeople(username);
      setResult(person ?? null);
    } catch (error) { Alert.alert('Search failed', error instanceof Error ? error.message : 'Try again.'); }
    finally { setBusy(false); }
  }, [query]);

  useEffect(() => { if (params.username && !handledInvite.current) { handledInvite.current = true; void search(params.username); } }, [params.username, search]);

  const add = async (person: Friend) => {
    setBusy(true);
    try { await sendFriendRequest(person.id); await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setResult(null); Alert.alert('Request sent', `${person.display_name} will see your request.`); }
    catch (error) { Alert.alert('Request not sent', error instanceof Error ? error.message : 'Try again.'); }
    finally { setBusy(false); }
  };

  const respond = async (request: IncomingRequest, accept: boolean) => {
    setBusy(true);
    try { await respondFriendRequest(request.request_id, accept); await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); await refresh(); }
    catch (error) { Alert.alert('Request not updated', error instanceof Error ? error.message : 'Try again.'); }
    finally { setBusy(false); }
  };

  const makeInviteText = async () => {
    const token = await createFriendInvite();
    return `Join me on Jello. Tap once to add ${me?.display_name ?? 'your friend'}: jello://invite/${token}`;
  };
  const share = async () => { try { await Share.share({ message: await makeInviteText() }); } catch (error) { Alert.alert('Invite unavailable', error instanceof Error ? error.message : 'Try again.'); } };
  const message = async () => { try { const text = await makeInviteText(); await Linking.openURL(`sms:&body=${encodeURIComponent(text)}`); } catch { await share(); } };
  const inviteContact = async (contact: Contacts.ExistingContact) => {
    const number = contact.phoneNumbers?.[0]?.number;
    try { const text = await makeInviteText(); if (number) await Linking.openURL(`sms:${number}&body=${encodeURIComponent(text)}`); else await Share.share({ message: text }); }
    catch (error) { Alert.alert('Invite unavailable', error instanceof Error ? error.message : 'Try again.'); }
  };

  const confirmRemove = (person: Friend) => {
    const perform = async () => { try { await removeFriend(person.id); await refresh(); } catch (error) { Alert.alert('Friend not removed', error instanceof Error ? error.message : 'Try again.'); } };
    const block = async () => { try { await blockUser(person.id); await refresh(); } catch (error) { Alert.alert('Could not block', error instanceof Error ? error.message : 'Try again.'); } };
    if (Platform.OS === 'ios') ActionSheetIOS.showActionSheetWithOptions({ title: person.display_name, options: ['Cancel', 'Remove friend', 'Block'], cancelButtonIndex: 0, destructiveButtonIndex: 2 }, (index) => { if (index === 1) void perform(); if (index === 2) Alert.alert(`Block ${person.display_name}?`, 'They will not be able to find, invite, or send moments to you.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Block', style: 'destructive', onPress: () => void block() }]); });
    else Alert.alert(`Remove ${person.display_name}?`, undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => void perform() }]);
  };

  const filteredContacts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const list = normalized ? contacts.filter((contact) => contact.name.toLocaleLowerCase().includes(normalized)) : contacts;
    return list.slice(0, 20);
  }, [contacts, query]);

  const avatar = (name: string, index = 0) => <View style={[styles.avatar, { backgroundColor: [colors.lavender, colors.peach, colors.apricot, colors.success][index % 4] }]}><Text style={styles.initial}>{name[0]?.toUpperCase()}</Text></View>;
  const personRow = (person: Friend, action?: ReactNode, onLongPress?: () => void) => <Pressable key={person.id} onLongPress={onLongPress} style={({ pressed }) => [styles.person, pressed && styles.pressed]}>{avatar(person.display_name)}<View style={styles.personCopy}><Text style={styles.name}>{person.display_name}</Text><Text style={styles.username}>@{person.username}</Text></View>{action}</Pressable>;

  return <Screen>
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.apricot} onRefresh={() => { setRefreshing(true); void refresh(); }} />} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <View style={styles.hero}><Text style={styles.title}>Add your friends</Text><Text style={styles.subtitle}>Make Two Sides moments together.</Text></View>

      <View style={styles.searchBar}><SymbolView name="magnifyingglass" tintColor={colors.secondary} size={21} /><TextInput value={query} onChangeText={(value) => { setQuery(value.replace(/^@/, '')); setResult(null); }} onSubmitEditing={() => void search()} autoCapitalize="none" autoCorrect={false} returnKeyType="search" textContentType="username" placeholder="Search username or contacts" placeholderTextColor={colors.secondary} style={styles.searchInput} /></View>
      {result ? personRow(result, <Pressable disabled={busy} onPress={() => void add(result)} style={styles.addButton}><Text style={styles.addButtonText}>+ Add</Text></Pressable>) : query.trim().length >= 3 && !busy ? <Pressable onPress={() => void search()} style={styles.usernameSearch}><SymbolView name="at" tintColor={colors.apricot} size={20} /><Text style={styles.usernameSearchText}>Search Jello for @{query.trim()}</Text></Pressable> : null}

      <View style={styles.block}>
        <Text style={styles.sectionTitle}>Share your Jello link</Text>
        <Pressable onPress={() => void message()} style={styles.actionRow}><View style={[styles.actionIcon, styles.messageIcon]}><SymbolView name="message.fill" tintColor="#FFFFFF" size={22} /></View><Text style={styles.actionText}>Messages</Text><SymbolView name="chevron.right" tintColor={colors.secondary} size={16} /></Pressable>
        <Pressable onPress={() => void share()} style={styles.actionRow}><View style={styles.actionIcon}><SymbolView name="square.and.arrow.up" tintColor={colors.text} size={21} /></View><Text style={styles.actionText}>Other apps</Text><SymbolView name="chevron.right" tintColor={colors.secondary} size={16} /></Pressable>
      </View>

      {requests.length ? <View style={styles.block}><View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Requests</Text><View style={styles.badge}><Text style={styles.badgeText}>{requests.length}</Text></View></View>{requests.map((request) => personRow(request, <View style={styles.requestActions}><Pressable disabled={busy} onPress={() => void respond(request, false)}><Text style={styles.notNow}>Not now</Text></Pressable><Pressable disabled={busy} onPress={() => void respond(request, true)} style={styles.addButton}><Text style={styles.addButtonText}>Accept</Text></Pressable></View>))}</View> : null}

      <View style={styles.block}>
        <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Your contacts</Text>{contacts.length ? <Text style={styles.sectionMeta}>{contacts.length}</Text> : null}</View>
        {!contacts.length ? <Pressable onPress={() => setPermissionSheet(true)} style={styles.contactsPrompt}><View style={styles.contactsArt}><SymbolView name="person.crop.circle.badge.plus" tintColor={colors.apricot} size={46} /></View><View style={styles.promptCopy}><Text style={styles.promptTitle}>Find people you know</Text><Text style={styles.promptText}>Contacts stay on this iPhone. Jello only uses them to help you invite friends.</Text></View><Text style={styles.allowText}>Allow</Text></Pressable> : filteredContacts.map((contact, index) => <View key={contact.id} style={styles.person}>{avatar(contact.name, index)}<View style={styles.personCopy}><Text style={styles.name}>{contact.name}</Text><Text style={styles.username}>{contact.phoneNumbers?.[0]?.label ?? 'Contact'}</Text></View><Pressable onPress={() => void inviteContact(contact)} style={styles.inviteButton}><Text style={styles.inviteButtonText}>Invite</Text></Pressable></View>)}
      </View>

      {friends.length ? <View style={styles.block}><View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Friends</Text><Text style={styles.sectionMeta}>{friends.length}/20</Text></View>{friends.map((person) => personRow(person, undefined, () => confirmRemove(person)))}</View> : null}

    </ScrollView>

    <Modal visible={permissionSheet} transparent animationType="fade" onRequestClose={() => setPermissionSheet(false)}><View style={styles.modalScrim}><View style={styles.permissionCard}><View style={styles.permissionArt}><SymbolView name="person.3.fill" tintColor={colors.apricot} size={50} /></View><Text style={styles.permissionTitle}>Find your friends</Text><Text style={styles.permissionCopy}>Allow contact access to quickly invite people already on your phone.</Text><View style={styles.privacyRow}><SymbolView name="lock.fill" tintColor={colors.secondary} size={14} /><Text style={styles.privacyText}>Your contacts are never posted publicly</Text></View><Pressable onPress={() => setPermissionSheet(false)} style={styles.laterButton}><Text style={styles.laterText}>Not now</Text></Pressable><Pressable onPress={() => void requestContacts()} style={styles.allowButton}><Text style={styles.allowButtonText}>Allow contacts</Text></Pressable></View></View></Modal>
  </Screen>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.lg, paddingTop: 30, paddingBottom: 140, gap: 24 },
  hero: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  title: { color: colors.text, fontSize: 34, fontWeight: '800', letterSpacing: -1.2 },
  subtitle: { color: colors.secondary, fontSize: 17, marginTop: 7 },
  searchBar: { height: 58, borderRadius: 19, backgroundColor: colors.raised, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 11 },
  searchInput: { flex: 1, height: '100%', color: colors.text, fontSize: 17, fontWeight: '600' },
  usernameSearch: { minHeight: 52, borderRadius: 16, backgroundColor: colors.surface, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  usernameSearchText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  block: { gap: 0 },
  sectionHeading: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '700' },
  sectionMeta: { color: colors.secondary, fontSize: 13, fontWeight: '600' },
  actionRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  actionIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.raised, alignItems: 'center', justifyContent: 'center' },
  messageIcon: { backgroundColor: '#34C759' },
  actionText: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '600' },
  person: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  personCopy: { flex: 1 },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  initial: { color: '#17110B', fontSize: 18, fontWeight: '800' },
  name: { color: colors.text, fontSize: 17, fontWeight: '600' },
  username: { color: colors.secondary, fontSize: 13, marginTop: 2 },
  pressed: { opacity: 0.58 },
  addButton: { backgroundColor: colors.apricot, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 9 },
  addButtonText: { color: '#211506', fontWeight: '800' },
  inviteButton: { borderRadius: radius.pill, backgroundColor: colors.raised, paddingHorizontal: 16, paddingVertical: 9 },
  inviteButtonText: { color: colors.apricot, fontWeight: '800' },
  requestActions: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  notNow: { color: colors.secondary, fontWeight: '600' },
  badge: { minWidth: 24, height: 24, borderRadius: 12, backgroundColor: colors.apricot, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#211506', fontSize: 12, fontWeight: '800' },
  contactsPrompt: { marginTop: 8, minHeight: 104, borderRadius: 22, padding: 16, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 13 },
  contactsArt: { width: 54, height: 54, borderRadius: 20, backgroundColor: '#FFB84D18', alignItems: 'center', justifyContent: 'center' },
  promptCopy: { flex: 1 },
  promptTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  promptText: { color: colors.secondary, fontSize: 12, lineHeight: 17, marginTop: 3 },
  allowText: { color: colors.apricot, fontSize: 14, fontWeight: '800' },
  modalScrim: { flex: 1, backgroundColor: '#000000B8', justifyContent: 'flex-end', padding: 14 },
  permissionCard: { borderRadius: 30, backgroundColor: '#202023', paddingHorizontal: 22, paddingTop: 28, paddingBottom: 18, alignItems: 'center', borderWidth: 1, borderColor: colors.hairline },
  permissionArt: { width: 86, height: 86, borderRadius: 30, backgroundColor: '#FFB84D16', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  permissionTitle: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.6 },
  permissionCopy: { color: colors.secondary, fontSize: 16, lineHeight: 22, textAlign: 'center', maxWidth: 330, marginTop: 9 },
  privacyRow: { marginTop: 22, marginBottom: 18, flexDirection: 'row', alignItems: 'center', gap: 7 },
  privacyText: { color: colors.secondary, fontSize: 13, fontWeight: '600' },
  laterButton: { width: '100%', height: 52, borderRadius: radius.pill, backgroundColor: colors.raised, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  laterText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  allowButton: { width: '100%', height: 56, borderRadius: radius.pill, backgroundColor: colors.apricot, alignItems: 'center', justifyContent: 'center' },
  allowButtonText: { color: '#211506', fontSize: 17, fontWeight: '800' },
});
