import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deleteTrip, getAllTrips, insertTrip, TripRecord } from '../db/database';
import { LocationService } from '../services/LocationService';
import { calculateTaxDeduction, CountryCode } from '../utils/TaxEngine';

export const TrackerScreen = () => {
  const navigation = useNavigation<any>();
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>('US');
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);

  // 控制选中行程详情弹窗
  const [selectedTrip, setSelectedTrip] = useState<TripRecord | null>(null);

  // 每次切换到这个页面时刷新数据
  useFocusEffect(
    useCallback(() => {
      setTrips(getAllTrips());
    }, [])
  );

  // 🟢 开启真实后台 GPS 定位追踪
  const handleStartTracking = async () => {
    const success = await LocationService.startTracking();
    if (success) {
      setIsTracking(true);
      setStartTime(new Date());
    } else {
      Alert.alert(
        'Permission Required',
        'Please allow "Always Allow" location access in device Settings to track mileage in background.'
      );
    }
  };

  // 🔴 停止后台定位，并保存实际测得的 GPS 公里数
  const handleStopTracking = async () => {
    if (!startTime) return;
    const endTime = new Date();

    // 从后台 LocationService 获取实际行驶的物理米数
    const realMeters = await LocationService.stopTracking();
    const taxRes = calculateTaxDeduction(realMeters, selectedCountry);

    insertTrip({
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      distance_meters: realMeters,
      category: 'business',
      country_code: selectedCountry,
      deduction_amount: taxRes.deductionAmount,
      start_address: 'Start Location',
      end_address: 'Destination',
    });

    setIsTracking(false);
    setStartTime(null);
    setTrips(getAllTrips());
  };

  // 🗑️ 删除行程
  const handleDeleteTrip = (id?: number) => {
    if (!id) return;
    if (typeof deleteTrip === 'function') {
      deleteTrip(id);
    }
    setSelectedTrip(null);
    setTrips(getAllTrips());
  };

  const totalTaxSaved = trips
    .filter((t) => t.country_code === selectedCountry)
    .reduce((sum, t) => sum + t.deduction_amount, 0);

  const currentCurrency = calculateTaxDeduction(0, selectedCountry).currency;

  return (
    <SafeAreaView style={styles.container}>
      {/* 1. 国家切换器 */}
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

      {/* 2. 抵税大卡片 */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>2026 Estimated Tax Deduction</Text>
        <Text style={styles.summaryAmount}>
          {currentCurrency} {totalTaxSaved.toFixed(2)}
        </Text>
        <Text style={styles.summarySub}>Country Profile: {selectedCountry}</Text>
      </View>

      {/* 3. Start/Stop 控制按钮 */}
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

      {/* 4. 最近行程 Header */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeader}>Recent Activity</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Log')}>
          <Text style={styles.seeAllText}>See All ({trips.length}) ➔</Text>
        </TouchableOpacity>
      </View>

      {/* 5. 行程列表 */}
      <FlatList
        data={trips.slice(0, 3)}
        keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
        renderItem={({ item }) => {
          const res = calculateTaxDeduction(item.distance_meters, item.country_code);
          return (
            <TouchableOpacity
              style={styles.tripCard}
              activeOpacity={0.7}
              onPress={() => setSelectedTrip(item)}
            >
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.tripTitle} numberOfLines={1}>
                  {item.start_address} ➔ {item.end_address}
                </Text>
                <Text style={styles.tripMeta}>
                  {res.formattedDistance} • {item.category.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.tripAmount}>+{res.formattedDeduction}</Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* 6. 行程详情 Modal 弹窗 */}
      <Modal
        visible={!!selectedTrip}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedTrip(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedTrip && (() => {
              const res = calculateTaxDeduction(selectedTrip.distance_meters, selectedTrip.country_code);
              const startTimeStr = new Date(selectedTrip.start_time).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });
              const endTimeStr = new Date(selectedTrip.end_time).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Trip Details</Text>
                    <TouchableOpacity onPress={() => setSelectedTrip(null)}>
                      <Text style={styles.closeBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.modalAmountBox}>
                    <Text style={styles.modalAmountLabel}>Estimated Tax Deduction</Text>
                    <Text style={styles.modalAmountValue}>+{res.formattedDeduction}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Route</Text>
                    <Text style={styles.detailValue}>
                      {selectedTrip.start_address} ➔ {selectedTrip.end_address}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Distance</Text>
                    <Text style={styles.detailValue}>{res.formattedDistance}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Time Window</Text>
                    <Text style={styles.detailValue}>
                      {startTimeStr} - {endTimeStr}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Category</Text>
                    <Text style={[styles.detailValue, { fontWeight: 'bold', color: '#007AFF' }]}>
                      {selectedTrip.category.toUpperCase()}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDeleteTrip(selectedTrip.id)}
                  >
                    <Text style={styles.deleteBtnText}>Delete This Trip</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>
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
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionHeader: { fontSize: 14, fontWeight: 'bold', color: '#666', textTransform: 'uppercase' },
  seeAllText: { fontSize: 13, color: '#007AFF', fontWeight: '600' },
  tripCard: { backgroundColor: '#fff', padding: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  tripTitle: { fontSize: 15, fontWeight: '600', color: '#1c1c1e' },
  tripMeta: { fontSize: 12, color: '#8e8e93', marginTop: 4 },
  tripAmount: { fontSize: 16, fontWeight: 'bold', color: '#30d158' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1c1c1e' },
  closeBtnText: { fontSize: 18, color: '#8e8e93', fontWeight: 'bold' },
  modalAmountBox: {
    backgroundColor: '#f2f2f7',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  modalAmountLabel: { fontSize: 12, color: '#8e8e93', textTransform: 'uppercase' },
  modalAmountValue: { fontSize: 28, fontWeight: 'bold', color: '#30d158', marginTop: 4 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f7',
  },
  detailLabel: { color: '#8e8e93', fontSize: 14 },
  detailValue: { color: '#1c1c1e', fontSize: 14, fontWeight: '500', maxWidth: '65%', textAlign: 'right' },
  deleteBtn: {
    marginTop: 25,
    backgroundColor: '#ffe5e5',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  deleteBtnText: { color: '#ff3b30', fontWeight: 'bold', fontSize: 14 },
});