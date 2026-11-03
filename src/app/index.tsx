import { Link, Redirect } from 'expo-router';
import { ActivityIndicator, Image, Platform, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import { colors } from '@/theme/tokens';
export default function Index() {
  const { session, loading } = useAuth();
  if (Platform.OS === 'web') return <View style={styles.web}><View style={styles.webNav}><Text style={styles.wordmark}>JELLO</Text><View style={styles.webLinks}><Link href="/privacy" style={styles.webLink}>Privacy</Link><Link href="/terms" style={styles.webLink}>Terms</Link></View></View><View style={styles.webHero}><Image source={require('../../assets/images/jello-app-icon.png')} style={styles.icon} /><Text style={styles.webTitle}>Two people.{`\n`}Two moments.{`\n`}One photo.</Text><Text style={styles.webCopy}>A private photo ritual built for the people you actually know.</Text></View></View>;
  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}><ActivityIndicator color={colors.apricot} /></View>;
  return <Redirect href={session ? '/(tabs)' : '/auth/welcome'} />;
}
const styles = StyleSheet.create({ web: { flex: 1, minHeight: '100%', backgroundColor: '#FFFDF8', paddingHorizontal: 24 }, webNav: { width: '100%', maxWidth: 1080, alignSelf: 'center', height: 78, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#E9E1D2' }, wordmark: { color: '#F3A621', fontSize: 24, fontWeight: '900', letterSpacing: -1.5 }, webLinks: { flexDirection: 'row', gap: 22 }, webLink: { color: '#4D4335', fontSize: 14, fontWeight: '700', textDecorationLine: 'none' }, webHero: { width: '100%', maxWidth: 1080, alignSelf: 'center', flex: 1, minHeight: 650, justifyContent: 'center', paddingVertical: 60 }, icon: { width: 92, height: 92, borderRadius: 24, marginBottom: 30 }, webTitle: { color: '#201A13', fontSize: 68, lineHeight: 68, letterSpacing: -4, fontWeight: '900', maxWidth: 760 }, webCopy: { color: '#675B4B', fontSize: 20, lineHeight: 30, maxWidth: 560, marginTop: 24 } });
