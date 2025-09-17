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

import { EmailEvent, UserProfile, RecipientInteraction, OpenDetail } from "./types";

// --- REMOVED: `const baseUrl = window.location.origin;` ---

// --- API FETCH FUNCTIONS ---

const authenticatedFetch = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText} for ${url}`);
    }
    return response;
};

// --- MODIFIED: Now accepts a domain parameter ---
const streamEmailEvents = async (domain: string, emailId: string, since: string, until: string): Promise<EmailEvent[]> => {
    const baseUrl = `https://${domain}`;
    const url = `${baseUrl}/api/email-performance/${emailId}/events?since=${since}&until=${until}`;
    const response = await authenticatedFetch(url);
    const textData = await response.text();
    
    return textData
        .split('\n')
        .filter(line => line.trim() !== '')
        .map(line => JSON.parse(line));
};

const userProfileCache = new Map<string, UserProfile>();
// --- MODIFIED: Now accepts a domain parameter ---
const fetchUserProfile = async (domain: string, userId: string): Promise<UserProfile> => {
    if (userProfileCache.has(userId)) {
        return userProfileCache.get(userId)!;
    }
    const baseUrl = `https://${domain}`;
    const url = `${baseUrl}/api/profiles/public/${userId}`;
    const response = await authenticatedFetch(url);
    const user = await response.json();
    userProfileCache.set(userId, user);
    return user;
};

// --- DATA PROCESSING & AGGREGATION ---

// --- MODIFIED: Now accepts a domain parameter to pass it down ---
const processEvents = async (domain: string, events: EmailEvent[]): Promise<RecipientInteraction[]> => {
    if (!events || events.length === 0) {
        return [];
    }

    const eventsByUser = new Map<string, EmailEvent[]>();
    for (const event of events) {
        const userIdMatch = event.eventSubject.match(/user\/(.*)/);
        if (userIdMatch && userIdMatch[1]) {
            const userId = userIdMatch[1];
            if (!eventsByUser.has(userId)) {
                eventsByUser.set(userId, []);
            }
            eventsByUser.get(userId)!.push(event);
        }
    }

    const uniqueUserIds = Array.from(eventsByUser.keys());
    const userProfiles = await Promise.all(
      // --- MODIFIED: Pass domain to fetchUserProfile ---
      uniqueUserIds.map(id => fetchUserProfile(domain, id).catch(() => null))
    );
    const userProfileMap = new Map(userProfiles.filter(p => p).map(p => [p!.id, p!]));

    const recipientInteractions: RecipientInteraction[] = [];

    for (const [userId, userEvents] of eventsByUser.entries()) {
        const userProfile = userProfileMap.get(userId);
        if (!userProfile) continue;

        userEvents.sort((a, b) => new Date(a.eventTime).getTime() - new Date(b.eventTime).getTime());

        const interaction: RecipientInteraction = {
            user: userProfile,
            sentTime: null,
            wasOpened: false,
            opens: [],
        };

        let lastOpenDetail: OpenDetail | null = null;

        for (const event of userEvents) {
            switch (event.eventType) {
                case "sent":
                    interaction.sentTime = event.eventTime;
                    break;
                case "open":
                    interaction.wasOpened = true;
                    lastOpenDetail = { openTime: event.eventTime, clicks: [] };
                    interaction.opens.push(lastOpenDetail);
                    break;
                case "click":
                    if (lastOpenDetail && event.eventTarget) {
                        lastOpenDetail.clicks.push({
                            clickTime: event.eventTime,
                            targetUrl: event.eventTarget,
                        });
                    }
                    break;
            }
        }
        recipientInteractions.push(interaction);
    }
    
    return recipientInteractions.sort((a, b) => a.user.lastName.localeCompare(b.user.lastName));
};

// --- DUMMY DATA (Unchanged) ---
export const getDummyData = (): RecipientInteraction[] => {
    console.warn("Using dummy data for email performance widget.");
    return [
        {
            user: { id: "dummy1", firstName: "Nicole", lastName: "Adams", avatarUrl: "https://cdn.prod.website-files.com/65b3b9f9bfb500445a7573e5/65dda761c0fad5c4f2e3b9ae_OGS%20Female%20Student.png" },
            sentTime: "2025-09-16T10:05:01Z",
            wasOpened: true,
            opens: [
                { openTime: "2025-09-16T10:05:11Z", clicks: [{ clickTime: "2025-09-16T10:05:15Z", targetUrl: "https://www.staffbase.com/blog/" }, { clickTime: "2025-09-16T10:05:20Z", targetUrl: "https://www.staffbase.com/about-us/" }] },
                { openTime: "2025-09-17T11:00:00Z", clicks: [] }
            ]
        },
        {
            user: { id: "dummy2", firstName: "Eira", lastName: "Topé", avatarUrl: "https://media.licdn.com/dms/image/v2/D4E03AQFzOrVUvcipug/profile-displayphoto-shrink_200_200/profile-displayphoto-shrink_200_200/0/1679787786926?e=2147483647&v=beta&t=Z9nIwWi1aQ3hdCDfdIwPL4PnHbiFvKNcZO_qxBbgRbU" },
            sentTime: "2025-09-15T14:29:55Z",
            wasOpened: true,
            opens: [{ openTime: "2025-09-15T14:30:00Z", clicks: [] }]
        },
        {
            user: { id: "dummy3", firstName: "Jean", lastName: "Kirstein", avatarUrl: "" },
            sentTime: "2025-09-14T09:00:10Z",
            wasOpened: false,
            opens: []
        }
    ];
};

// --- PUBLIC API FUNCTION FOR THE COMPONENT ---

// --- MODIFIED: Signature changed to accept domain first ---
export const getEmailPerformanceData = async (emailId: string | undefined, domain: string, since: string, until: string): Promise<RecipientInteraction[]> => {
    if (!emailId || emailId.toLowerCase().includes("dummy")) {
        return getDummyData();
    }
    
    try {
        // --- MODIFIED: Pass domain in correct order ---
        const events = await streamEmailEvents(domain, emailId, since, until);
        if (events.length === 0) {
            console.log("No events found for this email in the selected time range.");
            return [];
        }
        // --- MODIFIED: Pass domain to processEvents ---
        return processEvents(domain, events);
    } catch (error) {
        console.error("❗️ Failed to get email performance data, returning dummy data as fallback.", error);
        return getDummyData();
    }
};