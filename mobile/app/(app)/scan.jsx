import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { extractContenedorId } from '../../src/utils/contenedor';
import { colors, layout } from '../../src/theme';

export default function Scan() {
  const router = useRouter();
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [manual, setManual] = useState('');

  useEffect(() => {
    BarCodeScanner.requestPermissionsAsync().then(({ status }) => {
      setHasPermission(status === 'granted');
    });
  }, []);

  const goToContenedor = useCallback(
    async (raw) => {
      const id = extractContenedorId(raw);
      if (!id) return;
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push(`/(app)/contenedor/${id}`);
    },
    [router]
  );

  const handleBarCode = async ({ data }) => {
    if (scanned) return;
    setScanned(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await goToContenedor(data);
    setTimeout(() => setScanned(false), 1500);
  };

  if (hasPermission === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>Solicitando cámara...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>Sin permiso de cámara</Text>
        <ManualEntry manual={manual} setManual={setManual} onSubmit={() => goToContenedor(manual)} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BarCodeScanner
        onBarCodeScanned={scanned ? undefined : handleBarCode}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.frame}>
        <View style={styles.corner} />
      </View>
      <View style={styles.footer}>
        <Text style={styles.hint}>Apuntá al QR del contenedor</Text>
        <ManualEntry manual={manual} setManual={setManual} onSubmit={() => goToContenedor(manual)} />
        {scanned && (
          <Pressable style={styles.rescan} onPress={() => setScanned(false)}>
            <Text style={styles.rescanText}>Escanear de nuevo</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function ManualEntry({ manual, setManual, onSubmit }) {
  return (
    <View style={styles.manual}>
      <TextInput
        style={styles.input}
        placeholder="Código manual A01-E1-C1"
        placeholderTextColor={colors.textMuted}
        value={manual}
        onChangeText={setManual}
        autoCapitalize="characters"
      />
      <Pressable style={styles.manualBtn} onPress={onSubmit}>
        <Text style={styles.manualBtnText}>Ir</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: colors.bg, padding: layout.pad, justifyContent: 'center' },
  msg: { color: colors.text, fontSize: 18, textAlign: 'center', marginBottom: 20 },
  frame: {
    position: 'absolute',
    top: '25%',
    left: '10%',
    right: '10%',
    height: 260,
    borderWidth: 3,
    borderColor: colors.primary,
    borderRadius: 16,
  },
  corner: { flex: 1 },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: layout.pad,
    backgroundColor: 'rgba(15,23,42,0.92)',
  },
  hint: { color: colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  manual: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  manualBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  manualBtnText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  rescan: { marginTop: 12, alignItems: 'center' },
  rescanText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
});
