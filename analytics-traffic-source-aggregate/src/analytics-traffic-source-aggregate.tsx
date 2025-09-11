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

import { Chart as ChartJS, ArcElement, Tooltip, Legend, Title, CategoryScale, LinearScale, BarElement } from "chart.js";
import { Doughnut, Bar } from "react-chartjs-2";
import { getAnalyticsData } from "./api";
import { AnalyticsData } from "./types";

ChartJS.register(ArcElement, Tooltip, Legend, Title, CategoryScale, LinearScale, BarElement);

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
    
    const doughnutChartData = {
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

    const doughnutChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
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

    const groupBarChartData = {
        labels: data?.topGroups.map(group => group.name) || [],
        datasets: [
            {
                label: 'Visits',
                data: data?.topGroups.map(group => group.visits) || [],
                backgroundColor: 'rgba(69, 148, 224, 0.7)',
                borderColor: '#0d51a1',
                borderWidth: 1,
            },
        ],
    };

    const groupBarChartOptions = {
        indexAxis: 'y' as const,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false,
            },
            title: {
                display: true,
                text: 'Top 5 User Groups by Visits',
                font: { size: 16 }
            },
        },
        scales: {
            x: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Total Visits'
                }
            },
        },
    };

    if (loading) {
        return <div className="widget-container loading">Loading Analytics...</div>;
    }
    
    return (
        <>
            {/* --- REFACTORED STYLES --- */}
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

                /* -- Modal Overlay & Container -- */
                .analytics-modal-overlay {
                  position: fixed;
                  top: 0;
                  left: 0;
                  width: 100vw;
                  height: 100vh;
                  background-color: rgba(0, 0, 0, 0.6);
                  z-index: 999;
                  opacity: 0;
                  visibility: hidden;
                  transition: opacity 0.3s ease, visibility 0.3s ease;
                }
                
                .analytics-modal-overlay.open {
                  opacity: 1;
                  visibility: visible;
                }

                .analytics-modal {
                  font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif;
                  position: fixed;
                  top: 10vh; /* Position towards the top */
                  left: 50%;
                  transform: translateX(-50%) scale(0.95);
                  width: 90vw;
                  max-width: 950px; /* Rectangular shape */
                  height: auto; /* No scrolling */
                  background-color: #f9f9fb;
                  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
                  border-radius: 12px;
                  z-index: 1000;
                  padding: 25px 30px 30px;
                  box-sizing: border-box;
                  color: #333;
                  opacity: 0;
                  visibility: hidden;
                  transition: opacity 0.3s ease, transform 0.3s ease, visibility 0.3s ease;
                }

                .analytics-modal.open {
                  opacity: 1;
                  visibility: visible;
                  transform: translateX(-50%) scale(1);
                }
                
                .close-button {
                  position: absolute;
                  top: 12px;
                  left: 12px; /* Positioned top left */
                  background: #eef0f2;
                  border: none;
                  font-size: 16px; /* Tiny */
                  font-weight: bold;
                  cursor: pointer;
                  color: #555;
                  width: 28px;
                  height: 28px;
                  border-radius: 50%; /* Circular shape */
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  line-height: 1;
                  transition: background-color 0.2s, color 0.2s;
                }
                
                .close-button:hover {
                    background-color: #dfe3e6;
                    color: #111;
                }

                /* -- Modal Content & Layout -- */
                .modal-title {
                  text-align: center;
                  font-size: 1.5em;
                  font-weight: 600;
                  color: #0d51a1;
                  padding-bottom: 10px;
                  margin-bottom: 25px;
                  margin-top: 10px;
                  border-bottom: 2px solid #eef0f2;
                }

                .modal-title em {
                  font-style: normal;
                  font-weight: 400;
                  color: #555;
                }
                
                .modal-content-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
                    gap: 25px;
                    align-items: stretch;
                }
                
                .grid-column {
                    display: flex;
                    flex-direction: column;
                    gap: 25px;
                }

                .section {
                  background-color: #ffffff;
                  border-radius: 8px;
                  padding: 20px;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                  flex-grow: 1; /* Helps sections in a column be of similar height */
                }

                .section h3 {
                  font-size: 1.2em;
                  margin-top: 0;
                  margin-bottom: 15px;
                  color: #333;
                }

                /* -- Specific Section Styles -- */
                .campaign-section p { margin: 5px 0; line-height: 1.5; }
                .alignment-score { margin-top: 15px; }
                .alignment-score > span { font-weight: bold; color: #2F793D; font-size: 1.2em; margin-left: 10px; }
                .score-bar-container { background: #e0e0e0; border-radius: 10px; height: 10px; margin: 8px 0; overflow: hidden; }
                .score-bar { background: #2F793D; height: 100%; border-radius: 10px; }
                .alignment-score small { color: #777; }

                .stats-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 15px;
                    padding: 20px;
                }
                .stat-item { text-align: center; background-color: #f9f9fb; padding: 15px; border-radius: 5px; }
                .stat-value { font-size: 2em; font-weight: 600; color: #0d51a1; }
                .stat-label { font-size: 0.9em; color: #666; }

                .chart-container, .bar-chart-container {
                    height: 280px; /* Standardized height for grid alignment */
                    position: relative;
                }

                .widget-container.loading { padding: 20px; text-align: center; color: #555; font-style: italic; }
                .error-message { background-color: #f8d7da; color: #721c24; padding: 15px; border: 1px solid #f5c6cb; border-radius: 8px; margin-bottom: 20px; text-align: center; }
            `}</style>
            
            <button onClick={togglePanel} className="sb-button">
                {isOpen ? "Hide" : "Show"} Post Analytics
            </button>
            
            {/* -- REFACTORED LAYOUT -- */}
            <div className={`analytics-modal-overlay ${isOpen ? "open" : ""}`} onClick={togglePanel}>
                <div className={`analytics-modal ${isOpen ? "open" : ""}`} onClick={(e) => e.stopPropagation()}>
                    <button onClick={togglePanel} className="close-button">&times;</button>
                    {error && <div className="error-message">{error}</div>}
                    {data && (
                        <>
                            <h2 className="modal-title">Analytics for: <em>{data.post.title}</em></h2>

                            <div className="modal-content-grid">
                                <div className="grid-column">
                                    <div className="section campaign-section">
                                        <h3>🎯 Campaign Details</h3>
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
                                </div>

                                <div className="grid-column">
                                    <div className="section chart-section">
                                        <div className="bar-chart-container">
                                            <Bar data={groupBarChartData} options={groupBarChartOptions} />
                                        </div>
                                    </div>
                                    <div className="section chart-section">
                                        <div className="chart-container">
                                            <Doughnut data={doughnutChartData} options={doughnutChartOptions} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    );
};