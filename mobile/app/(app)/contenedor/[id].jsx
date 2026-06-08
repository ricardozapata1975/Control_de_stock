import { useCallback, useEffect, useState } from 'react';
import { Alert, Text, StyleSheet, Modal, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../../src/services/api';
import { useSync } from '../../../src/context/SyncContext';
import Screen from '../../../src/components/Screen';
import ItemCard from '../../../src/components/ItemCard';
import BigButton from '../../../src/components/BigButton';
import { colors, layout } from '../../../src/theme';

export default function ContenedorScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { executeOrQueue } = useSync();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [nombre, setNombre] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.contenedor(id);
      setData(result);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const retirar = (item) => {
    setModal({ type: 'egreso', item });
    setCantidad('1');
    setNombre('');
  };

  const devolver = async (item) => {
    try {
      const movs = await api.movimientos({ pendiente: 'true' });
      const related = movs.movimientos.filter(
        (m) =>
          m.nombreHerramienta === item.nombre &&
          m.ubicacion === item.ubicacion &&
          m.estante === item.estante &&
          m.contenedor === item.contenedor
      );
      if (!related.length) {
        Alert.alert('Sin pendientes', 'No hay devolución pendiente para esta herramienta.');
        return;
      }
      setSubmitting(true);
      const result = await executeOrQueue('ingreso', { movimientoId: related[0].id });
      Alert.alert(
        result.offline ? 'Guardado offline' : 'Devolución OK',
        result.offline ? 'Se sincronizará al reconectar.' : 'Stock actualizado.'
      );
      load();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmEgreso = async () => {
    if (!nombre.trim()) return;
    setSubmitting(true);
    try {
      const result = await executeOrQueue('egreso', {
        inventarioId: modal.item.id,
        cantidad: Number(cantidad),
        nombrePersonal: nombre.trim(),
      });
      setModal(null);
      Alert.alert(
        result.offline ? 'Guardado offline' : 'Egreso OK',
        result.offline ? 'Se sincronizará al reconectar.' : 'Retiro registrado.'
      );
      load();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !data) {
    return (
      <Screen title="Cargando...">
        <Text style={styles.muted}>Obteniendo inventario del contenedor</Text>
      </Screen>
    );
  }

  if (!data) return null;

  return (
    <Screen
      title={data.contenedor.id}
      subtitle={`${data.contenedor.ubicacion} / ${data.contenedor.estante} / ${data.contenedor.contenedor}`}
      onRefresh={load}
      refreshing={loading}
    >
      <Text style={styles.summary}>
        {data.items.length} herramientas · Stock total: {data.contenedor.totalStock}
      </Text>

      {data.items.map((item) => (
        <ItemCard key={item.id} item={item} onRetirar={retirar} onDevolver={devolver} />
      ))}

      <BigButton
        title="Escanear otro contenedor"
        variant="secondary"
        onPress={() => router.push('/(app)/scan')}
      />

      <Modal visible={!!modal} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Retirar: {modal?.item?.nombre}</Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre empleado"
              placeholderTextColor={colors.textMuted}
              value={nombre}
              onChangeText={setNombre}
            />
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={cantidad}
              onChangeText={setCantidad}
            />
            <BigButton title="Confirmar retiro" onPress={confirmEgreso} loading={submitting} />
            <BigButton title="Cancelar" variant="secondary" onPress={() => setModal(null)} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.textMuted, fontSize: 16 },
  summary: { color: colors.text, fontSize: 16, marginBottom: 16, fontWeight: '600' },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.bgCard,
    padding: layout.pad,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 16 },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 18,
    fontSize: 20,
    color: colors.text,
    marginBottom: 12,
  },
});
