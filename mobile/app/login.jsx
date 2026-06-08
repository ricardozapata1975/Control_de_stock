import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import BigButton from '../src/components/BigButton';
import { colors, layout } from '../src/theme';
import { getApiUrl } from '../src/services/api';

export default function Login() {
  const router = useRouter();
  const { loginDemo, loginMicrosoft } = useAuth();
  const [nombre, setNombre] = useState('');
  const [loading, setLoading] = useState(false);

  const enter = async () => {
    if (!nombre.trim()) return;
    setLoading(true);
    try {
      await loginDemo(nombre);
      router.replace('/(app)/home');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.logo}>🔧</Text>
      <Text style={styles.title}>Inventario Taller</Text>
      <Text style={styles.sub}>Acceso para operarios</Text>

      <TextInput
        style={styles.input}
        placeholder="Tu nombre"
        placeholderTextColor={colors.textMuted}
        value={nombre}
        onChangeText={setNombre}
        autoCapitalize="words"
        returnKeyType="go"
        onSubmitEditing={enter}
      />

      <BigButton title="Entrar al taller" onPress={enter} loading={loading} disabled={!nombre.trim()} />

      <BigButton
        title="Microsoft (producción)"
        variant="secondary"
        onPress={async () => {
          setLoading(true);
          try {
            await loginMicrosoft();
            router.replace('/(app)/home');
          } finally {
            setLoading(false);
          }
        }}
      />

      <Text style={styles.api}>Servidor: {getApiUrl()}</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    padding: layout.pad,
  },
  logo: { fontSize: 56, textAlign: 'center', marginBottom: 8 },
  title: { fontSize: 32, fontWeight: '800', color: colors.text, textAlign: 'center' },
  sub: { fontSize: 16, color: colors.textMuted, textAlign: 'center', marginBottom: 32 },
  input: {
    backgroundColor: colors.bgCard,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: layout.radius,
    padding: 20,
    fontSize: 22,
    color: colors.text,
    marginBottom: 16,
  },
  api: { marginTop: 24, textAlign: 'center', color: colors.textMuted, fontSize: 12 },
});
