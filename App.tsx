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

  const checkAuth = async () => {
    try {
      // 🌟 先检查用户是否开启了 Face ID
      const isEnabled = await AuthService.isFaceIdEnabled();
      if (!isEnabled) {
        setIsUnlocked(true); // 关掉了直接解锁，不弹窗
        return;
      }

      if (isAuthenticating.current) return;
      isAuthenticating.current = true;

      const success = await AuthService.authenticate();
      setIsUnlocked(success);
    } catch (error) {
      console.error('CheckAuth Error:', error);
      setIsUnlocked(false);
    } finally {
      isAuthenticating.current = false;
    }
  };

  useEffect(() => {
    try {
      initDatabase();
    } catch (error) {
      console.error('Failed to initialize database:', error);
    }

    // 打开 App 时检查权限状态
    checkAuth();

    // 监听切前后台
    const subscription = AppState.addEventListener('change', (nextAppState) => {
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