import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { Plus, MessageSquare, Trash2, ChevronRight } from 'lucide-react-native';
import { colors, fonts, radius } from '../theme';
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
    Alert.alert('Delete Chat', `Delete "${chat.title}"?`, [
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

  if (loading) {
    return (
      <View style={styles.root}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.aiAccent} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Chat</Text>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => navigation.push('ChatMain', {})}
        >
          <Plus size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />}
      >
        {chats.length === 0 ? (
          <View style={styles.empty}>
            <MessageSquare size={32} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptySubtitle}>Start a new chat to ask your notes anything</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => navigation.push('ChatMain', {})}
            >
              <Plus size={16} color="#FFFFFF" />
              <Text style={styles.emptyBtnText}>New Chat</Text>
            </TouchableOpacity>
          </View>
        ) : (
          chats.map((chat) => (
            <TouchableOpacity
              key={chat.id}
              style={styles.chatItem}
              onPress={() => navigation.push('ChatMain', { chatId: chat.id })}
            >
              <View style={styles.chatIcon}>
                <MessageSquare size={18} color={colors.aiAccent} />
              </View>
              <View style={styles.chatInfo}>
                <Text style={styles.chatTitle} numberOfLines={1}>{chat.title}</Text>
                <Text style={styles.chatMeta}>
                  {chat.source_note_ids?.length || 0} source{(chat.source_note_ids?.length || 0) !== 1 ? 's' : ''} · {formatDate(chat.updated_at)}
                </Text>
              </View>
              <View style={styles.chatActions}>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(chat)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Trash2 size={16} color={colors.textMuted} />
                </TouchableOpacity>
                <ChevronRight size={16} color={colors.textMuted} />
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4,
  },
  title: { fontFamily: fonts.spaceGrotesk.semiBold, fontSize: 28, color: colors.textPrimary },
  newBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  scroll: { flex: 1, marginTop: 8 },

  empty: { alignItems: 'center', paddingTop: 80, gap: 10, paddingHorizontal: 40 },
  emptyTitle: { fontFamily: fonts.spaceGrotesk.semiBold, fontSize: 18, color: colors.textPrimary, marginTop: 4 },
  emptySubtitle: {
    fontFamily: fonts.inter.regular, fontSize: 14, color: colors.textSecondary,
    textAlign: 'center', lineHeight: 20,
  },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.accent, borderRadius: radius.full,
    paddingHorizontal: 20, paddingVertical: 12, marginTop: 8,
  },
  emptyBtnText: { fontFamily: fonts.inter.semiBold, fontSize: 14, color: '#FFFFFF' },

  chatItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  chatIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.aiAccentLight,
    alignItems: 'center', justifyContent: 'center',
  },
  chatInfo: { flex: 1, gap: 3 },
  chatTitle: { fontFamily: fonts.inter.semiBold, fontSize: 15, color: colors.textPrimary },
  chatMeta: { fontFamily: fonts.inter.regular, fontSize: 12, color: colors.textMuted },
  chatActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deleteBtn: { padding: 4 },
});
