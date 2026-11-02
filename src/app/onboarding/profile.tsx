import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import { setProfileIdentity } from '@/features/jello/api';
import { colors, radius, space } from '@/theme/tokens';

export default function ProfileOnboardingScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const editing = mode === 'edit';
  const { session, profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(() => profile?.display_name ?? session?.user.user_metadata.full_name ?? '');
  const [username, setUsername] = useState(() => profile?.username_completed ? profile.username : '');
  const [busy, setBusy] = useState(false);
  const cleanUsername = username.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24);
  const valid = cleanUsername.length >= 3 && displayName.trim().length >= 1 && displayName.trim().length <= 50;
  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await setProfileIdentity(cleanUsername, displayName.trim());
      await refreshProfile();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (editing) router.back(); else router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Could not save profile', error instanceof Error ? error.message : 'Try another username.');
    } finally { setBusy(false); }
  };
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
    <View style={styles.header}>{editing ? <Pressable onPress={() => router.back()} hitSlop={12}><Text style={styles.close}>×</Text></Pressable> : <View style={styles.closeSpace} />}<Text style={styles.mark}>j.</Text><View style={styles.closeSpace} /></View>
    <View style={styles.content}><View style={styles.pair}><View style={[styles.face, { backgroundColor: colors.apricot }]}><Text style={styles.faceText}>YOU</Text></View><View style={[styles.face, { backgroundColor: colors.lavender }]}><Text style={styles.faceText}>THEM</Text></View></View><Text style={styles.title}>{editing ? 'Your Jello identity' : 'What should friends call you?'}</Text><Text style={styles.subtitle}>Friends can only find you with your exact username. You can change it later.</Text>
      <View style={styles.fields}><Text style={styles.label}>Display name</Text><TextInput value={displayName} onChangeText={(value) => setDisplayName(value.slice(0, 50))} textContentType="name" autoCapitalize="words" placeholder="Your name" placeholderTextColor={colors.secondary} style={styles.input} /><Text style={styles.label}>Username</Text><View style={styles.usernameField}><Text style={styles.at}>@</Text><TextInput value={cleanUsername} onChangeText={setUsername} textContentType="username" autoCapitalize="none" autoCorrect={false} placeholder="username" placeholderTextColor={colors.secondary} style={styles.usernameInput} /></View><Text style={styles.help}>3–24 characters · letters, numbers, and underscores</Text></View>
    </View>
    <Pressable disabled={!valid || busy} onPress={() => void save()} style={({ pressed }) => [styles.button, (!valid || busy) && styles.disabled, pressed && styles.pressed]}><Text style={styles.buttonText}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Continue'}</Text></Pressable>
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.canvas, paddingHorizontal: space.lg, paddingBottom: 30 }, header: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, close: { color: colors.text, fontSize: 34, fontWeight: '300' }, closeSpace: { width: 24 }, mark: { color: colors.text, fontSize: 30, fontWeight: '900', letterSpacing: -3 }, content: { flex: 1, justifyContent: 'center' }, pair: { flexDirection: 'row', alignSelf: 'center', marginBottom: 28 }, face: { width: 76, height: 76, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginHorizontal: -5, borderWidth: 4, borderColor: colors.canvas, transform: [{ rotate: '-3deg' }] }, faceText: { color: '#211506', fontSize: 11, fontWeight: '900', letterSpacing: 0.8 }, title: { color: colors.text, fontSize: 32, lineHeight: 37, fontWeight: '800', letterSpacing: -0.9, textAlign: 'center' }, subtitle: { color: colors.secondary, fontSize: 16, lineHeight: 22, textAlign: 'center', marginTop: 10, paddingHorizontal: 12 }, fields: { marginTop: 34, gap: 8 }, label: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 8 }, input: { height: 54, borderRadius: radius.md, paddingHorizontal: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline, color: colors.text, fontSize: 17 }, usernameField: { height: 54, borderRadius: radius.md, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline }, at: { color: colors.secondary, fontSize: 17, fontWeight: '700' }, usernameInput: { flex: 1, height: '100%', color: colors.text, fontSize: 17, paddingHorizontal: 3 }, help: { color: colors.secondary, fontSize: 13 }, button: { height: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.apricot }, buttonText: { color: '#211506', fontSize: 17, fontWeight: '800' }, disabled: { opacity: 0.35 }, pressed: { transform: [{ scale: 0.99 }] } });
