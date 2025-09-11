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

// Simplified types based on API responses
export interface Post {
    id: string;
    campaignId: string;
    contents: {
        en_US: {
            title: string;
        };
    };
}

export interface PostStats {
    registeredVisits: number;
    likes: number;
    comments: number;
    shares: number;
}

export interface Campaign {
    id: string;
    title: string;
    goal: string;
    stats: {
        totalVisitsCount: number;
        totalLikesCount: number;
        totalCommentsCount: number;
    };
}

export interface CampaignAlignment {
    averageScore: number;
    participantCount: number;
    answers: Record<string, number>;
}

export interface TrafficSource {
    name: string;
    visits: number;
}

export interface UserGroup {
    name: string;
    visits: number;
}


// Final structured data for the component
export interface AnalyticsData {
    post: {
        title: string;
    };
    stats: {
        totalVisits: number;
        totalLikes: number;
        totalComments: number;
        totalShares: number;
    };
    trafficSources: TrafficSource[];
    likesBySource: {
        name: string;
        likes: number;
    }[];
    campaign: {
        title: string;
        goal: string;
        alignmentScore: number;
        participants: number;
        url: string;
    };
    topGroups: UserGroup[];
}