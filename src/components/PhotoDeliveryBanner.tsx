import { useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPhotoOutboxStatus, subscribePhotoOutbox } from '@/features/jello/photoOutbox';
import { colors, radius } from '@/theme/tokens';

const copy = {
  sending: ['Sending photo…', 'It’s safe to keep using Jello'],
  retrying: ['Photo saved', 'Sending when the connection returns'],
  sent: ['Photo sent', 'Delivered to your moment'],
} as const;

export function PhotoDeliveryBanner() {
  const status = useSyncExternalStore(subscribePhotoOutbox, getPhotoOutboxStatus, getPhotoOutboxStatus);
  const insets = useSafeAreaInsets();
  if (status === 'idle') return null;
  const [title, detail] = copy[status];
  return <View pointerEvents="none" style={[styles.wrap, { top: Math.max(insets.top, 10) + 6 }]}>
    <View style={styles.banner}>
      <View style={[styles.indicator, status === 'sent' && styles.sent, status === 'retrying' && styles.retrying]} />
      <View style={styles.copy}><Text style={styles.title}>{title}</Text><Text style={styles.detail}>{detail}</Text></View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 14, right: 14, zIndex: 1000, alignItems: 'center' },
  banner: { width: '100%', maxWidth: 430, minHeight: 58, borderRadius: radius.md, paddingHorizontal: 15, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#252529F2', borderWidth: 1, borderColor: '#FFFFFF24', shadowColor: '#000', shadowOpacity: 0.34, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  indicator: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.apricot },
  sent: { backgroundColor: colors.success },
  retrying: { backgroundColor: colors.lavender },
  copy: { flex: 1 },
  title: { color: colors.text, fontSize: 14, fontWeight: '800' },
  detail: { color: colors.secondary, fontSize: 11, marginTop: 2 },
});
