import React, { useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Mail, Lock, Eye, EyeOff, Check } from 'lucide-react-native';
import { fonts, type Colors } from '../theme';
import { useStyles, useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/Logo';
import { Button, TextField } from '../components/ui';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

// Matches config.password_length in the server's Devise initializer.
const MIN_PASSWORD = 6;

export function SignUpScreen({ navigation }: Props) {
  const { register } = useAuth();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!email || !password) {
      Alert.alert('Email and password needed', 'Enter both to create your account.');
      return;
    }
    if (password.length < MIN_PASSWORD) {
      Alert.alert('Password too short', `Use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (!agreed) {
      Alert.alert('Accept the terms to continue', 'Tick the box to agree to the Terms and Privacy Policy.');
      return;
    }
    try {
      setLoading(true);
      await register(email.trim(), password, password);
    } catch (e: any) {
      Alert.alert("Couldn't create your account", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <Logo height={34} style={styles.logo} />
          <Text style={styles.title} accessibilityRole="header">Create your account</Text>
          <Text style={styles.subtitle}>Write notes, then ask them questions. Every answer shows its source.</Text>
        </View>

        <View style={styles.form}>
          <TextField
            label="Email"
            icon={Mail}
            placeholder="you@university.edu"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            value={email}
            onChangeText={setEmail}
            onSubmitEditing={() => passwordRef.current?.focus()}
          />

          <View style={styles.passwordGroup}>
            <TextField
              ref={passwordRef}
              label="Password"
              icon={Lock}
              placeholder="Create a password"
              secureTextEntry={!showPassword}
              autoComplete="new-password"
              textContentType="newPassword"
              value={password}
              onChangeText={setPassword}
              trailing={
                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword
                    ? <Eye size={17} color={colors.textMuted} strokeWidth={1.75} />
                    : <EyeOff size={17} color={colors.textMuted} strokeWidth={1.75} />}
                </Pressable>
              }
            />
            <Text style={styles.hint}>At least {MIN_PASSWORD} characters</Text>
          </View>

          <Pressable
            style={styles.checkRow}
            onPress={() => setAgreed(!agreed)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreed }}
          >
            <View style={[styles.checkbox, agreed && styles.checkboxOn]}>
              {agreed ? <Check size={14} color={colors.onAccent} strokeWidth={2.5} /> : null}
            </View>
            <Text style={styles.checkText}>I agree to the Terms and Privacy Policy</Text>
          </Pressable>

          <Button title="Create account" onPress={handleSignUp} loading={loading} />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchText}>Already have an account?</Text>
          <Pressable onPress={() => navigation.navigate('SignIn')} hitSlop={10} accessibilityRole="link">
            <Text style={styles.switchLink}>Sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgPrimary },
  container: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40, gap: 32 },
  intro: { gap: 8 },
  logo: { marginBottom: 28, marginLeft: -4 },
  title: {
    fontFamily: fonts.spaceGrotesk.semiBold, fontSize: 32, lineHeight: 38,
    letterSpacing: -0.64, color: colors.textPrimary,
  },
  subtitle: { fontFamily: fonts.inter.regular, fontSize: 15, lineHeight: 22, color: colors.textMuted },
  form: { gap: 18 },
  passwordGroup: { gap: 8 },
  hint: { fontFamily: fonts.inter.regular, fontSize: 13, color: colors.textMuted },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: colors.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkText: { flex: 1, fontFamily: fonts.inter.regular, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  switchText: { fontFamily: fonts.inter.regular, fontSize: 14, color: colors.textMuted },
  switchLink: { fontFamily: fonts.inter.semiBold, fontSize: 14, color: colors.textPrimary },
});
