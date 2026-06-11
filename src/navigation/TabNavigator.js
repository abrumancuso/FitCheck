/**
 * TabNavigator — Tabs con Ionicons y responsive
 */

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';
import { useAppScale } from '../utils/responsive';

import HomeScreen from '../screens/HomeScreen';
import WardrobeScreen from '../screens/WardrobeScreen';
import OutfitsScreen from '../screens/OutfitsScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Home: { focused: 'home', unfocused: 'home-outline' },
  Wardrobe: { focused: 'shirt', unfocused: 'shirt-outline' },
  Outfits: { focused: 'sparkles', unfocused: 'sparkles-outline' },
  Profile: { focused: 'person', unfocused: 'person-outline' },
};

export default function TabNavigator() {
  const { scale, fontScale } = useAppScale();
  const insets = useSafeAreaInsets();
  const S = (n) => scale(n);
  const FS = (n) => fontScale(n);

  // Altura del tab: ícono + label (S(50)) + padding inferior dinámico
  const TAB_HEIGHT = S(50) + insets.bottom + S(8);
  const TAB_PADDING_BOTTOM = insets.bottom + S(8);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color }) => {
          const icons = TAB_ICONS[route.name];
          return <Ionicons name={focused ? icons.focused : icons.unfocused} size={S(22)} color={color} />;
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textLight,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopWidth: 0,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          height: TAB_HEIGHT,
          paddingBottom: TAB_PADDING_BOTTOM,
          paddingTop: S(8),
        },
        tabBarLabelStyle: {
          fontSize: FS(11),
          fontWeight: '600',
          letterSpacing: 0.3,
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Inicio' }} />
      <Tab.Screen name="Wardrobe" component={WardrobeScreen} options={{ tabBarLabel: 'Wardrobe' }} />
      <Tab.Screen name="Outfits" component={OutfitsScreen} options={{ tabBarLabel: 'Outfits' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: 'Perfil' }} />
    </Tab.Navigator>
  );
}
