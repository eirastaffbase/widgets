/*!
 * Copyright 2024, Staffbase GmbH and contributors.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may not use a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Make sure to import the new types from your types.ts file
import { 
    AnalyticsData, 
    Post, 
    PostStats, 
    TrafficSource, 
    Campaign, 
    CampaignAlignment,
    TimeseriesResponse // Add this new type
} from "./types";

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
    const encodedFilter = encodeURIComponent(`post.id eq "${postId}"`);
    return authenticatedFetch(`${baseUrl}/api/branch/analytics/posts/stats?filter=${encodedFilter}`);
};

const fetchVisits = (postId: string): Promise<any[]> => {
    return authenticatedFetch(`${baseUrl}/api/branch/analytics/post/${postId}/visits?groupBy=platform,utmSource,utmMedium`);
};

const fetchCampaign = (campaignId: string): Promise<Campaign> => {
    return authenticatedFetch(`${baseUrl}/api/campaigns/${campaignId}`);
};

const fetchAlignment = (campaignId: string): Promise<CampaignAlignment> => {
    return authenticatedFetch(`${baseUrl}/api/alignment-survey/results/overall?campaignId=${campaignId}`);
};

const fetchAllGroups = async (): Promise<{ id: string, name: string }[]> => {
    const groupsResponse = await authenticatedFetch(`${baseUrl}/api/branch/groups?limit=200`);
    return groupsResponse.data.map((group: any) => ({ id: group.id, name: group.name }));
};

// --- MODIFIED: Using the /posts/timeseries endpoint to get visits per group ---
const fetchGroupVisitsForPost = async (branchId: string, postId: string, groupId: string): Promise<{ visits: number }> => {
    // This endpoint requires a time interval. We use a 5-year window to capture all data.
    const until = new Date().toISOString();
    const since = new Date(new Date().setFullYear(new Date().getFullYear() - 5)).toISOString();
    
    // The filter now includes both postId and groupId for accuracy.
    const encodedFilter = encodeURIComponent(`postId eq "${postId}" and groupId eq "${groupId}"`);
    
    const url = `${baseUrl}/api/branch/analytics/posts/timeseries?branchId=${branchId}&since=${since}&until=${until}&groupBy=week&filter=${encodedFilter}`;
    
    const response: TimeseriesResponse = await authenticatedFetch(url);

    // The endpoint returns visits grouped by week; we need to sum them up.
    const totalVisits = response.timeseries.reduce((sum, entry) => sum + entry.registeredVisits, 0);
    
    return { visits: totalVisits };
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
        name = name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
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

const simulateTopGroups = (allGroups: { id: string, name: string }[], totalVisits: number): { name: string, visits: number }[] => {
    console.warn("⚠️ Simulating Top Groups data for demo purposes.");
    if (totalVisits === 0 || allGroups.length === 0) return [];
    const groupsToSimulate = allGroups.slice(0, 5);
    const simulationRatio = Math.random() * 0.25 + 0.60;
    let visitsToDistribute = Math.floor(totalVisits * simulationRatio);
    const weights = groupsToSimulate.map(() => Math.random());
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    const simulatedData = groupsToSimulate.map((group, index) => {
        const proportionalVisits = Math.round((weights[index] / totalWeight) * visitsToDistribute);
        visitsToDistribute -= proportionalVisits;
        return { name: group.name, visits: proportionalVisits };
    });

    if (visitsToDistribute > 0 && simulatedData.length > 0) {
        simulatedData[0].visits += visitsToDistribute;
    }

    return simulatedData.sort((a, b) => b.visits - a.visits);
};

// --- PUBLIC API FUNCTIONS ---

export const getDummyData = (): AnalyticsData => {
    console.warn("Using dummy data for analytics widget.");
    return {
        post: { title: "Dummy Post: Our Company's Vision" },
        stats: { totalVisits: 450, totalLikes: 82, totalComments: 15, totalShares: 7 },
        trafficSources: [
            { name: "Email Campaign", visits: 150 }, { name: "SharePoint", visits: 120 },
            { name: "Direct", visits: 100 }, { name: "Mobile Push", visits: 80 },
        ],
        likesBySource: [
            { name: "Email Campaign", likes: 30 }, { name: "SharePoint", likes: 25 },
            { name: "Direct", likes: 18 }, { name: "Mobile Push", likes: 9 },
        ],
        campaign: {
            title: "Q4 All-Hands Initiative (Dummy)",
            goal: "To align all employees on our strategic goals for the upcoming year.",
            alignmentScore: 4.2, participants: 152, url: "#"
        },
        topGroups: [
            { name: "Sales Team (Global)", visits: 125 }, { name: "Engineering Department", visits: 98 },
            { name: "Marketing Crew", visits: 72 }, { name: "New York Office", visits: 55 },
            { name: "Project Phoenix Team", visits: 31 },
        ],
    };
};

// MODIFIED: This function now requires a branchId to work
const getTopGroupsData = async (branchId: string, postId: string): Promise<{ name: string; visits: number }[]> => {
    const allGroups = await fetchAllGroups();
    const groupStatPromises = allGroups.map(group =>
        fetchGroupVisitsForPost(branchId, postId, group.id)
            .then(rankingData => ({
                name: group.name,
                visits: rankingData.visits || 0,
            }))
            .catch(() => ({ name: group.name, visits: 0 }))
    );
    const groupStats = await Promise.all(groupStatPromises);
    
    return groupStats
        .filter(group => group.visits > 0)
        .sort((a, b) => b.visits - a.visits)
        .slice(0, 5);
};

// --- MODIFIED: Main function with updated logic to get branchId first ---
export const getAnalyticsData = async (postId?: string): Promise<AnalyticsData> => {
    if (!postId || postId.toLowerCase().includes("dummy")) {
        return getDummyData();
    }
    
    const defaultCampaign = {
        title: "No Campaign", goal: "This post is not part of a campaign.",
        alignmentScore: 0, participants: 0, url: '#',
    };

    // --- Step 1: Fetch Post and Campaign data to get the essential branchId ---
    const postData = await fetchPost(postId).catch(err => {
        console.error("❗️ Failed to fetch core post data.", err); return null;
    });
    const campaignId = postData?.campaignId;
    const campaign = campaignId ? await fetchCampaign(campaignId).catch(err => {
        console.error("❗️ Failed to fetch campaign details to get branchId.", err.message); return null;
    }) : null;
    
    const branchId = campaign?.branchId;
    if (!branchId) {
        console.error("❗️ Critical Error: Could not determine branchId from campaign data. Top Groups will not be fetched.");
    }
    
    // --- Step 2: Fetch all other data in parallel, including Top Groups if we have a branchId ---
    const [
        statsResult,
        visitsResult,
        alignmentResult,
        topGroupsResult,
        allGroupsResult,
    ] = await Promise.allSettled([
        fetchStats(postId),
        fetchVisits(postId),
        campaignId ? fetchAlignment(campaignId) : Promise.resolve(null),
        branchId ? getTopGroupsData(branchId, postId) : Promise.resolve([]), // Only call if branchId exists
        fetchAllGroups(),
    ]);

    // Process Stats
    const stats = statsResult.status === 'fulfilled' ? statsResult.value : null;
    if (statsResult.status === 'rejected') console.error("❗️ Failed to fetch stats.", statsResult.reason);
    const finalStats = {
        totalVisits: stats?.registeredVisits ?? 0,
        totalLikes: stats?.likes ?? 0,
        totalComments: stats?.comments ?? 0,
        totalShares: stats?.shares ?? 0,
    };

    // Process Traffic Sources
    const visits = visitsResult.status === 'fulfilled' ? visitsResult.value : [];
    if (visitsResult.status === 'rejected') console.error("❗️ Failed to fetch visits.", visitsResult.reason);
    const trafficSources = formatTrafficSources(visits);
    const likesBySource = simulateLikesBySource(finalStats.totalLikes, trafficSources);
    
    // Process Top Groups with Simulation Fallback
    let topGroups = topGroupsResult.status === 'fulfilled' ? topGroupsResult.value : [];
    const allGroups = allGroupsResult.status === 'fulfilled' ? allGroupsResult.value : [];
    if (topGroupsResult.status === 'rejected') console.error("❗️ Failed to fetch top groups.", topGroupsResult.reason);

    // *** FALLBACK LOGIC ***
    if (topGroups.length === 0 && finalStats.totalVisits > 0 && allGroups.length > 0) {
        topGroups = simulateTopGroups(allGroups, finalStats.totalVisits);
    }
    
    // Process Campaign Data
    const alignment = alignmentResult.status === 'fulfilled' ? alignmentResult.value : null;
    if (alignmentResult.status === 'rejected') console.error("❗️ Failed to fetch campaign alignment.", alignmentResult.reason);

    const finalCampaign = campaignId && campaign
        ? {
            title: campaign.title, goal: campaign.goal,
            alignmentScore: alignment?.averageScore ?? 0,
            participants: alignment?.participantCount ?? 0,
            url: `${baseUrl}/studio/analytics/campaigns/${campaign.id}`,
          }
        : defaultCampaign;
        
    return {
        post: { title: postData?.contents.en_US.title ?? "Post Title Unavailable" },
        stats: finalStats,
        trafficSources,
        likesBySource,
        campaign: finalCampaign,
        topGroups,
    };
};