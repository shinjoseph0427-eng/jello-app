import { NativeTabs } from 'expo-router/unstable-native-tabs';
export default function TabLayout() {
  return <NativeTabs tintColor="#FFB84D" backgroundColor="#111113" minimizeBehavior="onScrollDown">
    <NativeTabs.Trigger name="index"><NativeTabs.Trigger.Icon sf={{ default: 'camera', selected: 'camera.fill' }} /><NativeTabs.Trigger.Label>Camera</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="moments"><NativeTabs.Trigger.Icon sf={{ default: 'rectangle.split.2x1', selected: 'rectangle.split.2x1.fill' }} /><NativeTabs.Trigger.Label>Moments</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="friends"><NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} /><NativeTabs.Trigger.Label>Friends</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="profile"><NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} /><NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label></NativeTabs.Trigger>
  </NativeTabs>;
}
