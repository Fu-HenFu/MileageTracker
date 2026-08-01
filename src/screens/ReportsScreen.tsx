import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAllTrips, insertTrip, TripRecord } from '../db/database';
import { AuthService } from '../utils/AuthService';
import { calculateTaxDeduction } from '../utils/TaxEngine';

export const ReportsScreen = () => {
  const [faceIdEnabled, setFaceIdEnabled] = useState(false);
  const [allTrips, setAllTrips] = useState<TripRecord[]>([]);

  // 🌟 1. 每次进入页面刷新数据库真实行程
  useFocusEffect(
    useCallback(() => {
      setAllTrips(getAllTrips() || []);
    }, [])
  );

  // 🌟 2. 动态计算数据库中实际存在的年份列表（降序排列，例如：2026, 2025, 2024... + ALL）
  const availableYears = useMemo(() => {
    if (allTrips.length === 0) {
      const currentYear = new Date().getFullYear().toString();
      return [currentYear, 'ALL'];
    }

    // 提取去重后的年份列表
    const yearSet = new Set(
      allTrips.map((t) => new Date(t.start_time).getFullYear().toString())
    );
    
    // 按数字大小倒序 (最新年份在前)
    const sortedYears = Array.from(yearSet).sort((a, b) => Number(b) - Number(a));

    return [...sortedYears, 'ALL'];
  }, [allTrips]);

  // 🌟 3. Selected Year 默认选中最新年份
  const [selectedYear, setSelectedYear] = useState<string>(() => {
    return new Date().getFullYear().toString();
  });

  const [selectedCategory, setSelectedCategory] = useState<'all' | 'business' | 'personal'>('business');

  // 当可用年份变化时（例如刚导入新数据），如果当前选中的年份不存在，自动更正
  useEffect(() => {
    if (!availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  // 初始化读取 Face ID 设置
  useEffect(() => {
    AuthService.isFaceIdEnabled().then((enabled) => {
      setFaceIdEnabled(enabled);
    });
  }, []);

  const handleResetOnboarding = async () => {
    await AsyncStorage.removeItem('@taxmiles_onboarding_completed');
    Alert.alert(
      'Reset Successful 🔄',
      'Onboarding flag has been cleared. Please reload the app (Cmd + R / Shake menu) to view the onboarding screen.',
      [{ text: 'OK' }]
    );
  };

  // 处理切换 Face ID 开关
  const handleToggleFaceId = async (newValue: boolean) => {
    if (newValue) {
      const success = await AuthService.authenticate();
      if (success) {
        setFaceIdEnabled(true);
        await AuthService.setFaceIdEnabled(true);
      } else {
        Alert.alert('Authentication Failed', 'Could not verify Face ID / Passcode.');
      }
    } else {
      setFaceIdEnabled(false);
      await AuthService.setFaceIdEnabled(false);
    }
  };

  const handleUpgrade = () => {
    Alert.alert('TaxMiles Pro', 'Opening Subscription Paywall...');
  };

  const handleRestore = () => {
    Alert.alert('Restore Purchase', 'Checking for previous subscriptions...');
  };

  // 🔍 动态筛选当前选中年份 & 分类的行程
  const filteredTrips = useMemo(() => {
    let trips = allTrips;

    if (selectedYear !== 'ALL') {
      trips = trips.filter(
        (t) => new Date(t.start_time).getFullYear().toString() === selectedYear
      );
    }

    if (selectedCategory !== 'all') {
      trips = trips.filter((t) => t.category === selectedCategory);
    }

    return trips;
  }, [allTrips, selectedYear, selectedCategory]);

  // 📊 动态统计看板数据
  const taxStats = useMemo(() => {
    let totalDeduction = 0;
    let totalMeters = 0;

    filteredTrips.forEach((t) => {
      totalDeduction += t.deduction_amount;
      totalMeters += t.distance_meters;
    });

    const distanceRes = calculateTaxDeduction(totalMeters, 'US');

    return {
      totalDeduction,
      totalTrips: filteredTrips.length,
      formattedDistance: distanceRes.formattedDistance,
    };
  }, [filteredTrips]);

  // 📈 导出 CSV
  const handleExportCSV = async () => {
    try {
      if (filteredTrips.length === 0) {
        Alert.alert(
          'No Matching Records',
          `No ${selectedCategory.toUpperCase()} trips found for ${selectedYear}.`
        );
        return;
      }

      let csvContent = 'Date,Start Address,End Address,Distance,Category,Country,Business Purpose,Deduction\n';

      filteredTrips.forEach((t) => {
        const res = calculateTaxDeduction(t.distance_meters, t.country_code);
        const dateStr = new Date(t.start_time).toLocaleDateString();
        const startAddr = `"${(t.start_address || '').replace(/"/g, '""')}"`;
        const endAddr = `"${(t.end_address || '').replace(/"/g, '""')}"`;
        const distance = `"${res.formattedDistance}"`;
        const category = t.category.toUpperCase();
        const country = t.country_code;
        const purpose = `"${(t.notes || '').replace(/"/g, '""')}"`;
        const deduction = `"$${t.deduction_amount.toFixed(2)}"`;

        csvContent += `${dateStr},${startAddr},${endAddr},${distance},${category},${country},${purpose},${deduction}\n`;
      });

      const dateStr = new Date().toISOString().slice(0, 10);
      const fileName = `TaxMiles_${selectedYear}_${selectedCategory.toUpperCase()}_${dateStr}.csv`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, csvContent);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: `Export CSV Tax Report`,
          UTI: 'public.comma-separated-values-text',
        });
      }
    } catch (error) {
      console.error('CSV Generation Error:', error);
      Alert.alert('Error', 'Failed to generate CSV report.');
    }
  };

  // 📄 导出 PDF 报表
  const handleExportPDF = async () => {
    try {
      if (filteredTrips.length === 0) {
        Alert.alert(
          'No Matching Records',
          `No ${selectedCategory.toUpperCase()} trips found for ${selectedYear}.`
        );
        return;
      }

      let totalDeduction = 0;
      const rowsHtml = filteredTrips
        .map((t) => {
          const res = calculateTaxDeduction(t.distance_meters, t.country_code);
          totalDeduction += t.deduction_amount;
          const dateStr = new Date(t.start_time).toLocaleDateString();
          const purposeStr = t.notes ? t.notes : '<span style="color: #c7c7cc;">N/A</span>';

          return `
            <tr>
              <td>${dateStr}</td>
              <td><b>${t.start_address}</b> &rarr; <b>${t.end_address}</b></td>
              <td>${res.formattedDistance}</td>
              <td>${t.category.toUpperCase()}</td>
              <td>${purposeStr}</td>
              <td style="color: #30d158; font-weight: bold; text-align: right;">+${res.formattedDeduction}</td>
            </tr>
          `;
        })
        .join('');

      const reportTitle = `${selectedYear === 'ALL' ? 'All-Time' : selectedYear} ${selectedCategory.toUpperCase()} Mileage Report`;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 30px; color: #1c1c1e; }
              .header { border-bottom: 2px solid #007AFF; padding-bottom: 12px; margin-bottom: 20px; }
              h1 { font-size: 22px; margin: 0; color: #1c1c1e; }
              .subtitle { color: #8e8e93; font-size: 13px; margin-top: 4px; }
              .summary-box { background: #f2f2f7; padding: 16px; border-radius: 8px; margin-bottom: 24px; }
              .summary-title { font-size: 11px; text-transform: uppercase; color: #8e8e93; font-weight: bold; }
              .summary-amount { font-size: 32px; font-weight: bold; color: #30d158; margin-top: 4px; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              th { text-align: left; padding: 10px; border-bottom: 2px solid #e5e5ea; font-size: 11px; color: #8e8e93; text-transform: uppercase; background-color: #f9f9fb; }
              td { padding: 12px 10px; border-bottom: 1px solid #e5e5ea; font-size: 12px; }
              .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #8e8e93; border-top: 1px solid #e5e5ea; padding-top: 15px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>TaxMiles • ${reportTitle}</h1>
              <div class="subtitle">Official Audit-Ready Record • Generated on ${new Date().toLocaleDateString()} (${filteredTrips.length} trips)</div>
            </div>

            <div class="summary-box">
              <div class="summary-title">Total Estimated Tax Deduction</div>
              <div class="summary-amount">$${totalDeduction.toFixed(2)}</div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Route (Start &rarr; End)</th>
                  <th>Distance</th>
                  <th>Category</th>
                  <th>Business Purpose</th>
                  <th style="text-align: right;">Deduction</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>

            <div class="footer">
              This official report was tracked and generated by TaxMiles App.
            </div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          UTI: '.pdf',
          mimeType: 'application/pdf',
          dialogTitle: `Export ${reportTitle}`,
        });
      }
    } catch (error) {
      console.error('PDF Generation Error:', error);
      Alert.alert('Error', 'Failed to generate PDF report.');
    }
  };

  // 🛡️ 导出 JSON 数据备份
  const handleBackup = async () => {
    try {
      const trips = getAllTrips() || [];

      if (trips.length === 0) {
        Alert.alert('No Data', 'There are no trips recorded to back up.');
        return;
      }

      const backupData = {
        app_name: 'TaxMiles',
        version: '1.0.0',
        exported_at: new Date().toISOString(),
        total_records: trips.length,
        data: trips,
      };

      const dateStr = new Date().toISOString().slice(0, 10);
      const fileName = `TaxMiles_Backup_${dateStr}.json`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(
        fileUri,
        JSON.stringify(backupData, null, 2)
      );

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Export TaxMiles Data Backup',
          UTI: 'public.json',
        });
      }
    } catch (error) {
      console.error('Backup Generation Error:', error);
      Alert.alert('Error', 'Failed to generate backup file.');
    }
  };

  // 📥 从 JSON 恢复数据并实时更新 UI
  const handleImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const selectedFile = result.assets[0];
      const fileContent = await FileSystem.readAsStringAsync(selectedFile.uri);
      const parsedData = JSON.parse(fileContent);

      if (
        !parsedData.app_name ||
        parsedData.app_name !== 'TaxMiles' ||
        !Array.isArray(parsedData.data)
      ) {
        Alert.alert(
          'Invalid Backup File',
          'The selected file is not a valid TaxMiles backup format.'
        );
        return;
      }

      const tripsToImport = parsedData.data;

      if (tripsToImport.length === 0) {
        Alert.alert('Empty Backup', 'No trip records found in this backup file.');
        return;
      }

      Alert.alert(
        'Restore Data',
        `Found ${tripsToImport.length} trips in backup. Would you like to import them into your database?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Import',
            onPress: () => {
              let count = 0;
              tripsToImport.forEach((trip: any) => {
                insertTrip({
                  start_time: trip.start_time,
                  end_time: trip.end_time,
                  distance_meters: trip.distance_meters,
                  category: trip.category || 'business',
                  country_code: trip.country_code || 'US',
                  deduction_amount: trip.deduction_amount || 0,
                  start_address: trip.start_address || 'Start Location',
                  end_address: trip.end_address || 'End Location',
                  notes: trip.notes || '',
                  odometer_start: trip.odometer_start,
                  odometer_end: trip.odometer_end,
                });
                count++;
              });

              // 🌟 导入成功后立即刷新 state
              setAllTrips(getAllTrips() || []);

              Alert.alert(
                'Import Successful',
                `Successfully restored ${count} trip logs to your local database!`
              );
            },
          },
        ]
      );
    } catch (error) {
      console.error('Import Error:', error);
      Alert.alert('Import Failed', 'Unable to parse or read the backup file.');
    }
  };

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() =>
      Alert.alert('Error', 'Cannot open URL link')
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.headerTitle}>Settings & Reports</Text>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#ff9500', marginTop: 10 }]}
          onPress={handleResetOnboarding}
        >
          <Text style={styles.actionBtnText}>🔄 Replay Onboarding</Text>
        </TouchableOpacity>

        {/* 👑 1. 会员状态 */}
        <View style={[styles.card, styles.proCard]}>
          <View style={styles.proBadgeRow}>
            <Text style={styles.proBadge}>FREE PLAN</Text>
          </View>
          <Text style={styles.proTitle}>TaxMiles Pro</Text>
          <Text style={styles.proDesc}>
            Unlock Unlimited GPS Tracking, Auto PDF Reports & Cloud Backup.
          </Text>

          <TouchableOpacity style={styles.upgradeBtn} onPress={handleUpgrade}>
            <Text style={styles.upgradeBtnText}>🚀 Upgrade to Pro</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore}>
            <Text style={styles.restoreBtnText}>Restore Purchases</Text>
          </TouchableOpacity>
        </View>

        {/* 🔒 2. 安全与锁屏 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🔒 Privacy & Security</Text>
          <Text style={styles.cardDesc}>
            Control app lock settings to protect your driving records.
          </Text>

          <View style={styles.settingRow}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.settingLabel}>Face ID / Passcode Lock</Text>
              <Text style={styles.settingSub}>
                Require authentication when opening the app
              </Text>
            </View>
            <Switch
              value={faceIdEnabled}
              onValueChange={handleToggleFaceId}
              trackColor={{ false: '#e5e5ea', true: '#34c759' }}
            />
          </View>
        </View>

        {/* 📄 3. 报表与导出区 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📄 Official Tax Reports</Text>
          <Text style={styles.cardDesc}>
            Select tax year and category to generate audit-ready reports.
          </Text>

          {/* 📊 动态报税统计看板 */}
          <View style={styles.statsCard}>
            <View style={styles.statsHeader}>
              <Text style={styles.statsTitle}>
                {selectedYear === 'ALL' ? 'All-Time' : selectedYear} {selectedCategory.toUpperCase()} SUMMARY
              </Text>
            </View>
            <Text style={styles.statsAmount}>${taxStats.totalDeduction.toFixed(2)}</Text>

            <View style={styles.statsMetaRow}>
              <View style={styles.statsMetaItem}>
                <Text style={styles.statsMetaLabel}>Trips Logged</Text>
                <Text style={styles.statsMetaValue}>{taxStats.totalTrips}</Text>
              </View>
              <View style={styles.statsMetaDivider} />
              <View style={styles.statsMetaItem}>
                <Text style={styles.statsMetaLabel}>Total Distance</Text>
                <Text style={styles.statsMetaValue}>{taxStats.formattedDistance}</Text>
              </View>
            </View>
          </View>

          {/* 🌟 筛选配置 1: Tax Year (根据数据库实际存在的年份动态生成 + 支持横向滑动) */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Tax Year</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.segmentContainer}>
                {availableYears.map((year) => (
                  <TouchableOpacity
                    key={year}
                    style={[
                      styles.segmentBtn,
                      selectedYear === year && styles.activeSegmentBtn,
                      { paddingHorizontal: 16, minWidth: 64 }
                    ]}
                    onPress={() => setSelectedYear(year)}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        selectedYear === year && styles.activeSegmentText,
                      ]}
                    >
                      {year}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* 筛选配置 2: Category */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Category</Text>
            <View style={styles.segmentContainer}>
              {[
                { label: 'Business', value: 'business' },
                { label: 'Personal', value: 'personal' },
                { label: 'All', value: 'all' },
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

          {/* 双导出按钮组合 */}
          <View style={styles.exportBtnGroup}>
            <TouchableOpacity style={[styles.actionBtn, styles.pdfBtn]} onPress={handleExportPDF}>
              <Text style={styles.actionBtnText}>📄 PDF Report</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionBtn, styles.csvBtn]} onPress={handleExportCSV}>
              <Text style={styles.actionBtnText}>📊 CSV Sheet</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 🛡️ 4. 数据安全与备份区 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🛡️ Data Backup & Safety</Text>
          <Text style={styles.cardDesc}>
            Save your raw data as JSON or restore records from a backup file.
          </Text>

          <TouchableOpacity
            style={[styles.actionBtn, styles.backupBtn]}
            onPress={handleBackup}
          >
            <Text style={styles.actionBtnText}>Backup Data to File</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.restoreDataBtn]}
            onPress={handleImport}
          >
            <Text style={styles.restoreDataBtnText}>Restore Data from File</Text>
          </TouchableOpacity>
        </View>

        {/* ⚖️ 5. 法律协议与支持 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>⚖️ Legal & Support</Text>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => openLink('https://example.com/privacy')}
          >
            <Text style={styles.linkText}>Privacy Policy</Text>
            <Text style={styles.arrowText}>➔</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => openLink('https://example.com/terms')}
          >
            <Text style={styles.linkText}>Terms of Service (EULA)</Text>
            <Text style={styles.arrowText}>➔</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.linkRow, { borderBottomWidth: 0 }]}
            onPress={() => Alert.alert('Support', 'Contact: support@zovito.com')}
          >
            <Text style={styles.linkText}>Contact Support</Text>
            <Text style={styles.arrowText}>➔</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.versionText}>TaxMiles v1.0.0 (Build 2026.1)</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f4f6' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#1c1c1e', marginVertical: 15 },

  card: { backgroundColor: '#fff', padding: 18, borderRadius: 14, marginBottom: 15 },
  cardTitle: { fontSize: 17, fontWeight: 'bold', color: '#1c1c1e', marginBottom: 6 },
  cardDesc: { fontSize: 13, color: '#8e8e93', marginBottom: 15 },

  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  settingLabel: { fontSize: 15, fontWeight: '600', color: '#1c1c1e' },
  settingSub: { fontSize: 12, color: '#8e8e93', marginTop: 2 },

  statsCard: { backgroundColor: '#f2f2f7', padding: 14, borderRadius: 12, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#30d158' },
  statsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statsTitle: { fontSize: 11, fontWeight: 'bold', color: '#8e8e93', textTransform: 'uppercase' },
  statsAmount: { fontSize: 28, fontWeight: 'bold', color: '#30d158', marginVertical: 4 },
  statsMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e5e5ea' },
  statsMetaItem: { flex: 1 },
  statsMetaLabel: { fontSize: 11, color: '#8e8e93' },
  statsMetaValue: { fontSize: 14, fontWeight: 'bold', color: '#1c1c1e', marginTop: 2 },
  statsMetaDivider: { width: 1, height: 20, backgroundColor: '#e5e5ea', marginHorizontal: 10 },

  filterGroup: { marginBottom: 14 },
  filterLabel: { fontSize: 12, fontWeight: 'bold', color: '#8e8e93', textTransform: 'uppercase', marginBottom: 6 },
  segmentContainer: { flexDirection: 'row', backgroundColor: '#f2f2f7', borderRadius: 9, padding: 2 },
  segmentBtn: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 7 },
  activeSegmentBtn: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 2 },
  segmentText: { fontSize: 13, color: '#8e8e93', fontWeight: '500' },
  activeSegmentText: { color: '#1c1c1e', fontWeight: 'bold' },

  proCard: { backgroundColor: '#1c1c1e' },
  proBadgeRow: { flexDirection: 'row', marginBottom: 6 },
  proBadge: { backgroundColor: '#3a3a3c', color: '#ffd60a', fontSize: 10, fontWeight: 'bold', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, overflow: 'hidden' },
  proTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 6 },
  proDesc: { fontSize: 13, color: '#8e8e93', marginBottom: 16, lineHeight: 18 },
  upgradeBtn: { backgroundColor: '#30d158', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  upgradeBtnText: { color: '#000', fontWeight: 'bold', fontSize: 15 },
  restoreBtn: { paddingVertical: 8, alignItems: 'center' },
  restoreBtnText: { color: '#8e8e93', fontSize: 13, textDecorationLine: 'underline' },

  exportBtnGroup: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  pdfBtn: { backgroundColor: '#007AFF' },
  csvBtn: { backgroundColor: '#34c759' },
  actionBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  backupBtn: { backgroundColor: '#5856D6', marginBottom: 12, marginTop: 0 },
  restoreDataBtn: { backgroundColor: '#f2f2f7', borderWidth: 1, borderColor: '#e5e5ea', marginTop: 0 },
  restoreDataBtnText: { color: '#1c1c1e', fontWeight: 'bold', fontSize: 15 },

  linkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f2f2f7' },
  linkText: { fontSize: 14, color: '#1c1c1e', fontWeight: '500' },
  arrowText: { fontSize: 14, color: '#c7c7cc' },

  versionText: { textAlign: 'center', color: '#8e8e93', fontSize: 12, marginTop: 10 },
});