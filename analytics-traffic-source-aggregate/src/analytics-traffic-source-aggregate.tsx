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

import React, { ReactElement, useState, useEffect } from "react";
import { BlockAttributes } from "widget-sdk";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, Title } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { getAnalyticsData, getDummyData } from "./api"; // Mock API and dummy data
import { AnalyticsData } from "./types"; // Type definitions

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, Title);

/**
 * React Component
 */
export interface AnalyticsTrafficSourceAggregateProps extends BlockAttributes {
  postid?: string;
}

const staffbaseColors = [
  '#0d51a1', // Staffbase Blue
  '#4594E0', // Light Blue
  '#2F793D', // Green
  '#FFAF1F', // Yellow
  '#DE1320', // Red
  '#545459', // Gray
];

export const AnalyticsTrafficSourceAggregate = ({ postid }: AnalyticsTrafficSourceAggregateProps): ReactElement => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getAnalyticsData(postid);
        setData(result);
      } catch (err) {
        setError("Failed to fetch analytics data. Please check the Post ID and try again.");
        console.error(err);
        setData(getDummyData()); // Load dummy data on error for demonstration
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [postid]);

  const togglePanel = () => setIsOpen(!isOpen);
  
  const chartData = {
    labels: data?.trafficSources.map(source => source.name) || [],
    datasets: [
      {
        label: "Visits",
        data: data?.trafficSources.map(source => source.visits) || [],
        backgroundColor: staffbaseColors,
        borderColor: '#ffffff',
        borderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'right' as const,
      },
      title: {
        display: true,
        text: 'Visits by Source',
        font: {
          size: 16,
        }
      },
    },
  };

  if (loading) {
    return <div className="widget-container loading">Loading Analytics...</div>;
  }
  
  return (
    <>
      {/* --- EMBEDDED STYLES --- */}
      <style>{`
        .sb-button {
          background-color: #0d51a1;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 5px;
          font-size: 16px;
          font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif;
          cursor: pointer;
          transition: background-color 0.3s ease;
        }

        .sb-button:hover {
          background-color: #0a4183;
        }

        .analytics-panel {
          font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif;
          position: fixed;
          top: 0;
          right: 0; /* Anchor to the right edge */
          width: 450px;
          height: 100%;
          background-color: #f9f9fb;
          box-shadow: -5px 0 15px rgba(0, 0, 0, 0.1);
          z-index: 1000;
          overflow-y: auto;
          padding: 20px;
          box-sizing: border-box;
          color: #333;
          
          /* --- MODIFICATION START --- */
          visibility: hidden; /* Hide and make non-interactive */
          transform: translateX(100%); /* Move it 100% of its own width to the right */
          transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), visibility 0.4s;
          /* --- MODIFICATION END --- */
        }

        .analytics-panel.open {
          /* --- MODIFICATION START --- */
          visibility: visible; /* Show and make interactive */
          transform: translateX(0); /* Move it back to its original position */
          /* --- MODIFICATION END --- */
        }
        
        .close-button {
          position: absolute;
          top: 10px;
          right: 15px;
          background: none;
          border: none;
          font-size: 28px;
          cursor: pointer;
          color: #888;
        }

        .panel-title {
          margin-top: 20px;
          font-size: 1.4em;
          font-weight: 600;
          color: #0d51a1;
          border-bottom: 2px solid #eef0f2;
          padding-bottom: 10px;
          margin-bottom: 20px;
        }

        .panel-title em {
          font-style: normal;
          font-weight: 400;
          color: #555;
        }

        .section {
          background-color: #ffffff;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 20px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }

        .section h3 {
          font-size: 1.1em;
          margin-top: 0;
          margin-bottom: 15px;
          color: #333;
        }

        .campaign-section p {
          margin: 5px 0;
          line-height: 1.5;
        }

        .alignment-score {
          margin-top: 15px;
        }
        .alignment-score > span {
          font-weight: bold;
          color: #2F793D;
          font-size: 1.2em;
          margin-left: 10px;
        }
        .score-bar-container {
            background: #e0e0e0;
            border-radius: 10px;
            height: 10px;
            margin: 8px 0;
            overflow: hidden;
        }
        .score-bar {
            background: #2F793D;
            height: 100%;
            border-radius: 10px;
        }
        .alignment-score small {
            color: #777;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }
        .stat-item {
            text-align: center;
            background-color: #f9f9fb;
            padding: 15px;
            border-radius: 5px;
        }
        .stat-value {
            font-size: 2em;
            font-weight: 600;
            color: #0d51a1;
        }
        .stat-label {
            font-size: 0.9em;
            color: #666;
        }

        .chart-container {
            max-height: 300px;
            display: flex;
            justify-content: center;
            align-items: center;
        }

        .likes-section ul {
          list-style-type: none;
          padding: 0;
          margin: 0;
        }
        .likes-section li {
          display: flex;
          justify-content: space-between;
          padding: 10px 5px;
          border-bottom: 1px solid #eef0f2;
        }
        .likes-section li:last-child {
          border-bottom: none;
        }
        .like-count {
          font-weight: bold;
          color: #DE1320;
        }

        .widget-container.loading {
          padding: 20px;
          text-align: center;
          color: #555;
          font-style: italic;
        }
        .error-message {
          background-color: #f8d7da;
          color: #721c24;
          padding: 10px;
          border: 1px solid #f5c6cb;
          border-radius: 5px;
          margin-bottom: 20px;
        }
      `}</style>
      
      <button onClick={togglePanel} className="sb-button">
        {isOpen ? "Hide" : "Show"} Post Analytics
      </button>

      <div className={`analytics-panel ${isOpen ? "open" : ""}`}>
        <button onClick={togglePanel} className="close-button">&times;</button>
        {error && <div className="error-message">{error}</div>}
        {data && (
          <>
            <h2 className="panel-title">Analytics for: <em>{data.post.title}</em></h2>

            <div className="section campaign-section">
              <h3>🎯 Campaign Deets</h3>
              <p><strong>Campaign:</strong> <a href={data.campaign.url} target="_blank" rel="noopener noreferrer">{data.campaign.title}</a></p>
              <p><strong>Goal:</strong> {data.campaign.goal}</p>
              <div className="alignment-score">
                <strong>Alignment Score:</strong>
                <span>{data.campaign.alignmentScore.toFixed(2)} / 5</span>
                <div className="score-bar-container">
                    <div className="score-bar" style={{ width: `${(data.campaign.alignmentScore / 5) * 100}%` }}></div>
                </div>
                <small>({data.campaign.participants} participants)</small>
              </div>
            </div>

            <div className="section stats-grid">
                 <div className="stat-item">
                    <div className="stat-value">{data.stats.totalVisits.toLocaleString()}</div>
                    <div className="stat-label">Total Visits</div>
                </div>
                <div className="stat-item">
                    <div className="stat-value">{data.stats.totalLikes.toLocaleString()}</div>
                    <div className="stat-label">Total Likes</div>
                </div>
                <div className="stat-item">
                    <div className="stat-value">{data.stats.totalComments.toLocaleString()}</div>
                    <div className="stat-label">Comments</div>
                </div>
                <div className="stat-item">
                    <div className="stat-value">{data.stats.totalShares.toLocaleString()}</div>
                    <div className="stat-label">Shares</div>
                </div>
            </div>

            <div className="section chart-section">
              <div className="chart-container">
                <Doughnut data={chartData} options={chartOptions} />
              </div>
            </div>

            <div className="section likes-section">
              <h3>❤️ Likes by Source (Simulated)</h3>
              <ul>
                {data.likesBySource.map((source, index) => (
                  <li key={index}>
                    <span>{source.name}</span>
                    <span className="like-count">{source.likes.toLocaleString()} Likes</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </>
  );
};