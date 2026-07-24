import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { initDatabase } from './src/db/database';
import { TrackerScreen } from './src/screens/TrackerScreen';
import { LogScreen } from './src/screens/LogScreen';
import { ReportsScreen } from './src/screens/ReportsScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  useEffect(() => {
    initDatabase();
  }, []);

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: '#007AFF',
          tabBarInactiveTintColor: '#8e8e93',
          tabBarStyle: { paddingBottom: 5, height: 60 },
          tabBarIcon: ({ color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap = 'car';
            if (route.name === 'Tracker') iconName = 'car';
            else if (route.name === 'Log') iconName = 'list';
            else if (route.name === 'Reports') iconName = 'document-text';

            return <Ionicons name={iconName} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Tracker" component={TrackerScreen} options={{ tabBarLabel: 'Tracker' }} />
        <Tab.Screen name="Log" component={LogScreen} options={{ tabBarLabel: 'Logs' }} />
        <Tab.Screen name="Reports" component={ReportsScreen} options={{ tabBarLabel: 'Reports' }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}