import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AdminLogin'>;
};

// Dummy admin credentials (demo only)
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'nhai@2026';

export default function AdminLoginScreen({ navigation }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  function handleLogin() {
    setError(null);
    const u = username.trim();
    if (!u || !password) {
      setError('Please enter both username and password.');
      return;
    }
    setLoading(true);
    // Simulate a short auth round-trip
    setTimeout(() => {
      if (u.toLowerCase() === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        setLoading(false);
        setUsername('');
        setPassword('');
        // Route to the project details page (Official dashboard)
        navigation.replace('Dashboard', { role: 'Official' });
      } else {
        setLoading(false);
        setError('Invalid credentials. Please try again.');
      }
    }, 400);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          {/* Badge */}
          <View style={styles.badge}>
            <Text style={styles.badgeText}>ADMIN · CONSOLE</Text>
          </View>

          <View style={styles.header}>
            <Text style={styles.title}>Admin Login</Text>
            <Text style={styles.subtitle}>
              Sign in to view project key-personnel records.
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>USERNAME</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="admin"
                placeholderTextColor="#4B5563"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>PASSWORD</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#4B5563"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {error && <Text style={styles.error}>{error}</Text>}
          </View>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.buttonBusy]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.loginButtonText}>
              {loading ? 'Signing in…' : 'Sign In'}
            </Text>
          </TouchableOpacity>

          {/* Demo credential hint */}
          <View style={styles.hintCard}>
            <Text style={styles.hintTitle}>DEMO CREDENTIALS</Text>
            <Text style={styles.hintLine}>Username: <Text style={styles.hintMono}>admin</Text></Text>
            <Text style={styles.hintLine}>Password: <Text style={styles.hintMono}>nhai@2026</Text></Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1117' },
  container: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 8, marginBottom: 16 },
  backText: { color: '#6B7280', fontSize: 15 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#1E1432',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#4B2D8A',
    marginBottom: 20,
  },
  badgeText: { color: '#A78BFA', fontSize: 11, fontWeight: '600', letterSpacing: 1.5 },
  header: { marginBottom: 32, gap: 8 },
  title: { fontSize: 28, fontWeight: '700', color: '#FFFFFF' },
  subtitle: { fontSize: 14, color: '#6B7280', lineHeight: 21 },
  form: { gap: 20, marginBottom: 28 },
  field: { gap: 8 },
  label: { fontSize: 11, fontWeight: '600', color: '#4B5563', letterSpacing: 1.2 },
  input: {
    backgroundColor: '#1A1E2E',
    borderWidth: 1,
    borderColor: '#252A3A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#FFFFFF',
  },
  error: { color: '#EF4444', fontSize: 13, fontWeight: '500' },
  loginButton: {
    backgroundColor: '#9333EA',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#9333EA',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonBusy: { opacity: 0.7 },
  loginButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', letterSpacing: 0.2 },
  hintCard: {
    backgroundColor: '#1A1E2E',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#252A3A',
    padding: 16,
    gap: 5,
  },
  hintTitle: { color: '#4B5563', fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: 4 },
  hintLine: { color: '#9CA3AF', fontSize: 13 },
  hintMono: { color: '#A78BFA', fontFamily: 'monospace', fontWeight: '600' },
});
