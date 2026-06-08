import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/context/AuthContext';
import { SyncProvider } from '../src/context/SyncContext';
import { colors } from '../src/theme';

export default function RootLayout() {
  return (
    <AuthProvider>
      <SyncProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bgCard },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '700', fontSize: 18 },
            contentStyle: { backgroundColor: colors.bg },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
        </Stack>
      </SyncProvider>
    </AuthProvider>
  );
}
