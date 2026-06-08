import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSync } from '../context/SyncContext';
import { colors } from '../theme';

export default function OfflineBanner() {
  const { isOnline, pendingCount, syncing, offlineLabel, syncNow } = useSync();

  if (isOnline && pendingCount === 0) return null;

  return (
    <Pressable
      style={[styles.banner, !isOnline ? styles.offline : styles.pending]}
      onPress={syncNow}
      disabled={syncing || !isOnline}
    >
      <Text style={styles.text}>
        {syncing
          ? '⟳ Sincronizando...'
          : offlineLabel || 'Sin conexión - trabajando offline'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { paddingVertical: 12, paddingHorizontal: 16 },
  offline: { backgroundColor: colors.warning },
  pending: { backgroundColor: colors.primary },
  text: { color: '#fff', fontWeight: '800', fontSize: 15, textAlign: 'center' },
});
