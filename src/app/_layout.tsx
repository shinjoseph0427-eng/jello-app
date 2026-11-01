import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }));
  return <GestureHandlerRootView style={{ flex: 1 }}><QueryClientProvider client={queryClient}><StatusBar style="light" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0B0B0C' } }} /></QueryClientProvider></GestureHandlerRootView>;
}
