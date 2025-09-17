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

const baseUrl = window.location.origin;

// --- API FETCH FUNCTIONS ---

// Helper to handle authenticated requests and potential errors
const authenticatedFetch = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText} for ${url}`);
    }
    return response;
};

// Fetches the raw event stream for a given email and time range
const streamEmailEvents = async (emailId: string, since: string, until: string): Promise<EmailEvent[]> => {
    const url = `${baseUrl}/api/email-performance/${emailId}/events?since=${since}&until=${until}`;
    const response = await authenticatedFetch(url);
    const textData = await response.text();
    
    // The API returns newline-separated JSON objects. Split and parse them.
    return textData
        .split('\n')
        .filter(line => line.trim() !== '')
        .map(line => JSON.parse(line));
};

// Fetches a user's public profile. A simple cache is used to avoid redundant requests.
const userProfileCache = new Map<string, UserProfile>();
const fetchUserProfile = async (userId: string): Promise<UserProfile> => {
    if (userProfileCache.has(userId)) {
        return userProfileCache.get(userId)!;
    }
    const url = `${baseUrl}/api/profiles/public/${userId}`;
    const response = await authenticatedFetch(url);
    const user = await response.json();
    userProfileCache.set(userId, user);
    return user;
};

// --- DATA PROCESSING & AGGREGATION ---

const processEvents = async (events: EmailEvent[]): Promise<RecipientInteraction[]> => {
    if (!events || events.length === 0) {
        return [];
    }

    // Group events by user ID
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

    // Fetch all unique user profiles in parallel
    const uniqueUserIds = Array.from(eventsByUser.keys());
    const userProfiles = await Promise.all(
      uniqueUserIds.map(id => fetchUserProfile(id).catch(() => null))
    );
    const userProfileMap = new Map(userProfiles.filter(p => p).map(p => [p!.id, p!]));

    const recipientInteractions: RecipientInteraction[] = [];

    // Process events for each user
    for (const [userId, userEvents] of eventsByUser.entries()) {
        const userProfile = userProfileMap.get(userId);
        if (!userProfile) continue; // Skip if user profile couldn't be fetched

        // Sort events chronologically to process them in order
        userEvents.sort((a, b) => new Date(a.eventTime).getTime() - new Date(b.eventTime).getTime());

        const interaction: RecipientInteraction = {
            user: userProfile,
            wasSent: false,
            wasOpened: false,
            opens: [],
        };

        let lastOpenDetail: OpenDetail | null = null;

        for (const event of userEvents) {
            switch (event.eventType) {
                case "sent":
                    interaction.wasSent = true;
                    break;
                case "open":
                    interaction.wasOpened = true;
                    // Create a new entry for this specific open event
                    lastOpenDetail = { openTime: event.eventTime, clicks: [] };
                    interaction.opens.push(lastOpenDetail);
                    break;
                case "click":
                    // Associate this click with the most recent open event
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
    
    // Sort by last name for a consistent display order
    return recipientInteractions.sort((a, b) => a.user.lastName.localeCompare(b.user.lastName));
};

// --- DUMMY DATA FOR DEMO/FALLBACK ---

export const getDummyData = (): RecipientInteraction[] => {
    console.warn("Using dummy data for email performance widget.");
    return [
        {
            user: { id: "dummy1", firstName: "Alex", lastName: "Ray", avatarUrl: "https://app.staffbase.com/api/media/secure/external/v2/image/upload/c_crop,w_495,h_495,y_2/c_fill,w_200,h_200/682b8d6072207c18b1c5568e.jpg" },
            wasSent: true,
            wasOpened: true,
            opens: [
                {
                    openTime: "2025-09-16T10:05:11Z",
                    clicks: [
                        { clickTime: "2025-09-16T10:05:15Z", targetUrl: "https://www.staffbase.com/blog/" },
                        { clickTime: "2025-09-16T10:05:20Z", targetUrl: "https://www.staffbase.com/about-us/" }
                    ]
                },
                {
                    openTime: "2025-09-17T11:00:00Z",
                    clicks: []
                }
            ]
        },
        {
            user: { id: "dummy2", firstName: "Eira", lastName: "Topé", avatarUrl: "https://app.staffbase.com/api/media/secure/external/v2/image/upload/c_crop,w_495,h_495,y_2/c_fill,w_200,h_200/682b8d6072207c18b1c5568e.jpg" },
            wasSent: true,
            wasOpened: true,
            opens: [
                { openTime: "2025-09-15T14:30:00Z", clicks: [] }
            ]
        },
        {
            user: { id: "dummy3", firstName: "Sam", lastName: "Jones", avatarUrl: "https://app.staffbase.com/api/media/secure/external/v2/image/upload/c_crop,w_495,h_495,y_2/c_fill,w_200,h_200/682b8d6072207c18b1c5568e.jpg" },
            wasSent: true,
            wasOpened: false,
            opens: []
        }
    ];
};

// --- PUBLIC API FUNCTION FOR THE COMPONENT ---

export const getEmailPerformanceData = async (emailId: string | undefined, since: string, until: string): Promise<RecipientInteraction[]> => {
    if (!emailId || emailId.toLowerCase().includes("dummy")) {
        return getDummyData();
    }
    
    try {
        const events = await streamEmailEvents(emailId, since, until);
        if (events.length === 0) {
            console.log("No events found for this email in the selected time range.");
            return []; // Return empty array if no events, component will show a message
        }
        return processEvents(events);
    } catch (error) {
        console.error("❗️ Failed to get email performance data, returning dummy data as fallback.", error);
        return getDummyData();
    }
};