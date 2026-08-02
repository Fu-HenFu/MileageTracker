import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    // 🌟 1. 启动弹簧放大与淡入动画
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // 🌟 2. 停留 1 秒后渐隐并进入 App 主页
      setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }).start(() => {
          onFinish();
        });
      }, 1000);
    });
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Animated.View style={[styles.content, { transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.iconBadge}>
          <Text style={styles.logoIcon}>🚗</Text>
        </View>
        <Text style={styles.appName}>TaxMiles</Text>
        <Text style={styles.slogan}>Smart Drive & Tax Write-off Tracker</Text>
      </Animated.View>

      <Text style={styles.footerText}>Secure Audit-Ready Records</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1c1c1e',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999, // 确保挂载在最顶层
  },
  content: {
    alignItems: 'center',
  },
  iconBadge: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: '#2c2c2e',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#3a3a3c',
    shadowColor: '#30d158',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  logoIcon: {
    fontSize: 44,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 1,
  },
  slogan: {
    fontSize: 14,
    color: '#8e8e93',
    marginTop: 8,
    fontWeight: '500',
  },
  footerText: {
    position: 'absolute',
    bottom: 50,
    fontSize: 12,
    color: '#636366',
    letterSpacing: 0.5,
  },
});