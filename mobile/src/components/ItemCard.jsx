import { View, Text, StyleSheet } from 'react-native';
import { colors, layout } from '../theme';
import BigButton from './BigButton';

export default function ItemCard({ item, onRetirar, onDevolver }) {
  return (
    <View style={styles.card}>
      <Text style={styles.name}>{item.nombre}</Text>
      <Text style={styles.meta}>
        {item.marca} {item.modelo} · {item.tipo}
      </Text>
      <Text style={styles.stock}>
        Stock: <Text style={styles.stockNum}>{item.cantidad}</Text>
      </Text>
      <View style={styles.row}>
        <View style={styles.half}>
          <BigButton
            title="Retirar"
            icon="📤"
            onPress={() => onRetirar(item)}
            disabled={item.cantidad < 1}
          />
        </View>
        <View style={styles.half}>
          <BigButton title="Devolver" icon="📥" variant="secondary" onPress={() => onDevolver(item)} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: layout.radius,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 4 },
  meta: { fontSize: 14, color: colors.textMuted, marginBottom: 8 },
  stock: { fontSize: 16, color: colors.text, marginBottom: 8 },
  stockNum: { fontWeight: '800', color: colors.primary, fontSize: 22 },
  row: { flexDirection: 'row', gap: 8 },
  half: { flex: 1 },
});
