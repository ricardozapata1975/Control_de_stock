import { Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, layout } from '../theme';

export default function BigButton({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
}) {
  const bg =
    variant === 'secondary'
      ? colors.bgElevated
      : variant === 'danger'
        ? colors.danger
        : variant === 'success'
          ? colors.success
          : colors.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: pressed ? 0.85 : disabled ? 0.5 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#fff" size="large" />
      ) : (
        <Text style={styles.text}>
          {icon ? `${icon} ` : ''}
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: layout.btnMinHeight,
    borderRadius: layout.radius,
    paddingHorizontal: 24,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  text: {
    color: colors.text,
    fontSize: layout.btnFontSize,
    fontWeight: '700',
  },
});
