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

const fetchStats = (postId: string): Promise<PostStats> => {
    // Note: The /api/posts/stats endpoint is more suitable for this filter.
    const encodedFilter = encodeURIComponent(`postId eq "${postId}"`);
    return authenticatedFetch(`${baseUrl}/api/posts/stats?filter=${encodedFilter}`);
};

const fetchVisits = (postId: string): Promise<any[]> => {
    // This endpoint seems to be incorrect in the documentation provided.
    // A more likely endpoint would be part of the rankings or a dedicated visits endpoint.
    // Using a placeholder based on the provided info, but this may need adjustment.
    return authenticatedFetch(`${baseUrl}/api/posts/rankings?filter=postId eq "${postId}"&groupBy=platform,utmSource,utmMedium`);
};

const fetchCampaign = (campaignId: string): Promise<Campaign> => {
    return authenticatedFetch(`${baseUrl}/api/campaigns/${campaignId}`);
};

const fetchAlignment = (campaignId: string): Promise<CampaignAlignment> => {
    return authenticatedFetch(`${baseUrl}/api/alignment-survey/results/overall?campaignId=${campaignId}`);
};

const fetchBranchId = async (): Promise<string> => {
    const branchInfo = await authenticatedFetch(`${baseUrl}/api/branch/discover`);
    if (!branchInfo || !branchInfo.id) {
        throw new Error("Could not determine branchId from /api/branch/discover");
    }
    return branchInfo.id;
};

const fetchAllGroups = async (): Promise<{ id: string, name: string }[]> => {
    // Fetch a large number to get all groups, adjust limit if necessary
    const groupsResponse = await authenticatedFetch(`${baseUrl}/api/branch/groups?limit=200`);
    return groupsResponse.data.map((group: any) => ({ id: group.id, name: group.name }));
};

const fetchGroupStatsForPost = (branchId: string, postId: string, groupId: string): Promise<PostStats> => {
    const encodedFilter = encodeURIComponent(`postId eq "${postId}" and groupId eq "${groupId}"`);
    return authenticatedFetch(`${baseUrl}/api/posts/stats?branchId=${branchId}&filter=${encodedFilter}`);
};

// --- HELPER & TRANSFORMATION FUNCTIONS ---

const formatTrafficSources = (visits: any[]): TrafficSource[] => {
    if (!Array.isArray(visits)) return [];
    // This assumes the ranking endpoint provides a `group` object and visit counts.
    return visits.map(v => {
        const source = v.group;
        let name = 'Direct';
        if (source.utmSource && source.utmMedium) {
            name = `${source.utmSource} (${source.utmMedium})`;
        } else if (source.utmSource) {
            name = source.utmSource;
        } else if (source.utmMedium) {
            name = source.utmMedium;
        }
        name = name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); // Capitalize
        return { name: `${name} - ${source.platform.toUpperCase()}`, visits: v.registeredVisits };
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

export const getAnalyticsData = async (postId?: string): Promise<AnalyticsData> => {
    if (!postId || postId.toLowerCase().includes("dummy")) {
        return getDummyData();
    }
    
    try {
        const branchId = await fetchBranchId();
        const allGroups = await fetchAllGroups();
        const postData = await fetchPost(postId);

        const groupStatPromises = allGroups.map(group => 
            fetchGroupStatsForPost(branchId, postId, group.id)
                .then(stats => ({
                    name: group.name,
                    visits: stats.registeredVisits || 0
                }))
                .catch(() => ({ name: group.name, visits: 0 }))
        );
        
        const [stats, visits, campaign, alignment, groupStats] = await Promise.all([
            fetchStats(postId),
            fetchVisits(postId),
            postData.campaignId ? fetchCampaign(postData.campaignId) : Promise.resolve(null),
            postData.campaignId ? fetchAlignment(postData.campaignId) : Promise.resolve(null),
            Promise.all(groupStatPromises),
        ]);

        const trafficSources = formatTrafficSources(visits);
        const likesBySource = simulateLikesBySource(stats.likes, trafficSources);
        
        const topGroups = groupStats
            .filter(group => group.visits > 0)
            .sort((a, b) => b.visits - a.visits)
            .slice(0, 5);

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
                title: campaign?.title ?? "No Campaign",
                goal: campaign?.goal ?? "This post is not part of a campaign.",
                alignmentScore: alignment?.averageScore ?? 0,
                participants: alignment?.participantCount ?? 0,
                url: campaign ? `${baseUrl}/studio/analytics/campaigns/${campaign.id}`: '#',
            },
            topGroups,
        };
    } catch (error) {
        console.error("❗️ Failed to fetch live analytics data. Falling back to dummy data.", error);
        return getDummyData();
    }
};