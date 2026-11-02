import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import { colors } from '@/theme/tokens';
export default function TabLayout() {
  const { session, loading, profile, profileLoading } = useAuth();
  if (loading || profileLoading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}><ActivityIndicator color={colors.apricot} /></View>;
  if (!session) return <Redirect href="/auth/welcome" />;
  if (!profile?.username_completed) return <Redirect href="/onboarding/profile" />;
  return <NativeTabs tintColor="#FFB84D" backgroundColor="#111113" minimizeBehavior="onScrollDown">
    <NativeTabs.Trigger name="index"><NativeTabs.Trigger.Icon sf={{ default: 'camera', selected: 'camera.fill' }} /><NativeTabs.Trigger.Label>Camera</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="moments"><NativeTabs.Trigger.Icon sf={{ default: 'rectangle.split.2x1', selected: 'rectangle.split.2x1.fill' }} /><NativeTabs.Trigger.Label>Moments</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="friends"><NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} /><NativeTabs.Trigger.Label>Friends</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="profile"><NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} /><NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label></NativeTabs.Trigger>
  </NativeTabs>;
}
