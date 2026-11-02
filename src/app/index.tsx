import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import { colors } from '@/theme/tokens';
export default function Index() {
  const { session, loading } = useAuth();
  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}><ActivityIndicator color={colors.apricot} /></View>;
  return <Redirect href={session ? '/(tabs)' : '/auth/welcome'} />;
}
