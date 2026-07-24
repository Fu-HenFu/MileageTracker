import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { insertTrip, getAllTrips, TripRecord } from '../db/database';
import { calculateTaxDeduction, CountryCode } from '../utils/TaxEngine';
import { useNavigation } from '@react-navigation/native';

export const TrackerScreen = () => {
  const navigation = useNavigation<any>();
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>('US');
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<TripRecord | null>(null);

  // 每次切换到这个页面时刷新数据
  useFocusEffect(
    useCallback(() => {
      setTrips(getAllTrips());
    }, [])
  );

  const handleStartTracking = () => {
    setIsTracking(true);
    setStartTime(new Date());
  };

  const handleStopTracking = () => {
    if (!startTime) return;
    const endTime = new Date();
    const simulatedMeters = Math.floor(Math.random() * (25000 - 8000 + 1)) + 8000;
    const taxRes = calculateTaxDeduction(simulatedMeters, selectedCountry);

    insertTrip({
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      distance_meters: simulatedMeters,
      category: 'business',
      country_code: selectedCountry,
      deduction_amount: taxRes.deductionAmount,
      start_address: 'Current Location',
      end_address: 'Destination Office',
    });

    setIsTracking(false);
    setStartTime(null);
    setTrips(getAllTrips());
  };

  // 删除行程方法
const handleDeleteTrip = (id?: number) => {
  if (!id) return;
  // TODO: 调用 database 的 deleteTrip(id)
  setSelectedTrip(null);
  setTrips(getAllTrips());
};

  const totalTaxSaved = trips
    .filter((t) => t.country_code === selectedCountry)
    .reduce((sum, t) => sum + t.deduction_amount, 0);

  const currentCurrency = calculateTaxDeduction(0, selectedCountry).currency;

  return (
    <SafeAreaView style={styles.container}>
      {/* 国家切换器 */}
      <View style={styles.countryPicker}>
        {(['US', 'CA', 'AU'] as CountryCode[]).map((country) => (
          <TouchableOpacity
            key={country}
            style={[styles.countryBtn, selectedCountry === country && styles.activeBtn]}
            onPress={() => setSelectedCountry(country)}
          >
            <Text style={selectedCountry === country ? styles.activeBtnText : styles.btnText}>
              {country}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 抵税大卡片 */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>2026 Estimated Tax Deduction</Text>
        <Text style={styles.summaryAmount}>{currentCurrency} {totalTaxSaved.toFixed(2)}</Text>
        <Text style={styles.summarySub}>Country Profile: {selectedCountry}</Text>
      </View>

      {/* Start/Stop 控制按钮 */}
      {!isTracking ? (
        <TouchableOpacity style={styles.startBtn} onPress={handleStartTracking}>
          <Text style={styles.startBtnText}>🟢 START DRIVING</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.activeTrackingBox}>
          <Text style={styles.trackingStatusText}>🔴 Trip in Progress...</Text>
          <Text style={styles.trackingSubText}>Recording GPS & Calculation in background</Text>
          <TouchableOpacity style={styles.stopBtn} onPress={handleStopTracking}>
            <Text style={styles.stopBtnText}>STOP & SAVE TRIP</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 最近行程 Header + 查看全部按钮 */}
    <View style={styles.sectionHeaderRow}>
    <Text style={styles.sectionHeader}>Recent Activity</Text>
    <TouchableOpacity onPress={() => navigation.navigate('Log')}>
        <Text style={styles.seeAllText}>See All ({trips.length}) ➔</Text>
    </TouchableOpacity>
    </View>
      <FlatList
        data={trips.slice(0, 3)}
        keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
        renderItem={({ item }) => {
            const res = calculateTaxDeduction(item.distance_meters, item.country_code);
            return (
            <TouchableOpacity 
                style={styles.tripCard} 
                activeOpacity={0.7}
                onPress={() => setSelectedTrip(item)} // 🌟 点击打开详情
            >
                <View style={{ flex: 1 }}>
                <Text style={styles.tripTitle}>{item.start_address} ➔ {item.end_address}</Text>
                <Text style={styles.tripMeta}>{res.formattedDistance} • {item.category.toUpperCase()}</Text>
                </View>
                <Text style={styles.tripAmount}>+{res.formattedDeduction}</Text>
            </TouchableOpacity>
            );
        }}
        />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f4f6', padding: 16 },
  countryPicker: { flexDirection: 'row', justifyContent: 'center', marginBottom: 15, marginTop: 10 },
  countryBtn: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#e0e0e0', marginHorizontal: 5 },
  activeBtn: { backgroundColor: '#007AFF' },
  btnText: { color: '#333', fontWeight: '600' },
  activeBtnText: { color: '#fff', fontWeight: '600' },
  summaryCard: { backgroundColor: '#1c1c1e', padding: 20, borderRadius: 16, alignItems: 'center', marginBottom: 15 },
  summaryTitle: { color: '#8e8e93', fontSize: 13, textTransform: 'uppercase', fontWeight: '600' },
  summaryAmount: { color: '#30d158', fontSize: 36, fontWeight: 'bold', marginVertical: 6 },
  summarySub: { color: '#8e8e93', fontSize: 12 },
  startBtn: { backgroundColor: '#34c759', paddingVertical: 18, borderRadius: 14, alignItems: 'center', marginBottom: 20 },
  startBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  activeTrackingBox: { backgroundColor: '#fff', padding: 16, borderRadius: 14, alignItems: 'center', marginBottom: 20, borderWidth: 1.5, borderColor: '#ff3b30' },
  trackingStatusText: { color: '#ff3b30', fontSize: 16, fontWeight: 'bold' },
  trackingSubText: { color: '#8e8e93', fontSize: 12, marginVertical: 8 },
  stopBtn: { backgroundColor: '#ff3b30', paddingVertical: 12, borderRadius: 10, width: '100%', alignItems: 'center' },
  stopBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
//   sectionHeader: { fontSize: 14, fontWeight: 'bold', color: '#666', marginBottom: 10, textTransform: 'uppercase' },
  tripCard: { backgroundColor: '#fff', padding: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  tripTitle: { fontSize: 15, fontWeight: '600', color: '#1c1c1e' },
  tripMeta: { fontSize: 12, color: '#8e8e93', marginTop: 4 },
  tripAmount: { fontSize: 16, fontWeight: 'bold', color: '#30d158' },
  // ... 保持原有样式，新增/修改以下样式：
  sectionHeaderRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 10 
  },
  sectionHeader: { fontSize: 14, fontWeight: 'bold', color: '#666', textTransform: 'uppercase' },
  seeAllText: { fontSize: 13, color: '#007AFF', fontWeight: '600' },
});