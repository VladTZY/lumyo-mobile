import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FileText, ArrowUp, ListChecks } from 'lucide-react-native';
import { fonts, radius, type Colors } from '../theme';
import { useStyles, useTheme } from '../theme/ThemeContext';
import { LogoMark } from '../components/Logo';
import { BackButton, Button, CitationChip } from '../components/ui';
import {
  createChat, getChat, sendMessageStream, updateChat,
  type Chat, type Message, type Source,
} from '../services/chat';
import Markdown from 'react-native-markdown-display';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ChatStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<ChatStackParamList, 'ChatMain'>;

// One chip per note, numbered in the order the answer cites them.
function uniqueSources(sources: Source[]): Source[] {
  const seen = new Set<number>();
  return sources.filter((src) => {
    if (seen.has(src.note_id)) return false;
    seen.add(src.note_id);
    return true;
  });
}

function AssistantAvatar() {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.aiAvatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <LogoMark size={16} />
    </View>
  );
}

export function ChatScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { colors, scheme } = useTheme();
  const styles = useStyles(makeStyles);
  const mdStyles = useStyles(makeMdStyles);
  const scrollRef = useRef<ScrollView>(null);

  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);
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
      const assistantMsg = await sendMessageStream(currentChat.id, text, (delta) => {
        setStreamingText((prev) => (prev ?? '') + delta);
        scrollRef.current?.scrollToEnd({ animated: false });
      });
      setMessages((prev) => [...prev, assistantMsg]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      const errorMsg: Message = {
        id: Date.now() + 1,
        chat_id: currentChat.id,
        role: 'assistant',
        content: `Couldn't get an answer: ${e.message}. Check your connection and send the question again.`,
        sources: [],
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
      setStreamingText(null);
    }
  }, [input, chat, sending, sourceNoteIds, navigation]);

  const handleSourcesPress = useCallback(() => {
    const ids = chat?.source_note_ids || sourceNoteIds || [];
    navigation.navigate('SourceSelector', {
      chatId: chat?.id,
      selectedIds: ids,
    });
  }, [chat, sourceNoteIds, navigation]);

  const openSource = useCallback((noteId: number) => {
    (navigation as any).navigate('Notes', {
      screen: 'NoteEditor',
      params: { id: String(noteId) },
      initial: false,
    });
  }, [navigation]);

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
          <BackButton onPress={() => navigation.goBack()} />
          <Text style={styles.headerTitle} numberOfLines={1}>
            {chat?.title || 'New chat'}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.sourcesBtn, pressed && styles.sourcesBtnPressed]}
          onPress={handleSourcesPress}
          accessibilityRole="button"
          accessibilityLabel={sourceCount > 0 ? `${sourceCount} notes selected. Change notes` : 'Choose notes'}
        >
          <FileText size={14} color={colors.citationText} strokeWidth={1.75} />
          <Text style={styles.sourcesBtnText}>
            {sourceCount > 0 ? `${sourceCount} ${sourceCount === 1 ? 'note' : 'notes'}` : 'Choose notes'}
          </Text>
        </Pressable>
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
            <View style={styles.emptyMark}>
              <LogoMark size={30} />
            </View>
            <Text style={styles.emptyTitle}>Ask your notes.</Text>
            <Text style={styles.emptySubtitle}>
              {sourceCount > 0
                ? `Lumyo will answer from the ${sourceCount} ${sourceCount === 1 ? 'note' : 'notes'} you picked, and cite each one it uses.`
                : 'First choose which notes Lumyo can read. It answers only from those, and says so when they don\'t cover your question.'}
            </Text>
            {sourceCount === 0 && (
              <Button title="Choose notes" icon={ListChecks} size="small" onPress={handleSourcesPress} style={styles.emptyAction} />
            )}
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
                <AssistantAvatar />
                <View style={styles.aiContent}>
                  <Markdown style={mdStyles}>{msg.content}</Markdown>
                  {msg.sources && msg.sources.length > 0 && (() => {
                    const cited = uniqueSources(msg.sources);
                    return (
                      <View style={styles.citations}>
                        <View style={styles.sourcesRow}>
                          {cited.map((src, i) => (
                            <CitationChip
                              key={src.note_id}
                              index={i + 1}
                              title={src.title}
                              onPress={() => openSource(src.note_id)}
                            />
                          ))}
                        </View>
                        <Text style={styles.basedOn}>
                          Based on {cited.length} of your notes
                        </Text>
                      </View>
                    );
                  })()}
                </View>
              </View>
            )}
          </View>
        ))}

        {sending && (
          <View style={styles.aiBubble}>
            <AssistantAvatar />
            {streamingText ? (
              <View style={styles.aiContent}>
                <Markdown style={mdStyles}>{streamingText}</Markdown>
              </View>
            ) : (
              <View style={styles.thinkingWrap}>
                <ActivityIndicator size="small" color={colors.accentText} />
                <Text style={styles.thinkingText}>Reading your notes…</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <View style={styles.inputArea}>
        <TextInput
          style={styles.textInput}
          placeholder={sourceCount > 0 ? 'Ask your notes a question' : 'Choose notes first, then ask'}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.accent}
          keyboardAppearance={scheme}
          accessibilityLabel="Question"
          value={input}
          onChangeText={setInput}
          multiline
          editable={!sending}
          onSubmitEditing={handleSend}
        />
        <Pressable
          style={({ pressed }) => [styles.sendBtn, canSend && styles.sendBtnActive, pressed && canSend && styles.sendBtnPressed]}
          onPress={handleSend}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Send question"
          accessibilityState={{ disabled: !canSend, busy: sending }}
        >
          {sending
            ? <ActivityIndicator size="small" color={colors.textMuted} />
            : <ArrowUp size={18} color={canSend ? colors.onAccent : colors.textMuted} strokeWidth={2.25} />
          }
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgPrimary },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingLeft: 20, paddingRight: 16, paddingVertical: 4, gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderStrong,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerTitle: {
    fontFamily: fonts.spaceGrotesk.semiBold, fontSize: 18, color: colors.textPrimary,
    flex: 1,
  },
  sourcesBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36,
    backgroundColor: colors.citationBg, borderRadius: radius.full,
    paddingHorizontal: 12,
  },
  sourcesBtnPressed: { opacity: 0.75 },
  sourcesBtnText: { fontFamily: fonts.inter.semiBold, fontSize: 13, color: colors.citationText },

  messages: { flex: 1 },
  messagesContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, gap: 24 },
  messagesContentEmpty: { flexGrow: 1, justifyContent: 'center' },

  emptyState: { alignItems: 'center', gap: 8, paddingBottom: 24, paddingHorizontal: 12 },
  emptyMark: {
    width: 64, height: 64, borderRadius: 20, marginBottom: 12,
    backgroundColor: colors.citationBg, alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: fonts.spaceGrotesk.semiBold, fontSize: 26, letterSpacing: -0.5, color: colors.textPrimary,
  },
  emptySubtitle: {
    fontFamily: fonts.inter.regular, fontSize: 15, color: colors.textMuted,
    textAlign: 'center', lineHeight: 22, maxWidth: 320,
  },
  emptyAction: { marginTop: 14 },

  messageWrapper: {},
  userBubble: {
    alignSelf: 'flex-end', maxWidth: '82%',
    backgroundColor: colors.ink, borderRadius: 20,
    borderBottomRightRadius: 6,
    paddingHorizontal: 16, paddingVertical: 11,
  },
  userText: { fontFamily: fonts.inter.regular, fontSize: 15, color: colors.onInk, lineHeight: 22 },
  aiBubble: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
  },
  aiAvatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.citationBg,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  aiContent: { flex: 1, gap: 12, paddingTop: 3 },
  thinkingWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 6 },
  thinkingText: { fontFamily: fonts.inter.regular, fontSize: 14, color: colors.textMuted },

  citations: {
    gap: 10, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderStrong,
  },
  sourcesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  basedOn: { fontFamily: fonts.inter.regular, fontSize: 12, color: colors.textMuted },

  inputArea: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderStrong,
    backgroundColor: colors.bgPrimary,
  },
  textInput: {
    flex: 1, fontFamily: fonts.inter.regular, fontSize: 15, color: colors.textPrimary,
    backgroundColor: colors.bgSurface,
    borderWidth: 1, borderColor: colors.border, borderRadius: 22,
    paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, minHeight: 44, maxHeight: 120,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.bgHover, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnActive: { backgroundColor: colors.accent },
  sendBtnPressed: { backgroundColor: colors.accentPressed },
});

const makeMdStyles = (colors: Colors) => StyleSheet.create({
  body: { fontFamily: fonts.inter.regular, fontSize: 15, color: colors.textPrimary, lineHeight: 24 },
  heading1: { fontFamily: fonts.spaceGrotesk.semiBold, fontSize: 20, color: colors.textPrimary, marginTop: 12, marginBottom: 4 },
  heading2: { fontFamily: fonts.spaceGrotesk.semiBold, fontSize: 18, color: colors.textPrimary, marginTop: 10, marginBottom: 4 },
  heading3: { fontFamily: fonts.spaceGrotesk.semiBold, fontSize: 16, color: colors.textPrimary, marginTop: 8, marginBottom: 4 },
  strong: { fontFamily: fonts.inter.semiBold },
  em: { fontFamily: fonts.inter.italic },
  bullet_list: { marginVertical: 4 },
  ordered_list: { marginVertical: 4 },
  list_item: { marginVertical: 2 },
  bullet_list_icon: { color: colors.textMuted },
  ordered_list_icon: { color: colors.textMuted },
  code_inline: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13, backgroundColor: colors.bgHover, color: colors.textPrimary,
    paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4,
  },
  fence: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13, backgroundColor: colors.bgSurface, color: colors.textPrimary,
    borderWidth: 1, borderColor: colors.border,
    padding: 12, borderRadius: 8, marginVertical: 8, overflow: 'hidden',
  },
  code_block: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13, backgroundColor: colors.bgSurface, color: colors.textPrimary,
    padding: 12, borderRadius: 8,
  },
  blockquote: {
    backgroundColor: colors.bgSurface, borderLeftWidth: 3, borderLeftColor: colors.spark,
    paddingHorizontal: 12, paddingVertical: 8, marginVertical: 6, borderRadius: 4,
  },
  hr: { backgroundColor: colors.border, height: 1, marginVertical: 12 },
  paragraph: { marginTop: 0, marginBottom: 8 },
  link: { color: colors.accentText, textDecorationLine: 'underline' },
  table: { borderColor: colors.border },
  tr: { borderColor: colors.border },
});
