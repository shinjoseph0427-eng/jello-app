import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { registerPushToken } from '@/features/jello/api';

const DEVICE_ID_KEY = 'jello.push-device-id';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: true, shouldShowBanner: true, shouldShowList: true }),
});

async function deviceId() {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;
  const next = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await SecureStore.setItemAsync(DEVICE_ID_KEY, next);
  return next;
}

export async function pushPermissionStatus() {
  return (await Notifications.getPermissionsAsync()).status;
}

export async function enablePushNotifications() {
  if (!Device.isDevice) throw new Error('Push notifications require a physical device.');
  const current = await Notifications.getPermissionsAsync();
  const permission = current.status === 'granted' ? current : await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') throw new Error('Notifications are not allowed.');
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error('EAS project ID is missing.');
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await registerPushToken(token, await deviceId(), Platform.OS as 'ios' | 'android', Constants.expoConfig?.version);
  return token;
}
