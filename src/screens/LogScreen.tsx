import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  ScrollView,
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

// 月份字典
const MONTH_OPTIONS = [
  { label: 'All Months', value: 'ALL' },
  { label: 'Jan', value: '1' },
  { label: 'Feb', value: '2' },
  { label: 'Mar', value: '3' },
  { label: 'Apr', value: '4' },
  { label: 'May', value: '5' },
  { label: 'Jun', value: '6' },
  { label: 'Jul', value: '7' },
  { label: 'Aug', value: '8' },
  { label: 'Sep', value: '9' },
  { label: 'Oct', value: '10' },
  { label: 'Nov', value: '11' },
  { label: 'Dec', value: '12' },
];

export const LogScreen = () => {
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [searchText, setSearchText] = useState<string>('');
  const [selectedTrip, setSelectedTrip] = useState<TripRecord | null>(null);

  // 全屏放大预览照片 State
  const [fullImageUri, setFullImageUri] = useState<string | null>(null);

  // 1. 筛选条件 State
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'business' | 'personal'>('all');

  // 每次进入页面刷新数据
  useFocusEffect(
    useCallback(() => {
      const realTrips = getAllTrips() || [];

      // 🧪 【测试用】带有示例存证图片的行程数据
      const mock2027Trip: TripRecord = {
        id: 99999,
        start_time: '2027-05-20T10:00:00.000Z',
        end_time: '2027-05-20T10:30:00.000Z',
        distance_meters: 20000,
        category: 'business',
        country_code: 'US',
        deduction_amount: 13.40,
        start_address: '777 Future St, New York',
        end_address: '888 Tech Center, New York',
        notes: 'Client Meeting & Fuel Proof',
        photo_uri: 'https://picsum.photos/600/400',
      };

      setTrips([mock2027Trip, ...realTrips]);
    }, [])
  );

  // 🌟 动态计算年份
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear().toString();
    const yearsSet = new Set<string>();

    yearsSet.add(currentYear);

    trips.forEach((t) => {
      if (t.start_time) {
        const yearStr = new Date(t.start_time).getFullYear().toString();
        yearsSet.add(yearStr);
      }
    });

    const sortedYears = Array.from(yearsSet).sort((a, b) => Number(b) - Number(a));

    if (sortedYears.length === 1) {
      return sortedYears;
    }

    return ['ALL', ...sortedYears];
  }, [trips]);

  // 🔍 核心过滤逻辑 (年份 + 月份 + 类别 + 关键字)
  const filteredTrips = useMemo(() => {
    return trips.filter((t) => {
      const tripDate = new Date(t.start_time);
      const tripYear = tripDate.getFullYear().toString();
      const tripMonth = (tripDate.getMonth() + 1).toString();

      if (selectedYear !== 'ALL' && tripYear !== selectedYear) {
        return false;
      }

      if (selectedMonth !== 'ALL' && tripMonth !== selectedMonth) {
        return false;
      }

      if (selectedCategory !== 'all' && t.category !== selectedCategory) {
        return false;
      }

      if (searchText.trim()) {
        const query = searchText.toLowerCase();
        const matchStart = t.start_address.toLowerCase().includes(query);
        const matchEnd = t.end_address.toLowerCase().includes(query);
        if (!matchStart && !matchEnd) return false;
      }

      return true;
    });
  }, [trips, selectedYear, selectedMonth, selectedCategory, searchText]);

  // 📊 动态计算当前视图汇总金额
  const filteredTotalDeduction = useMemo(() => {
    return filteredTrips.reduce((sum, t) => sum + t.deduction_amount, 0);
  }, [filteredTrips]);

  // 修改历史行程分类
  const handleCategoryChange = (
    trip: TripRecord,
    newCategory: 'business' | 'personal'
  ) => {
    if (!trip.id || trip.category === newCategory) return;

    const taxRes = calculateTaxDeduction(trip.distance_meters, trip.country_code);
    const newDeduction = newCategory === 'business' ? taxRes.deductionAmount : 0;

    updateTripCategory(trip.id, newCategory, newDeduction);

    const updatedTrip = {
      ...trip,
      category: newCategory,
      deduction_amount: newDeduction,
    };
    setSelectedTrip(updatedTrip);
    setTrips(getAllTrips());
  };

  // 删除单条
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

  // 清空当前视图
  const handleClearAll = () => {
    if (filteredTrips.length === 0) return;
    Alert.alert(
      'Clear Filtered Logs',
      `Are you sure you want to delete ${filteredTrips.length} trip records in this current view?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Selected',
          style: 'destructive',
          onPress: () => {
            filteredTrips.forEach((t) => t.id && deleteTrip(t.id));
            setTrips(getAllTrips());
            setSelectedTrip(null);
          },
        },
      ]
    );
  };

  // 动态生成标题文案
  const filterTitle = useMemo(() => {
    const yearStr = selectedYear === 'ALL' ? 'All-Time' : selectedYear;
    const monthObj = MONTH_OPTIONS.find((m) => m.value === selectedMonth);
    const monthStr = selectedMonth === 'ALL' ? '' : `${monthObj?.label || ''}`;
    return `${yearStr} ${monthStr}`.trim();
  }, [selectedYear, selectedMonth]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* 顶部标题栏 */}
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Driving Logs ({filteredTrips.length})</Text>
        {filteredTrips.length > 0 && (
          <TouchableOpacity onPress={handleClearAll}>
            <Text style={styles.clearAllText}>Clear View</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 🌟 筛选控制区 */}
      <View style={styles.filterSection}>
        {availableYears.length > 1 && (
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>YEAR:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 10 }}
            >
              {availableYears.map((year) => (
                <TouchableOpacity
                  key={year}
                  style={[
                    styles.chipBtn,
                    selectedYear === year && styles.activeChipBtn,
                  ]}
                  onPress={() => setSelectedYear(year)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedYear === year && styles.activeChipText,
                    ]}
                  >
                    {year === 'ALL' ? 'All Years' : year}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={[styles.filterRow, availableYears.length > 1 && { marginTop: 8 }]}>
          <Text style={styles.filterLabel}>MONTH:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 10 }}
          >
            {MONTH_OPTIONS.map((item) => (
              <TouchableOpacity
                key={item.value}
                style={[
                  styles.chipBtn,
                  selectedMonth === item.value && styles.activeChipBtn,
                ]}
                onPress={() => setSelectedMonth(item.value)}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedMonth === item.value && styles.activeChipText,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={[styles.segmentContainer, { marginTop: 10 }]}>
          {[
            { label: 'All Categories', value: 'all' },
            { label: 'Business', value: 'business' },
            { label: 'Personal', value: 'personal' },
          ].map((item) => (
            <TouchableOpacity
              key={item.value}
              style={[
                styles.segmentBtn,
                selectedCategory === item.value && styles.activeSegmentBtn,
              ]}
              onPress={() => setSelectedCategory(item.value as any)}
            >
              <Text
                style={[
                  styles.segmentText,
                  selectedCategory === item.value && styles.activeSegmentText,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 📊 动态结果汇总卡片 */}
      <View style={styles.summaryBar}>
        <Text style={styles.summaryBarLabel}>{filterTitle} Savings:</Text>
        <Text style={styles.summaryBarValue}>
          ${filteredTotalDeduction.toFixed(2)}
        </Text>
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
        contentContainerStyle={{ paddingBottom: 20 }}
        renderItem={({ item }) => {
          const res = calculateTaxDeduction(item.distance_meters, item.country_code);
          return (
            <TouchableOpacity
              style={styles.tripCard}
              activeOpacity={0.7}
              onPress={() => setSelectedTrip(item)}
            >
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
              {searchText
                ? 'No matching trips found.'
                : `No records found for ${filterTitle}.`}
            </Text>
          </View>
        }
      />

      {/* 🔍 行程详情 Modal */}
      <Modal
        visible={!!selectedTrip}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setSelectedTrip(null);
          setFullImageUri(null);
        }}
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
                <ScrollView showsVerticalScrollIndicator={false}>
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

                  {selectedTrip.notes ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Notes</Text>
                      <Text style={styles.detailValue}>{selectedTrip.notes}</Text>
                    </View>
                  ) : null}

                  {/* 📷 存证照片区域 */}
                  {selectedTrip.photo_uri ? (
                    <View style={styles.detailRowColumn}>
                      <Text style={styles.detailLabel}>Attached Proof (Audit Shield)</Text>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setFullImageUri(selectedTrip.photo_uri || null)}
                        style={{ marginTop: 8 }}
                      >
                        <Image
                          source={{ uri: selectedTrip.photo_uri }}
                          style={styles.photoThumbnail}
                          resizeMode="cover"
                        />
                        <Text style={styles.zoomHintText}>🔍 Tap image to view full size</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}

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
                </ScrollView>
              );
            })()}
          </View>

          {/* 🌟 核心修复：把大图全屏遮罩移入弹窗内部（绝对定位），解决 iOS 双 Modal 冲突 */}
          {fullImageUri ? (
            <View style={styles.fullImageOverlay}>
              <TouchableOpacity
                style={styles.fullImageCloseBtn}
                onPress={() => setFullImageUri(null)}
              >
                <Text style={styles.fullImageCloseText}>✕ Close</Text>
              </TouchableOpacity>
              <Image
                source={{ uri: fullImageUri }}
                style={styles.fullImage}
                resizeMode="contain"
              />
            </View>
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f4f6',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#1c1c1e' },
  clearAllText: { fontSize: 13, color: '#ff3b30', fontWeight: '600' },

  filterSection: { marginBottom: 10 },
  filterRow: { flexDirection: 'row', alignItems: 'center' },
  filterLabel: { fontSize: 11, fontWeight: 'bold', color: '#8e8e93', marginRight: 8, width: 48 },

  chipBtn: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#e5e5ea', marginRight: 6 },
  activeChipBtn: { backgroundColor: '#007AFF' },
  chipText: { fontSize: 12, color: '#666', fontWeight: '600' },
  activeChipText: { color: '#fff', fontWeight: 'bold' },

  segmentContainer: { flexDirection: 'row', backgroundColor: '#e5e5ea', borderRadius: 9, padding: 2 },
  segmentBtn: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 7 },
  activeSegmentBtn: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 2 },
  segmentText: { fontSize: 12, color: '#8e8e93', fontWeight: '600' },
  activeSegmentText: { color: '#1c1c1e', fontWeight: 'bold' },

  summaryBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, marginBottom: 10 },
  summaryBarLabel: { fontSize: 13, fontWeight: '600', color: '#8e8e93' },
  summaryBarValue: { fontSize: 16, fontWeight: 'bold', color: '#30d158' },

  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12, borderWidth: 1, borderColor: '#e5e5ea' },
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

  emptyBox: { alignItems: 'center', marginTop: 40, paddingHorizontal: 20 },
  emptyText: { color: '#8e8e93', fontSize: 14, textAlign: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1c1c1e' },
  closeBtnText: { fontSize: 18, color: '#8e8e93', fontWeight: 'bold' },
  modalAmountBox: { backgroundColor: '#f2f2f7', padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 20 },
  modalAmountLabel: { fontSize: 12, color: '#8e8e93', textTransform: 'uppercase' },
  modalAmountValue: { fontSize: 28, fontWeight: 'bold', color: '#30d158', marginTop: 4 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f2f2f7' },
  detailLabel: { color: '#8e8e93', fontSize: 14 },
  detailValue: { color: '#1c1c1e', fontSize: 14, fontWeight: '500', maxWidth: '65%', textAlign: 'right' },

  modalCategoryToggle: { flexDirection: 'row', backgroundColor: '#e5e5ea', borderRadius: 8, padding: 2 },
  modalCatBtn: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 6 },
  modalCatBtnActive: { backgroundColor: '#007AFF' },
  modalCatText: { fontSize: 12, fontWeight: '600', color: '#8e8e93' },
  modalCatTextActive: { color: '#fff', fontWeight: 'bold' },

  deleteBtn: { marginTop: 25, backgroundColor: '#ffe5e5', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  deleteBtnText: { color: '#ff3b30', fontWeight: 'bold', fontSize: 14 },

  detailRowColumn: { marginVertical: 12, borderTopWidth: 1, borderTopColor: '#f2f2f7', paddingTop: 10 },
  photoThumbnail: { width: '100%', height: 160, borderRadius: 10 },
  zoomHintText: { fontSize: 11, color: '#007AFF', textAlign: 'right', marginTop: 4, fontWeight: '500' },

  // 🌟 绝对定位浮层样式（确保 zIndex 极高覆盖屏幕）
  fullImageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  fullImageCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10000,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  fullImageCloseText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },
  fullImage: { width: '100%', height: '80%' },
});