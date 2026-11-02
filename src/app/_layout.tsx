import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { startPhotoOutbox } from '@/features/jello/photoOutbox';

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }));
  useEffect(() => { startPhotoOutbox(); }, []);
  return <GestureHandlerRootView style={{ flex: 1 }}><QueryClientProvider client={queryClient}><AuthProvider><StatusBar style="light" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0B0B0C' } }} /></AuthProvider></QueryClientProvider></GestureHandlerRootView>;
}
