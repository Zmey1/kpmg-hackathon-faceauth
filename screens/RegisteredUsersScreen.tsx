import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../types/navigation';
import { RegisteredUser } from '../types/face';
import { getAllRegisteredUsers, deleteRegisteredUser } from '../services/faceTemplateStore';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'RegisteredUsers'>;
};

export default function RegisteredUsersScreen({ navigation }: Props) {
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getAllRegisteredUsers();
      setUsers(all);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUsers();
    }, [loadUsers])
  );

  function confirmDelete(user: RegisteredUser) {
    Alert.alert(
      'Delete Registration',
      `Remove all face templates for "${user.name}" (${user.employeeId})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteRegisteredUser(user.employeeId);
            await loadUsers();
          },
        },
      ]
    );
  }

  function renderItem({ item }: { item: RegisteredUser }) {
    const date = new Date(item.createdAt).toLocaleDateString();
    return (
      <View style={styles.card}>
        <View style={styles.cardBody}>
          <Text style={styles.cardName}>{item.name}</Text>
          <Text style={styles.cardId}>{item.employeeId}</Text>
          <View style={styles.metaRow}>
            <View style={styles.chip}>
              <Text style={styles.chipText}>{item.templates.length} template{item.templates.length !== 1 ? 's' : ''}</Text>
            </View>
            <Text style={styles.dateText}>Registered {date}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => confirmDelete(item)}
        >
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Registered Users</Text>
        <Text style={styles.subtitle}>
          {users.length} employee{users.length !== 1 ? 's' : ''} on file
        </Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#2563EB" />
        </View>
      ) : users.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No registered users yet.</Text>
          <Text style={styles.emptyHint}>
            Register a face from the Home screen.
          </Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={u => u.employeeId}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0F1117',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 6,
  },
  backText: {
    color: '#6B7280',
    fontSize: 15,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFF',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 17,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  emptyHint: {
    fontSize: 13,
    color: '#4B5563',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 12,
  },
  card: {
    backgroundColor: '#1A1E2E',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#252A3A',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  cardId: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'monospace',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    backgroundColor: '#252A3A',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  dateText: {
    fontSize: 11,
    color: '#4B5563',
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: '#7F1D1D',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deleteButtonText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },
});
