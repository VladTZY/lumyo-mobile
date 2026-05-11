import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FileText, Sparkles, ArrowUp, ChevronLeft } from 'lucide-react-native';
import { colors, fonts, radius } from '../theme';
import {
  createChat, getChat, sendMessage, updateChat,
  type Chat, type Message,
} from '../services/chat';
import Markdown from 'react-native-markdown-display';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ChatStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<ChatStackParamList, 'ChatMain'>;

export function ChatScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sourceCount, setSourceCount] = useState(0);

  const chatId = route.params?.chatId;
  const sourceNoteIds = route.params?.sourceNoteIds;

  useEffect(() => {
    // Reset state when switching chats
    setChat(null);
    setMessages([]);
    setSourceCount(0);
    setInput('');

    if (chatId) {
      getChat(chatId).then((data) => {
        setChat(data);
        setMessages(data.messages || []);
        setSourceCount(data.source_note_ids?.length || 0);
      }).catch(() => {});
    }
  }, [chatId]);

  useEffect(() => {
    if (sourceNoteIds && sourceNoteIds.length > 0) {
      setSourceCount(sourceNoteIds.length);
      if (chat) {
        updateChat(chat.id, sourceNoteIds).then(setChat).catch(() => {});
      }
    }
  }, [sourceNoteIds]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    let currentChat = chat;

    if (!currentChat) {
      if (!sourceNoteIds || sourceNoteIds.length === 0) {
        navigation.navigate('SourceSelector', { selectedIds: [] });
        return;
      }
      try {
        const title = text.length > 15 ? text.slice(0, 15) + '...' : text;
        currentChat = await createChat(title, sourceNoteIds);
        setChat(currentChat);
      } catch {
        return;
      }
    }

    const tempUserMsg: Message = {
      id: Date.now(),
      chat_id: currentChat.id,
      role: 'user',
      content: text,
      sources: [],
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setInput('');
    setSending(true);

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const assistantMsg = await sendMessage(currentChat.id, text);
      setMessages((prev) => [...prev, assistantMsg]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      const errorMsg: Message = {
        id: Date.now() + 1,
        chat_id: currentChat.id,
        role: 'assistant',
        content: `Sorry, something went wrong: ${e.message}`,
        sources: [],
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  }, [input, chat, sending, sourceNoteIds, navigation]);

  const handleSourcesPress = useCallback(() => {
    const ids = chat?.source_note_ids || sourceNoteIds || [];
    navigation.navigate('SourceSelector', {
      chatId: chat?.id,
      selectedIds: ids,
    });
  }, [chat, sourceNoteIds, navigation]);

  const canSend = input.trim().length > 0 && !sending;
  const hasMessages = messages.length > 0 || sending;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top}
    >

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {chat?.title || 'New Chat'}
          </Text>
        </View>
        <TouchableOpacity style={styles.sourcesBtn} onPress={handleSourcesPress}>
          <FileText size={14} color={colors.aiAccent} />
          <Text style={styles.sourcesBtnText}>
            {sourceCount > 0 ? `${sourceCount} source${sourceCount !== 1 ? 's' : ''}` : 'Select sources'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Messages area */}
      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={[
          styles.messagesContent,
          !hasMessages && styles.messagesContentEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!hasMessages && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Sparkles size={28} color={colors.aiAccent} />
            </View>
            <Text style={styles.emptyTitle}>Your second brain</Text>
            <Text style={styles.emptySubtitle}>
              {sourceCount > 0
                ? 'Ask anything about your selected notes'
                : 'Select sources to start chatting'}
            </Text>
          </View>
        )}

        {messages.map((msg) => (
          <View key={msg.id} style={styles.messageWrapper}>
            {msg.role === 'user' ? (
              <View style={styles.userBubble}>
                <Text style={styles.userText}>{msg.content}</Text>
              </View>
            ) : (
              <View style={styles.aiBubble}>
                <View style={styles.aiAvatarWrap}>
                  <Sparkles size={14} color={colors.aiAccent} />
                </View>
                <View style={styles.aiContent}>
                  <Markdown style={mdStyles}>{msg.content}</Markdown>
                  {msg.sources && msg.sources.length > 0 && (
                    <View style={styles.sourcesRow}>
                      {msg.sources.map((src, i) => (
                        <View key={i} style={styles.sourceChip}>
                          <FileText size={11} color={colors.aiAccent} />
                          <Text style={styles.sourceText}>{src.title}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
        ))}

        {sending && (
          <View style={styles.aiBubble}>
            <View style={styles.aiAvatarWrap}>
              <Sparkles size={14} color={colors.aiAccent} />
            </View>
            <View style={styles.thinkingWrap}>
              <ActivityIndicator size="small" color={colors.aiAccent} />
              <Text style={styles.thinkingText}>Thinking...</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <View style={styles.inputArea}>
        <TextInput
          style={styles.textInput}
          placeholder="Ask about your notes..."
          placeholderTextColor={colors.textMuted}
          value={input}
          onChangeText={setInput}
          multiline
          editable={!sending}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[styles.sendBtn, canSend && styles.sendBtnActive]}
          onPress={handleSend}
          disabled={!canSend}
        >
          {sending
            ? <ActivityIndicator size={14} color="#FFFFFF" />
            : <ArrowUp size={18} color={canSend ? '#FFFFFF' : colors.textMuted} />
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgPrimary },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8, gap: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  backBtn: { padding: 2 },
  headerTitle: {
    fontFamily: fonts.spaceGrotesk.semiBold, fontSize: 18, color: colors.textPrimary,
    flex: 1,
  },
  sourcesBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.aiAccentLight, borderRadius: radius.full,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  sourcesBtnText: { fontFamily: fonts.inter.medium, fontSize: 13, color: colors.aiAccent },

  messages: { flex: 1 },
  messagesContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, gap: 20 },
  messagesContentEmpty: { flexGrow: 1, justifyContent: 'center' },

  emptyState: { alignItems: 'center', gap: 10, paddingBottom: 20 },
  emptyIconWrap: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.aiAccentLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontFamily: fonts.spaceGrotesk.semiBold, fontSize: 20, color: colors.textPrimary },
  emptySubtitle: {
    fontFamily: fonts.inter.regular, fontSize: 14, color: colors.textSecondary,
    textAlign: 'center', lineHeight: 20, paddingHorizontal: 20,
  },

  messageWrapper: {},
  userBubble: {
    alignSelf: 'flex-end', maxWidth: '80%',
    backgroundColor: colors.accent, borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  userText: { fontFamily: fonts.inter.regular, fontSize: 15, color: '#FFFFFF', lineHeight: 22 },
  aiBubble: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
  },
  aiAvatarWrap: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.aiAccentLight,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  aiContent: { flex: 1, gap: 10 },
  aiText: { fontFamily: fonts.inter.regular, fontSize: 15, color: colors.textPrimary, lineHeight: 24 },
  thinkingWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 6 },
  thinkingText: { fontFamily: fonts.inter.regular, fontSize: 13, color: colors.aiAccent },

  sourcesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sourceChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.aiAccentLight, borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  sourceText: { fontFamily: fonts.inter.medium, fontSize: 12, color: colors.aiAccent },

  inputArea: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  textInput: {
    flex: 1, fontFamily: fonts.inter.regular, fontSize: 14, color: colors.textPrimary,
    borderWidth: 1, borderColor: colors.border, borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10, maxHeight: 100,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.bgHover, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnActive: { backgroundColor: colors.accent },
});

const mdStyles = StyleSheet.create({
  body: { fontFamily: fonts.inter.regular, fontSize: 15, color: colors.textPrimary, lineHeight: 24 },
  heading1: { fontFamily: fonts.spaceGrotesk.semiBold, fontSize: 20, color: colors.textPrimary, marginTop: 12, marginBottom: 4 },
  heading2: { fontFamily: fonts.spaceGrotesk.semiBold, fontSize: 18, color: colors.textPrimary, marginTop: 10, marginBottom: 4 },
  heading3: { fontFamily: fonts.spaceGrotesk.semiBold, fontSize: 16, color: colors.textPrimary, marginTop: 8, marginBottom: 4 },
  strong: { fontFamily: fonts.inter.semiBold },
  em: { fontStyle: 'italic' },
  bullet_list: { marginVertical: 4 },
  ordered_list: { marginVertical: 4 },
  list_item: { marginVertical: 2 },
  code_inline: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13, backgroundColor: colors.bgSurface, color: colors.aiAccent,
    paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4,
  },
  fence: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13, backgroundColor: colors.bgSurface, color: colors.textPrimary,
    padding: 12, borderRadius: 8, marginVertical: 8, overflow: 'hidden',
  },
  blockquote: {
    backgroundColor: colors.bgSurface, borderLeftWidth: 3, borderLeftColor: colors.aiAccent,
    paddingHorizontal: 12, paddingVertical: 8, marginVertical: 6, borderRadius: 4,
  },
  hr: { backgroundColor: colors.border, height: 1, marginVertical: 12 },
  paragraph: { marginTop: 0, marginBottom: 8 },
  link: { color: colors.aiAccent, textDecorationLine: 'underline' },
});
