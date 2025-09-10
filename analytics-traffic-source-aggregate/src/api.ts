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

import { AnalyticsData, Post, PostStats, TrafficSource, Campaign, CampaignResult, Like, User, Group, ReactionsByGroup } from "./types";

const API_BASE = window.location.origin;

async function apiFetch<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText} for ${url}`);
  }
  return response.json();
}

const getPost = (postId: string) => apiFetch<Post>(`${API_BASE}/api/posts/${postId}`);
const getPostStats = (postId: string) => apiFetch<PostStats>(`${API_BASE}/api/branch/analytics/posts/stats?filter=${encodeURIComponent(`post.id eq "${postId}"`)}`);
const getPostVisits = (postId: string) => apiFetch<TrafficSource[]>(`${API_BASE}/api/branch/analytics/post/${postId}/visits?groupBy=platform,utmSource,utmMedium`);
const getCampaign = (campaignId: string) => apiFetch<Campaign>(`${API_BASE}/api/campaigns/${campaignId}`);
const getCampaignResults = (campaignId: string) => apiFetch<CampaignResult>(`${API_BASE}/api/alignment-survey/results/overall?campaignId=${campaignId}`);
const getPostLikes = (postId: string) => apiFetch<{ data: Like[] }>(`${API_BASE}/api/posts/${postId}/likes?limit=1000`);
const getUser = (userId: string) => apiFetch<User>(`${API_BASE}/api/users/${userId}`);
const getGroups = () => apiFetch<{ data: Group[] }>(`${API_BASE}/api/branch/groups?limit=1000`);

export async function getAnalyticsData(postId?: string): Promise<AnalyticsData> {
  if (!postId || postId.toLowerCase().includes("dummy")) {
    return getDummyData();
  }

  try {
    const post = await getPost(postId);
    const [stats, visits, likesResponse, groupsResponse] = await Promise.all([
      getPostStats(postId),
      getPostVisits(postId),
      getPostLikes(postId),
      getGroups(),
    ]);

    const campaign = post.campaignId ? await getCampaign(post.campaignId) : null;
    const campaignResults = post.campaignId ? await getCampaignResults(post.campaignId) : null;

    const groupMap = new Map(groupsResponse.data.map(g => [g.id, g.name]));
    const userGroupPromises = likesResponse.data.map(like => getUser(like.userID));
    const users = await Promise.all(userGroupPromises);

    const reactionsByGroup: { [key: string]: number } = {};
    users.forEach(user => {
      user.groupIDs.forEach(groupId => {
        const groupName = groupMap.get(groupId);
        if (groupName) {
          reactionsByGroup[groupName] = (reactionsByGroup[groupName] || 0) + 1;
        }
      });
    });

    const reactions: ReactionsByGroup[] = Object.entries(reactionsByGroup)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const trafficSources = Array.isArray(visits) ? visits.map(source => {
      let name = "Direct";
      if (source.utmSource && source.utmMedium) {
        name = `${source.utmSource} (${source.utmMedium})`;
      } else if (source.utmSource) {
        name = source.utmSource;
      } else if (source.utmMedium) {
        name = source.utmMedium;
      }
      name = name.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());
      return { name: `${name} - ${source.platform.toUpperCase()}`, visits: source.visits };
    }) : [];

    return {
      post: { title: post.contents.en_US.title },
      stats: {
        totalVisits: stats.registeredVisits,
        totalLikes: stats.likes,
        totalComments: stats.comments,
        totalShares: stats.shares,
      },
      trafficSources,
      reactionsByGroup: reactions,
      campaign: {
        title: campaign?.title ?? "No Campaign",
        goal: campaign?.goal ?? "This post is not part of a campaign.",
        alignmentScore: campaignResults?.averageScore ?? 0,
        participants: campaignResults?.participantCount ?? 0,
        url: campaign ? `${API_BASE}/studio/analytics/campaigns/${campaign.id}` : "#",
      },
    };
  } catch (error) {
    console.error("❗️ Failed to fetch live analytics data. Falling back to dummy data.", error);
    return getDummyData();
  }
}

export const getDummyData = (): AnalyticsData => ({
  post: { title: "Dummy Post: Our Company's Vision" },
  stats: { totalVisits: 450, totalLikes: 82, totalComments: 15, totalShares: 7 },
  trafficSources: [{ name: "Email Campaign", visits: 150 }, { name: "SharePoint", visits: 120 }, { name: "Direct", visits: 100 }, { name: "Mobile Push", visits: 80 }],
  reactionsByGroup: [{ name: "Sales Team", count: 25 }, { name: "Engineering", count: 20 }, { name: "Marketing", count: 15 }, { name: "All Staff", count: 12 }, { name: "Leadership", count: 10 }],
  campaign: { title: "Q4 All-Hands Initiative (Dummy)", goal: "To align all employees on our strategic goals for the upcoming year.", alignmentScore: 4.2, participants: 152, url: "#" },
});