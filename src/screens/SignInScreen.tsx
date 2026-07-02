import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { Sun, Mail, Lock, Eye, EyeOff, Globe } from 'lucide-react-native';
import { colors, fonts, spacing, radius } from '../theme';
import { useAuth } from '../context/AuthContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

export function SignInScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter your email and password.');
      return;
    }
    try {
      setLoading(true);
      await login(email.trim(), password);
    } catch (e: any) {
      Alert.alert('Sign In Failed', e.message);
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
        {/* Logo */}
        <View style={styles.logoBlock}>
          <View style={styles.logoIcon}>
            <Sun size={28} color="#FFFFFF" />
          </View>
          <Text style={styles.appName}>Lumyo</Text>
          <Text style={styles.subtitle}>Welcome back. Sign in to continue.</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputRow}>
              <Mail size={16} color={colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Password</Text>
              <TouchableOpacity>
                <Text style={styles.forgot}>Forgot?</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.inputRow}>
              <Lock size={16} color={colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                {showPassword
                  ? <Eye size={16} color={colors.textMuted} />
                  : <EyeOff size={16} color={colors.textMuted} />
                }
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleSignIn} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={styles.primaryBtnText}>Sign In</Text>
            }
          </TouchableOpacity>

          {/* or continue with
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.socialRow}>
            <TouchableOpacity style={styles.socialBtn}>
              <Globe size={16} color={colors.textPrimary} />
              <Text style={styles.socialBtnText}>Google</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialBtn}>
              <Sun size={16} color={colors.textPrimary} />
              <Text style={styles.socialBtnText}>Apple</Text>
            </TouchableOpacity>
          </View>
          */}

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
              <Text style={styles.switchLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgPrimary },
  container: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 40 },
  logoBlock: { alignItems: 'center', paddingTop: 32, paddingBottom: 40 },
  logoIcon: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  appName: { fontFamily: fonts.spaceGrotesk.semiBold, fontSize: 28, color: colors.textPrimary },
  subtitle: { fontFamily: fonts.inter.regular, fontSize: 14, color: colors.textSecondary, marginTop: 6 },
  form: { gap: 16 },
  fieldGroup: { gap: 6 },
  label: { fontFamily: fonts.inter.medium, fontSize: 14, color: colors.textPrimary },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  forgot: { fontFamily: fonts.inter.medium, fontSize: 14, color: colors.aiAccentText },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  input: { flex: 1, fontFamily: fonts.inter.regular, fontSize: 14, color: colors.textPrimary },
  primaryBtn: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: 15, alignItems: 'center', marginTop: 4,
  },
  primaryBtnText: { fontFamily: fonts.inter.semiBold, fontSize: 15, color: '#FFFFFF' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontFamily: fonts.inter.regular, fontSize: 13, color: colors.textMuted },
  socialRow: { flexDirection: 'row', gap: 12 },
  socialBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 13,
  },
  socialBtnText: { fontFamily: fonts.inter.medium, fontSize: 14, color: colors.textPrimary },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  switchText: { fontFamily: fonts.inter.regular, fontSize: 14, color: colors.textSecondary },
  switchLink: { fontFamily: fonts.inter.semiBold, fontSize: 14, color: colors.textPrimary },
});
