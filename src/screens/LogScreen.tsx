import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, FlatList, SafeAreaView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getAllTrips, TripRecord } from '../db/database';
import { calculateTaxDeduction } from '../utils/TaxEngine';

export const LogScreen = () => {
  const [trips, setTrips] = useState<TripRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      setTrips(getAllTrips());
    }, [])
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.headerTitle}>All Driving Logs</Text>
      <FlatList
        data={trips}
        keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
        renderItem={({ item }) => {
          const res = calculateTaxDeduction(item.distance_meters, item.country_code);
          return (
            <View style={styles.tripCard}>
              <View>
                <Text style={styles.tripTitle}>{item.start_address} ➔ {item.end_address}</Text>
                <Text style={styles.tripDate}>{new Date(item.start_time).toLocaleDateString()}</Text>
                <Text style={styles.tripMeta}>{res.formattedDistance} • {item.category.toUpperCase()}</Text>
              </View>
              <Text style={styles.tripAmount}>+{res.formattedDeduction}</Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No trips recorded yet.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f4f6', padding: 16 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#1c1c1e', marginVertical: 15 },
  tripCard: { backgroundColor: '#fff', padding: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  tripTitle: { fontSize: 15, fontWeight: '600', color: '#1c1c1e' },
  tripDate: { fontSize: 11, color: '#007AFF', marginVertical: 2 },
  tripMeta: { fontSize: 12, color: '#8e8e93' },
  tripAmount: { fontSize: 16, fontWeight: 'bold', color: '#30d158' },
  emptyBox: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#8e8e93', fontSize: 16 },
});