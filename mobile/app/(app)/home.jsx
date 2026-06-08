import { Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useSync } from '../../src/context/SyncContext';
import Screen from '../../src/components/Screen';
import BigButton from '../../src/components/BigButton';
import { colors } from '../../src/theme';

export default function Home() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { isOnline, pendingCount, syncNow, syncing } = useSync();

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <Screen
      title={`Hola, ${user?.name?.split(' ')[0] || 'Operario'}`}
      subtitle={isOnline ? 'Conectado al servidor' : 'Modo offline activo'}
      onRefresh={syncNow}
      refreshing={syncing}
    >
      <BigButton title="Escanear QR" icon="📷" onPress={() => router.push('/(app)/scan')} />
      <BigButton
        title="Inventario por contenedor"
        icon="📦"
        variant="secondary"
        onPress={() => router.push('/(app)/scan')}
      />
      <BigButton title="Registrar egreso" icon="📤" onPress={() => router.push('/(app)/egreso')} />
      <BigButton
        title="Registrar ingreso"
        icon="📥"
        variant="success"
        onPress={() => router.push('/(app)/ingreso')}
      />

      {pendingCount > 0 && (
        <Pressable style={styles.pending} onPress={syncNow}>
          <Text style={styles.pendingText}>{pendingCount} acción(es) en cola offline</Text>
        </Pressable>
      )}

      <BigButton title="Cerrar sesión" variant="danger" onPress={handleLogout} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pending: {
    backgroundColor: colors.warning,
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  pendingText: { color: '#0f172a', fontWeight: '700', fontSize: 16, textAlign: 'center' },
});
