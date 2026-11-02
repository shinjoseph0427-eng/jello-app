import { Pressable, Share, StyleSheet, Text } from 'react-native';
import { colors, radius } from '@/theme/tokens';

type Props = { username: string };

export function NativeInviteButton({ username }: Props) {
  const clean = username.replace(/^@/, '');
  const share = () => Share.share({ message: `Add me on Jello as @${clean}. jello://friends?username=${encodeURIComponent(clean)}` });
  return <Pressable onPress={() => void share()} style={styles.button}><Text style={styles.text}>Share your Jello</Text></Pressable>;
}
const styles = StyleSheet.create({ button: { height: 52, borderRadius: radius.pill, backgroundColor: colors.apricot, alignItems: 'center', justifyContent: 'center' }, text: { color: '#211506', fontSize: 17, fontWeight: '800' } });
