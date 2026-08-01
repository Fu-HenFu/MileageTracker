import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { initDatabase } from './src/db/database';
import { LogScreen } from './src/screens/LogScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { ReportsScreen } from './src/screens/ReportsScreen';
import { TrackerScreen } from './src/screens/TrackerScreen';
import { AuthService } from './src/utils/AuthService';

const Tab = createBottomTabNavigator();

export default function App() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  // 🌟 记录用户是否已完成新手引导 (null 代表数据还在读取中)
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState<boolean | null>(null);

  const appState = useRef<AppStateStatus>(AppState.currentState);
  const isAuthenticating = useRef<boolean>(false);

  // 🌟 检查锁屏认证状态
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
      setTimeout(() => {
        isAuthenticating.current = false;
      }, 300);
    }
  };

  useEffect(() => {
    // 1. 初始化数据库
    try {
      initDatabase();
    } catch (error) {
      console.error('Failed to initialize database:', error);
    }

    // 2. 读取本地保存的新手引导状态
    AsyncStorage.getItem('@taxmiles_onboarding_completed').then((val) => {
      setIsOnboardingCompleted(val === 'true');
    });

    // 3. 冷启动检查锁屏认证
    checkAuth();

    // 4. 监听前后台切换锁屏
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appState.current === 'background' &&
        nextAppState === 'active' &&
        !isAuthenticating.current
      ) {
        AuthService.isFaceIdEnabled().then((isEnabled) => {
          if (isEnabled) {
            setIsUnlocked(false);
            setTimeout(() => checkAuth(), 400);
          }
        });
      }

      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  // 1. 如果未通过安全解锁（开启了 Face ID 锁屏），展示锁屏页面
  if (!isUnlocked) {
    return (
      <View style={styles.lockScreen}>
        <Text style={styles.lockIcon}>🔒</Text>
        <Text style={styles.lockText}>TaxMiles is Locked</Text>
        <TouchableOpacity style={styles.unlockBtn} onPress={() => checkAuth(true)}>
          <Text style={styles.unlockBtnText}>Unlock App</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 2. 如果数据正在读取中，保持空白等待
  if (isOnboardingCompleted === null) {
    return null;
  }

  // 3. 如果用户还没完成过引导页，优先展示 Onboarding 画面
  if (!isOnboardingCompleted) {
    return (
      <SafeAreaProvider>
        <OnboardingScreen onFinish={() => setIsOnboardingCompleted(true)} />
      </SafeAreaProvider>
    );
  }

  // 4. 解锁且已完成引导后，展示主程序 Tab 导航
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