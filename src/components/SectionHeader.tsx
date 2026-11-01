import { StyleSheet, Text, View } from 'react-native';
import { colors, space } from '@/theme/tokens';
export function SectionHeader({ title, detail }: { title: string; detail?: string }) { return <View style={styles.row}><Text style={styles.title}>{title}</Text>{detail ? <Text style={styles.detail}>{detail}</Text> : null}</View>; }
const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: space.lg }, title: { color: colors.text, fontSize: 30, fontWeight: '700', letterSpacing: -0.7 }, detail: { color: colors.secondary, fontSize: 15 } });
