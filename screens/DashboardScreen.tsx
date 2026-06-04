import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  ScrollView,
  Modal,
  Dimensions,
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

function monthsAgo(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d;
}

// ─── Chart helpers ────────────────────────────────────────────────────────────

type ChartBar = { label: string; pass: number; fail: number };

type MonthYear = { month: number; year: number }; // month 0-11

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function startOfMonth(my: MonthYear): Date {
  return new Date(my.year, my.month, 1, 0, 0, 0, 0);
}
function endOfMonth(my: MonthYear): Date {
  return new Date(my.year, my.month + 1, 0, 23, 59, 59, 999);
}
function nowMonthYear(): MonthYear {
  const n = new Date();
  return { month: n.getMonth(), year: n.getFullYear() };
}
function monthsAgoMY(n: number): MonthYear {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return { month: d.getMonth(), year: d.getFullYear() };
}
function compareMY(a: MonthYear, b: MonthYear): number {
  return a.year !== b.year ? a.year - b.year : a.month - b.month;
}

function groupByDay(events: AttendanceEvent[]): ChartBar[] {
  const map = new Map<string, { pass: number; fail: number; d: Date }>();
  events.forEach(e => {
    const d = new Date(e.timestamp);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!map.has(key)) {
      map.set(key, { pass: 0, fail: 0, d: new Date(d.getFullYear(), d.getMonth(), d.getDate()) });
    }
    const entry = map.get(key)!;
    if (e.success) entry.pass++; else entry.fail++;
  });
  return Array.from(map.values())
    .sort((a, b) => a.d.getTime() - b.d.getTime())
    .map(v => ({
      label: `${String(v.d.getDate()).padStart(2, '0')} ${MONTH_NAMES[v.d.getMonth()]}`,
      pass: v.pass,
      fail: v.fail,
    }));
}

function groupByWeek(events: AttendanceEvent[]): ChartBar[] {
  const map = new Map<string, { pass: number; fail: number; ws: Date }>();
  events.forEach(e => {
    const d = new Date(e.timestamp);
    const ws = new Date(d);
    ws.setDate(d.getDate() - d.getDay());
    ws.setHours(0, 0, 0, 0);
    const key = ws.toISOString();
    if (!map.has(key)) map.set(key, { pass: 0, fail: 0, ws: new Date(ws) });
    const entry = map.get(key)!;
    if (e.success) entry.pass++; else entry.fail++;
  });
  return Array.from(map.values())
    .sort((a, b) => a.ws.getTime() - b.ws.getTime())
    .map(v => ({
      label: `${String(v.ws.getDate()).padStart(2, '0')} ${MONTH_NAMES[v.ws.getMonth()]}`,
      pass: v.pass,
      fail: v.fail,
    }));
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────

const BAR_W = 28;
const BAR_AREA_H = 130;
const SCREEN_W = Dimensions.get('window').width;

function AttendanceBarChart({ bars, title }: { bars: ChartBar[]; title: string }) {
  if (bars.length === 0) {
    return (
      <View style={chartSt.emptyBox}>
        <Text style={chartSt.emptyText}>No events in this range</Text>
      </View>
    );
  }

  const maxVal = Math.max(...bars.map(b => b.pass + b.fail), 1);
  const yTicks = [0, Math.round(maxVal / 2), maxVal];

  return (
    <View style={chartSt.container}>
      <Text style={chartSt.sectionLabel}>{title}</Text>

      {/* Y-axis + bars */}
      <View style={{ flexDirection: 'row' }}>
        {/* Y-axis labels */}
        <View style={{ width: 24, height: BAR_AREA_H, justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 4 }}>
          {yTicks.slice().reverse().map((t, i) => (
            <Text key={i} style={chartSt.yLabel}>{t}</Text>
          ))}
        </View>

        {/* Bars — horizontal scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingRight: 16, gap: 6, flexDirection: 'row', alignItems: 'flex-end', minHeight: BAR_AREA_H + 28 }}
        >
          {bars.map((b, i) => {
            const total = b.pass + b.fail;
            const barH = Math.max((total / maxVal) * BAR_AREA_H, 3);
            const passH = total > 0 ? (b.pass / total) * barH : 0;
            const failH = barH - passH;

            return (
              <View key={i} style={{ alignItems: 'center', width: BAR_W + 8 }}>
                <View style={{ height: BAR_AREA_H, width: BAR_W, justifyContent: 'flex-end' }}>
                  <View style={{ width: BAR_W, borderRadius: 5, overflow: 'hidden' }}>
                    {failH > 0 && (
                      <View style={{ height: failH, backgroundColor: '#DC2626' }} />
                    )}
                    {passH > 0 && (
                      <View style={{ height: passH, backgroundColor: '#16A34A' }} />
                    )}
                  </View>
                </View>
                <Text style={chartSt.xLabel}>{b.label.slice(0, 6)}</Text>
              </View>
            );
          })}
        </ScrollView>
      </View>

      {/* Horizontal grid line at top */}
      <View style={{ marginLeft: 28, height: 0, borderTopWidth: 1, borderTopColor: '#1A1E2E', marginTop: -BAR_AREA_H - 28 + 2, marginBottom: BAR_AREA_H + 26 }} />

      {/* Legend */}
      <View style={chartSt.legend}>
        <View style={chartSt.legendItem}>
          <View style={[chartSt.legendDot, { backgroundColor: '#16A34A' }]} />
          <Text style={chartSt.legendText}>Pass</Text>
        </View>
        <View style={chartSt.legendItem}>
          <View style={[chartSt.legendDot, { backgroundColor: '#DC2626' }]} />
          <Text style={chartSt.legendText}>Fail</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Pass Rate Visual ─────────────────────────────────────────────────────────

function PassRateCard({ pass, fail }: { pass: number; fail: number }) {
  const total = pass + fail;
  const rate = total > 0 ? Math.round((pass / total) * 100) : 0;
  const color = rate >= 80 ? '#16A34A' : rate >= 60 ? '#D97706' : '#DC2626';
  const barWidth = `${rate}%` as `${number}%`;

  return (
    <View style={chartSt.container}>
      <Text style={chartSt.sectionLabel}>Pass Rate Summary</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <View style={[chartSt.rateBadge, { borderColor: color }]}>
          <Text style={[chartSt.rateValue, { color }]}>{rate}%</Text>
          <Text style={chartSt.rateSubLabel}>PASS RATE</Text>
        </View>
        <View style={{ gap: 10, flex: 1, paddingLeft: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: '#9CA3AF', fontSize: 13 }}>Total events</Text>
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>{total}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: '#16A34A', fontSize: 13 }}>Passed</Text>
            <Text style={{ color: '#16A34A', fontWeight: '700', fontSize: 13 }}>{pass}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: '#DC2626', fontSize: 13 }}>Failed</Text>
            <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 13 }}>{fail}</Text>
          </View>
        </View>
      </View>
      {/* Progress bar */}
      <View style={chartSt.progressTrack}>
        <View style={[chartSt.progressFill, { width: barWidth, backgroundColor: color }]} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }}>
        <Text style={{ color: '#374151', fontSize: 10 }}>0%</Text>
        <Text style={{ color: '#374151', fontSize: 10 }}>50%</Text>
        <Text style={{ color: '#374151', fontSize: 10 }}>100%</Text>
      </View>
    </View>
  );
}

// ─── Custom Date Range Modal ──────────────────────────────────────────────────

function MonthYearSelector({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: MonthYear;
  min?: MonthYear;
  max?: MonthYear;
  onChange: (v: MonthYear) => void;
}) {
  function canGoBack(): boolean {
    if (!min) return value.year > 2020 || value.month > 0;
    return compareMY(value, min) > 0;
  }
  function canGoForward(): boolean {
    if (!max) return true;
    return compareMY(value, max) < 0;
  }
  function prev() {
    if (!canGoBack()) return;
    if (value.month === 0) onChange({ month: 11, year: value.year - 1 });
    else onChange({ month: value.month - 1, year: value.year });
  }
  function next() {
    if (!canGoForward()) return;
    if (value.month === 11) onChange({ month: 0, year: value.year + 1 });
    else onChange({ month: value.month + 1, year: value.year });
  }

  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={modalSt.pickerLabel}>{label}</Text>
      <View style={modalSt.pickerRow}>
        <TouchableOpacity
          style={[modalSt.arrowBtn, !canGoBack() && modalSt.arrowDisabled]}
          onPress={prev}
          disabled={!canGoBack()}
        >
          <Text style={[modalSt.arrowText, !canGoBack() && modalSt.arrowTextDisabled]}>‹</Text>
        </TouchableOpacity>
        <Text style={modalSt.pickerValue}>
          {MONTH_NAMES[value.month]} {value.year}
        </Text>
        <TouchableOpacity
          style={[modalSt.arrowBtn, !canGoForward() && modalSt.arrowDisabled]}
          onPress={next}
          disabled={!canGoForward()}
        >
          <Text style={[modalSt.arrowText, !canGoForward() && modalSt.arrowTextDisabled]}>›</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function DateRangeModal({
  visible,
  initialFrom,
  initialTo,
  onApply,
  onClose,
}: {
  visible: boolean;
  initialFrom: MonthYear;
  initialTo: MonthYear;
  onApply: (from: MonthYear, to: MonthYear) => void;
  onClose: () => void;
}) {
  const [from, setFrom] = useState<MonthYear>(initialFrom);
  const [to, setTo]     = useState<MonthYear>(initialTo);
  const now = nowMonthYear();

  function handleApply() {
    if (compareMY(from, to) > 0) {
      onApply(to, from); // swap if inverted
    } else {
      onApply(from, to);
    }
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={modalSt.overlay} activeOpacity={1} onPress={onClose}>
        <View style={modalSt.sheet}>
          <Text style={modalSt.title}>Custom Date Range</Text>

          <MonthYearSelector
            label="FROM"
            value={from}
            max={to}
            onChange={setFrom}
          />
          <MonthYearSelector
            label="TO"
            value={to}
            min={from}
            max={now}
            onChange={setTo}
          />

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <TouchableOpacity style={modalSt.cancelBtn} onPress={onClose}>
              <Text style={modalSt.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={modalSt.applyBtn} onPress={handleApply}>
              <Text style={modalSt.applyText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const modalSt = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sheet: {
    backgroundColor: '#1A1E2E',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#252A3A',
    padding: 24,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 22,
  },
  pickerLabel: {
    color: '#4B5563',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F1117',
    borderRadius: 12,
    paddingVertical: 4,
  },
  pickerValue: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  arrowBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  arrowDisabled: { opacity: 0.3 },
  arrowText: { color: '#2563EB', fontSize: 22, fontWeight: '600' },
  arrowTextDisabled: { color: '#4B5563' },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#0F1117',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#252A3A',
  },
  cancelText: { color: '#6B7280', fontSize: 15, fontWeight: '600' },
  applyBtn: {
    flex: 1,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  applyText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});

const chartSt = StyleSheet.create({
  container: {
    backgroundColor: '#1A1E2E',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#252A3A',
    padding: 16,
    marginBottom: 12,
  },
  sectionLabel: {
    color: '#4B5563',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  yLabel: { color: '#374151', fontSize: 9 },
  xLabel: { color: '#374151', fontSize: 9, marginTop: 6, textAlign: 'center' },
  legend: { flexDirection: 'row', gap: 16, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendText: { color: '#6B7280', fontSize: 11 },
  emptyBox: {
    backgroundColor: '#1A1E2E',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#252A3A',
    padding: 32,
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyText: { color: '#374151', fontSize: 14, textAlign: 'center' },
  rateBadge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F1117',
  },
  rateValue: { fontSize: 22, fontWeight: '800' },
  rateSubLabel: { color: '#4B5563', fontSize: 8, fontWeight: '700', letterSpacing: 0.8, marginTop: 1 },
  progressTrack: {
    height: 10,
    backgroundColor: '#252A3A',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
});

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
          {matchedUser && <Text style={styles.headerSub}>Official</Text>}
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

type RangeMode = 3 | 6 | 'custom';

function PDDashboard({ navigation, matchedUser, fromManager }: {
  navigation: Props['navigation'];
  matchedUser: { name: string; employeeId: string; position: string };
  fromManager?: boolean;
}) {
  const [events, setEvents]         = useState<AttendanceEvent[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [range, setRange]           = useState<RangeMode>(3);
  const [showDateModal, setShowDateModal] = useState(false);
  const [customFrom, setCustomFrom] = useState<MonthYear>(monthsAgoMY(6));
  const [customTo, setCustomTo]     = useState<MonthYear>(nowMonthYear());

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

  // Filter events by selected range
  const filtered = (() => {
    if (range === 'custom') {
      const from = startOfMonth(customFrom);
      const to   = endOfMonth(customTo);
      return events.filter(e => {
        const t = new Date(e.timestamp);
        return t >= from && t <= to;
      });
    }
    const cutoff = monthsAgo(range);
    return events.filter(e => new Date(e.timestamp) >= cutoff);
  })();

  const passCount = filtered.filter(e => e.success).length;
  const failCount = filtered.length - passCount;

  // Group for bar chart — weekly if many data points
  const bars = filtered.length > 0
    ? (filtered.length > 60 ? groupByWeek(filtered) : groupByDay(filtered))
    : [];

  const chartTitle = bars.length > 0
    ? `Daily Attendance${bars.length > 20 ? ' (weekly groups)' : ''}`
    : 'Daily Attendance';

  // Custom range label
  function customRangeLabel(): string {
    return `${MONTH_NAMES[customFrom.month]} ${customFrom.year} – ${MONTH_NAMES[customTo.month]} ${customTo.year}`;
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
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

      {/* Stats */}
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
          <Text style={[styles.statValue, passCount / (filtered.length || 1) >= 0.8 ? styles.colorPass : styles.colorFail]}>
            {filtered.length > 0 ? Math.round((passCount / filtered.length) * 100) : 0}%
          </Text>
          <Text style={styles.statLabel}>PASS RATE</Text>
        </View>
      </View>

      {/* Range selector */}
      <View style={styles.rangeRow}>
        <Text style={styles.rangeLabel}>RANGE</Text>
        {([3, 6] as const).map(r => (
          <TouchableOpacity
            key={r}
            style={[styles.rangeBtn, range === r && styles.rangeBtnActive]}
            onPress={() => setRange(r)}
          >
            <Text style={[styles.rangeBtnText, range === r && styles.rangeBtnTextActive]}>
              {r}M
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.rangeBtn, range === 'custom' && styles.rangeBtnActive]}
          onPress={() => { setRange('custom'); setShowDateModal(true); }}
        >
          <Text style={[styles.rangeBtnText, range === 'custom' && styles.rangeBtnTextActive]}>
            Custom
          </Text>
        </TouchableOpacity>
        {range === 'custom' && (
          <TouchableOpacity onPress={() => setShowDateModal(true)} style={styles.customDatePill}>
            <Text style={styles.customDateText}>{customRangeLabel()}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Charts */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Fetching data…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.chartScroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#2563EB" />
          }
        >
          <AttendanceBarChart bars={bars} title={chartTitle} />
          <PassRateCard pass={passCount} fail={failCount} />
        </ScrollView>
      )}

      {/* Date range picker modal */}
      <DateRangeModal
        visible={showDateModal}
        initialFrom={customFrom}
        initialTo={customTo}
        onApply={(from, to) => { setCustomFrom(from); setCustomTo(to); }}
        onClose={() => setShowDateModal(false)}
      />
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

  chartScroll:        { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 40 },

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

  // Range filter
  rangeRow:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: '#1A1E2E', flexWrap: 'wrap' },
  rangeLabel:         { color: '#4B5563', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginRight: 4 },
  rangeBtn:           { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#252A3A', backgroundColor: '#1A1E2E' },
  rangeBtnActive:     { borderColor: '#2563EB', backgroundColor: '#1E2A45' },
  rangeBtnText:       { color: '#6B7280', fontSize: 13, fontWeight: '500' },
  rangeBtnTextActive: { color: '#60A5FA', fontWeight: '600' },
  customDatePill:     { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#2563EB', backgroundColor: '#1E2A45' },
  customDateText:     { color: '#60A5FA', fontSize: 11, fontWeight: '500' },
});
