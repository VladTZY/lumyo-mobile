import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';

import { SignInScreen } from '../screens/SignInScreen';
import { SignUpScreen } from '../screens/SignUpScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { CategoriesScreen } from '../screens/CategoriesScreen';
import { CategoryDetailScreen } from '../screens/CategoryDetailScreen';
import { NotesScreen } from '../screens/NotesScreen';
import { NoteEditorScreen } from '../screens/NoteEditorScreen';
import { ChatListScreen } from '../screens/ChatListScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { SourceSelectorScreen } from '../screens/SourceSelectorScreen';
import { TabBar } from './TabBar';

import type {
  AuthStackParamList, HomeStackParamList, CategoriesStackParamList,
  NotesStackParamList, ChatStackParamList, TabParamList, RootStackParamList,
} from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const CategoriesStack = createNativeStackNavigator<CategoriesStackParamList>();
const NotesStack = createNativeStackNavigator<NotesStackParamList>();
const ChatStack = createNativeStackNavigator<ChatStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();
const Root = createNativeStackNavigator<RootStackParamList>();

function HomeNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeMain" component={HomeScreen} />
    </HomeStack.Navigator>
  );
}

function CategoriesNavigator() {
  return (
    <CategoriesStack.Navigator screenOptions={{ headerShown: false }}>
      <CategoriesStack.Screen name="CategoriesMain" component={CategoriesScreen} />
      <CategoriesStack.Screen name="CategoryDetail" component={CategoryDetailScreen} />
    </CategoriesStack.Navigator>
  );
}

function NotesNavigator() {
  return (
    <NotesStack.Navigator screenOptions={{ headerShown: false }}>
      <NotesStack.Screen name="NotesMain" component={NotesScreen} />
      <NotesStack.Screen name="NoteEditor" component={NoteEditorScreen} />
    </NotesStack.Navigator>
  );
}

function ChatNavigator() {
  return (
    <ChatStack.Navigator screenOptions={{ headerShown: false }}>
      <ChatStack.Screen name="ChatList" component={ChatListScreen} />
      <ChatStack.Screen name="ChatMain" component={ChatScreen} />
      <ChatStack.Screen name="SourceSelector" component={SourceSelectorScreen} />
    </ChatStack.Navigator>
  );
}

function TabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={HomeNavigator} />
      <Tab.Screen name="Categories" component={CategoriesNavigator} />
      <Tab.Screen name="Notes" component={NotesNavigator} />
      <Tab.Screen name="Chat" component={ChatNavigator} />
    </Tab.Navigator>
  );
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="SignIn" component={SignInScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
    </AuthStack.Navigator>
  );
}

export function AppNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgPrimary }}>
        <ActivityIndicator color={colors.aiAccent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }} edges={['top']}>
      <NavigationContainer>
        <Root.Navigator screenOptions={{ headerShown: false }}>
          {user ? (
            <Root.Screen name="Main" component={TabNavigator} />
          ) : (
            <Root.Screen name="Auth" component={AuthNavigator} />
          )}
        </Root.Navigator>
      </NavigationContainer>
    </SafeAreaView>
  );
}
