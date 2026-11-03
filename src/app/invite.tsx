import { Redirect, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function InviteEntry() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  if (!token) return <View style={styles.page}><Text style={styles.mark}>JELLO</Text><Text style={styles.title}>This invite link is incomplete.</Text><Text style={styles.copy}>Ask your friend to send a new invitation from Jello.</Text></View>;
  return <Redirect href={{ pathname: '/invite/[token]', params: { token } }} />;
}
const styles = StyleSheet.create({ page: { flex: 1, minHeight: '100%', backgroundColor: '#FFFDF8', alignItems: 'center', justifyContent: 'center', padding: 28 }, mark: { color: '#F3A621', fontSize: 26, fontWeight: '900' }, title: { color: '#201A13', fontSize: 28, fontWeight: '900', textAlign: 'center', marginTop: 22 }, copy: { color: '#675B4B', fontSize: 16, lineHeight: 24, textAlign: 'center', marginTop: 10 } });
