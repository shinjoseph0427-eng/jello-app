import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/features/auth/AuthProvider';
import { acceptFriendInvite, getFriendInvite, type FriendInvite } from '@/features/jello/api';
import { colors, radius, space } from '@/theme/tokens';

export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { session, loading } = useAuth();
  const [invite, setInvite] = useState<FriendInvite | null>(null);
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!session || !token) return;
    getFriendInvite(token).then((value) => { setInvite(value); setUnavailable(!value); }).catch(() => setUnavailable(true));
  }, [session, token]);

  if (loading) return <Screen><View style={styles.center}><ActivityIndicator color={colors.apricot} /></View></Screen>;
  if (!session) return <Screen><View style={styles.center}><Text style={styles.mark}>j.</Text><Text style={styles.title}>A friend invited you</Text><Text style={styles.copy}>Sign in to see who sent this private Jello invite.</Text><Pressable onPress={() => router.push({ pathname: '/auth/welcome', params: { returnTo: `/invite/${token}` } })} style={styles.primary}><Text style={styles.primaryText}>Continue to sign in</Text></Pressable></View></Screen>;
  if (unavailable) return <Screen><View style={styles.center}><Text style={styles.title}>This invite is unavailable</Text><Text style={styles.copy}>It may have expired, been revoked, or already been accepted.</Text><Pressable onPress={() => router.replace('/friends')} style={styles.secondary}><Text style={styles.secondaryText}>Open Friends</Text></Pressable></View></Screen>;
  if (!invite) return <Screen><View style={styles.center}><ActivityIndicator color={colors.apricot} /></View></Screen>;

  const accept = async () => {
    setBusy(true);
    try { await acceptFriendInvite(token); await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); router.replace('/friends'); }
    catch { setUnavailable(true); }
    finally { setBusy(false); }
  };

  return <Screen><View style={styles.center}><View style={styles.avatar}><Text style={styles.initial}>{invite.display_name[0]?.toUpperCase()}</Text></View><Text style={styles.title}>{invite.display_name}</Text><Text style={styles.handle}>@{invite.username}</Text><Text style={styles.copy}>wants to make Two Sides moments with you.</Text><Pressable disabled={busy} onPress={() => void accept()} style={[styles.primary, busy && styles.disabled]}><Text style={styles.primaryText}>{busy ? 'Adding…' : 'Accept friend'}</Text></Pressable><Pressable onPress={() => router.replace('/(tabs)')} style={styles.secondary}><Text style={styles.secondaryText}>Not now</Text></Pressable></View></Screen>;
}

const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl }, mark: { color: colors.apricot, fontSize: 62, fontWeight: '900', letterSpacing: -6, marginBottom: 24 }, avatar: { width: 96, height: 96, borderRadius: 34, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center', marginBottom: 22 }, initial: { color: '#211506', fontSize: 38, fontWeight: '900' }, title: { color: colors.text, fontSize: 30, fontWeight: '800', textAlign: 'center' }, handle: { color: colors.secondary, fontSize: 16, marginTop: 5 }, copy: { color: colors.secondary, fontSize: 16, lineHeight: 23, textAlign: 'center', maxWidth: 330, marginTop: 12, marginBottom: 28 }, primary: { width: '100%', minHeight: 56, borderRadius: radius.pill, backgroundColor: colors.apricot, alignItems: 'center', justifyContent: 'center' }, primaryText: { color: '#211506', fontSize: 17, fontWeight: '800' }, secondary: { minHeight: 50, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', marginTop: 8 }, secondaryText: { color: colors.text, fontSize: 16, fontWeight: '700' }, disabled: { opacity: 0.55 } });
