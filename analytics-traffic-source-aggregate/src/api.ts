/*!
 * Copyright 2024, Staffbase GmbH and contributors.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may not-use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { AnalyticsData, Post, PostStats, TrafficSource, Campaign, CampaignAlignment } from "./types";

// --- LIVE API FETCH FUNCTIONS ---

// This helper function makes a real API call and handles errors.
// It relies on the browser automatically sending the necessary authentication cookies.
const authenticatedFetch = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    // This error will be caught by our main function, triggering the fallback to dummy data.
    throw new Error(`API request failed: ${response.status} ${response.statusText} for ${url}`);
  }
  return response.json();
};

// Get the base URL dynamically from the browser's current location.
const baseUrl = window.location.origin;

const fetchPost = (postId: string): Promise<Post> => {
  return authenticatedFetch(`${baseUrl}/api/posts/${postId}`);
};

const fetchStats = (postId: string): Promise<PostStats> => {
  const encodedFilter = encodeURIComponent(`post.id eq "${postId}"`);
  return authenticatedFetch(`${baseUrl}/api/branch/analytics/posts/stats?filter=${encodedFilter}`);
};

const fetchVisits = (postId:string): Promise<any[]> => {
    return authenticatedFetch(`${baseUrl}/api/branch/analytics/post/${postId}/visits?groupBy=platform,utmSource,utmMedium`);
};

const fetchCampaign = (campaignId: string): Promise<Campaign> => {
    return authenticatedFetch(`${baseUrl}/api/campaigns/${campaignId}`);
};

const fetchAlignment = (campaignId: string): Promise<CampaignAlignment> => {
    return authenticatedFetch(`${baseUrl}/api/alignment-survey/results/overall?campaignId=${campaignId}`);
};

// --- HELPER & TRANSFORMATION FUNCTIONS (Unchanged) ---

const formatTrafficSources = (visits: any[]): TrafficSource[] => {
    if (!Array.isArray(visits)) return [];
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

    if (remainingLikes !== 0 && likesDistribution.length > 0) {
        likesDistribution.sort((a, b) => b.likes - a.likes)[0].likes += remainingLikes;
    }
    
    return likesDistribution;
};


// --- PUBLIC API FUNCTIONS ---

export const getDummyData = (): AnalyticsData => {
    console.warn("Using dummy data for analytics widget.");
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
            title: "Q4 All-Hands Initiative (Dummy)",
            goal: "To align all employees on our strategic goals for the upcoming year.",
            alignmentScore: 4.2,
            participants: 152,
            url: "#"
        }
    };
};

export const getAnalyticsData = async (postId?: string): Promise<AnalyticsData> => {
    // Use dummy data if the post ID is missing or contains the word "dummy"
    if (!postId || postId.toLowerCase().includes("dummy")) {
        return getDummyData();
    }
    
    try {
        // Fetch all data, allowing some requests to run in parallel
        const postData = await fetchPost(postId);
        
        const [stats, visits, campaign, alignment] = await Promise.all([
            fetchStats(postId),
            fetchVisits(postId),
            // Only fetch campaign data if an ID exists
            postData.campaignId ? fetchCampaign(postData.campaignId) : Promise.resolve(null),
            postData.campaignId ? fetchAlignment(postData.campaignId) : Promise.resolve(null),
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
                // Handle cases where there is no campaign
                title: campaign?.title ?? "No Campaign",
                goal: campaign?.goal ?? "This post is not part of a campaign.",
                alignmentScore: alignment?.averageScore ?? 0,
                participants: alignment?.participantCount ?? 0,
                url: campaign ? `${baseUrl}/studio/analytics/campaigns/${campaign.id}`: '#',
            },
        };
    } catch (error) {
        console.error("❗️ Failed to fetch live analytics data. Falling back to dummy data.", error);
        // If any API call fails, we catch the error here and return the dummy data set.
        return getDummyData();
    }
};