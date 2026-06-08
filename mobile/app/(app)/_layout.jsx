import { Redirect, Stack } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { colors } from '../../src/theme';

export default function AppLayout() {
  const { loading, isLoggedIn } = useAuth();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isLoggedIn) return <Redirect href="/login" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bgCard },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="home" options={{ title: 'Inicio' }} />
      <Stack.Screen name="scan" options={{ title: 'Escanear QR' }} />
      <Stack.Screen name="contenedor/[id]" options={{ title: 'Contenedor' }} />
      <Stack.Screen name="egreso" options={{ title: 'Registrar egreso' }} />
      <Stack.Screen name="ingreso" options={{ title: 'Registrar ingreso' }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', backgroundColor: colors.bg },
});
