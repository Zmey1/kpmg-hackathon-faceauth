import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { fetchAttendanceHistory, AttendanceEvent } from '../services/attendanceService';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function EventCard({ event }: { event: AttendanceEvent }) {
  const pass = event.success;
  const scorePct = (event.matchScore * 100).toFixed(1);
  return (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <Text style={styles.cardName} numberOfLines={1}>
          {event.matchedName ?? event.employeeId ?? 'Unknown'}
        </Text>
        <Text style={styles.cardSub}>
          {event.employeeId}
        </Text>
        <Text style={styles.cardTime}>
          {formatTime(event.timestamp)}
        </Text>
      </View>
      <View style={styles.cardRight}>
        <View style={[styles.resultBadge, pass ? styles.badgePass : styles.badgeFail]}>
          <Text style={[styles.resultText, pass ? styles.resultPassText : styles.resultFailText]}>
            {pass ? 'PASS' : 'FAIL'}
          </Text>
        </View>
        <Text style={[styles.scoreText, parseFloat(scorePct) >= 65 ? styles.scorePass : styles.scoreFail]}>
          {scorePct}%
        </Text>
        <Text style={styles.msText}>{event.processingMs}ms</Text>
      </View>
    </View>
  );
}

export default function DashboardScreen({ navigation }: Props) {
  const [events, setEvents]         = useState<AttendanceEvent[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const data = await fetchAttendanceHistory(200);
      setEvents(data);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load. Is the server reachable?');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const today        = new Date().toDateString();
  const todayEvents  = events.filter(e => new Date(e.timestamp).toDateString() === today);
  const todayPass    = todayEvents.filter(e => e.success).length;
  const totalPass    = events.filter(e => e.success).length;
  const passRate     = events.length > 0 ? Math.round((totalPass / events.length) * 100) : 0;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Attendance</Text>
        <TouchableOpacity onPress={() => load(true)} style={styles.refreshBtn}>
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Summary stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{todayEvents.length}</Text>
          <Text style={styles.statLabel}>TODAY</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, styles.colorPass]}>{todayPass}</Text>
          <Text style={styles.statLabel}>TODAY PASS</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{events.length}</Text>
          <Text style={styles.statLabel}>TOTAL</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, passRate >= 80 ? styles.colorPass : styles.colorFail]}>
            {passRate}%
          </Text>
          <Text style={styles.statLabel}>PASS RATE</Text>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Fetching from server…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={e => e.id}
          renderItem={({ item }) => <EventCard event={item} />}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor="#2563EB"
            />
          }
          ListHeaderComponent={
            events.length > 0 ? (
              <Text style={styles.listHeader}>
                {events.length} event{events.length !== 1 ? 's' : ''} · most recent first
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No events yet</Text>
              <Text style={styles.emptySubText}>
                Run verifications and sync to see history here.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: '#0F1117' },

  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1A1E2E' },
  backBtn:        { width: 60 },
  backText:       { color: '#2563EB', fontSize: 15, fontWeight: '500' },
  headerTitle:    { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  refreshBtn:     { width: 60, alignItems: 'flex-end' },
  refreshText:    { color: '#2563EB', fontSize: 14, fontWeight: '500' },

  statsRow:       { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 16, gap: 8 },
  statCard:       { flex: 1, backgroundColor: '#1A1E2E', borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#252A3A' },
  statValue:      { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  statLabel:      { color: '#4B5563', fontSize: 9, fontWeight: '700', marginTop: 3, letterSpacing: 0.6 },
  colorPass:      { color: '#16A34A' },
  colorFail:      { color: '#DC2626' },

  center:         { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 32, paddingTop: 60 },
  loadingText:    { color: '#6B7280', fontSize: 14, marginTop: 12 },
  errorText:      { color: '#DC2626', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  retryBtn:       { backgroundColor: '#1A1E2E', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10, borderWidth: 1, borderColor: '#252A3A' },
  retryText:      { color: '#2563EB', fontSize: 14, fontWeight: '600' },
  emptyText:      { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  emptySubText:   { color: '#6B7280', fontSize: 13, textAlign: 'center', lineHeight: 20 },

  list:           { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 40, gap: 8 },
  listHeader:     { color: '#4B5563', fontSize: 12, paddingVertical: 8, paddingHorizontal: 4 },

  card:           { backgroundColor: '#1A1E2E', borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#252A3A' },
  cardLeft:       { flex: 1, gap: 3 },
  cardName:       { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  cardSub:        { color: '#6B7280', fontSize: 12 },
  cardTime:       { color: '#4B5563', fontSize: 11, marginTop: 2 },
  cardRight:      { alignItems: 'flex-end', gap: 5, marginLeft: 12 },
  resultBadge:    { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgePass:      { backgroundColor: '#052E16' },
  badgeFail:      { backgroundColor: '#2D0A0A' },
  resultText:     { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  resultPassText: { color: '#16A34A' },
  resultFailText: { color: '#DC2626' },
  scoreText:      { fontSize: 13, fontWeight: '700' },
  scorePass:      { color: '#16A34A' },
  scoreFail:      { color: '#DC2626' },
  msText:         { color: '#4B5563', fontSize: 10 },
});
