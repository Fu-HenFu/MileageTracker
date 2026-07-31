import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
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

  // 1. 筛选条件 State
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'business' | 'personal'>('all');

  // 每次进入页面刷新数据
  // 每次进入页面刷新数据
  useFocusEffect(
    useCallback(() => {
      // 🌟 关键修复：加上 || [] 防护，确保 realTrips 必定是数组，防止 ... 展开报错
      const realTrips = getAllTrips() || [];

      // 🧪 【测试用】伪造一条 2027 年 5 月 20 日的行程数据
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
      };

      setTrips([mock2027Trip, ...realTrips]);
    }, [])
  );

  // 🌟 动态计算年份（零硬编码，随数据自然增长）
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear().toString(); // 获取今年，如 "2026"
    const yearsSet = new Set<string>();

    // 1. 始终把当前年份作为保底选项
    yearsSet.add(currentYear);

    // 2. 只有当数据库里确实存在其他年份的数据时，才收集进来
    trips.forEach((t) => {
      if (t.start_time) {
        const yearStr = new Date(t.start_time).getFullYear().toString();
        yearsSet.add(yearStr);
      }
    });

    // 从大到小排序：2027, 2026...
    const sortedYears = Array.from(yearsSet).sort((a, b) => Number(b) - Number(a));

    // 🌟 关键 UX 细节：如果只有今年 1 个年份，就不需要 'ALL'，避免界面啰嗦
    if (sortedYears.length === 1) {
      return sortedYears; // ['2026']
    }

    // 有多个年份时，才显示 'ALL' 汇总选项
    return ['ALL', ...sortedYears]; // ['ALL', '2027', '2026']
  }, [trips]);

  // 🔍 核心过滤逻辑 (年份 + 月份 + 类别 + 关键字)
  const filteredTrips = useMemo(() => {
    return trips.filter((t) => {
      const tripDate = new Date(t.start_time);
      const tripYear = tripDate.getFullYear().toString();
      const tripMonth = (tripDate.getMonth() + 1).toString();

      // 1️⃣ 按年份过滤
      if (selectedYear !== 'ALL' && tripYear !== selectedYear) {
        return false;
      }

      // 2️⃣ 按月份过滤
      if (selectedMonth !== 'ALL' && tripMonth !== selectedMonth) {
        return false;
      }

      // 3️⃣ 按分类过滤
      if (selectedCategory !== 'all' && t.category !== selectedCategory) {
        return false;
      }

      // 4️⃣ 按关键字过滤
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
    <SafeAreaView style={styles.container}>
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

        {/* 1. 年份可滑动选择器（🌟 只有存在 2 个及以上年份时才渲染，避免首年界面啰嗦） */}
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

        {/* 2. 月份可滑动选择器 */}
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

        {/* 3. 类别按钮 */}
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

  modalCategoryToggle: { flexDirection: 'row', backgroundColor: '#e5e5ea', borderRadius: 8, padding: 2 },
  modalCatBtn: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 6 },
  modalCatBtnActive: { backgroundColor: '#007AFF' },
  modalCatText: { fontSize: 12, fontWeight: '600', color: '#8e8e93' },
  modalCatTextActive: { color: '#fff', fontWeight: 'bold' },

  deleteBtn: { marginTop: 25, backgroundColor: '#ffe5e5', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  deleteBtnText: { color: '#ff3b30', fontWeight: 'bold', fontSize: 14 },
});