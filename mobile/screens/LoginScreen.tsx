import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
    Alert,
    TextInput,
    KeyboardAvoidingView,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { signInAnonymously, signInWithApple, signInWithEmailOtp, verifyEmailOtp } from '../lib/auth';

interface LoginScreenProps {
    onSignedIn: () => void;
}

type Step = 'welcome' | 'email-entry' | 'code-entry';

export default function LoginScreen({ onSignedIn }: LoginScreenProps) {
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<Step>('welcome');
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [resendCooldown, setResendCooldown] = useState(0);
    const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        return () => {
            if (cooldownRef.current) clearInterval(cooldownRef.current);
        };
    }, []);

    const startCooldown = () => {
        setResendCooldown(60);
        if (cooldownRef.current) clearInterval(cooldownRef.current);
        cooldownRef.current = setInterval(() => {
            setResendCooldown(s => {
                if (s <= 1) {
                    clearInterval(cooldownRef.current!);
                    return 0;
                }
                return s - 1;
            });
        }, 1000);
    };

    const handleAppleSignIn = async () => {
        setLoading(true);
        try {
            await signInWithApple();
            onSignedIn();
        } catch (err: any) {
            if (err?.code === 'ERR_REQUEST_CANCELED') {
                // User cancelled — no error shown
            } else if (err?.code === 'ERR_REQUEST_NOT_HANDLED') {
                Alert.alert('Not Available', 'Apple Sign-In is not available on this device.');
            } else {
                Alert.alert('Sign In Failed', err?.message ?? 'An error occurred. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleContinueAnon = async () => {
        setLoading(true);
        try {
            await signInAnonymously();
            onSignedIn();
        } catch (err: any) {
            Alert.alert('Error', err?.message ?? 'Could not start session. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSendCode = async () => {
        if (!email.includes('@')) {
            Alert.alert('Invalid Email', 'Please enter a valid email address.');
            return;
        }
        setLoading(true);
        try {
            await signInWithEmailOtp(email);
            startCooldown();
            setStep('code-entry');
        } catch (err: any) {
            const msg = err?.message?.toLowerCase() ?? '';
            if (msg.includes('for security purposes')) {
                Alert.alert('Wait', 'Wait a moment before requesting a new code (60s cooldown).');
            } else if (msg.includes('email rate limit exceeded')) {
                Alert.alert('System Busy', 'Email limit reached for this project. Please try again in an hour or use a different sign-in method.');
            } else if (msg.includes('too many requests') || err?.status === 429) {
                Alert.alert('Wait', 'Too many attempts. Wait a few minutes and try again.');
            } else {
                Alert.alert('Error', 'Failed to send code. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyCode = async () => {
        if (code.length < 6) {
            Alert.alert('Invalid Code', 'Please enter the 6-digit code.');
            return;
        }
        setLoading(true);
        try {
            await verifyEmailOtp(email, code);
            onSignedIn();
        } catch {
            Alert.alert('Verification Failed', 'The code was invalid or has expired. Please request a new one.');
        } finally {
            setLoading(false);
        }
    };

    const renderWelcome = () => (
        <View style={styles.welcomeContainer}>
            <View style={styles.welcomeContent}>
                <Text style={styles.title}>Welcome to Sharene</Text>
                <Text style={styles.subtitle}>Securely share your private photos with true end-to-end encryption.</Text>
            </View>

            <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => setStep('email-entry')}
            >
                <Text style={styles.primaryButtonText}>Get Started</Text>
            </TouchableOpacity>
        </View>
    );

    const renderEmailEntry = () => (
        <View style={styles.stepContainer}>
            <TouchableOpacity onPress={() => setStep('welcome')} style={styles.backButton}>
                <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>

            <View style={styles.stepHeader}>
                <Text style={styles.stepTitle}>Enter an email to get started!</Text>
                <Text style={styles.stepSubtitle}>We'll send a verification code in email, which you can use to sign in.</Text>
            </View>

            <TextInput
                style={styles.input}
                placeholder="Your Email"
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
            />

            <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleSendCode}
                disabled={loading || !email}
            >
                {loading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.primaryButtonText}>Continue</Text>
                )}
            </TouchableOpacity>

            <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
            </View>

            {Platform.OS === 'ios' && (
                <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                    cornerRadius={12}
                    style={styles.appleButton}
                    onPress={handleAppleSignIn}
                />
            )}

            <TouchableOpacity
                style={styles.skipLinkContainer}
                onPress={handleContinueAnon}
                disabled={loading}
            >
                <Text style={styles.skipLinkText}>Skip for now</Text>
            </TouchableOpacity>
        </View>
    );

    const renderCodeEntry = () => (
        <View style={styles.stepContainer}>
            <TouchableOpacity onPress={() => setStep('email-entry')} style={styles.backButton}>
                <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>

            <View style={styles.stepHeader}>
                <Text style={styles.stepTitle}>Check your email</Text>
                <Text style={styles.stepSubtitle}>Enter the 6-digit code sent to {email}</Text>
            </View>

            <TextInput
                style={styles.input}
                placeholder="000000"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                autoFocus
            />

            <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleVerifyCode}
                disabled={loading || code.length < 6}
            >
                {loading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.primaryButtonText}>Verify</Text>
                )}
            </TouchableOpacity>

            <TouchableOpacity
                onPress={handleSendCode}
                disabled={loading || resendCooldown > 0}
                style={styles.secondaryAction}
            >
                <Text style={[styles.secondaryActionText, resendCooldown > 0 && styles.secondaryActionDisabled]}>
                    {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : 'Resend code'}
                </Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            {step === 'welcome' && renderWelcome()}
            {step === 'email-entry' && renderEmailEntry()}
            {step === 'code-entry' && renderCodeEntry()}
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        paddingHorizontal: 24,
        paddingTop: 80,
        paddingBottom: 40,
    },
    welcomeContainer: {
        flex: 1,
        justifyContent: 'space-between',
        paddingBottom: 20,
    },
    welcomeContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    title: {
        fontSize: 36,
        fontWeight: '700',
        color: '#111',
        letterSpacing: -0.5,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: 20,
    },
    stepContainer: {
        flex: 1,
        justifyContent: 'flex-start',
        paddingTop: 20,
    },
    appleButton: {
        height: 56,
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 24,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#E5E7EB',
    },
    dividerText: {
        marginHorizontal: 16,
        color: '#6B7280',
        fontSize: 14,
    },
    skipLinkContainer: {
        marginTop: 32,
        alignItems: 'center',
    },
    skipLinkText: {
        fontSize: 16,
        color: '#666',
        fontWeight: '500',
    },
    backButton: {
        marginBottom: 32,
    },
    backButtonText: {
        fontSize: 16,
        color: '#6366F1',
        fontWeight: '500',
    },
    stepHeader: {
        marginBottom: 24,
    },
    stepTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111',
        marginBottom: 8,
    },
    stepSubtitle: {
        fontSize: 16,
        color: '#666',
        lineHeight: 22,
    },
    input: {
        height: 56,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 16,
        marginBottom: 16,
        backgroundColor: '#F9FAFB',
    },
    primaryButton: {
        height: 56,
        backgroundColor: '#000',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonText: {
        fontSize: 16,
        color: '#fff',
        fontWeight: '600',
    },
    secondaryAction: {
        marginTop: 24,
        alignItems: 'center',
    },
    secondaryActionText: {
        fontSize: 14,
        color: '#666',
        textDecorationLine: 'underline',
    },
    secondaryActionDisabled: {
        color: '#bbb',
        textDecorationLine: 'none',
    },
});
