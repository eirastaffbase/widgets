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

// --- LIVE API FETCH FUNCTIONS ---

const authenticatedFetch = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText} for ${url}`);
    }
    return response.json();
};

const baseUrl = window.location.origin;

const fetchPost = (postId: string): Promise<Post> => {
    return authenticatedFetch(`${baseUrl}/api/posts/${postId}`);
};

// --- MODIFIED: Reverted to the old, working endpoint for stats ---
const fetchStats = (postId: string): Promise<PostStats> => {
    const encodedFilter = encodeURIComponent(`post.id eq "${postId}"`);
    return authenticatedFetch(`${baseUrl}/api/branch/analytics/posts/stats?filter=${encodedFilter}`);
};

// --- MODIFIED: Reverted to the old, working endpoint for visits ---
const fetchVisits = (postId: string): Promise<any[]> => {
    return authenticatedFetch(`${baseUrl}/api/branch/analytics/post/${postId}/visits?groupBy=platform,utmSource,utmMedium`);
};

const fetchCampaign = (campaignId: string): Promise<Campaign> => {
    return authenticatedFetch(`${baseUrl}/api/campaigns/${campaignId}`);
};

const fetchAlignment = (campaignId: string): Promise<CampaignAlignment> => {
    return authenticatedFetch(`${baseUrl}/api/alignment-survey/results/overall?campaignId=${campaignId}`);
};

// --- UNCHANGED: New functions for Top Groups feature ---
const fetchBranchId = async (): Promise<string> => {
    const branchInfo = await authenticatedFetch(`${baseUrl}/api/branch/discover`);
    if (!branchInfo || !branchInfo.id) {
        throw new Error("Could not determine branchId from /api/branch/discover");
    }
    return branchInfo.id;
};

const fetchAllGroups = async (): Promise<{ id: string, name: string }[]> => {
    const groupsResponse = await authenticatedFetch(`${baseUrl}/api/branch/groups?limit=200`);
    return groupsResponse.data.map((group: any) => ({ id: group.id, name: group.name }));
};

const fetchGroupStatsForPost = (branchId: string, postId: string, groupId: string): Promise<PostStats> => {
    const encodedFilter = encodeURIComponent(`postId eq "${postId}" and groupId eq "${groupId}"`);
    return authenticatedFetch(`${baseUrl}/api/posts/stats?branchId=${branchId}&filter=${encodedFilter}`);
};


// --- HELPER & TRANSFORMATION FUNCTIONS ---

// --- MODIFIED: Reverted to the old helper that processes the old visits API response ---
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
        name = name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        // Note: The property is `v.visits`, not `v.registeredVisits`
        return { name: `${name} - ${v.platform.toUpperCase()}`, visits: v.visits };
    });
};

const simulateLikesBySource = (totalLikes: number, sources: TrafficSource[]): { name: string, likes: number }[] => {
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
        },
        topGroups: [
            { name: "Sales Team (Global)", visits: 125 },
            { name: "Engineering Department", visits: 98 },
            { name: "Marketing Crew", visits: 72 },
            { name: "New York Office", visits: 55 },
            { name: "Project Phoenix Team", visits: 31 },
        ],
    };
};

// --- UNCHANGED: New function for Top Groups feature ---
const getTopGroupsData = async (postId: string): Promise<{ name: string; visits: number }[]> => {
    const branchId = await fetchBranchId();
    const allGroups = await fetchAllGroups();
    const groupStatPromises = allGroups.map(group =>
        fetchGroupStatsForPost(branchId, postId, group.id)
            .then(stats => ({
                name: group.name,
                visits: stats.registeredVisits || 0
            }))
            .catch(() => ({ name: group.name, visits: 0 }))
    );
    const groupStats = await Promise.all(groupStatPromises);
    return groupStats
        .filter(group => group.visits > 0)
        .sort((a, b) => b.visits - a.visits)
        .slice(0, 5);
};

export const getAnalyticsData = async (postId?: string): Promise<AnalyticsData> => {
    if (!postId || postId.toLowerCase().includes("dummy")) {
        return getDummyData();
    }
    
    const defaultCampaign = {
        title: "No Campaign",
        goal: "This post is not part of a campaign.",
        alignmentScore: 0,
        participants: 0,
        url: '#',
    };

    const postData = await fetchPost(postId).catch(err => {
        console.error("❗️ Failed to fetch core post data. Post title will be unavailable.", err);
        return null;
    });
    const campaignId = postData?.campaignId;

    const [
        statsResult,
        visitsResult,
        campaignResult,
        alignmentResult,
        topGroupsResult
    ] = await Promise.allSettled([
        fetchStats(postId),
        fetchVisits(postId),
        campaignId ? fetchCampaign(campaignId) : Promise.resolve(null),
        campaignId ? fetchAlignment(campaignId) : Promise.resolve(null),
        getTopGroupsData(postId)
    ]);

    // Process Stats
    const stats = statsResult.status === 'fulfilled' ? statsResult.value : (console.error("❗️ Failed to fetch stats.", statsResult.reason), null);
    // The property names like `registeredVisits` are correct for the old endpoint
    const finalStats = {
        totalVisits: stats?.registeredVisits ?? 0,
        totalLikes: stats?.likes ?? 0,
        totalComments: stats?.comments ?? 0,
        totalShares: stats?.shares ?? 0,
    };

    // Process Traffic Sources & derived Likes by Source
    const visits = visitsResult.status === 'fulfilled' ? visitsResult.value : (console.error("❗️ Failed to fetch visits.", visitsResult.reason), []);
    const trafficSources = formatTrafficSources(visits);
    const likesBySource = simulateLikesBySource(finalStats.totalLikes, trafficSources);
    
    // Process Top Groups
    const topGroups = topGroupsResult.status === 'fulfilled' ? topGroupsResult.value : (console.error("❗️ Failed to fetch top groups.", topGroupsResult.reason), []);
    
    // Process Campaign Data
    const campaign = campaignResult.status === 'fulfilled' ? campaignResult.value : null;
    const alignment = alignmentResult.status === 'fulfilled' ? alignmentResult.value : null;
    if (campaignResult.status === 'rejected') console.error("❗️ Failed to fetch campaign details.", campaignResult.reason);
    if (alignmentResult.status === 'rejected') console.error("❗️ Failed to fetch campaign alignment.", alignmentResult.reason);

    const finalCampaign = campaignId && campaign
        ? {
            title: campaign.title,
            goal: campaign.goal,
            alignmentScore: alignment?.averageScore ?? 0,
            participants: alignment?.participantCount ?? 0,
            url: `${baseUrl}/studio/analytics/campaigns/${campaign.id}`,
          }
        : defaultCampaign;
        
    return {
        post: {
            title: postData?.contents.en_US.title ?? "Post Title Unavailable",
        },
        stats: finalStats,
        trafficSources,
        likesBySource,
        campaign: finalCampaign,
        topGroups,
    };
};