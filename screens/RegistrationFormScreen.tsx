import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { userExists } from '../services/faceTemplateStore';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'RegistrationForm'>;
};

export default function RegistrationFormScreen({ navigation }: Props) {
  const [employeeId, setEmployeeId] = useState('');
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [role, setRole] = useState<'Official' | 'PD'>('PD');
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    const trimmedId   = employeeId.trim();
    const trimmedName = name.trim();
    const trimmedPos  = position.trim();

    if (!trimmedId) {
      Alert.alert('Required', 'Please enter an Employee ID.');
      return;
    }
    if (!trimmedName) {
      Alert.alert('Required', 'Please enter a name.');
      return;
    }
    if (!trimmedPos) {
      Alert.alert('Required', 'Please enter a position.');
      return;
    }

    setLoading(true);
    try {
      const exists = await userExists(trimmedId);
      if (exists) {
        Alert.alert(
          'Employee Already Registered',
          `Employee ID "${trimmedId}" already has face templates. Do you want to overwrite them?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Overwrite',
              style: 'destructive',
              onPress: () =>
                navigation.navigate('FaceRegistrationCamera', {
                  employeeId: trimmedId,
                  name: trimmedName,
                  role,
                  position: trimmedPos,
                }),
            },
          ]
        );
      } else {
        navigation.navigate('FaceRegistrationCamera', {
          employeeId: trimmedId,
          name: trimmedName,
          role,
          position: trimmedPos,
        });
      }
    } finally {
      setLoading(false);
    }
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
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>Register Face</Text>
            <Text style={styles.subtitle}>
              Enter employee details before face capture.
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>EMPLOYEE ID</Text>
              <TextInput
                style={styles.input}
                value={employeeId}
                onChangeText={setEmployeeId}
                placeholder="e.g. EMP-001"
                placeholderTextColor="#4B5563"
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>FULL NAME</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Jane Smith"
                placeholderTextColor="#4B5563"
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>POSITION</Text>
              <TextInput
                style={styles.input}
                value={position}
                onChangeText={setPosition}
                placeholder="e.g. Senior Analyst"
                placeholderTextColor="#4B5563"
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>ROLE</Text>
              <View style={styles.roleRow}>
                <TouchableOpacity
                  style={[styles.roleBtn, role === 'PD' && styles.roleBtnActive]}
                  onPress={() => setRole('PD')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.roleBtnText, role === 'PD' && styles.roleBtnTextActive]}>
                    PD
                  </Text>
                  <Text style={[styles.roleSubText, role === 'PD' && styles.roleSubTextActive]}>
                    Personnel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.roleBtn, role === 'Official' && styles.roleBtnActiveOfficial]}
                  onPress={() => setRole('Official')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.roleBtnText, role === 'Official' && styles.roleBtnTextActive]}>
                    Official
                  </Text>
                  <Text style={[styles.roleSubText, role === 'Official' && styles.roleSubTextActive]}>
                    Overseer / Manager
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.continueButton, loading && styles.buttonBusy]}
            onPress={handleContinue}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.continueButtonText}>
              {loading ? 'Checking…' : 'Continue to Face Capture'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.note}>
            You will capture 3–5 face samples using the front camera.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0F1117',
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    marginBottom: 24,
  },
  backText: {
    color: '#6B7280',
    fontSize: 15,
  },
  header: {
    marginBottom: 36,
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 21,
  },
  form: {
    gap: 20,
    marginBottom: 36,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
    letterSpacing: 1.2,
  },
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
  roleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  roleBtn: {
    flex: 1,
    backgroundColor: '#1A1E2E',
    borderWidth: 1.5,
    borderColor: '#252A3A',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 3,
  },
  roleBtnActive: {
    borderColor: '#2563EB',
    backgroundColor: '#1E2A45',
  },
  roleBtnActiveOfficial: {
    borderColor: '#9333EA',
    backgroundColor: '#1E1432',
  },
  roleBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6B7280',
  },
  roleBtnTextActive: {
    color: '#FFFFFF',
  },
  roleSubText: {
    fontSize: 11,
    color: '#374151',
  },
  roleSubTextActive: {
    color: '#9CA3AF',
  },
  continueButton: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonBusy: {
    opacity: 0.7,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  note: {
    fontSize: 13,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 19,
  },
});
