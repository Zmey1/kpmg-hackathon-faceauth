import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import StatusCard from '../components/StatusCard';
import { getPendingSyncCount } from '../services/syncService';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
};

export default function HomeScreen({ navigation }: Props) {
  const [pendingSync, setPendingSync] = useState(0);

  useEffect(() => {
    const refresh = () => getPendingSyncCount().then(setPendingSync);
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo / badge */}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>OFFLINE · SECURE</Text>
        </View>

        {/* Title block */}
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Offline FaceAuth Lite</Text>
          <Text style={styles.subtitle}>
            Secure offline facial authentication{'\n'}for field operations
          </Text>
        </View>

        {/* System status cards */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SYSTEM STATUS</Text>
          <View style={styles.cards}>
            <StatusCard label="Offline Mode"    value="Active"    status="success" />
            <StatusCard label="Local Templates" value="Ready"     status="success" />
            <StatusCard
              label="Sync Queue"
              value={pendingSync === 0 ? 'Up to date' : `${pendingSync} pending`}
              status={pendingSync === 0 ? 'success' : 'neutral'}
            />
          </View>
        </View>

        {/* Primary actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Verification')}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>Start Verification</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('RegistrationForm')}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryButtonText}>Register Face</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.ghostButton}
            onPress={() => navigation.navigate('RegisteredUsers')}
            activeOpacity={0.85}
          >
            <Text style={styles.ghostButtonText}>View Registered Users</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.ghostButton}
            onPress={() => navigation.navigate('Dashboard')}
            activeOpacity={0.85}
          >
            <Text style={styles.ghostButtonText}>Attendance Dashboard</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          All biometric processing happens on-device.{'\n'}No data leaves this device.
        </Text>
      </ScrollView>
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
    paddingTop: 48,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  badge: {
    alignSelf: 'center',
    backgroundColor: '#1A1E2E',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#2D3348',
    marginBottom: 28,
  },
  badgeText: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  titleBlock: {
    alignItems: 'center',
    marginBottom: 40,
    gap: 12,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 23,
  },
  section: {
    marginBottom: 36,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  cards: {
    gap: 10,
  },
  actions: {
    gap: 12,
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  secondaryButton: {
    backgroundColor: '#16A34A',
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  ghostButton: {
    borderWidth: 1,
    borderColor: '#252A3A',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ghostButtonText: {
    color: '#6B7280',
    fontSize: 15,
    fontWeight: '500',
  },
  footer: {
    fontSize: 12,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 18,
  },
});
