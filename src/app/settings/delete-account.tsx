import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/features/auth/AuthProvider';
import { deleteMyAccount } from '@/features/jello/api';
import { colors, radius, space } from '@/theme/tokens';

export default function DeleteAccountScreen() {
  const { signOut } = useAuth();
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const remove = async () => { setBusy(true); try { await deleteMyAccount(); await signOut(); router.replace('/auth/welcome'); } catch (error) { Alert.alert('Account not deleted', error instanceof Error ? error.message : 'Try again.'); } finally { setBusy(false); } };
  return <Screen><View style={styles.header}><Pressable onPress={() => router.back()}><Text style={styles.back}>‹</Text></Pressable><Text style={styles.headerTitle}>Delete account</Text><View style={styles.spacer} /></View><View style={styles.content}><Text style={styles.title}>Delete your Jello?</Text><Text style={styles.copy}>This permanently deletes your profile, photos, moments, friendships, invitations, push tokens, and account. This cannot be undone.</Text><Text style={styles.label}>Type DELETE to confirm</Text><TextInput value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" autoCorrect={false} placeholder="DELETE" placeholderTextColor={colors.secondary} style={styles.input} /><Pressable disabled={confirmation !== 'DELETE' || busy} onPress={() => Alert.alert('Delete account permanently?', 'All of your Jello data will be removed.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void remove() }])} style={[styles.button, (confirmation !== 'DELETE' || busy) && styles.disabled]}><Text style={styles.buttonText}>{busy ? 'Deleting…' : 'Delete account'}</Text></Pressable></View></Screen>;
}
const styles = StyleSheet.create({ header: { height: 62, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, back: { color: colors.text, fontSize: 40, fontWeight: '300' }, headerTitle: { color: colors.text, fontSize: 18, fontWeight: '700' }, spacer: { width: 24 }, content: { flex: 1, padding: space.lg }, title: { color: colors.text, fontSize: 30, fontWeight: '800' }, copy: { color: colors.secondary, fontSize: 16, lineHeight: 23, marginTop: 10 }, label: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 30, marginBottom: 8 }, input: { height: 54, borderRadius: radius.md, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: 16, fontSize: 17, borderWidth: 1, borderColor: colors.hairline }, button: { minHeight: 54, borderRadius: radius.pill, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', marginTop: 18 }, buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' }, disabled: { opacity: 0.35 } });
