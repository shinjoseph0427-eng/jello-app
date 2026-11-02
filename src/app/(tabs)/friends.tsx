import { useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { listFriends, listIncomingRequests, respondFriendRequest, searchPeople, sendFriendRequest, type Friend, type IncomingRequest } from '@/features/jello/api';
import { colors, radius, space } from '@/theme/tokens';

export default function FriendsScreen() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<IncomingRequest[]>([]);
  const [results, setResults] = useState<Friend[]>([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    try { const [nextFriends, nextRequests] = await Promise.all([listFriends(), listIncomingRequests()]); setFriends(nextFriends); setRequests(nextRequests); }
    catch (error) { Alert.alert('Could not load friends', error instanceof Error ? error.message : 'Try again.'); }
  }, []);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const search = async () => { if (query.trim().length < 2) return; setBusy(true); try { setResults(await searchPeople(query.trim())); } catch (error) { Alert.alert('Search failed', error instanceof Error ? error.message : 'Try again.'); } finally { setBusy(false); } };
  const add = async (person: Friend) => { setBusy(true); try { await sendFriendRequest(person.id); setResults((items) => items.filter((item) => item.id !== person.id)); Alert.alert('Request sent', `${person.display_name} can now accept you in Jello.`); } catch (error) { Alert.alert('Could not send request', error instanceof Error ? error.message : 'Try again.'); } finally { setBusy(false); } };
  const respond = async (request: IncomingRequest, accept: boolean) => { setBusy(true); try { await respondFriendRequest(request.request_id, accept); await refresh(); } catch (error) { Alert.alert('Could not update request', error instanceof Error ? error.message : 'Try again.'); } finally { setBusy(false); } };
  const row = (person: Friend, action?: ReactNode) => <View key={person.id} style={styles.person}><View style={styles.avatar}><Text style={styles.initial}>{person.display_name[0]?.toUpperCase()}</Text></View><View style={styles.personCopy}><Text style={styles.name}>{person.display_name}</Text><Text style={styles.username}>@{person.username}</Text></View>{action}</View>;
  return <Screen><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <SectionHeader title="Friends" detail={`${friends.length} close ${friends.length === 1 ? 'friend' : 'friends'}`} />
    <View style={styles.searchRow}><TextInput value={query} onChangeText={setQuery} onSubmitEditing={() => void search()} accessibilityLabel="Search friends" autoCapitalize="none" returnKeyType="search" placeholder="Search username or name" placeholderTextColor={colors.secondary} style={styles.search} /><Pressable disabled={busy || query.trim().length < 2} onPress={() => void search()} style={styles.searchButton}><Text style={styles.searchButtonText}>Search</Text></Pressable></View>
    {results.map((person) => row(person, <Pressable disabled={busy} onPress={() => void add(person)} style={styles.smallButton}><Text style={styles.smallButtonText}>Add</Text></Pressable>))}
    {requests.length > 0 && <><Text style={styles.label}>REQUESTS</Text>{requests.map((request) => row(request, <View style={styles.requestActions}><Pressable disabled={busy} onPress={() => void respond(request, false)}><Text style={styles.decline}>Not now</Text></Pressable><Pressable disabled={busy} onPress={() => void respond(request, true)} style={styles.smallButton}><Text style={styles.smallButtonText}>Accept</Text></Pressable></View>))}</>}
    <Text style={styles.label}>YOUR PEOPLE</Text>
    {friends.length ? friends.map((person) => row(person)) : <View style={styles.empty}><Text style={styles.emptyTitle}>Jello needs two people.</Text><Text style={styles.emptyCopy}>Search for a second account, send a request, and accept it there. Then your first Two Sides moment is ready.</Text></View>}
  </ScrollView></Screen>;
}
const styles = StyleSheet.create({ content: { paddingTop: space.lg, paddingBottom: 120 }, searchRow: { flexDirection: 'row', gap: 8, margin: space.lg, marginBottom: space.sm }, search: { flex: 1, height: 48, paddingHorizontal: 16, backgroundColor: colors.surface, borderRadius: radius.md, color: colors.text, fontSize: 16 }, searchButton: { height: 48, paddingHorizontal: 16, borderRadius: radius.md, backgroundColor: colors.apricot, justifyContent: 'center' }, searchButtonText: { color: '#211506', fontWeight: '800' }, label: { color: colors.secondary, fontSize: 12, fontWeight: '700', letterSpacing: 1.1, marginHorizontal: space.lg, marginTop: space.xl, marginBottom: space.sm }, person: { minHeight: 72, marginHorizontal: space.md, borderBottomWidth: 1, borderBottomColor: colors.hairline, flexDirection: 'row', alignItems: 'center', gap: 14 }, avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lavender }, initial: { color: '#17110B', fontSize: 18, fontWeight: '800' }, personCopy: { flex: 1 }, name: { color: colors.text, fontSize: 17, fontWeight: '600' }, username: { color: colors.secondary, fontSize: 14, marginTop: 2 }, smallButton: { backgroundColor: colors.apricot, borderRadius: radius.pill, paddingHorizontal: 15, paddingVertical: 9 }, smallButtonText: { color: '#211506', fontWeight: '800' }, requestActions: { flexDirection: 'row', alignItems: 'center', gap: 12 }, decline: { color: colors.secondary, fontWeight: '600' }, empty: { marginHorizontal: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface }, emptyTitle: { color: colors.text, fontSize: 21, fontWeight: '800' }, emptyCopy: { color: colors.secondary, fontSize: 15, lineHeight: 21, marginTop: 8 } });
