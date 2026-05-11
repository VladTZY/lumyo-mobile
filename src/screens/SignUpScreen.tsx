import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { Sun, User, Mail, Lock, Eye, EyeOff, Globe, CheckSquare, Square } from 'lucide-react-native';
import { colors, fonts, radius } from '../theme';
import { useAuth } from '../context/AuthContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

export function SignUpScreen({ navigation }: Props) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    if (!agreed) {
      Alert.alert('Error', 'Please agree to the Terms & Privacy Policy.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }
    try {
      setLoading(true);
      await register(email.trim(), password, password);
    } catch (e: any) {
      Alert.alert('Sign Up Failed', e.message);
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
          <Text style={styles.appName}>Create Account</Text>
          <Text style={styles.subtitle}>Start organizing your notes with AI.</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Full Name</Text>
            <View style={styles.inputRow}>
              <User size={16} color={colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={setName}
              />
            </View>
          </View>

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
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputRow}>
              <Lock size={16} color={colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="Create a password"
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
            <Text style={styles.hint}>Must be at least 8 characters</Text>
          </View>

          <TouchableOpacity style={styles.checkRow} onPress={() => setAgreed(!agreed)}>
            {agreed
              ? <CheckSquare size={18} color={colors.accent} />
              : <Square size={18} color={colors.textMuted} />
            }
            <Text style={styles.checkText}>I agree to the Terms & Privacy Policy</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleSignUp} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={styles.primaryBtnText}>Create Account</Text>
            }
          </TouchableOpacity>

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

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
              <Text style={styles.switchLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgPrimary },
  container: { paddingHorizontal: 28, paddingBottom: 40 },
  logoBlock: { alignItems: 'center', paddingTop: 24, paddingBottom: 32 },
  logoIcon: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  appName: { fontFamily: fonts.spaceGrotesk.semiBold, fontSize: 26, color: colors.textPrimary },
  subtitle: { fontFamily: fonts.inter.regular, fontSize: 14, color: colors.textSecondary, marginTop: 6 },
  form: { gap: 14 },
  fieldGroup: { gap: 6 },
  label: { fontFamily: fonts.inter.medium, fontSize: 14, color: colors.textPrimary },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  input: { flex: 1, fontFamily: fonts.inter.regular, fontSize: 14, color: colors.textPrimary },
  hint: { fontFamily: fonts.inter.regular, fontSize: 12, color: colors.textMuted },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkText: { fontFamily: fonts.inter.regular, fontSize: 13, color: colors.textSecondary, flex: 1 },
  primaryBtn: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: 15, alignItems: 'center', marginTop: 4,
  },
  primaryBtnText: { fontFamily: fonts.inter.semiBold, fontSize: 15, color: '#FFFFFF' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontFamily: fonts.inter.regular, fontSize: 13, color: colors.textMuted },
  socialRow: { flexDirection: 'row', gap: 12 },
  socialBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 13,
  },
  socialBtnText: { fontFamily: fonts.inter.medium, fontSize: 14, color: colors.textPrimary },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 4 },
  switchText: { fontFamily: fonts.inter.regular, fontSize: 14, color: colors.textSecondary },
  switchLink: { fontFamily: fonts.inter.semiBold, fontSize: 14, color: colors.textPrimary },
});
