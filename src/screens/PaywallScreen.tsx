import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
  Alert,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export const PaywallScreen = () => {
  const navigation = useNavigation();
  const [selectedPlan, setSelectedPlan] = useState<'yearly' | 'monthly'>('yearly');

  // 🌟 打开协议链接辅助方法
  const openLink = (url: string) => {
    Linking.openURL(url).catch(() =>
      Alert.alert('Error', 'Unable to open link. Please check your internet connection.')
    );
  };

  const handleSubscribe = () => {
    Alert.alert(
      'Processing Purchase 💳',
      `Subscribing to ${
        selectedPlan === 'yearly' ? 'Annual Pass ($39.99/yr)' : 'Monthly Pass ($4.99/mo)'
      }`
    );
  };

  const handleRestore = () => {
    Alert.alert('Restore Purchase', 'Checking for active subscriptions...');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 顶部关闭按钮 */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header 区域 */}
        <Text style={styles.badge}>TAXMILES PRO</Text>
        <Text style={styles.title}>Maximize Your Tax Savings</Text>
        <Text style={styles.subtitle}>
          Unlock unlimited GPS tracking, auto PDF reports & cloud backup.
        </Text>

        {/* 核心权益 */}
        <View style={styles.featureList}>
          <Text style={styles.featureItem}>⚡ Unlimited Auto GPS Tracking</Text>
          <Text style={styles.featureItem}>📄 Official PDF & CSV Audit Reports</Text>
          <Text style={styles.featureItem}>☁️ Cloud Sync & Automatic Backups</Text>
          <Text style={styles.featureItem}>🔒 Smart Face ID App Security</Text>
        </View>

        {/* 订阅套餐卡片 */}
        <View style={styles.planContainer}>
          {/* 年度套餐 */}
          <TouchableOpacity
            style={[styles.planCard, selectedPlan === 'yearly' && styles.activePlanCard]}
            onPress={() => setSelectedPlan('yearly')}
          >
            <View style={styles.bestValueTag}>
              <Text style={styles.bestValueText}>SAVE 35%</Text>
            </View>
            <Text style={styles.planTitle}>Annual Access</Text>
            <Text style={styles.planPrice}>$39.99 / year</Text>
            <Text style={styles.planSub}>$3.33 / month (Billed Annually)</Text>
          </TouchableOpacity>

          {/* 月度套餐 */}
          <TouchableOpacity
            style={[styles.planCard, selectedPlan === 'monthly' && styles.activePlanCard]}
            onPress={() => setSelectedPlan('monthly')}
          >
            <Text style={styles.planTitle}>Monthly Access</Text>
            <Text style={styles.planPrice}>$4.99 / month</Text>
            <Text style={styles.planSub}>Flexible month-to-month</Text>
          </TouchableOpacity>
        </View>

        {/* 订阅按钮 */}
        <TouchableOpacity style={styles.subscribeBtn} onPress={handleSubscribe}>
          <Text style={styles.subscribeBtnText}>
            Continue & Subscribe
          </Text>
        </TouchableOpacity>

        {/* 恢复购买 */}
        <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore}>
          <Text style={styles.restoreText}>Restore Purchases</Text>
        </TouchableOpacity>

        {/* 🌟 核心合规区域：App Store 强制要求包含的协议与续费说明 */}
        <View style={styles.legalSection}>
          {/* 1. 协议链接按钮 */}
          <View style={styles.legalLinksRow}>
            <TouchableOpacity onPress={() => openLink('https://example.com/privacy')}>
              <Text style={styles.legalLinkText}>Privacy Policy</Text>
            </TouchableOpacity>

            <Text style={styles.legalDot}>•</Text>

            {/* 💡 说明：如果不写自定义 EULA，苹果默认使用 Apple Standard EULA */}
            <TouchableOpacity
              onPress={() =>
                openLink('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')
              }
            >
              <Text style={styles.legalLinkText}>Terms of Use (EULA)</Text>
            </TouchableOpacity>
          </View>

          {/* 2. 苹果审核必查：订阅自动续费文案 (Auto-Renewable Terms) */}
          <Text style={styles.disclaimerText}>
            Payment will be charged to your Apple ID account at confirmation of purchase.
            Subscription automatically renews unless it is canceled at least 24 hours before the end
            of the current period. Your account will be charged for renewal within 24 hours prior to
            the end of the current period. You can manage and cancel your subscriptions by going to
            your App Store account settings after purchase.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1c1c1e' },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 10 },
  closeBtn: { padding: 8 },
  closeBtnText: { color: '#8e8e93', fontSize: 20, fontWeight: 'bold' },

  scrollContent: { paddingHorizontal: 24, paddingBottom: 40, alignItems: 'center' },
  badge: { color: '#ffd60a', fontSize: 12, fontWeight: 'bold', letterSpacing: 1.5, marginBottom: 8 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { color: '#8e8e93', fontSize: 13, textAlign: 'center', marginBottom: 20, lineHeight: 18 },

  featureList: { width: '100%', backgroundColor: '#2c2c2e', padding: 18, borderRadius: 14, marginBottom: 20 },
  featureItem: { color: '#fff', fontSize: 13, fontWeight: '600', marginVertical: 6 },

  planContainer: { width: '100%', gap: 12, marginBottom: 20 },
  planCard: {
    backgroundColor: '#2c2c2e',
    padding: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  activePlanCard: { borderColor: '#30d158', backgroundColor: '#1a3320' },
  bestValueTag: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: '#30d158',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bestValueText: { color: '#000', fontSize: 10, fontWeight: 'bold' },
  planTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  planPrice: { color: '#30d158', fontSize: 18, fontWeight: 'bold', marginVertical: 4 },
  planSub: { color: '#8e8e93', fontSize: 12 },

  subscribeBtn: {
    width: '100%',
    backgroundColor: '#30d158',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  subscribeBtnText: { color: '#000', fontSize: 16, fontWeight: 'bold' },

  restoreBtn: { paddingVertical: 8, marginBottom: 20 },
  restoreText: { color: '#8e8e93', fontSize: 13, textDecorationLine: 'underline' },

  // 🌟 法律条款样式
  legalSection: { width: '100%', borderTopWidth: 1, borderTopColor: '#2c2c2e', paddingTop: 16, alignItems: 'center' },
  legalLinksRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  legalLinkText: { color: '#007AFF', fontSize: 12, fontWeight: '600' },
  legalDot: { color: '#8e8e93', marginHorizontal: 8, fontSize: 12 },
  disclaimerText: { color: '#636366', fontSize: 10, textAlign: 'center', lineHeight: 14 },
});