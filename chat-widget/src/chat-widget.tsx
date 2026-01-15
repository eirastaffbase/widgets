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

import React, { ReactElement, useState, useEffect, CSSProperties, useRef } from "react";
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
  participantIDs?: string[];
  meta: {
    title: string;
    image?: Avatar;
  };
  lastMessage: Message;
  partner?: User;
}

interface InstallationsResponse {
    data: { id: string }[];
}

interface ConversationsResponse {
  data: Conversation[];
}

interface MessagesResponse {
  data: Message[];
}

interface LogEntry {
  timestamp: string;
  url: string;
  method: string;
  payload?: any;
  response: any;
  status: number;
  ok: boolean;
}

const API_BASE_URL = 'https://app.staffbase.com';

export interface ChatWidgetProps extends BlockAttributes {
  title: string;
  conversationlimit: number;
  apitoken: string;
  widgetApi: WidgetApi;
  debugmode: boolean | string;
  // MODIFICATION: Added dummy data prop
  dummydatajson?: string;
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
  const initials = (conversation.meta.title || '').split(' ').map(n => n[0]).slice(0, 2).join('');
  if (image?.icon.url) {
    return <img src={image.icon.url} alt={conversation.meta.title} style={styles.avatarImage} />;
  }
  
  if (conversation.type === 'group') {
      return (
        <div style={styles.groupAvatarContainer}>
          <span
            // @ts-ignore - size is a non-standard attribute required by the icon system
            size="48"
            data-testid="avatar-group"
            className="we-icon et74wq91 css-1phgycb-IconStyled-IconBase-baseAvatarStyles-IconWrap e19il6tt0"
            aria-hidden={true}
          >
            g
          </span>
        </div>
      );
  }
  
  return <div style={styles.avatarInitials}>{initials}</div>;
};

const DebugView = ({ logs }: { logs: LogEntry[] }) => (
  <div style={styles.debugContainer}>
    <h3 style={styles.debugTitle}>🐞 Debug Log</h3>
    <pre style={styles.debugPre}>
      {logs.length > 0
        ? JSON.stringify(logs, null, 2)
        : "No requests logged yet. API calls will appear here."}
    </pre>
  </div>
);


// **********************************
// * Main ChatWidget Component
// **********************************
export const ChatWidget = ({ title, conversationlimit, apitoken, debugmode, dummydatajson }: ChatWidgetProps): ReactElement => {
  const isDebugMode = debugmode === true || debugmode === 'true';

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useDummyData, setUseDummyData] = useState<boolean>(false);
  const [newMessage, setNewMessage] = useState<string>("");
  const [chatInstallationId, setChatInstallationId] = useState<string | null>(null);
  const fetchDataAttempted = useRef(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  // MODIFICATION: State to hold parsed dummy messages
  const [dummyMessageData, setDummyMessageData] = useState<{ [key: string]: Message[] }>({});

  const debugFetch = async (url: string, options?: RequestInit): Promise<Response> => {
    if (!isDebugMode) {
      return fetch(url, options);
    }
    
    const addLog = (logData: Omit<LogEntry, 'timestamp'>) => {
        setLogs(prev => [{ ...logData, timestamp: new Date().toISOString() }, ...prev]);
    };

    let payload;
    try {
      if (options?.body) {
        payload = JSON.parse(options.body as string);
      }
    } catch (e) {
      payload = "Could not parse request body";
    }

    try {
      const response = await fetch(url, options);
      const responseClone = response.clone();
      const responseData = await responseClone.json().catch(() => 'Could not parse JSON response');

      addLog({ url, method: options?.method || 'GET', payload, response: responseData, status: response.status, ok: response.ok });
      return response;
    } catch (error: any) {
      addLog({ url, method: options?.method || 'GET', payload, response: { error: error.message }, status: 0, ok: false });
      throw error;
    }
  };


  useEffect(() => {
    // MODIFICATION: loadDummyData now parses the JSON prop
    const loadDummyData = () => {
        if (!dummydatajson) {
            setError("Error: Dummy data is not configured in the widget settings.");
            setUseDummyData(true);
            return;
        }

        try {
            const data = JSON.parse(dummydatajson);
            const { currentUser: dummyUser, senders, conversations: rawConversations, messages: rawMessages } = data;

            if (!dummyUser || !senders || !rawConversations || !rawMessages) {
                throw new Error("Dummy data is missing required keys: 'currentUser', 'senders', 'conversations', 'messages'.");
            }
            
            // Re-hydrate sender and partner objects from references
            const hydratedConversations = rawConversations.map((convo: any) => {
                const hydratedConvo = { ...convo };
                if (convo.lastMessage.senderRef && senders[convo.lastMessage.senderRef]) {
                    hydratedConvo.lastMessage.sender = senders[convo.lastMessage.senderRef];
                }

                if (convo.type === 'direct' && convo.partnerRef && senders[convo.partnerRef]) {
                    hydratedConvo.partner = senders[convo.partnerRef];
                    if (hydratedConvo.partner.avatar?.icon?.url) {
                        hydratedConvo.meta.image = { icon: { url: hydratedConvo.partner.avatar.icon.url } };
                    }
                }
                return hydratedConvo;
            });
            
            // Re-hydrate senders for all messages and store them in state
            const hydratedMessages = Object.entries(rawMessages).reduce((acc, [convoId, msgList]) => {
                acc[convoId] = (msgList as any[]).map(msg => {
                    const hydratedMsg = { ...msg };
                    if (msg.senderRef && senders[msg.senderRef]) {
                        hydratedMsg.sender = senders[msg.senderRef];
                    }
                    delete hydratedMsg.senderRef;
                    return hydratedMsg;
                });
                return acc;
            }, {} as { [key: string]: Message[] });

            setDummyMessageData(hydratedMessages);
            setCurrentUser(dummyUser);
            setConversations(hydratedConversations);
            setError("Displaying customizable sample content.");
            setUseDummyData(true);

        } catch (e: any) {
            console.error("Failed to parse or process dummy data JSON:", e);
            setError(`Error in dummy data configuration: ${e.message}`);
            setUseDummyData(true);
            setConversations([]);
        }
    };

    const fetchData = async () => {
      if (fetchDataAttempted.current) return;
      fetchDataAttempted.current = true;

      try {
        setLoading('Loading...');
        setError(null);
        
        const installResponse = await debugFetch(`${API_BASE_URL}/api/plugins/chat/installations`);
        if (!installResponse.ok) throw new Error(`Failed to fetch installations: ${installResponse.statusText}`);
        const installData: InstallationsResponse = await installResponse.json();
        const foundChatId = installData.data[0]?.id;
        if (!foundChatId) throw new Error("Chat plugin installation not found.");
        setChatInstallationId(foundChatId);

        const convoResponse = await debugFetch(`${API_BASE_URL}/api/installations/${foundChatId}/conversations?archived=false&limit=${conversationlimit || 10}`);
        if (!convoResponse.ok) throw new Error(`Failed to fetch conversations: ${convoResponse.statusText}`);
        const convoData: ConversationsResponse = await convoResponse.json();
        
        if (!convoData.data || convoData.data.length === 0) {
          setConversations([]);
          return;
        }

        const participantCounts: { [id: string]: number } = {};
        convoData.data
          .filter(c => c.type === 'direct' && c.participantIDs && c.participantIDs.length > 0)
          .forEach(c => {
            c.participantIDs!.forEach(id => {
              participantCounts[id] = (participantCounts[id] || 0) + 1;
            });
          });
        
        const currentUserId = Object.keys(participantCounts).length > 0
          ? Object.keys(participantCounts).reduce((a, b) => participantCounts[a] > participantCounts[b] ? a : b)
          : null;
        
        if (!currentUserId) {
            console.warn("Could not reliably determine current user ID.");
            setCurrentUser({ id: 'unknown-user-id', firstName: 'You', lastName: '', avatar: null });
        } else {
            setCurrentUser({ id: currentUserId, firstName: 'You', lastName: '', avatar: null });
        }
        setConversations(convoData.data);

      } catch (e: any) {
        console.error("Failed to load live chat data:", e.message);
        loadDummyData();
      } finally {
        setLoading(null);
      }
    };

    fetchData();
  }, [conversationlimit, apitoken, isDebugMode, dummydatajson]);

  useEffect(() => {
    if (!selectedConversation) return;

    // MODIFICATION: Use dummyMessageData state for messages
    if (useDummyData) {
        setMessages(dummyMessageData[selectedConversation.id] || []);
        return;
    }

    const fetchMessages = async () => {
      try {
        setLoading(`Loading messages...`);
        setError(null);
        const response = await debugFetch(`${API_BASE_URL}/api/conversations/${selectedConversation.id}/messages?limit=50`);
        if (!response.ok) throw new Error(`Failed to fetch messages: ${response.statusText}`);
        const messagesData: MessagesResponse = await response.json();
        setMessages(messagesData.data);
      } catch (e: any) {
        setError(`Failed to load messages: ${e.message}`);
        setMessages([]);
      } finally {
        setLoading(null);
      }
    };

    fetchMessages();
  }, [selectedConversation, currentUser, useDummyData, isDebugMode, dummyMessageData]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !currentUser || !chatInstallationId || !apitoken) return;

    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      senderID: currentUser.id,
      parts: [{ body: newMessage.trim() }],
      sender: currentUser,
      created: new Date().toISOString(),
    };
  
    setMessages(prevMessages => [optimisticMessage, ...prevMessages]);
    const messageToSend = newMessage;
    setNewMessage("");

    const participantIDs = selectedConversation.type === 'direct' && selectedConversation.partner?.id
      ? [selectedConversation.partner.id]
      : selectedConversation.participantIDs?.filter(id => id !== currentUser.id) || [];

    const payload = {
      message: messageToSend.trim(),
      participantIDs: participantIDs,
      type: selectedConversation.type,
    };

    try {
      const response = await debugFetch(`${API_BASE_URL}/api/installations/${chatInstallationId}/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${apitoken}`,
        },
        body: JSON.stringify(payload),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send message');
      }
      
      const newConvoState = await response.json();
      console.log('Message sent, new conversation state:', newConvoState);
      
      setMessages(prev => prev.map(m => m.id === optimisticMessage.id ? { ...optimisticMessage, id: newConvoState.lastMessage.id || optimisticMessage.id } : m));

    } catch (e: any) {
      console.error("Error sending message:", e);
    }
  };
  
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const renderConversationList = () => {
    if (conversations.length === 0 && !loading) {
      return <div style={styles.centeredMessage}>No conversations found.</div>;
    }
    return (
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
  };
  
  const renderMessageView = () => {
    if (!selectedConversation) return null;
    const isMessagingDisabled = !apitoken;
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
                            {!isCurrentUser && msg.sender?.avatar?.icon?.url && <img src={msg.sender.avatar.icon.url} style={styles.messageAvatar} alt={msg.sender.firstName}/>}
                            <div style={{ ...styles.messageBubble, ...(isCurrentUser ? styles.currentUserBubble : styles.otherUserBubble) }}>
                                {!isCurrentUser && <b style={styles.senderName}>{msg.sender.firstName}</b>}
                                <p style={{margin: 0, color: 'inherit', whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>{msg.parts[0]?.body}</p>
                                <span style={styles.messageTimestamp}>{formatDate(msg.created)}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
            <div style={styles.footer}>
                <input 
                    type="text" 
                    placeholder={isMessagingDisabled ? "API token needed to send messages" : "Type a message..."}
                    style={styles.messageInput} 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isMessagingDisabled}
                />
                <button 
                    style={styles.sendButton}
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || isMessagingDisabled}
                >
                    ➤
                </button>
            </div>
        </section>
    );
  }

  const renderWidgetContent = () => {
      if (loading) {
        return <div style={styles.centeredMessage}>{loading}</div>;
      }
      
      if (error && !useDummyData) {
        return <div style={{...styles.centeredMessage, color: '#e53935', padding: '10px'}}>{error}</div>;
      }

      return (
        <div style={styles.container}>
          {selectedConversation ? renderMessageView() : renderConversationList()}
        </div>
      );
  }

  return (
    <>
      {isDebugMode && <DebugView logs={logs} />}
      {renderWidgetContent()}
    </>
  );
};

// **********************************
// * Component Styles
// **********************************
const styles: { [key: string]: CSSProperties } = {
  debugContainer: {
    border: '1px solid #ffb74d',
    backgroundColor: '#fff8e1',
    borderRadius: '8px',
    margin: '0 0 16px 0',
    padding: '8px 16px',
    maxHeight: '200px',
    overflowY: 'auto',
  },
  debugTitle: {
    marginTop: '0',
    marginBottom: '8px',
    color: '#bf360c',
    fontSize: '16px',
  },
  debugPre: {
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    fontSize: '12px',
    color: '#424242',
  },
  
  container: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', border: '1px solid #e0e0e0', borderRadius: '8px', height: '500px', display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#f9f9f9' },
  header: { display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #e0e0e0', backgroundColor: 'white' },
  headerTitle: { margin: '0 0 0 8px', fontSize: '18px', fontWeight: '600', color: '#191919', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  centeredMessage: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#666', textAlign: 'center' },
  convoItem: { display: 'flex', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', backgroundColor: 'white' },
  avatarImage: { width: '48px', height: '48px', borderRadius: '50%', marginRight: '12px', objectFit: 'cover' },
  avatarInitials: { width: '48px', height: '48px', borderRadius: '50%', marginRight: '12px', backgroundColor: '#e0e0e0', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', color: '#555' },
  groupAvatarContainer: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    marginRight: '12px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'var(--sb-brand, lightgrey)',
    color: 'var(--sb-brand-inverse, black)',
  },
  convoDetails: { flex: 1, overflow: 'hidden' },
  convoTopRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  convoTitle: { fontWeight: '600', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden', color: '#191919' },
  convoTimestamp: { fontSize: '12px', color: '#888', flexShrink: 0, marginLeft: '8px' },
  convoBottomRow: { marginTop: '4px' },
  convoLastMessage: { margin: 0, fontSize: '14px', color: '#555', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' },
  backButton: { background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', padding: '0 8px 0 0', color: '#007aff', width: '20px', margin: '0px' },
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