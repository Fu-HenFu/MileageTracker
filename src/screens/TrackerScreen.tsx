import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,                       // 👈 新增引入
  KeyboardAvoidingView,          // 👈 新增引入
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,       // 👈 新增引入
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  deleteTrip,
  getAllTrips,
  insertTrip,
  updateTripCategory,
  TripRecord,
} from '../db/database';
import { LocationService } from '../services/LocationService';
import { calculateTaxDeduction, CountryCode } from '../utils/TaxEngine';

interface SavedPlace {
  id: string;
  label: string;
  address: string;
}

const DEFAULT_PLACES: SavedPlace[] = [
  { id: 'home', label: '🏡 Home', address: '' },
  { id: 'office', label: '🏢 Office', address: '' },
  { id: 'airport', label: '✈️ Airport', address: '' },
  { id: 'store', label: '🏬 Wholesale Store', address: '' },
];

const QUICK_PURPOSES = [
  '🤝 Client Meeting',
  '📦 Supply Pickup',
  '🏗️ Site Visit',
  '🏦 Bank & Tax',
  '✈️ Airport Dropoff',
];

export const TrackerScreen = () => {
  const [startAddress, setStartAddress] = useState<string>('');
  const navigation = useNavigation<any>();
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>('US');

  const [selectedCategory, setSelectedCategory] = useState<'business' | 'personal'>('business');

  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);

  const [selectedTrip, setSelectedTrip] = useState<TripRecord | null>(null);

  // 手动补录行程 Modal State
  const [isManualModalVisible, setIsManualModalVisible] = useState(false);
  const [manualStart, setManualStart] = useState('');
  const [manualEnd, setManualEnd] = useState('');
  const [manualDistance, setManualDistance] = useState('');
  const [manualCategory, setManualCategory] = useState<'business' | 'personal'>('business');
  const [manualNotes, setManualNotes] = useState('');
  const [manualDate, setManualDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // 搜索补全与坐标 State
  const [startSuggestions, setStartSuggestions] = useState<any[]>([]);
  const [placeSuggestions, setPlaceSuggestions] = useState<any[]>([]);
  const [endSuggestions, setEndSuggestions] = useState<any[]>([]);
  const [startCoords, setStartCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [endCoords, setEndCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [isCalculatingDist, setIsCalculatingDist] = useState(false);

  // 常用地址管理 State
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>(DEFAULT_PLACES);
  const [isPlaceModalVisible, setIsPlaceModalVisible] = useState(false);
  const [editingPlace, setEditingPlace] = useState<SavedPlace | null>(null);
  const [placeLabelInput, setPlaceLabelInput] = useState('');
  const [placeAddressInput, setPlaceAddressInput] = useState('');
  const [currentTargetField, setCurrentTargetField] = useState<'start' | 'end' | null>(null);

  useEffect(() => {
    loadSavedPlaces();
  }, []);

  useEffect(() => {
    if (startCoords && endCoords) {
      calculateDrivingDistance(startCoords, endCoords);
    }
  }, [startCoords, endCoords, selectedCountry]);

  useEffect(() => {
    AsyncStorage.getItem('@taxmiles_selected_country').then((savedCountry) => {
      if (savedCountry && (savedCountry === 'US' || savedCountry === 'CA' || savedCountry === 'AU')) {
        setSelectedCountry(savedCountry as CountryCode);
      }
    });
  }, []);

  const handleCountrySwitch = async (country: CountryCode) => {
    setSelectedCountry(country);
    await AsyncStorage.setItem('@taxmiles_selected_country', country);
  };

  const loadSavedPlaces = async () => {
    try {
      const jsonStr = await AsyncStorage.getItem('@taxmiles_saved_places_v3');
      if (jsonStr) {
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSavedPlaces(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to load saved places', e);
    }
  };

  const savePlacesToStorage = async (newPlaces: SavedPlace[]) => {
    try {
      setSavedPlaces(newPlaces);
      await AsyncStorage.setItem('@taxmiles_saved_places_v3', JSON.stringify(newPlaces));
    } catch (e) {
      console.error('Failed to save places', e);
    }
  };

  // 🔍 优化后的地址自动搜索补全 (含超时控制与防频发)
  const fetchAddressSuggestions = async (
    query: string,
    setSuggestions: (list: any[]) => void
  ) => {
    if (!query || query.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    // 🌟 1. 设置 3 秒超时控制器，防止请求无限挂起
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query
      )}&limit=5&addressdetails=1`;

      const response = await fetch(url, {
        headers: { 'User-Agent': 'TaxMilesApp/1.0' },
        signal: controller.signal, // 绑定中断信号
      });

      clearTimeout(timeoutId);

      if (!response.ok) return;
      const data = await response.json();
      setSuggestions(data || []);
    } catch (error: any) {
      // 🌟 2. 优雅捕获超时与网络中断，静默处理不抛红错
      if (error.name === 'AbortError' || error.message?.includes('timed out')) {
        // 网络超时时直接忽略，不干扰用户正常输入
        return;
      }
      console.warn('Autocomplete fetch skipped due to network issue.');
    }
  };

  const calculateDrivingDistance = async (
    start: { lat: number; lon: number },
    end: { lat: number; lon: number }
  ) => {
    setIsCalculatingDist(true);
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=false`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const meters = data.routes[0].distance;
        const dist = selectedCountry === 'US' ? meters / 1609.34 : meters / 1000;
        setManualDistance(dist.toFixed(1));
      }
    } catch (error) {
      console.error('Distance calculation error:', error);
    } finally {
      setIsCalculatingDist(false);
    }
  };

  const handlePlacePress = (place: SavedPlace, targetField: 'start' | 'end') => {
    if (!place.address) {
      setEditingPlace(place);
      setPlaceLabelInput(place.label);
      setPlaceAddressInput('');
      setCurrentTargetField(targetField);
      setIsPlaceModalVisible(true);
    } else {
      if (targetField === 'start') {
        setManualStart(place.address);
        fetchAddressSuggestions(place.address, (data) => {
          if (data.length > 0) {
            setStartCoords({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) });
          }
        });
      } else {
        setManualEnd(place.address);
        fetchAddressSuggestions(place.address, (data) => {
          if (data.length > 0) {
            setEndCoords({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) });
          }
        });
      }
    }
  };

  const handleAddNewPlace = (targetField: 'start' | 'end') => {
    setEditingPlace(null);
    setPlaceLabelInput('');
    setPlaceAddressInput('');
    setCurrentTargetField(targetField);
    setIsPlaceModalVisible(true);
  };

  const handlePlaceLongPress = (place: SavedPlace) => {
    Alert.alert(
      `Manage "${place.label}"`,
      place.address ? `Saved Address: ${place.address}` : 'No address set yet.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Edit Address',
          onPress: () => {
            setEditingPlace(place);
            setPlaceLabelInput(place.label);
            setPlaceAddressInput(place.address);
            setCurrentTargetField(null);
            setIsPlaceModalVisible(true);
          },
        },
        {
          text: 'Delete Place',
          style: 'destructive',
          onPress: () => {
            const updated = savedPlaces.filter((p) => p.id !== place.id);
            savePlacesToStorage(updated);
          },
        },
      ]
    );
  };

  const handleSavePlaceModal = () => {
    if (!placeLabelInput.trim() || !placeAddressInput.trim()) {
      Alert.alert('Missing Info', 'Please enter both a Name and a Full Street Address.');
      return;
    }

    const label = placeLabelInput.trim();
    const address = placeAddressInput.trim();
    let updatedPlaces: SavedPlace[];

    if (editingPlace) {
      updatedPlaces = savedPlaces.map((p) =>
        p.id === editingPlace.id ? { ...p, label, address } : p
      );
    } else {
      const newPlace: SavedPlace = {
        id: Date.now().toString(),
        label,
        address,
      };
      updatedPlaces = [...savedPlaces, newPlace];
    }

    savePlacesToStorage(updatedPlaces);

    if (currentTargetField === 'start') setManualStart(address);
    if (currentTargetField === 'end') setManualEnd(address);

    setIsPlaceModalVisible(false);
    setPlaceSuggestions([]); // 👈 清空联想列表
    setEditingPlace(null);
    setPlaceLabelInput('');
    setPlaceAddressInput('');
    setCurrentTargetField(null);
  };

  useFocusEffect(
    useCallback(() => {
      setTrips(getAllTrips() || []);
    }, [])
  );

  const handleStartTracking = async () => {
    const success = await LocationService.startTracking();
    if (success) {
      setIsTracking(true);
      setStartTime(new Date());

      const address = await LocationService.getReadableAddress();
      setStartAddress(address);
    } else {
      Alert.alert(
        'Permission Required',
        'Please allow "Always Allow" location access in device Settings to track mileage in background.'
      );
    }
  };

  const handleStopTracking = async () => {
    if (!startTime) return;
    const endTime = new Date();

    const endAddress = await LocationService.getReadableAddress();
    const realMeters = await LocationService.stopTracking();
    const taxRes = calculateTaxDeduction(realMeters, selectedCountry);

    const finalDeductionAmount =
      selectedCategory === 'business' ? taxRes.deductionAmount : 0;

    insertTrip({
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      distance_meters: realMeters,
      category: selectedCategory,
      country_code: selectedCountry,
      deduction_amount: finalDeductionAmount,
      start_address: startAddress || 'Start Location',
      end_address: endAddress || 'End Location',
      notes: selectedCategory === 'business' ? 'GPS Auto Tracked Drive' : 'Personal Drive',
    });

    setIsTracking(false);
    setStartTime(null);
    setStartAddress('');
    setTrips(getAllTrips() || []);
  };

  const handleSaveManualTrip = () => {
    const distNum = parseFloat(manualDistance);

    if (isNaN(distNum) || distNum <= 0) {
      Alert.alert('Invalid Distance', 'Please enter a valid numeric distance.');
      return;
    }

    if (!manualStart.trim() || !manualEnd.trim()) {
      Alert.alert('Missing Fields', 'Please enter both Start and End addresses.');
      return;
    }

    const distanceMeters = selectedCountry === 'US' ? distNum * 1609.34 : distNum * 1000;
    const taxRes = calculateTaxDeduction(distanceMeters, selectedCountry);
    const finalDeductionAmount = manualCategory === 'business' ? taxRes.deductionAmount : 0;

    const startTimeIso = manualDate.toISOString();
    const endTimeObj = new Date(manualDate.getTime() + 20 * 60 * 1000);
    const endTimeIso = endTimeObj.toISOString();

    insertTrip({
      start_time: startTimeIso,
      end_time: endTimeIso,
      distance_meters: distanceMeters,
      category: manualCategory,
      country_code: selectedCountry,
      deduction_amount: finalDeductionAmount,
      start_address: manualStart.trim(),
      end_address: manualEnd.trim(),
      notes: manualNotes.trim() || (manualCategory === 'business' ? 'Business Mileage' : 'Personal Drive'),
    });

    setIsManualModalVisible(false);
    setManualStart('');
    setManualEnd('');
    setManualDistance('');
    setManualNotes('');
    setStartCoords(null);
    setEndCoords(null);
    setManualCategory('business');
    setManualDate(new Date());

    setTrips(getAllTrips() || []);
    Alert.alert('Success 🚗', 'Manual trip record added successfully.');
  };

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
    setTrips(getAllTrips() || []);
  };

  const handleDeleteTrip = (id?: number) => {
    if (!id) return;
    if (typeof deleteTrip === 'function') {
      deleteTrip(id);
    }
    setSelectedTrip(null);
    setTrips(getAllTrips() || []);
  };

  const totalTaxSaved = trips
    .filter((t) => t.country_code === selectedCountry)
    .reduce((sum, t) => sum + t.deduction_amount, 0);

  const currentCurrency = calculateTaxDeduction(0, selectedCountry).currency;
  const distanceUnitLabel = selectedCountry === 'US' ? 'Miles' : 'km';

  const renderPlaceChips = (targetField: 'start' | 'end') => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScrollView}>
      {savedPlaces.map((place) => {
        const isConfigured = !!place.address;
        return (
          <TouchableOpacity
            key={`${targetField}-${place.id}`}
            style={[styles.chip, isConfigured && styles.activeChip]}
            onPress={() => handlePlacePress(place, targetField)}
            onLongPress={() => handlePlaceLongPress(place)}
          >
            <Text style={[styles.chipText, isConfigured && styles.activeChipText]}>
              {isConfigured ? place.label : `+ ${place.label}`}
            </Text>
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity
        style={styles.addPlaceChip}
        onPress={() => handleAddNewPlace(targetField)}
      >
        <Text style={styles.addPlaceChipText}>➕ Add Place</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* 1. 国家切换器 */}
      <View style={styles.countryPicker}>
        {(['US', 'CA', 'AU'] as CountryCode[]).map((country) => (
          <TouchableOpacity
            key={country}
            style={[styles.countryBtn, selectedCountry === country && styles.activeBtn]}
            onPress={() => handleCountrySwitch(country)}
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

      {/* 3. 开车前分类预选器 */}
      {!isTracking && (
        <View style={styles.categoryPicker}>
          <TouchableOpacity
            style={[
              styles.categoryBtn,
              selectedCategory === 'business' && styles.activeCategoryBtn,
            ]}
            onPress={() => setSelectedCategory('business')}
          >
            <Text
              style={[
                styles.categoryText,
                selectedCategory === 'business' && styles.activeCategoryText,
              ]}
            >
              🏢 Business
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.categoryBtn,
              selectedCategory === 'personal' && styles.activeCategoryBtn,
            ]}
            onPress={() => setSelectedCategory('personal')}
          >
            <Text
              style={[
                styles.categoryText,
                selectedCategory === 'personal' && styles.activeCategoryText,
              ]}
            >
              🚗 Personal
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 4. Start/Stop 控制按钮 */}
      {!isTracking ? (
        <TouchableOpacity style={styles.startBtn} onPress={handleStartTracking}>
          <Text style={styles.startBtnText}>
            🟢 START {selectedCategory.toUpperCase()} DRIVE
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.activeTrackingBox}>
          <Text style={styles.trackingStatusText}>
            🔴 {selectedCategory.toUpperCase()} Trip in Progress...
          </Text>
          <Text style={styles.trackingSubText}>Recording GPS & Calculation in background</Text>
          <TouchableOpacity style={styles.stopBtn} onPress={handleStopTracking}>
            <Text style={styles.stopBtnText}>STOP & SAVE TRIP</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 5. 最近行程 Header */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeader}>Recent Activity</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => setIsManualModalVisible(true)}>
            <Text style={styles.manualEntryBtnText}>✍️ + Manual Log</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Log')}>
            <Text style={styles.seeAllText}>See All ({trips.length}) ➔</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 6. 行程列表 */}
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
              <View style={{ flex: 1, marginRight: 12 }}>
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

              <Text
                style={[
                  styles.tripAmount,
                  item.category === 'personal' && { color: '#8e8e93' },
                ]}
              >
                {item.category === 'personal' ? '+$0.00' : `+${res.formattedDeduction}`}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* ✍️ 7. 手动补录 Modal (🌟 优化：加入 KeyboardAvoidingView 防止键盘遮挡) */}
      <Modal
        visible={isManualModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsManualModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Manual Trip Log</Text>
                <TouchableOpacity onPress={() => setIsManualModalVisible(false)}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* 📅 1. 日期选择器 */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Trip Date & Time</Text>
                  <TouchableOpacity
                    style={styles.datePickerBtn}
                    onPress={() => setShowDatePicker(!showDatePicker)}
                  >
                    <Text style={styles.datePickerBtnText}>
                      📅 {manualDate.toLocaleDateString()} ({manualDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                    </Text>
                  </TouchableOpacity>

                  {showDatePicker && (
                    <View style={Platform.OS === 'ios' ? styles.datePickerContainer : undefined}>
                      <DateTimePicker
                        value={manualDate}
                        mode="datetime"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, selectedDate) => {
                          if (Platform.OS === 'android') {
                            setShowDatePicker(false);
                            if (event.type === 'set' && selectedDate) {
                              setManualDate(selectedDate);
                            }
                          } else {
                            if (selectedDate) setManualDate(selectedDate);
                          }
                        }}
                      />
                      {Platform.OS === 'ios' && (
                        <TouchableOpacity
                          style={styles.datePickerDoneBtn}
                          onPress={() => setShowDatePicker(false)}
                        >
                          <Text style={styles.datePickerDoneText}>Done</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>

                {/* 🏡 2. 起点地址 */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Start Address</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g., 123 Main St, San Francisco"
                    placeholderTextColor="#8e8e93"
                    value={manualStart}
                    onChangeText={(text) => {
                      setManualStart(text);
                      fetchAddressSuggestions(text, setStartSuggestions);
                    }}
                  />

                  {startSuggestions.length > 0 && (
                    <View style={styles.suggestionsContainer}>
                      {startSuggestions.map((item, index) => (
                        <TouchableOpacity
                          key={`start-sug-${index}`}
                          style={styles.suggestionItem}
                          onPress={() => {
                            setManualStart(item.display_name);
                            setStartCoords({ lat: parseFloat(item.lat), lon: parseFloat(item.lon) });
                            setStartSuggestions([]);
                          }}
                        >
                          <Text style={styles.suggestionText} numberOfLines={2}>
                            📍 {item.display_name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {renderPlaceChips('start')}
                </View>

                {/* 🏬 3. 终点地址 */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>End Address</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g., 456 Market St, San Francisco"
                    placeholderTextColor="#8e8e93"
                    value={manualEnd}
                    onChangeText={(text) => {
                      setManualEnd(text);
                      fetchAddressSuggestions(text, setEndSuggestions);
                    }}
                  />

                  {endSuggestions.length > 0 && (
                    <View style={styles.suggestionsContainer}>
                      {endSuggestions.map((item, index) => (
                        <TouchableOpacity
                          key={`end-sug-${index}`}
                          style={styles.suggestionItem}
                          onPress={() => {
                            setManualEnd(item.display_name);
                            setEndCoords({ lat: parseFloat(item.lat), lon: parseFloat(item.lon) });
                            setEndSuggestions([]);
                          }}
                        >
                          <Text style={styles.suggestionText} numberOfLines={2}>
                            📍 {item.display_name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {renderPlaceChips('end')}
                </View>

                {/* 📏 4. 里程数 */}
                <View style={styles.inputGroup}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.inputLabel}>Distance ({distanceUnitLabel})</Text>
                    {isCalculatingDist && (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <ActivityIndicator size="small" color="#007AFF" />
                        <Text style={{ fontSize: 11, color: '#007AFF', marginLeft: 4 }}>
                          Calculating route...
                        </Text>
                      </View>
                    )}
                  </View>
                  <TextInput
                    style={styles.textInput}
                    placeholder={`e.g., 12.5 (${distanceUnitLabel})`}
                    placeholderTextColor="#8e8e93"
                    keyboardType="numeric"
                    value={manualDistance}
                    onChangeText={setManualDistance}
                  />
                </View>

                {/* 💼 5. 商业目的 */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Business Purpose / Notes</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g., Client meeting with John"
                    placeholderTextColor="#8e8e93"
                    value={manualNotes}
                    onChangeText={setManualNotes}
                  />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScrollView}>
                    {QUICK_PURPOSES.map((purpose) => (
                      <TouchableOpacity
                        key={purpose}
                        style={styles.chip}
                        onPress={() => setManualNotes(purpose)}
                      >
                        <Text style={styles.chipText}>{purpose}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* 🏷️ 6. 行程分类 */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Category</Text>
                  <View style={styles.categoryPicker}>
                    <TouchableOpacity
                      style={[
                        styles.categoryBtn,
                        manualCategory === 'business' && styles.activeCategoryBtn,
                      ]}
                      onPress={() => setManualCategory('business')}
                    >
                      <Text
                        style={[
                          styles.categoryText,
                          manualCategory === 'business' && styles.activeCategoryText,
                        ]}
                      >
                        🏢 Business
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.categoryBtn,
                        manualCategory === 'personal' && styles.activeCategoryBtn,
                      ]}
                      onPress={() => setManualCategory('personal')}
                    >
                      <Text
                        style={[
                          styles.categoryText,
                          manualCategory === 'personal' && styles.activeCategoryText,
                        ]}
                      >
                        🚗 Personal
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity style={styles.saveManualBtn} onPress={handleSaveManualTrip}>
                  <Text style={styles.saveManualBtnText}>Save Trip Record</Text>
                </TouchableOpacity>
              </ScrollView>

              {/* 🌟 7. 常用地址悬浮面板 (优化：重构为顶层悬浮并设置 KeyboardAvoidingView) */}
              {/* 常用地址悬浮面板 (已接入自动搜索补全 🔍) */}
              {isPlaceModalVisible && (
                <View style={styles.subOverlay}>
                  <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1, justifyContent: 'center', width: '100%' }}
                  >
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                      <View style={styles.subModalBox}>
                        <View style={styles.modalHeader}>
                          <Text style={styles.modalTitle}>
                            {editingPlace ? `Edit "${editingPlace.label}"` : 'Add Saved Place'}
                          </Text>
                          <TouchableOpacity
                            onPress={() => {
                              setIsPlaceModalVisible(false);
                              setPlaceSuggestions([]);
                            }}
                          >
                            <Text style={styles.closeBtnText}>✕</Text>
                          </TouchableOpacity>
                        </View>

                        <View style={styles.inputGroup}>
                          <Text style={styles.inputLabel}>Place Name / Label (名称)</Text>
                          <TextInput
                            style={styles.textInput}
                            placeholder="e.g., 🏡 Home, Costco, Client ABC"
                            placeholderTextColor="#8e8e93"
                            value={placeLabelInput}
                            onChangeText={setPlaceLabelInput}
                          />
                        </View>

                        {/* 🌟 支持自动补全的地址输入框 */}
                        <View style={styles.inputGroup}>
                          <Text style={styles.inputLabel}>Full Street Address (真实门牌地址)</Text>
                          <TextInput
                            style={styles.textInput}
                            placeholder="e.g., 123 Main St, San Francisco, CA"
                            placeholderTextColor="#8e8e93"
                            value={placeAddressInput}
                            onChangeText={(text) => {
                              setPlaceAddressInput(text);
                              fetchAddressSuggestions(text, setPlaceSuggestions); // 👈 实时拉取建议
                            }}
                          />

                          {/* 🔍 联想搜索结果下拉菜单 */}
                          {placeSuggestions.length > 0 && (
                            <View style={styles.suggestionsContainer}>
                              {placeSuggestions.map((item, index) => (
                                <TouchableOpacity
                                  key={`place-sug-${index}`}
                                  style={styles.suggestionItem}
                                  onPress={() => {
                                    setPlaceAddressInput(item.display_name);
                                    setPlaceSuggestions([]); // 点击选中后收起菜单
                                  }}
                                >
                                  <Text style={styles.suggestionText} numberOfLines={2}>
                                    📍 {item.display_name}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          )}
                        </View>

                        <TouchableOpacity style={styles.saveManualBtn} onPress={handleSavePlaceModal}>
                          <Text style={styles.saveManualBtnText}>Save Place & Fill Address</Text>
                        </TouchableOpacity>
                      </View>
                    </TouchableWithoutFeedback>
                  </KeyboardAvoidingView>
                </View>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 8. 行程详情 Modal */}
      <Modal
        visible={!!selectedTrip}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedTrip(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
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
                      <Text style={styles.modalTitle}>Trip Details</Text>
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

                    {selectedTrip.notes ? (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Notes</Text>
                        <Text style={styles.detailValue}>{selectedTrip.notes}</Text>
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
                      onPress={() => handleDeleteTrip(selectedTrip.id)}
                    >
                      <Text style={styles.deleteBtnText}>Delete This Trip</Text>
                    </TouchableOpacity>
                  </>
                );
              })()}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f4f6', padding: 16 },
  countryPicker: { flexDirection: 'row', justifyContent: 'center', marginBottom: 12, marginTop: 10 },
  countryBtn: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#e0e0e0', marginHorizontal: 5 },
  activeBtn: { backgroundColor: '#007AFF' },
  btnText: { color: '#333', fontWeight: '600' },
  activeBtnText: { color: '#fff', fontWeight: '600' },
  summaryCard: { backgroundColor: '#1c1c1e', padding: 20, borderRadius: 16, alignItems: 'center', marginBottom: 15 },
  summaryTitle: { color: '#8e8e93', fontSize: 13, textTransform: 'uppercase', fontWeight: '600' },
  summaryAmount: { color: '#30d158', fontSize: 36, fontWeight: 'bold', marginVertical: 6 },
  summarySub: { color: '#8e8e93', fontSize: 12 },

  categoryPicker: { flexDirection: 'row', backgroundColor: '#e5e5ea', borderRadius: 12, padding: 3, marginBottom: 12 },
  categoryBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 9 },
  activeCategoryBtn: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 2, elevation: 2 },
  categoryText: { color: '#8e8e93', fontWeight: '600', fontSize: 14 },
  activeCategoryText: { color: '#1c1c1e', fontWeight: 'bold', fontSize: 14 },

  startBtn: { backgroundColor: '#34c759', paddingVertical: 18, borderRadius: 14, alignItems: 'center', marginBottom: 20 },
  startBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  activeTrackingBox: { backgroundColor: '#fff', padding: 16, borderRadius: 14, alignItems: 'center', marginBottom: 20, borderWidth: 1.5, borderColor: '#ff3b30' },
  trackingStatusText: { color: '#ff3b30', fontSize: 16, fontWeight: 'bold' },
  trackingSubText: { color: '#8e8e93', fontSize: 12, marginVertical: 8 },
  stopBtn: { backgroundColor: '#ff3b30', paddingVertical: 12, borderRadius: 10, width: '100%', alignItems: 'center' },
  stopBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },

  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionHeader: { fontSize: 14, fontWeight: 'bold', color: '#666', textTransform: 'uppercase' },
  manualEntryBtnText: { fontSize: 13, color: '#34c759', fontWeight: 'bold' },
  seeAllText: { fontSize: 13, color: '#007AFF', fontWeight: '600' },

  tripCard: { backgroundColor: '#fff', padding: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  tripAmount: { fontSize: 16, fontWeight: 'bold', color: '#30d158' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, maxHeight: '85%', position: 'relative' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1c1c1e' },
  closeBtnText: { fontSize: 18, color: '#8e8e93', fontWeight: 'bold' },
  modalAmountBox: { backgroundColor: '#f2f2f7', padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 20 },
  modalAmountLabel: { fontSize: 12, color: '#8e8e93', textTransform: 'uppercase' },
  modalAmountValue: { fontSize: 28, fontWeight: 'bold', color: '#30d158', marginTop: 4 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f2f2f7' },
  detailLabel: { color: '#8e8e93', fontSize: 14 },
  detailValue: { color: '#1c1c1e', fontSize: 14, fontWeight: '500', maxWidth: '65%', textAlign: 'right' },

  inputGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 12, fontWeight: 'bold', color: '#8e8e93', marginBottom: 6, textTransform: 'uppercase' },
  textInput: { backgroundColor: '#f2f2f7', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1c1c1e' },

  suggestionsContainer: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e5ea', borderRadius: 10, marginTop: 4, maxHeight: 150 },
  suggestionItem: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f2f2f7' },
  suggestionText: { fontSize: 12, color: '#333' },

  datePickerBtn: { backgroundColor: '#e5e5ea', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, alignItems: 'flex-start' },
  datePickerBtnText: { color: '#007AFF', fontSize: 14, fontWeight: '600' },

  datePickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginTop: 8,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e5ea',
  },
  datePickerDoneBtn: {
    alignSelf: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    marginTop: 6,
  },
  datePickerDoneText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },

  chipScrollView: { marginTop: 6 },
  chip: { backgroundColor: '#e5e5ea', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12, marginRight: 6 },
  activeChip: { backgroundColor: '#e3f2fd', borderWidth: 1, borderColor: '#007AFF' },
  chipText: { fontSize: 12, color: '#666', fontWeight: '500' },
  activeChipText: { color: '#007AFF', fontWeight: 'bold' },

  addPlaceChip: { backgroundColor: '#f2f2f7', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: '#8e8e93' },
  addPlaceChipText: { fontSize: 12, color: '#8e8e93', fontWeight: '600' },

  saveManualBtn: { backgroundColor: '#34c759', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 10, marginBottom: 10 },
  saveManualBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  // 🌟 修复: 常用地址弹窗 Overlay 布局
  subOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    zIndex: 999,
  },
  subModalBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
    width: '100%',
  },

  modalCategoryToggle: { flexDirection: 'row', backgroundColor: '#e5e5ea', borderRadius: 8, padding: 2 },
  modalCatBtn: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 6 },
  modalCatBtnActive: { backgroundColor: '#007AFF' },
  modalCatText: { fontSize: 12, fontWeight: '600', color: '#8e8e93' },
  modalCatTextActive: { color: '#fff', fontWeight: 'bold' },

  deleteBtn: { marginTop: 25, backgroundColor: '#ffe5e5', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  deleteBtnText: { color: '#ff3b30', fontWeight: 'bold', fontSize: 14 },

  addressRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 7, height: 7, borderRadius: 3.5, marginRight: 8 },
  addressText: { fontSize: 14, fontWeight: '600', color: '#1c1c1e', flex: 1 },
  tripMeta: { fontSize: 12, color: '#8e8e93', marginTop: 6, marginLeft: 15 },
});