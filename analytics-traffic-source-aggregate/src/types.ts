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

export interface Post {
  contents: { en_US: { title: string } };
  campaignId?: string;
}

export interface PostStats {
  registeredVisits: number;
  likes: number;
  comments: number;
  shares: number;
}

export interface TrafficSource {
  platform: string;
  utmSource: string | null;
  utmMedium: string | null;
  visits: number;
}

export interface Campaign {
  id: string;
  title: string;
  goal: string;
}

export interface CampaignResult {
  averageScore: number;
  participantCount: number;
}

export interface Like { userID: string; }
export interface User { groupIDs: string[]; }
export interface Group { id: string; name: string; }
export interface ReactionsByGroup { name: string; count: number; }

export interface AnalyticsData {
  post: { title: string };
  stats: { totalVisits: number; totalLikes: number; totalComments: number; totalShares: number };
  trafficSources: { name: string; visits: number }[];
  reactionsByGroup: ReactionsByGroup[];
  campaign: { title: string; goal: string; alignmentScore: number; participants: number; url: string };
}