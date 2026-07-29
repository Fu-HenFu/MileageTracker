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
  // 🌟 用 ref 记录当前的 App 状态，避免在组件刷新时重置
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const isAuthenticating = useRef<boolean>(false);

  const checkAuth = async () => {
    // 防止重复并发调起生物识别弹窗
    if (isAuthenticating.current) return;
    isAuthenticating.current = true;

    const success = await AuthService.authenticate();
    setIsUnlocked(success);

    isAuthenticating.current = false;
  };

  useEffect(() => {
    // 1. 初始化 SQLite 数据库表
    try {
      initDatabase();
    } catch (error) {
      console.error('Failed to initialize database:', error);
    }

    // 2. 首次打开 App 调起解锁
    checkAuth();

    // 3. 监听 App 切后台 / 切前台事件
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      // 🌟 关键修复：只有当应用从真实的后台 (background) 切回前台 (active) 时才要求重新验证
      // 避开系统弹窗导致的 inactive -> active 伪前台切换
      if (
        appState.current === 'background' &&
        nextAppState === 'active'
      ) {
        setIsUnlocked(false);
        checkAuth();
      }

      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  // 🔒 未通过验证时展示黑色锁屏界面，并提供“点击解锁”按钮
  if (!isUnlocked) {
    return (
      <View style={styles.lockScreen}>
        <Text style={styles.lockIcon}>🔒</Text>
        <Text style={styles.lockText}>TaxMiles is Locked</Text>
        <TouchableOpacity style={styles.unlockBtn} onPress={checkAuth}>
          <Text style={styles.unlockBtnText}>Unlock App</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 🔓 验证通过后渲染完整的 Tab 导航
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