import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  deleteTrip,
  getAllTrips,
  updateTripCategory,
  TripRecord,
} from '../db/database';
import { calculateTaxDeduction } from '../utils/TaxEngine';

export const LogScreen = () => {
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [searchText, setSearchText] = useState<string>('');
  const [selectedTrip, setSelectedTrip] = useState<TripRecord | null>(null);

  // 每次进入页面刷新数据
  useFocusEffect(
    useCallback(() => {
      setTrips(getAllTrips());
    }, [])
  );

  // 🔍 根据搜索关键词过滤行程列表
  const filteredTrips = useMemo(() => {
    if (!searchText.trim()) return trips;
    const query = searchText.toLowerCase();
    return trips.filter(
      (t) =>
        t.start_address.toLowerCase().includes(query) ||
        t.end_address.toLowerCase().includes(query)
    );
  }, [trips, searchText]);

  // 🌟 修改历史行程分类并重新计算抵税额
  const handleCategoryChange = (
    trip: TripRecord,
    newCategory: 'business' | 'personal'
  ) => {
    if (!trip.id || trip.category === newCategory) return;

    // 重新计算抵税金额
    const taxRes = calculateTaxDeduction(trip.distance_meters, trip.country_code);
    const newDeduction = newCategory === 'business' ? taxRes.deductionAmount : 0;

    // 更新数据库
    updateTripCategory(trip.id, newCategory, newDeduction);

    // 刷新 Modal 视图及全局列表
    const updatedTrip = {
      ...trip,
      category: newCategory,
      deduction_amount: newDeduction,
    };
    setSelectedTrip(updatedTrip);
    setTrips(getAllTrips());
  };

  // 🗑️ 单条删除带二次确认
  const handleConfirmDelete = (id?: number) => {
    if (!id) return;
    Alert.alert(
      'Delete Record',
      'Are you sure you want to delete this trip log?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteTrip(id);
            if (selectedTrip?.id === id) setSelectedTrip(null);
            setTrips(getAllTrips());
          },
        },
      ]
    );
  };

  // 🧹 一键清空所有数据带二次确认
  const handleClearAll = () => {
    if (trips.length === 0) return;
    Alert.alert(
      'Clear All Logs',
      `Are you sure you want to permanently delete ALL ${trips.length} trip records? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            trips.forEach((t) => t.id && deleteTrip(t.id));
            setTrips([]);
            setSelectedTrip(null);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 顶部标题栏与清空按钮 */}
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>All Driving Logs ({filteredTrips.length})</Text>
        {trips.length > 0 && (
          <TouchableOpacity onPress={handleClearAll}>
            <Text style={styles.clearAllText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 🔍 搜索框 */}
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by street or city..."
          placeholderTextColor="#8e8e93"
          value={searchText}
          onChangeText={setSearchText}
          clearButtonMode="while-editing"
        />
      </View>

      {/* 📋 行程列表 */}
      <FlatList
        data={filteredTrips}
        keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
        renderItem={({ item }) => {
          const res = calculateTaxDeduction(item.distance_meters, item.country_code);
          return (
            <TouchableOpacity
              style={styles.tripCard}
              activeOpacity={0.7}
              onPress={() => setSelectedTrip(item)}
            >
              {/* 行程路线与时间 */}
              <View style={{ flex: 1, marginRight: 8 }}>
                <View style={styles.addressRow}>
                  <View style={[styles.dot, { backgroundColor: '#30d158' }]} />
                  <Text style={styles.addressText} numberOfLines={1}>
                    {item.start_address}
                  </Text>
                </View>

                <View style={[styles.addressRow, { marginTop: 4 }]}>
                  <View style={[styles.dot, { backgroundColor: '#ff3b30' }]} />
                  <Text style={styles.addressText} numberOfLines={1}>
                    {item.end_address}
                  </Text>
                </View>

                <Text style={styles.tripMeta}>
                  {new Date(item.start_time).toLocaleDateString()} • {res.formattedDistance} • {item.category.toUpperCase()}
                </Text>
              </View>

              {/* 右侧金额与快捷删除按钮 */}
              <View style={{ alignItems: 'flex-end' }}>
                <Text
                  style={[
                    styles.tripAmount,
                    item.category === 'personal' && { color: '#8e8e93' },
                  ]}
                >
                  {item.category === 'personal' ? '+$0.00' : `+${res.formattedDeduction}`}
                </Text>
                <TouchableOpacity
                  style={styles.quickDeleteBtn}
                  onPress={() => handleConfirmDelete(item.id)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.quickDeleteText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              {searchText ? 'No matching trips found.' : 'No trips recorded yet.'}
            </Text>
          </View>
        }
      />

      {/* 🔍 行程详情 Modal 弹窗 */}
      <Modal
        visible={!!selectedTrip}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedTrip(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedTrip && (() => {
              const res = calculateTaxDeduction(
                selectedTrip.distance_meters,
                selectedTrip.country_code
              );
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
                    <Text style={styles.modalTitle}>Log Details</Text>
                    <TouchableOpacity onPress={() => setSelectedTrip(null)}>
                      <Text style={styles.closeBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.modalAmountBox}>
                    <Text style={styles.modalAmountLabel}>Estimated Tax Deduction</Text>
                    <Text style={styles.modalAmountValue}>
                      {selectedTrip.category === 'personal'
                        ? '+$0.00'
                        : `+${res.formattedDeduction}`}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Start Address</Text>
                    <Text style={styles.detailValue}>{selectedTrip.start_address}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>End Address</Text>
                    <Text style={styles.detailValue}>{selectedTrip.end_address}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Distance</Text>
                    <Text style={styles.detailValue}>{res.formattedDistance}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Date & Time</Text>
                    <Text style={styles.detailValue}>
                      {new Date(selectedTrip.start_time).toLocaleDateString()} ({startTimeStr} - {endTimeStr})
                    </Text>
                  </View>

                  {/* 🌟 动态分段按钮：可以在日志页面随时修改历史分类 */}
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Category</Text>
                    <View style={styles.modalCategoryToggle}>
                      <TouchableOpacity
                        style={[
                          styles.modalCatBtn,
                          selectedTrip.category === 'business' && styles.modalCatBtnActive,
                        ]}
                        onPress={() => handleCategoryChange(selectedTrip, 'business')}
                      >
                        <Text
                          style={[
                            styles.modalCatText,
                            selectedTrip.category === 'business' && styles.modalCatTextActive,
                          ]}
                        >
                          BUSINESS
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.modalCatBtn,
                          selectedTrip.category === 'personal' && styles.modalCatBtnActive,
                        ]}
                        onPress={() => handleCategoryChange(selectedTrip, 'personal')}
                      >
                        <Text
                          style={[
                            styles.modalCatText,
                            selectedTrip.category === 'personal' && styles.modalCatTextActive,
                          ]}
                        >
                          PERSONAL
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleConfirmDelete(selectedTrip.id)}
                  >
                    <Text style={styles.deleteBtnText}>Delete This Log</Text>
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 15 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#1c1c1e' },
  clearAllText: { fontSize: 14, color: '#ff3b30', fontWeight: '600' },

  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 15, borderWidth: 1, borderColor: '#e5e5ea' },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#1c1c1e' },

  tripCard: { backgroundColor: '#fff', padding: 14, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  addressRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 7, height: 7, borderRadius: 3.5, marginRight: 8 },
  addressText: { fontSize: 14, fontWeight: '600', color: '#1c1c1e', flex: 1 },
  tripMeta: { fontSize: 11, color: '#8e8e93', marginTop: 6, marginLeft: 15 },
  tripAmount: { fontSize: 15, fontWeight: 'bold', color: '#30d158' },
  quickDeleteBtn: { marginTop: 6, padding: 2 },
  quickDeleteText: { fontSize: 14 },

  emptyBox: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#8e8e93', fontSize: 15 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1c1c1e' },
  closeBtnText: { fontSize: 18, color: '#8e8e93', fontWeight: 'bold' },
  modalAmountBox: { backgroundColor: '#f2f2f7', padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 20 },
  modalAmountLabel: { fontSize: 12, color: '#8e8e93', textTransform: 'uppercase' },
  modalAmountValue: { fontSize: 28, fontWeight: 'bold', color: '#30d158', marginTop: 4 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f2f2f7' },
  detailLabel: { color: '#8e8e93', fontSize: 14 },
  detailValue: { color: '#1c1c1e', fontSize: 14, fontWeight: '500', maxWidth: '65%', textAlign: 'right' },

  // Modal 内部分类切换控件样式
  modalCategoryToggle: { flexDirection: 'row', backgroundColor: '#e5e5ea', borderRadius: 8, padding: 2 },
  modalCatBtn: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 6 },
  modalCatBtnActive: { backgroundColor: '#007AFF' },
  modalCatText: { fontSize: 12, fontWeight: '600', color: '#8e8e93' },
  modalCatTextActive: { color: '#fff', fontWeight: 'bold' },

  deleteBtn: { marginTop: 25, backgroundColor: '#ffe5e5', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  deleteBtnText: { color: '#ff3b30', fontWeight: 'bold', fontSize: 14 },
});