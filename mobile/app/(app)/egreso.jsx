import { useEffect, useState } from 'react';
import { Alert, Text, StyleSheet, View, Pressable } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { api } from '../../src/services/api';
import { useSync } from '../../src/context/SyncContext';
import { useAuth } from '../../src/context/AuthContext';
import Screen from '../../src/components/Screen';
import BigButton from '../../src/components/BigButton';
import { colors, layout } from '../../src/theme';

export default function Egreso() {
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { executeOrQueue } = useSync();
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [cantidad, setCantidad] = useState('1');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .inventario()
      .then((d) => {
        let list = d.items.filter((i) => i.cantidad > 0);
        if (params.contenedorId) {
          list = list.filter((i) => i.contenedorId === params.contenedorId);
        }
        setItems(list);
        if (params.itemId) {
          setSelected(list.find((i) => i.id === params.itemId) || null);
        }
      })
      .catch((e) => Alert.alert('Error', e.message))
      .finally(() => setLoading(false));
  }, [params.contenedorId, params.itemId]);

  const submit = async () => {
    if (!selected) return;
    const qty = Number(cantidad);
    if (!qty || qty > selected.cantidad) {
      Alert.alert('Cantidad inválida', `Máximo disponible: ${selected.cantidad}`);
      return;
    }
    setSubmitting(true);
    try {
      const result = await executeOrQueue('egreso', {
        inventarioId: selected.id,
        cantidad: qty,
        nombrePersonal: user?.name || 'Operario',
      });
      Alert.alert(
        result.offline ? 'Guardado offline' : 'Egreso registrado',
        result.offline ? 'Se sincronizará automáticamente.' : `${selected.nombre}: ${qty} u.`
      );
      const d = await api.inventario();
      setItems(d.items.filter((i) => i.cantidad > 0));
      setSelected(null);
      setCantidad('1');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen title="Registrar egreso" subtitle="Seleccioná herramienta y cantidad" refreshing={loading}>
      {items.map((item) => (
        <Pressable
          key={item.id}
          style={[styles.item, selected?.id === item.id && styles.itemActive]}
          onPress={() => setSelected(item)}
        >
          <Text style={styles.itemName}>{item.nombre}</Text>
          <Text style={styles.itemMeta}>
            {item.contenedorId} · Stock: {item.cantidad}
          </Text>
        </Pressable>
      ))}

      {selected && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>{selected.nombre}</Text>
          <View style={styles.qtyRow}>
            <Pressable
              style={styles.qtyBtn}
              onPress={() => setCantidad(String(Math.max(1, Number(cantidad) - 1)))}
            >
              <Text style={styles.qtyBtnText}>−</Text>
            </Pressable>
            <Text style={styles.qty}>{cantidad}</Text>
            <Pressable
              style={styles.qtyBtn}
              onPress={() =>
                setCantidad(String(Math.min(selected.cantidad, Number(cantidad) + 1)))
              }
            >
              <Text style={styles.qtyBtnText}>+</Text>
            </Pressable>
          </View>
          <BigButton title="RETIRAR" icon="📤" onPress={submit} loading={submitting} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: {
    backgroundColor: colors.bgCard,
    padding: 18,
    borderRadius: layout.radius,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  itemActive: { borderColor: colors.primary },
  itemName: { fontSize: 20, fontWeight: '700', color: colors.text },
  itemMeta: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  panel: {
    marginTop: 16,
    padding: 16,
    backgroundColor: colors.bgCard,
    borderRadius: layout.radius,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  panelTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 12 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 8 },
  qtyBtn: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: { fontSize: 32, fontWeight: '800', color: colors.text },
  qty: {
    flex: 1,
    textAlign: 'center',
    fontSize: 36,
    fontWeight: '800',
    color: colors.primary,
  },
});
