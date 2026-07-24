import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, Alert } from 'react-native';

export const ReportsScreen = () => {
  const handleExportPDF = () => {
    Alert.alert("Export PDF", "Generating 2026 Tax Audit Report...");
  };

  const handleBackup = () => {
    Alert.alert("Backup", "Exporting database backup file...");
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.headerTitle}>Tax Reports & Settings</Text>

      {/* 导出 PDF 功能区 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📄 Official Tax Reports</Text>
        <Text style={styles.cardDesc}>Generate IRS, CRA, or ATO audit-ready PDF logs.</Text>
        <TouchableOpacity style={styles.actionBtn} onPress={handleExportPDF}>
          <Text style={styles.actionBtnText}>Export 2026 PDF Report</Text>
        </TouchableOpacity>
      </View>

      {/* 数据备份与恢复区 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🛡️ Data Backup & Safety</Text>
        <Text style={styles.cardDesc}>Save your data locally or share a .json backup file.</Text>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#5856D6' }]} onPress={handleBackup}>
          <Text style={styles.actionBtnText}>Backup Data to File</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f4f6', padding: 16 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#1c1c1e', marginVertical: 15 },
  card: { backgroundColor: '#fff', padding: 18, borderRadius: 14, marginBottom: 15 },
  cardTitle: { fontSize: 17, fontWeight: 'bold', color: '#1c1c1e', marginBottom: 6 },
  cardDesc: { fontSize: 13, color: '#8e8e93', marginBottom: 15 },
  actionBtn: { backgroundColor: '#007AFF', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});