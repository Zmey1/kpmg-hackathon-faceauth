import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { VerificationMetrics } from '../types/verification';

interface ResultModalProps {
  metrics: VerificationMetrics;
}

interface MetricRowProps {
  label: string;
  value: string;
  highlight?: boolean;
}

function MetricRow({ label, value, highlight }: MetricRowProps) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, highlight && styles.metricValueHighlight]}>
        {value}
      </Text>
    </View>
  );
}

export default function ResultModal({ metrics }: ResultModalProps) {
  const { success, livenessPass, matchScore, processingMs, matchedUser } = metrics;

  return (
    <View style={[styles.card, success ? styles.cardSuccess : styles.cardFailure]}>
      {/* Icon + headline */}
      <View style={styles.header}>
        <View style={[styles.iconCircle, success ? styles.iconCircleSuccess : styles.iconCircleFailure]}>
          <Text style={styles.iconText}>{success ? '✓' : '✕'}</Text>
        </View>
        <Text style={styles.headline}>
          {success ? 'Authentication Successful' : 'Authentication Failed'}
        </Text>
        {success && matchedUser ? (
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{matchedUser.name}</Text>
            <Text style={styles.userEmployeeId}>ID: {matchedUser.employeeId}</Text>
          </View>
        ) : (
          <Text style={styles.subheadline}>
            {success
              ? 'Identity verified. Access granted.'
              : 'Could not verify identity. Please retry.'}
          </Text>
        )}
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Metrics grid */}
      <View style={styles.metrics}>
        <MetricRow
          label="Liveness Check"
          value={livenessPass ? 'Passed' : 'Failed'}
          highlight={livenessPass}
        />
        <MetricRow
          label="Match Score"
          value={matchScore.toFixed(2)}
          highlight={matchScore >= 0.7}
        />
        <MetricRow
          label="Processing Time"
          value={`${processingMs} ms`}
        />
        <MetricRow
          label="Sync Status"
          value="Queued locally"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 24,
    borderWidth: 1,
    marginHorizontal: 0,
  },
  cardSuccess: {
    backgroundColor: '#0D2018',
    borderColor: '#166534',
  },
  cardFailure: {
    backgroundColor: '#1F0A0A',
    borderColor: '#7F1D1D',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 10,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconCircleSuccess: {
    backgroundColor: '#14532D',
    borderWidth: 2,
    borderColor: '#22C55E',
  },
  iconCircleFailure: {
    backgroundColor: '#450A0A',
    borderWidth: 2,
    borderColor: '#EF4444',
  },
  iconText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headline: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subheadline: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  userInfo: {
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#22C55E',
    textAlign: 'center',
  },
  userEmployeeId: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: '#1F2937',
    marginBottom: 24,
  },
  metrics: {
    gap: 14,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#D1D5DB',
  },
  metricValueHighlight: {
    color: '#22C55E',
  },
});
