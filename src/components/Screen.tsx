import type { PropsWithChildren } from 'react';
import { SafeAreaView, StyleSheet, View, type ViewStyle } from 'react-native';
import { colors } from '@/theme/tokens';
export function Screen({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) { return <SafeAreaView style={[styles.safe, style]}><View style={styles.body}>{children}</View></SafeAreaView>; }
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.canvas }, body: { flex: 1 } });
