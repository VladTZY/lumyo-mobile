import React, { useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import { fonts, type Colors } from '../theme';
import { useStyles, useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/Logo';
import { Button, TextField } from '../components/ui';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

export function SignInScreen({ navigation }: Props) {
  const { login } = useAuth();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Email and password needed', 'Enter both to sign in.');
      return;
    }
    try {
      setLoading(true);
      await login(email.trim(), password);
    } catch (e: any) {
      Alert.alert("Couldn't sign in", e.message);
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
          <Text style={styles.title} accessibilityRole="header">Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to pick up where your notes left off.</Text>
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

          <TextField
            ref={passwordRef}
            label="Password"
            icon={Lock}
            labelRight={
              <Pressable hitSlop={10} accessibilityRole="button">
                <Text style={styles.forgot}>Forgot password?</Text>
              </Pressable>
            }
            placeholder="Your password"
            secureTextEntry={!showPassword}
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={handleSignIn}
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

          <Button title="Sign in" onPress={handleSignIn} loading={loading} style={styles.submit} />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchText}>New to Lumyo?</Text>
          <Pressable onPress={() => navigation.navigate('SignUp')} hitSlop={10} accessibilityRole="link">
            <Text style={styles.switchLink}>Create an account</Text>
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
  forgot: { fontFamily: fonts.inter.medium, fontSize: 13, color: colors.accentText },
  submit: { marginTop: 6 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  switchText: { fontFamily: fonts.inter.regular, fontSize: 14, color: colors.textMuted },
  switchLink: { fontFamily: fonts.inter.semiBold, fontSize: 14, color: colors.textPrimary },
});
