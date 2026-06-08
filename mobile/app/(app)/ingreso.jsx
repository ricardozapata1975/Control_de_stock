import { useCallback, useEffect, useState } from 'react';
import { Alert, Text, StyleSheet, Pressable } from 'react-native';
import { api } from '../../src/services/api';
import { useSync } from '../../src/context/SyncContext';
import Screen from '../../src/components/Screen';
import BigButton from '../../src/components/BigButton';
import { colors, layout } from '../../src/theme';

export default function Ingreso() {
  const { executeOrQueue } = useSync();
  const [pendientes, setPendientes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.movimientos({ pendiente: 'true' });
      setPendientes(d.movimientos);
      setSelected(null);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const result = await executeOrQueue('ingreso', {
        movimientoId: selected.id,
        fechaIngreso: new Date().toISOString().slice(0, 10),
      });
      Alert.alert(
        result.offline ? 'Guardado offline' : 'Ingreso registrado',
        result.offline ? 'Se sincronizará automáticamente.' : 'Devolución completada.'
      );
      load();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen
      title="Registrar ingreso"
      subtitle="Devoluciones pendientes"
      onRefresh={load}
      refreshing={loading}
    >
      {!pendientes.length && !loading ? (
        <Text style={styles.empty}>No hay devoluciones pendientes</Text>
      ) : null}

      {pendientes.map((m) => (
        <Pressable
          key={m.id}
          style={[styles.card, selected?.id === m.id && styles.cardActive]}
          onPress={() => setSelected(m)}
        >
          <Text style={styles.name}>{m.nombreHerramienta}</Text>
          <Text style={styles.meta}>
            {m.nombrePersonal} · {m.cantidad} u. · Egreso: {m.fechaEgreso}
          </Text>
          <Text style={styles.loc}>
            {m.ubicacion} / {m.estante} / {m.contenedor}
          </Text>
        </Pressable>
      ))}

      {selected && (
        <BigButton
          title="CONFIRMAR DEVOLUCIÓN"
          icon="📥"
          variant="success"
          onPress={submit}
          loading={submitting}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { color: colors.textMuted, fontSize: 18, textAlign: 'center', marginTop: 24 },
  card: {
    backgroundColor: colors.bgCard,
    padding: 18,
    borderRadius: layout.radius,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardActive: { borderColor: colors.success },
  name: { fontSize: 20, fontWeight: '700', color: colors.text },
  meta: { fontSize: 15, color: colors.textMuted, marginTop: 4 },
  loc: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
});
