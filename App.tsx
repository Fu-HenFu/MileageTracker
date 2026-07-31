import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { initDatabase } from './src/db/database';
import { LogScreen } from './src/screens/LogScreen';
import { ReportsScreen } from './src/screens/ReportsScreen';
import { TrackerScreen } from './src/screens/TrackerScreen';
import { AuthService } from './src/utils/AuthService';

const Tab = createBottomTabNavigator();

export default function App() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const isAuthenticating = useRef<boolean>(false);

  // 🌟 checkAuth 接收 isManual 参数：如果手动点击按钮，强制重置防重复锁
  const checkAuth = async (isManual = false) => {
    if (isManual) {
      isAuthenticating.current = false;
    } else if (isAuthenticating.current) {
      return;
    }

    try {
      const isEnabled = await AuthService.isFaceIdEnabled();
      if (!isEnabled) {
        setIsUnlocked(true);
        return;
      }

      isAuthenticating.current = true;
      const success = await AuthService.authenticate();
      setIsUnlocked(success);
    } catch (error) {
      console.error('CheckAuth Error:', error);
      setIsUnlocked(false);
    } finally {
      // 验证结束后 300ms 释放锁
      setTimeout(() => {
        isAuthenticating.current = false;
      }, 300);
    }
  };

  useEffect(() => {
    try {
      initDatabase();
    } catch (error) {
      console.error('Failed to initialize database:', error);
    }

    // 冷启动检查
    checkAuth();

    // 监听切前后台
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appState.current === 'background' &&
        nextAppState === 'active' &&
        !isAuthenticating.current
      ) {
        AuthService.isFaceIdEnabled().then((isEnabled) => {
          if (isEnabled) {
            setIsUnlocked(false);
            // 🌟 给予 400ms 硬件就绪时间，避免 iOS 刚切回前台时摄像头没就绪而静默取消
            setTimeout(() => checkAuth(), 400);
          }
        });
      }

      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  if (!isUnlocked) {
    return (
      <View style={styles.lockScreen}>
        <Text style={styles.lockIcon}>🔒</Text>
        <Text style={styles.lockText}>TaxMiles is Locked</Text>
        {/* 🌟 核心：手动点击按钮传入 true，强行重置状态并再次发起 Face ID 刷脸 */}
        <TouchableOpacity style={styles.unlockBtn} onPress={() => checkAuth(true)}>
          <Text style={styles.unlockBtnText}>Unlock App</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarIcon: () => {
              let icon = '🚗';
              if (route.name === 'Tracker') icon = '🟢';
              if (route.name === 'Log') icon = '📋';
              if (route.name === 'Reports') icon = '⚙️';
              return <Text style={{ fontSize: 18 }}>{icon}</Text>;
            },
            tabBarActiveTintColor: '#007AFF',
            tabBarInactiveTintColor: '#8e8e93',
          })}
        >
          <Tab.Screen name="Tracker" component={TrackerScreen} options={{ title: 'Tracker' }} />
          <Tab.Screen name="Log" component={LogScreen} options={{ title: 'Logs' }} />
          <Tab.Screen name="Reports" component={ReportsScreen} options={{ title: 'Settings' }} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  lockScreen: {
    flex: 1,
    backgroundColor: '#1c1c1e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockIcon: { fontSize: 50, marginBottom: 15 },
  lockText: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 25 },
  unlockBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 22,
  },
  unlockBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});