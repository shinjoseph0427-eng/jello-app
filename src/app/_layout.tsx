import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { startPhotoOutbox } from '@/features/jello/photoOutbox';
import { PhotoDeliveryBanner } from '@/components/PhotoDeliveryBanner';

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }));
  useEffect(() => { startPhotoOutbox(); }, []);
  useEffect(() => { const subscription = Notifications.addNotificationResponseReceivedListener((response) => { const url = response.notification.request.content.data?.url; if (typeof url === 'string' && url.startsWith('/')) router.push(url as never); }); return () => subscription.remove(); }, []);
  return <GestureHandlerRootView style={{ flex: 1 }}><QueryClientProvider client={queryClient}><AuthProvider><StatusBar style="light" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0B0B0C' } }} /><PhotoDeliveryBanner /></AuthProvider></QueryClientProvider></GestureHandlerRootView>;
}
