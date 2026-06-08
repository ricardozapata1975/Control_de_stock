import { ScrollView, View, Text, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, layout } from '../theme';
import OfflineBanner from './OfflineBanner';

export default function Screen({ title, subtitle, children, onRefresh, refreshing }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <OfflineBanner />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          ) : undefined
        }
      >
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
        <View style={styles.body}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: layout.pad, paddingBottom: 40 },
  title: { fontSize: layout.titleSize, fontWeight: '800', color: colors.text, marginBottom: 6 },
  sub: { fontSize: 16, color: colors.textMuted, marginBottom: 20 },
  body: { flexGrow: 1 },
});
