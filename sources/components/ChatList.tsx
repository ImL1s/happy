import * as React from 'react';
import { useSession, useSessionMessages } from "@/sync/storage";
import { FlatList, Platform, Pressable, View } from 'react-native';
import { useCallback, useRef, useState } from 'react';
import { useHeaderHeight } from '@/utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageView } from './MessageView';
import { Metadata, Session } from '@/sync/storageTypes';
import { ChatFooter } from './ChatFooter';
import { Message } from '@/sync/typesMessage';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { hapticsLight } from './haptics';

export const ChatList = React.memo((props: { session: Session }) => {
    const { messages } = useSessionMessages(props.session.id);
    return (
        <ChatListInternal
            metadata={props.session.metadata}
            sessionId={props.session.id}
            messages={messages}
        />
    )
});

const ListHeader = React.memo(() => {
    const headerHeight = useHeaderHeight();
    const safeArea = useSafeAreaInsets();
    return <View style={{ flexDirection: 'row', alignItems: 'center', height: headerHeight + safeArea.top + 32 }} />;
});

const ListFooter = React.memo((props: { sessionId: string }) => {
    const session = useSession(props.sessionId)!;
    return (
        <ChatFooter controlledByUser={session.agentState?.controlledByUser || false} />
    )
});

const ChatListInternal = React.memo((props: {
    metadata: Metadata | null,
    sessionId: string,
    messages: Message[],
}) => {
    const { theme } = useUnistyles();
    const flatListRef = useRef<FlatList>(null);
    const [showScrollButton, setShowScrollButton] = useState(false);

    const keyExtractor = useCallback((item: any) => item.id, []);
    const renderItem = useCallback(({ item }: { item: any }) => (
        <MessageView message={item} metadata={props.metadata} sessionId={props.sessionId} />
    ), [props.metadata, props.sessionId]);

    // Track scroll position - for inverted list, contentOffset.y > threshold means scrolled up
    const handleScroll = useCallback((event: any) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        // Show button when scrolled more than 200 pixels from bottom (top in inverted)
        setShowScrollButton(offsetY > 200);
    }, []);

    // Scroll to bottom (index 0 in inverted list)
    const scrollToBottom = useCallback(() => {
        hapticsLight();
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, []);

    return (
        <View style={{ flex: 1 }}>
            <FlatList
                ref={flatListRef}
                data={props.messages}
                inverted={true}
                keyExtractor={keyExtractor}
                maintainVisibleContentPosition={{
                    minIndexForVisible: 0,
                    autoscrollToTopThreshold: 10,
                }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
                renderItem={renderItem}
                ListHeaderComponent={<ListFooter sessionId={props.sessionId} />}
                ListFooterComponent={<ListHeader />}
                onScroll={handleScroll}
                scrollEventThrottle={100}
            />

            {/* Floating scroll-to-bottom button */}
            {showScrollButton && (
                <Pressable
                    onPress={scrollToBottom}
                    style={({ pressed }) => [
                        styles.scrollButton,
                        {
                            backgroundColor: theme.colors.surfaceHighest,
                            opacity: pressed ? 0.8 : 1,
                        }
                    ]}
                >
                    <Ionicons name="chevron-down" size={20} color={theme.colors.text} />
                </Pressable>
            )}
        </View>
    )
});

const styles = StyleSheet.create((theme) => ({
    scrollButton: {
        position: 'absolute',
        bottom: 16,
        right: 16,
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: theme.colors.shadow.color,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: theme.colors.shadow.opacity,
        shadowRadius: 4,
        elevation: 4,
    },
}));