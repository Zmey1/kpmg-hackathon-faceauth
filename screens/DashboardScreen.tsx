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
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types/navigation';
import { fetchAttendanceHistory, AttendanceEvent } from '../services/attendanceService';
import { getAllProjects, getProjectForEmployee, Project } from '../services/projectDataService';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;
  route: RouteProp<RootStackParamList, 'Dashboard'>;
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function monthsAgo(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d;
}

// ─── Shared attendance event card ────────────────────────────────────────────

function EventCard({ event }: { event: AttendanceEvent }) {
  const pass = event.success;
  const scorePct = (event.matchScore * 100).toFixed(1);
  return (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <Text style={styles.cardName} numberOfLines={1}>
          {event.matchedName ?? event.employeeId ?? 'Unknown'}
        </Text>
        <Text style={styles.cardSub}>{event.employeeId}</Text>
        <Text style={styles.cardTime}>{formatTime(event.timestamp)}</Text>
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

// ─── Official Dashboard ───────────────────────────────────────────────────────

function ProjectCard({ project, navigation }: { project: Project; navigation: Props['navigation'] }) {
  const [expanded, setExpanded] = useState(false);

  function openKPAttendance(kp: { name: string; employeeId: string; position: string }) {
    navigation.push('Dashboard', {
      role: 'PD',
      matchedUser: { name: kp.name, employeeId: kp.employeeId, position: kp.position },
      fromManager: true,
    });
  }

  return (
    <TouchableOpacity
      style={styles.projectCard}
      onPress={() => setExpanded(e => !e)}
      activeOpacity={0.85}
    >
      <View style={styles.projectCardTop}>
        <View style={styles.projectCardLeft}>
          <Text style={styles.projectName}>{project.name}</Text>
          <View style={styles.upcBadge}>
            <Text style={styles.upcText}>{project.upc}</Text>
          </View>
        </View>
        <View style={styles.projectCardRight}>
          <View style={styles.kpCountBadge}>
            <Text style={styles.kpCountVal}>{project.currentKP.length}</Text>
            <Text style={styles.kpCountLabel}>KP</Text>
          </View>
          <Text style={styles.expandChevron}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </View>

      {expanded && (
        <View style={styles.projectDetail}>
          <View style={styles.divider} />

          <Text style={styles.detailSectionLabel}>CURRENT KEY PERSONNEL ({project.currentKP.length})</Text>
          {project.currentKP.length === 0 ? (
            <Text style={styles.detailEmpty}>None assigned</Text>
          ) : (
            project.currentKP.map(kp => (
              <TouchableOpacity
                key={kp.employeeId}
                style={[styles.kpRow, styles.kpRowTappable]}
                onPress={() => openKPAttendance(kp)}
                activeOpacity={0.7}
              >
                <View style={styles.kpAvatar}>
                  <Text style={styles.kpAvatarText}>{kp.name.charAt(0)}</Text>
                </View>
                <View style={styles.kpInfo}>
                  <Text style={styles.kpName}>{kp.name}</Text>
                  <Text style={styles.kpPosition}>{kp.position} · {kp.employeeId}</Text>
                </View>
                <Text style={styles.kpChevron}>›</Text>
              </TouchableOpacity>
            ))
          )}

          {project.previousKP.length > 0 && (
            <>
              <Text style={[styles.detailSectionLabel, { marginTop: 14 }]}>
                PREVIOUS KEY PERSONNEL ({project.previousKP.length})
              </Text>
              {project.previousKP.map(kp => (
                <TouchableOpacity
                  key={kp.employeeId}
                  style={[styles.kpRow, styles.kpRowPrev, styles.kpRowTappable]}
                  onPress={() => openKPAttendance(kp)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.kpAvatar, styles.kpAvatarPrev]}>
                    <Text style={[styles.kpAvatarText, styles.kpAvatarTextPrev]}>{kp.name.charAt(0)}</Text>
                  </View>
                  <View style={styles.kpInfo}>
                    <Text style={[styles.kpName, styles.kpNamePrev]}>{kp.name}</Text>
                    <Text style={styles.kpPosition}>{kp.position} · {kp.employeeId}</Text>
                  </View>
                  <Text style={styles.kpChevron}>›</Text>
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

function OfficialDashboard({ navigation, matchedUser }: {
  navigation: Props['navigation'];
  matchedUser?: { name: string; employeeId: string; position: string };
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);

  const load = useCallback((isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setProjects(getAllProjects());
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalKP = projects.reduce((sum, p) => sum + p.currentKP.length, 0);
  const totalPrevKP = projects.reduce((sum, p) => sum + p.previousKP.length, 0);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('Home')} style={styles.backBtn}>
          <Text style={styles.backText}>← Home</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {matchedUser?.name ?? 'Official Dashboard'}
          </Text>
          {matchedUser && (
            <Text style={styles.headerSub}>Official</Text>
          )}
        </View>
        <TouchableOpacity onPress={() => load(true)} style={styles.refreshBtn}>
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{projects.length}</Text>
          <Text style={styles.statLabel}>PROJECTS</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, styles.colorOfficial]}>{totalKP}</Text>
          <Text style={styles.statLabel}>CURRENT KP</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#6B7280' }]}>{totalPrevKP}</Text>
          <Text style={styles.statLabel}>PREVIOUS KP</Text>
        </View>
      </View>

      <FlatList
        data={projects}
        keyExtractor={p => p.id}
        renderItem={({ item }) => <ProjectCard project={item} navigation={navigation} />}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#9333EA" />
        }
        ListHeaderComponent={
          <Text style={styles.listHeader}>
            {projects.length} project{projects.length !== 1 ? 's' : ''} · tap to expand KP details
          </Text>
        }
      />
    </SafeAreaView>
  );
}

// ─── PD Dashboard ─────────────────────────────────────────────────────────────

type RangeOption = 3 | 6;

function PDDashboard({ navigation, matchedUser, fromManager }: {
  navigation: Props['navigation'];
  matchedUser: { name: string; employeeId: string; position: string };
  fromManager?: boolean;
}) {
  const [events, setEvents]         = useState<AttendanceEvent[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [range, setRange]           = useState<RangeOption>(3);

  const project = getProjectForEmployee(matchedUser.employeeId);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const data = await fetchAttendanceHistory(500);
      setEvents(data.filter(e => e.employeeId === matchedUser.employeeId));
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load. Is the server reachable?');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [matchedUser.employeeId]);

  useEffect(() => { load(); }, [load]);

  const cutoff       = monthsAgo(range);
  const filtered     = events.filter(e => new Date(e.timestamp) >= cutoff);
  const passCount    = filtered.filter(e => e.success).length;
  const passRate     = filtered.length > 0 ? Math.round((passCount / filtered.length) * 100) : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => fromManager ? navigation.goBack() : navigation.navigate('Home')}
          style={styles.backBtn}
        >
          <Text style={styles.backText}>{fromManager ? '← Back' : '← Home'}</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{matchedUser.name}</Text>
          <Text style={styles.headerSub}>{fromManager ? 'Key Personnel' : 'Personnel'}</Text>
        </View>
        <TouchableOpacity onPress={() => load(true)} style={styles.refreshBtn}>
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Profile card */}
      <View style={styles.profileCard}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileAvatarText}>{matchedUser.name.charAt(0)}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{matchedUser.name}</Text>
          <Text style={styles.profilePosition}>{matchedUser.position}</Text>
          {project ? (
            <View style={styles.profileProjectRow}>
              <Text style={styles.profileProjectName}>{project.name}</Text>
              <View style={styles.upcBadgeSmall}>
                <Text style={styles.upcTextSmall}>{project.upc}</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.profileNoProject}>No project assigned</Text>
          )}
        </View>
      </View>

      {/* Stats + range filter */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{filtered.length}</Text>
          <Text style={styles.statLabel}>EVENTS</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, styles.colorPass]}>{passCount}</Text>
          <Text style={styles.statLabel}>PASS</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, passRate >= 80 ? styles.colorPass : styles.colorFail]}>
            {passRate}%
          </Text>
          <Text style={styles.statLabel}>PASS RATE</Text>
        </View>
      </View>

      <View style={styles.rangeRow}>
        <Text style={styles.rangeLabel}>RANGE</Text>
        {([3, 6] as RangeOption[]).map(r => (
          <TouchableOpacity
            key={r}
            style={[styles.rangeBtn, range === r && styles.rangeBtnActive]}
            onPress={() => setRange(r)}
          >
            <Text style={[styles.rangeBtnText, range === r && styles.rangeBtnTextActive]}>
              {r} Months
            </Text>
          </TouchableOpacity>
        ))}
      </View>

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
          data={filtered}
          keyExtractor={e => e.id}
          renderItem={({ item }) => <EventCard event={item} />}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#2563EB" />
          }
          ListHeaderComponent={
            filtered.length > 0 ? (
              <Text style={styles.listHeader}>
                {filtered.length} event{filtered.length !== 1 ? 's' : ''} · last {range} months
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No events in this range</Text>
              <Text style={styles.emptySubText}>
                Attendance events will appear here after verification.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

// ─── Root screen ─────────────────────────────────────────────────────────────

export default function DashboardScreen({ navigation, route }: Props) {
  const { role, matchedUser, fromManager } = route.params ?? {};
  const effectiveRole = role ?? 'Official';

  if (effectiveRole === 'PD' && matchedUser) {
    return <PDDashboard navigation={navigation} matchedUser={matchedUser} fromManager={fromManager} />;
  }
  return <OfficialDashboard navigation={navigation} matchedUser={matchedUser} />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:               { flex: 1, backgroundColor: '#0F1117' },

  header:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1A1E2E' },
  backBtn:            { width: 60 },
  backText:           { color: '#2563EB', fontSize: 15, fontWeight: '500' },
  headerCenter:       { flex: 1, alignItems: 'center', overflow: 'visible' },
  headerTitle:        { color: '#FFFFFF', fontSize: 17, fontWeight: '700', lineHeight: 22 },
  headerSub:          { color: '#6B7280', fontSize: 12, lineHeight: 17, marginTop: 1 },
  refreshBtn:         { width: 60, alignItems: 'flex-end' },
  refreshText:        { color: '#2563EB', fontSize: 15, fontWeight: '500' },

  statsRow:           { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 16, gap: 8 },
  statCard:           { flex: 1, backgroundColor: '#1A1E2E', borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#252A3A' },
  statValue:          { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  statLabel:          { color: '#4B5563', fontSize: 9, fontWeight: '700', marginTop: 3, letterSpacing: 0.6 },
  colorPass:          { color: '#16A34A' },
  colorFail:          { color: '#DC2626' },
  colorOfficial:      { color: '#9333EA' },

  list:               { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 40, gap: 8 },
  listHeader:         { color: '#4B5563', fontSize: 12, paddingVertical: 8, paddingHorizontal: 4 },

  center:             { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 32, paddingTop: 60 },
  loadingText:        { color: '#6B7280', fontSize: 14, marginTop: 12 },
  errorText:          { color: '#DC2626', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  retryBtn:           { backgroundColor: '#1A1E2E', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10, borderWidth: 1, borderColor: '#252A3A' },
  retryText:          { color: '#2563EB', fontSize: 14, fontWeight: '600' },
  emptyText:          { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  emptySubText:       { color: '#6B7280', fontSize: 13, textAlign: 'center', lineHeight: 20 },

  // Attendance event card
  card:               { backgroundColor: '#1A1E2E', borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#252A3A' },
  cardLeft:           { flex: 1, gap: 3 },
  cardName:           { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  cardSub:            { color: '#6B7280', fontSize: 12 },
  cardTime:           { color: '#4B5563', fontSize: 11, marginTop: 2 },
  cardRight:          { alignItems: 'flex-end', gap: 5, marginLeft: 12 },
  resultBadge:        { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgePass:          { backgroundColor: '#052E16' },
  badgeFail:          { backgroundColor: '#2D0A0A' },
  resultText:         { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  resultPassText:     { color: '#16A34A' },
  resultFailText:     { color: '#DC2626' },
  scoreText:          { fontSize: 13, fontWeight: '700' },
  scorePass:          { color: '#16A34A' },
  scoreFail:          { color: '#DC2626' },
  msText:             { color: '#4B5563', fontSize: 10 },

  // Project card (Official view)
  projectCard:        { backgroundColor: '#1A1E2E', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#252A3A' },
  projectCardTop:     { flexDirection: 'row', alignItems: 'flex-start' },
  projectCardLeft:    { flex: 1, gap: 6 },
  projectName:        { color: '#FFFFFF', fontSize: 15, fontWeight: '600', lineHeight: 21 },
  upcBadge:           { alignSelf: 'flex-start', backgroundColor: '#1E1432', borderWidth: 1, borderColor: '#4B2D8A', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  upcText:            { color: '#A78BFA', fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  projectCardRight:   { alignItems: 'flex-end', gap: 8, marginLeft: 12 },
  kpCountBadge:       { backgroundColor: '#1E1432', borderWidth: 1, borderColor: '#4B2D8A', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center' },
  kpCountVal:         { color: '#C4B5FD', fontSize: 18, fontWeight: '700' },
  kpCountLabel:       { color: '#7C3AED', fontSize: 9, fontWeight: '700', letterSpacing: 0.6 },
  expandChevron:      { color: '#4B5563', fontSize: 12 },

  projectDetail:      { marginTop: 12, gap: 8 },
  divider:            { height: 1, backgroundColor: '#252A3A', marginBottom: 4 },
  detailSectionLabel: { color: '#4B5563', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  detailEmpty:        { color: '#374151', fontSize: 13 },

  kpRow:              { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kpRowPrev:          { opacity: 0.6 },
  kpRowTappable:      { paddingVertical: 4 },
  kpChevron:          { color: '#4B5563', fontSize: 18, marginLeft: 4 },
  kpAvatar:           { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1E2A45', borderWidth: 1, borderColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  kpAvatarPrev:       { borderColor: '#374151', backgroundColor: '#1A1E2E' },
  kpAvatarText:       { color: '#60A5FA', fontSize: 13, fontWeight: '700' },
  kpAvatarTextPrev:   { color: '#6B7280' },
  kpInfo:             { flex: 1 },
  kpName:             { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  kpNamePrev:         { color: '#9CA3AF' },
  kpPosition:         { color: '#6B7280', fontSize: 11, marginTop: 1 },

  // Profile card (PD view)
  profileCard:        { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1A1E2E' },
  profileAvatar:      { width: 52, height: 52, borderRadius: 26, backgroundColor: '#1E2A45', borderWidth: 2, borderColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  profileAvatarText:  { color: '#60A5FA', fontSize: 22, fontWeight: '700' },
  profileInfo:        { flex: 1, gap: 3 },
  profileName:        { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  profilePosition:    { color: '#9CA3AF', fontSize: 13 },
  profileProjectRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 },
  profileProjectName: { color: '#6B7280', fontSize: 12 },
  upcBadgeSmall:      { backgroundColor: '#1E1432', borderWidth: 1, borderColor: '#4B2D8A', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  upcTextSmall:       { color: '#A78BFA', fontSize: 10, fontWeight: '600' },
  profileNoProject:   { color: '#374151', fontSize: 12, marginTop: 4 },

  // Range filter (PD view)
  rangeRow:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: '#1A1E2E' },
  rangeLabel:         { color: '#4B5563', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginRight: 4 },
  rangeBtn:           { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#252A3A', backgroundColor: '#1A1E2E' },
  rangeBtnActive:     { borderColor: '#2563EB', backgroundColor: '#1E2A45' },
  rangeBtnText:       { color: '#6B7280', fontSize: 13, fontWeight: '500' },
  rangeBtnTextActive: { color: '#60A5FA', fontWeight: '600' },
});
