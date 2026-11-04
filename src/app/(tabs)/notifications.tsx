import * as Notifications from 'expo-notifications';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import {
  dismissNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '@/features/jello/api';
import { colors, radius, space } from '@/theme/tokens';

const iconByType: Record<AppNotification['event_type'], 'person.badge.plus' | 'person.2.fill' | 'camera.fill' | 'rectangle.split.2x1.fill' | 'heart.fill' | 'globe' | 'checkmark.circle.fill'> = {
  friend_request: 'person.badge.plus',
  friend_accepted: 'person.2.fill',
  moment_received: 'camera.fill',
  moment_completed: 'rectangle.split.2x1.fill',
  reaction: 'heart.fill',
  public_approval_requested: 'globe',
  moment_published: 'checkmark.circle.fill',
};

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d` : new Date(value).toLocaleDateString();
}

export default function NotificationsScreen() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const unread = useMemo(() => items.filter((item) => !item.read_at).length, [items]);
  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try { const next = await listNotifications(); setItems(next); void Notifications.setBadgeCountAsync(next.filter((item) => !item.read_at).length); }
    catch (error) { if (!quiet) Alert.alert('Could not load notifications', error instanceof Error ? error.message : 'Try again.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { void refresh(true); }, [refresh]));
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(() => void refresh(true));
    return () => subscription.remove();
  }, [refresh]);

  const open = async (item: AppNotification) => {
    if (!item.read_at) {
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read_at: new Date().toISOString() } : entry));
      void Notifications.setBadgeCountAsync(Math.max(0, unread - 1));
      await markNotificationRead(item.id).catch(() => refresh(true));
    }
    const url = item.data?.url;
    if (typeof url === 'string' && url.startsWith('/')) router.push(url as never);
  };
  const markAll = async () => {
    const now = new Date().toISOString();
    setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? now })));
    void Notifications.setBadgeCountAsync(0);
    await markAllNotificationsRead().catch(() => refresh(true));
  };
  const remove = async (item: AppNotification) => {
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    await dismissNotification(item.id).catch(() => refresh(true));
  };

  return <Screen>
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.apricot} onRefresh={() => void refresh()} />}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      ListHeaderComponent={<View style={styles.header}>
        <SectionHeader title="Notifications" detail={unread ? `${unread} unread` : 'All caught up'} />
        {unread ? <Pressable onPress={() => void markAll()} hitSlop={12}><Text style={styles.markAll}>Mark all read</Text></Pressable> : null}
      </View>}
      ListEmptyComponent={loading ? <ActivityIndicator color={colors.apricot} /> : <View style={styles.empty}><SymbolView name="bell.slash" tintColor={colors.secondary} size={34} /><Text style={styles.emptyTitle}>Nothing new</Text><Text style={styles.emptyCopy}>Friend requests, replies, completed moments and public-sharing approvals will stay here.</Text></View>}
      renderItem={({ item }) => <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.title}. ${item.body}`}
        onPress={() => void open(item)}
        onLongPress={() => Alert.alert(item.title, 'Remove this notification from your inbox?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => void remove(item) }])}
        style={({ pressed }) => [styles.row, !item.read_at && styles.unread, pressed && styles.pressed]}
      >
        <View style={[styles.icon, !item.read_at && styles.iconUnread]}><SymbolView name={iconByType[item.event_type]} tintColor={!item.read_at ? '#211506' : colors.secondary} size={20} /></View>
        <View style={styles.copy}><View style={styles.titleLine}><Text numberOfLines={1} style={[styles.title, !item.read_at && styles.titleUnread]}>{item.title}</Text><Text style={styles.time}>{relativeTime(item.created_at)}</Text></View><Text numberOfLines={2} style={styles.body}>{item.body}</Text></View>
        {!item.read_at ? <View style={styles.dot} /> : null}
      </Pressable>}
    />
  </Screen>;
}

const styles = StyleSheet.create({
  content: { paddingTop: space.lg, paddingBottom: 120, gap: 2 },
  header: { marginBottom: space.sm },
  markAll: { position: 'absolute', right: space.md, top: 7, color: colors.apricot, fontSize: 14, fontWeight: '700' },
  row: { marginHorizontal: space.md, minHeight: 82, borderRadius: radius.md, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  unread: { backgroundColor: '#FFB84D14' },
  pressed: { opacity: 0.7 },
  icon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.raised },
  iconUnread: { backgroundColor: colors.apricot },
  copy: { flex: 1, gap: 4 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: colors.text, fontSize: 15, fontWeight: '600', flex: 1 },
  titleUnread: { fontWeight: '800' },
  body: { color: colors.secondary, fontSize: 14, lineHeight: 19 },
  time: { color: colors.secondary, fontSize: 12 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.apricot },
  empty: { margin: space.md, padding: space.xl, alignItems: 'center', borderRadius: radius.lg, backgroundColor: colors.surface },
  emptyTitle: { marginTop: 12, color: colors.text, fontSize: 20, fontWeight: '800' },
  emptyCopy: { marginTop: 8, color: colors.secondary, textAlign: 'center', lineHeight: 21 },
});
