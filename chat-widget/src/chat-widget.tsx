/*!
 * Copyright 2024, Staffbase GmbH and contributors.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { ReactElement, useState, useEffect, CSSProperties } from "react";
import { BlockAttributes, WidgetApi } from "widget-sdk";

// **********************************
// * Data Interfaces & Types
// **********************************
interface Avatar {
  icon: { url: string | null };
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  avatar: Avatar | null;
}

interface Message {
  id: string;
  senderID: string;
  parts: { body: string }[];
  sender: User;
  created: string;
}

interface Conversation {
  id: string;
  type: 'direct' | 'group';
  meta: {
    title: string;
    image?: Avatar;
  };
  lastMessage: Message;
  partner?: User;
}

interface ConversationsResponse {
  data: Conversation[];
}

interface MessagesResponse {
  data: Message[];
}

export interface ChatWidgetProps extends BlockAttributes {
  title: string;
  conversationlimit: number;
  widgetApi: WidgetApi;
}

// **********************************
// * Helper Functions & Components
// **********************************

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const ChatAvatar = ({ conversation }: { conversation: Conversation }) => {
  const image = conversation.type === 'direct' ? conversation.partner?.avatar : conversation.meta.image;
  const initials = conversation.meta.title.split(' ').map(n => n[0]).slice(0, 2).join('');

  if (image?.icon.url) {
    return <img src={image.icon.url} alt={conversation.meta.title} style={styles.avatarImage} />;
  }
  
  if (conversation.type === 'group') {
      return <div style={styles.avatarInitials}>👥</div>
  }
  
  return <div style={styles.avatarInitials}>{initials}</div>;
};


// **********************************
// * Main ChatWidget Component
// **********************************
export const ChatWidget = ({ title, conversationlimit, widgetApi }: ChatWidgetProps): ReactElement => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // --- FALLBACK: Function to load dummy data on error ---
    const loadDummyData = () => {
      const dummyUser = { id: 'user-me', firstName: 'You', lastName: '', avatar: null };
      const dummyPartner = { id: 'user-partner', firstName: 'Alex', lastName: 'Weber', avatar: { icon: { url: 'https://i.pravatar.cc/150?u=alexweber' } } };
      
      setCurrentUser(dummyUser);
      setConversations([{
        id: 'convo-1',
        type: 'direct',
        meta: { title: 'Alex Weber' },
        partner: dummyPartner,
        lastMessage: {
          id: 'msg-2',
          senderID: 'user-partner',
          parts: [{ body: 'Sure, I will send it over shortly.' }],
          sender: dummyPartner,
          created: new Date().toISOString(),
        }
      }]);
      setError("Could not load live data. Displaying sample content.");
    };

    const fetchData = async () => {
      // Check if widgetApi and expected methods exist before trying to use them
      if (!widgetApi || typeof widgetApi.getContext !== 'function' || typeof widgetApi.get !== 'function') {
        loadDummyData();
        return;
      }
        
      try {
        setLoading('Loading...');
        setError(null);
        
        // --- FIX: Use widgetApi.getContext() to get IDs ---
        const { userId, branchId: installationId } = await widgetApi.getContext();
        if (!userId || !installationId) {
            throw new Error("Could not retrieve user or installation ID.");
        }

        const [userResponse, conversationsResponse] = await Promise.all([
          widgetApi.get<User>(`/api/users/${userId}`),
          widgetApi.get<ConversationsResponse>(`/api/installations/${installationId}/conversations?archived=false&limit=${conversationlimit || 10}`)
        ]);
        
        setCurrentUser(userResponse);
        setConversations(conversationsResponse.data);

      } catch (e: any) {
        // --- FALLBACK: Call dummy data function on any error ---
        console.error("Failed to load live chat data:", e.message);
        loadDummyData();
      } finally {
        setLoading(null);
      }
    };

    fetchData();
  }, [widgetApi, conversationlimit]);

  // Effect to fetch messages (or dummy messages) when a conversation is selected
  useEffect(() => {
    if (!selectedConversation) return;

    // --- FALLBACK: Load dummy messages if the selected conversation is a dummy one ---
    if (selectedConversation.id === 'convo-1') {
        setMessages([
            { id: 'msg-1', senderID: 'user-me', parts: [{ body: 'Hey Alex, can you send me the Q3 report?' }], sender: currentUser!, created: new Date(Date.now() - 60000 * 5).toISOString() },
            { id: 'msg-2', senderID: 'user-partner', parts: [{ body: 'Sure, I will send it over shortly.' }], sender: selectedConversation.partner!, created: new Date().toISOString() },
        ].reverse());
        return;
    }

    const fetchMessages = async () => {
      try {
        setLoading(`Loading messages...`);
        setError(null);
        const response = await widgetApi.get<MessagesResponse>(`/api/conversations/${selectedConversation.id}/messages?limit=50`);
        setMessages(response.data.reverse());
      } catch (e: any) {
        setError(`Failed to load messages: ${e.message}`);
      } finally {
        setLoading(null);
      }
    };
    fetchMessages();
  }, [selectedConversation, widgetApi, currentUser]);

  const renderConversationList = () => (
    <section>
      <header style={styles.header}>
        <h1 style={styles.headerTitle}>{title}</h1>
      </header>
      <div>
        {conversations.map((convo) => {
            const isFromCurrentUser = convo.lastMessage.senderID === currentUser?.id;
            return (
                <div key={convo.id} style={styles.convoItem} tabIndex={0} onClick={() => setSelectedConversation(convo)}>
                    <ChatAvatar conversation={convo} />
                    <div style={styles.convoDetails}>
                        <div style={styles.convoTopRow}>
                            <div style={styles.convoTitle}>{convo.meta.title}</div>
                            <div style={styles.convoTimestamp}>{formatDate(convo.lastMessage.created)}</div>
                        </div>
                        <div style={styles.convoBottomRow}>
                            <p style={styles.convoLastMessage}>
                                {isFromCurrentUser && <b>You: </b>}
                                {convo.lastMessage.parts[0]?.body}
                            </p>
                        </div>
                    </div>
                </div>
            );
        })}
      </div>
    </section>
  );

  const renderMessageView = () => {
    if (!selectedConversation) return null;
    return (
        <section style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <header style={{ ...styles.header, flexShrink: 0 }}>
                <button onClick={() => setSelectedConversation(null)} style={styles.backButton}>←</button>
                <h2 style={styles.headerTitle}>{selectedConversation.meta.title}</h2>
            </header>
            <div style={styles.messagesLog}>
                {messages.map((msg) => {
                    const isCurrentUser = msg.senderID === currentUser?.id;
                    return (
                        <div key={msg.id} style={{ ...styles.messageWrapper, alignSelf: isCurrentUser ? 'flex-end' : 'flex-start' }}>
                            {!isCurrentUser && msg.sender.avatar?.icon.url && <img src={msg.sender.avatar.icon.url} style={styles.messageAvatar} alt={msg.sender.firstName}/>}
                            <div style={{ ...styles.messageBubble, ...(isCurrentUser ? styles.currentUserBubble : styles.otherUserBubble) }}>
                                {!isCurrentUser && <b style={styles.senderName}>{msg.sender.firstName}</b>}
                                <p style={{margin: 0}}>{msg.parts[0]?.body}</p>
                                <span style={styles.messageTimestamp}>{formatDate(msg.created)}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
            <div style={styles.footer}>
                <input type="text" placeholder="Messaging not available in widget" style={styles.messageInput} disabled />
                <button style={styles.sendButton} disabled>➤</button>
            </div>
        </section>
    );
  }

  return (
    <div style={styles.container}>
      {loading && <div style={styles.centeredMessage}>{loading}</div>}
      {error && <div style={{...styles.centeredMessage, color: '#e53935', padding: '10px'}}>{error}</div>}
      {!loading && (
        selectedConversation ? renderMessageView() : renderConversationList()
      )}
    </div>
  );
};

// **********************************
// * Component Styles
// **********************************
const styles: { [key: string]: CSSProperties } = {
  container: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', border: '1px solid #e0e0e0', borderRadius: '8px', height: '500px', display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#f9f9f9' },
  header: { display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #e0e0e0', backgroundColor: 'white' },
  headerTitle: { margin: '0 0 0 8px', fontSize: '18px', fontWeight: '600' },
  centeredMessage: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#666', textAlign: 'center' },
  convoItem: { display: 'flex', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', backgroundColor: 'white' },
  avatarImage: { width: '48px', height: '48px', borderRadius: '50%', marginRight: '12px', objectFit: 'cover' },
  avatarInitials: { width: '48px', height: '48px', borderRadius: '50%', marginRight: '12px', backgroundColor: '#e0e0e0', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', color: '#555' },
  convoDetails: { flex: 1, overflow: 'hidden' },
  convoTopRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  convoTitle: { fontWeight: '600', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' },
  convoTimestamp: { fontSize: '12px', color: '#888', flexShrink: 0, marginLeft: '8px' },
  convoBottomRow: { marginTop: '4px' },
  convoLastMessage: { margin: 0, fontSize: '14px', color: '#555', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' },
  backButton: { background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', padding: '0 8px 0 0' },
  messagesLog: { flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column-reverse' },
  messageWrapper: { display: 'flex', alignItems: 'flex-end', marginBottom: '12px', maxWidth: '80%' },
  messageAvatar: { width: '32px', height: '32px', borderRadius: '50%', marginRight: '8px', objectFit: 'cover' },
  senderName: { fontWeight: 'bold', fontSize: '13px', color: '#333', marginBottom: '4px' },
  messageBubble: { padding: '8px 12px', borderRadius: '18px' },
  currentUserBubble: { backgroundColor: '#007aff', color: 'white', borderBottomRightRadius: '4px' },
  otherUserBubble: { backgroundColor: '#e5e5ea', color: 'black', borderBottomLeftRadius: '4px' },
  messageTimestamp: { fontSize: '11px', opacity: 0.7, display: 'block', textAlign: 'right', marginTop: '4px' },
  footer: { display: 'flex', padding: '8px', borderTop: '1px solid #e0e0e0', backgroundColor: 'white', flexShrink: 0 },
  messageInput: { flex: 1, border: '1px solid #ccc', borderRadius: '18px', padding: '8px 12px', fontSize: '15px', marginRight: '8px' },
  sendButton: { background: '#007aff', color: 'white', border: 'none', borderRadius: '50%', width: '36px', height: '36px', fontSize: '18px', cursor: 'pointer' },
};