import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import { Redirect, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { colors, radius, space } from '@/theme/tokens';

WebBrowser.maybeCompleteAuthSession();

export default function WelcomeScreen() {
  const { session } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  if (session) return <Redirect href="/(tabs)" />;

  const apple = async () => {
    if (!supabase) return;
    setBusy(true);
    try {
      const rawNonce = Crypto.randomUUID();
      const nonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
        nonce,
      });
      if (!credential.identityToken) throw new Error('Apple did not return an identity token.');
      const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken, nonce: rawNonce });
      if (error) throw error;
      const fullName = [credential.fullName?.givenName, credential.fullName?.middleName, credential.fullName?.familyName].filter(Boolean).join(' ');
      if (fullName) {
        await supabase.auth.updateUser({ data: { full_name: fullName, given_name: credential.fullName?.givenName, family_name: credential.fullName?.familyName } });
      }
      router.replace('/(tabs)');
    } catch (error) {
      if ((error as { code?: string }).code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Sign in failed', error instanceof Error ? error.message : 'Try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    if (!supabase) return;
    setBusy(true);
    try {
      const redirectTo = Linking.createURL('auth/callback');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true, queryParams: { access_type: 'offline', prompt: 'consent' } },
      });
      if (error) throw error;
      if (!data.url) throw new Error('Google did not return an authorization URL.');
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success') return;
      const callback = new URL(result.url);
      const query = new URLSearchParams(callback.search);
      const fragment = new URLSearchParams(callback.hash.replace(/^#/, ''));
      const authCode = query.get('code');
      if (authCode) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(authCode);
        if (exchangeError) throw exchangeError;
      } else {
        const accessToken = fragment.get('access_token');
        const refreshToken = fragment.get('refresh_token');
        if (!accessToken || !refreshToken) throw new Error(fragment.get('error_description') ?? 'Google did not return a session.');
        const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (sessionError) throw sessionError;
      }
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Google sign in failed', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const sendCode = async () => {
    if (!supabase || !email.trim()) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) Alert.alert('Could not send code', error.message);
    else setSent(true);
  };

  const verify = async () => {
    if (!supabase || !code.trim()) return;
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) Alert.alert('Code not accepted', error.message);
    else router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <View style={styles.art}>
        <View style={styles.card}>
          <View style={styles.sideA}><Text style={styles.you}>YOU</Text></View>
          <View style={styles.sideB}><Text style={styles.them}>THEM</Text></View>
        </View>
        <Text style={styles.mark}>j.</Text>
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>Two people. One moment.</Text>
        <Text style={styles.subtitle}>Take one side. Send it to someone close. They finish the photo.</Text>
      </View>
      <View style={styles.actions}>
        {Platform.OS === 'ios' ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={26}
            style={styles.apple}
            onPress={apple}
          />
        ) : null}
        <Pressable disabled={busy} onPress={google} style={styles.googleButton}>
          <Text style={styles.googleMark}>G</Text>
          <Text style={styles.googleText}>Continue with Google</Text>
        </Pressable>
        <View style={styles.divider}><View style={styles.line} /><Text style={styles.or}>or</Text><View style={styles.line} /></View>
        <TextInput value={email} onChangeText={setEmail} editable={!sent && !busy} autoCapitalize="none" keyboardType="email-address" placeholder="Email address" placeholderTextColor={colors.secondary} style={styles.input} />
        {sent ? <TextInput value={code} onChangeText={setCode} keyboardType="number-pad" placeholder="6-digit code" placeholderTextColor={colors.secondary} style={styles.input} /> : null}
        <Pressable disabled={busy} onPress={sent ? verify : sendCode} style={styles.button}>
          <Text style={styles.buttonText}>{busy ? 'Working…' : sent ? 'Verify code' : 'Continue with email'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas, paddingHorizontal: space.lg, paddingBottom: space.xl },
  art: { flex: 1.1, alignItems: 'center', justifyContent: 'center' },
  card: { width: 220, height: 270, borderRadius: radius.lg, overflow: 'hidden', flexDirection: 'row', transform: [{ rotate: '-4deg' }], borderWidth: 1, borderColor: colors.hairline },
  sideA: { flex: 1, backgroundColor: colors.apricot, alignItems: 'center', justifyContent: 'center' },
  sideB: { flex: 1, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center' },
  you: { color: '#2A1908', fontWeight: '900', letterSpacing: 1 },
  them: { color: '#251B46', fontWeight: '900', letterSpacing: 1 },
  mark: { position: 'absolute', color: colors.text, fontSize: 48, fontWeight: '900', letterSpacing: -5 },
  copy: { alignItems: 'center', gap: 10 },
  title: { color: colors.text, fontSize: 31, fontWeight: '800', letterSpacing: -0.8, textAlign: 'center' },
  subtitle: { color: colors.secondary, fontSize: 16, lineHeight: 23, textAlign: 'center', maxWidth: 340 },
  actions: { paddingTop: space.lg, gap: 12 },
  apple: { height: 52, width: '100%' },
  googleButton: { height: 52, borderRadius: radius.pill, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 12 },
  googleMark: { color: '#4285F4', fontSize: 20, fontWeight: '900' },
  googleText: { color: '#1F1F1F', fontSize: 17, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  line: { flex: 1, height: 1, backgroundColor: colors.hairline },
  or: { color: colors.secondary, fontSize: 13 },
  input: { height: 52, borderRadius: radius.md, backgroundColor: colors.surface, color: colors.text, fontSize: 17, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.hairline },
  button: { height: 52, borderRadius: radius.pill, backgroundColor: colors.apricot, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#211506', fontSize: 17, fontWeight: '800' },
});
