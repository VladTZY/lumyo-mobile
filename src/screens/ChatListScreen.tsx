import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, RefreshControl, Alert,
} from 'react-native';
import { Plus, MessageCircle, Trash2, FileText } from 'lucide-react-native';
import { fonts, radius, type Colors } from '../theme';
import { useStyles, useTheme } from '../theme/ThemeContext';
import { CenteredSpinner, EmptyState, IconButton, ScreenHeader } from '../components/ui';
import { getChats, deleteChat, type Chat } from '../services/chat';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ChatStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<ChatStackParamList, 'ChatList'>;

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ChatListScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getChats();
      setChats(data);
    } catch {}
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => load(true));
    return unsub;
  }, [navigation, load]);

  const handleDelete = useCallback((chat: Chat) => {
    Alert.alert('Delete this chat?', `“${chat.title}” will be removed. Your notes stay as they are.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteChat(chat.id);
            setChats((prev) => prev.filter((c) => c.id !== chat.id));
          } catch {}
        },
      },
    ]);
  }, []);

  const newChat = () => navigation.push('ChatMain', {});

  if (loading) return <View style={styles.root}><CenteredSpinner /></View>;

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Chat"
        subtitle="Ask questions. Lumyo answers only from the notes you pick."
        right={<IconButton icon={Plus} label="New chat" variant="accent" onPress={newChat} />}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }}
            tintColor={colors.textMuted}
            colors={[colors.accent]}
          />
        }
      >
        {chats.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            title="No chats yet"
            body="Pick some notes, then ask them anything. Each answer names the note it came from."
            action={{ title: 'New chat', icon: Plus, onPress: newChat }}
          />
        ) : (
          chats.map((chat) => {
            const sources = chat.source_note_ids?.length || 0;
            return (
              <Pressable
                key={chat.id}
                style={({ pressed }) => [styles.chatItem, pressed && styles.pressed]}
                onPress={() => navigation.push('ChatMain', { chatId: chat.id })}
                onLongPress={() => handleDelete(chat)}
                accessibilityRole="button"
                accessibilityLabel={`Open chat ${chat.title}`}
                accessibilityHint="Long press to delete"
              >
                <View style={styles.chatInfo}>
                  <Text style={styles.chatTitle} numberOfLines={1}>{chat.title}</Text>
                  <View style={styles.chatMeta}>
                    <FileText size={12} color={colors.textMuted} strokeWidth={1.75} />
                    <Text style={styles.chatMetaText}>
                      {sources} {sources === 1 ? 'note' : 'notes'} · {formatDate(chat.updated_at)}
                    </Text>
                  </View>
                </View>
                <IconButton icon={Trash2} label={`Delete chat ${chat.title}`} onPress={() => handleDelete(chat)} size={40} />
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgPrimary },
  scroll: { flex: 1 },
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24, gap: 8, flexGrow: 1 },
  pressed: { backgroundColor: colors.bgHover },
  chatItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
    backgroundColor: colors.bgSurface,
    paddingLeft: 16, paddingRight: 6, paddingVertical: 10,
  },
  chatInfo: { flex: 1, gap: 4 },
  chatTitle: { fontFamily: fonts.inter.semiBold, fontSize: 15, color: colors.textPrimary },
  chatMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  chatMetaText: { fontFamily: fonts.inter.regular, fontSize: 12, color: colors.textMuted },
});
