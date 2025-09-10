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

import { AnalyticsData, Post, PostStats, TrafficSource, Campaign, CampaignAlignment } from "./types";

// --- MOCK API RESPONSES (based on the provided cURL outputs) ---

const mockPostResponse: Post = { "id": "68bc9ad88f5c3e2b97a16845", "campaignId": "68bedd79b22cdf3ba913e654", "contents": { "en_US": { "title": "Zero Hunger | Zero Waste" } } };
const mockStatsResponse: PostStats = { "registeredVisitors": 37, "registeredVisits": 152, "comments": 2, "likes": 10, "shares": 1 };
const mockVisitsResponse: any[] = [{ "platform": "web", "utmSource": "in-app", "utmMedium": "studiolastpublished", "visits": 2 }, { "platform": "web", "utmSource": "", "utmMedium": "", "visits": 91 }, { "platform": "ios", "utmSource": "in-app", "utmMedium": "direct-link", "visits": 1 }, { "platform": "ios", "utmSource": "in-app", "utmMedium": "stagewidget", "visits": 23 }, { "platform": "web", "utmSource": "in-app", "utmMedium": "stagewidget", "visits": 35 }];
const mockCampaignResponse: Campaign = { "id": "66a3499d0f2f537068a966f3", "title": "Heroes of healthcare", "goal": "Connect Carbon 0 is an initiative to lower our carbon footprint.", "stats": { "totalVisitsCount": 888, "totalLikesCount": 165, "totalCommentsCount": 31 } };
const mockAlignmentResponse: CampaignAlignment = { "answers": { "1": 0, "2": 0, "3": 0, "4": 1, "5": 5 }, "averageScore": 4.8333335, "participantCount": 6 };

// --- MOCK API FETCH FUNCTIONS ---

const mockFetch = (data: any, delay: number = 500) => new Promise(resolve => setTimeout(() => resolve(data), delay));

const fetchPost = (postId: string) => mockFetch(mockPostResponse);
const fetchStats = (postId: string) => mockFetch(mockStatsResponse);
const fetchVisits = (postId: string) => mockFetch(mockVisitsResponse);
const fetchCampaign = (campaignId: string) => mockFetch(mockCampaignResponse);
const fetchAlignment = (campaignId: string) => mockFetch(mockAlignmentResponse);

// --- HELPER & TRANSFORMATION FUNCTIONS ---

const formatTrafficSources = (visits: any[]): TrafficSource[] => {
    return visits.map(v => {
        let name = 'Direct';
        if (v.utmSource && v.utmMedium) {
            name = `${v.utmSource} (${v.utmMedium})`;
        } else if (v.utmSource) {
            name = v.utmSource;
        } else if (v.utmMedium) {
            name = v.utmMedium;
        }
        name = name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); // Capitalize
        return { name: `${name} - ${v.platform.toUpperCase()}`, visits: v.visits };
    });
};

const simulateLikesBySource = (totalLikes: number, sources: TrafficSource[]): {name: string, likes: number}[] => {
    const totalVisits = sources.reduce((sum, s) => sum + s.visits, 0);
    if (totalVisits === 0) return sources.map(s => ({ name: s.name, likes: 0 }));

    let remainingLikes = totalLikes;
    const likesDistribution = sources.map(source => {
        const proportionalLikes = Math.round((source.visits / totalVisits) * totalLikes);
        remainingLikes -= proportionalLikes;
        return { name: source.name, likes: proportionalLikes };
    });

    // Distribute any rounding leftovers to the largest source
    if (remainingLikes !== 0 && likesDistribution.length > 0) {
        likesDistribution[0].likes += remainingLikes;
    }
    
    return likesDistribution;
};


// --- PUBLIC API FUNCTIONS ---

export const getDummyData = (): AnalyticsData => {
    const trafficSources = formatTrafficSources(mockVisitsResponse);
    return {
        post: { title: "Dummy Post: Our Company's Vision" },
        stats: { totalVisits: 450, totalLikes: 82, totalComments: 15, totalShares: 7 },
        trafficSources: [
            { name: "Email Campaign", visits: 150 },
            { name: "SharePoint", visits: 120 },
            { name: "Direct", visits: 100 },
            { name: "Mobile Push", visits: 80 },
        ],
        likesBySource: [
            { name: "Email Campaign", likes: 30 },
            { name: "SharePoint", likes: 25 },
            { name: "Direct", likes: 18 },
            { name: "Mobile Push", likes: 9 },
        ],
        campaign: {
            title: "Q4 All-Hands Initiative",
            goal: "To align all employees on our strategic goals for the upcoming year.",
            alignmentScore: 4.2,
            participants: 152,
            url: "#"
        }
    };
};

export const getAnalyticsData = async (postId?: string): Promise<AnalyticsData> => {
    if (!postId) {
        return getDummyData();
    }
    
    // Fetch all data in parallel where possible
    const postData = await fetchPost(postId) as Post;
    const [stats, visits, campaign, alignment] = await Promise.all([
        fetchStats(postId) as Promise<PostStats>,
        fetchVisits(postId) as Promise<any[]>,
        fetchCampaign(postData.campaignId) as Promise<Campaign>,
        fetchAlignment(postData.campaignId) as Promise<CampaignAlignment>
    ]);

    const trafficSources = formatTrafficSources(visits);
    const likesBySource = simulateLikesBySource(stats.likes, trafficSources);

    return {
        post: {
            title: postData.contents.en_US.title,
        },
        stats: {
            totalVisits: stats.registeredVisits,
            totalLikes: stats.likes,
            totalComments: stats.comments,
            totalShares: stats.shares,
        },
        trafficSources,
        likesBySource,
        campaign: {
            title: campaign.title,
            goal: campaign.goal,
            alignmentScore: alignment.averageScore,
            participants: alignment.participantCount,
            url: `https://connect.staffbase.com/studio/analytics/campaigns/${campaign.id}`,
        },
    };
};