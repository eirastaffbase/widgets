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

// --- DUMMY DATA FUNCTION ---
// Added to ensure the component can be rendered for demonstration.
const getDummyData = (): AnalyticsData => ({
    post: {
        title: "Example Post: The Future of Remote Work",
    },
    campaign: {
        title: "Q3 Engagement Initiative",
        goal: "Increase employee interaction with internal news.",
        url: "#",
        alignmentScore: 4.25,
        participants: 123,
    },
    stats: {
        totalVisits: 8452,
        totalLikes: 1243,
        totalComments: 189,
        totalShares: 76,
    },
    trafficSources: [
        { name: 'Internal Search', visits: 3421 },
        { name: 'Homepage Feed', visits: 2501 },
        { name: 'Email Newsletter', visits: 1530 },
        { name: 'Direct Link', visits: 800 },
        { name: 'Mobile App', visits: 200 },
    ],
    topGroups: [
        { name: 'Engineering', visits: 2800 },
        { name: 'Sales - NA', visits: 1950 },
        { name: 'Marketing', visits: 1500 },
        { name: 'Human Resources', visits: 980 },
        { name: 'Support', visits: 750 },
    ],
});


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
            if (!postid) {
                // If no postid, load dummy data immediately for preview.
                setData(getDummyData());
                setLoading(false);
                return;
            }
            setLoading(true);
            setError(null);
            try {
                // This would be your actual API call.
                // const result = await getAnalyticsData(postid);
                // Forcing dummy data for this example:
                const result = getDummyData();
                setData(result);
            } catch (err) {
                setError("Failed to fetch analytics data. Displaying example data.");
                console.error(err);
                setData(getDummyData()); // Load dummy data on error
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [postid]);

    const toggleModal = () => setIsOpen(!isOpen);

    const doughnutChartData = {
        labels: data?.trafficSources.map(source => source.name) || [],
        datasets: [{
            label: "Visits",
            data: data?.trafficSources.map(source => source.visits) || [],
            backgroundColor: staffbaseColors,
            borderColor: '#ffffff',
            borderWidth: 2,
        }],
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
                font: { size: 16 }
            },
        },
    };

    const groupBarChartData = {
        labels: data?.topGroups.map(group => group.name) || [],
        datasets: [{
            label: 'Visits',
            data: data?.topGroups.map(group => group.visits) || [],
            backgroundColor: 'rgba(69, 148, 224, 0.7)',
            borderColor: '#0d51a1',
            borderWidth: 1,
        }],
    };

    const groupBarChartOptions = {
        indexAxis: 'y' as const,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            title: {
                display: true,
                text: 'Top 5 User Groups by Visits',
                font: { size: 16 }
            },
        },
        scales: {
            x: {
                beginAtZero: true,
                title: { display: true, text: 'Total Visits' }
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

                /* --- MODAL OVERLAY STYLES --- */
                .modal-overlay {
                  position: fixed;
                  top: 0;
                  left: 0;
                  width: 100%;
                  height: 100%;
                  background-color: rgba(0, 0, 0, 0.6);
                  z-index: 999;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  visibility: hidden;
                  opacity: 0;
                  transition: opacity 0.3s ease, visibility 0.3s;
                }
                .modal-overlay.open {
                  visibility: visible;
                  opacity: 1;
                }

                .analytics-modal {
                  font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif;
                  background-color: #f9f9fb;
                  border-radius: 12px;
                  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
                  z-index: 1000;
                  padding: 25px 30px;
                  box-sizing: border-box;
                  color: #333;
                  width: 90vw;
                  max-width: 950px; /* Rectangular shape */
                  transform: scale(0.95);
                  transition: transform 0.3s ease;
                }
                .modal-overlay.open .analytics-modal {
                    transform: scale(1);
                }
                
                .close-button {
                  position: absolute;
                  top: 10px;
                  right: 15px;
                  background: none;
                  border: none;
                  font-size: 32px;
                  font-weight: 300;
                  cursor: pointer;
                  color: #888;
                  line-height: 1;
                }
                .close-button:hover {
                    color: #333;
                }

                .modal-title {
                  font-size: 1.5em;
                  font-weight: 600;
                  color: #0d51a1;
                  border-bottom: 2px solid #eef0f2;
                  padding-bottom: 15px;
                  margin: 0 0 20px 0;
                }
                .modal-title em {
                  font-style: normal;
                  font-weight: 400;
                  color: #555;
                  display: block;
                  font-size: 0.7em;
                  margin-top: 4px;
                }

                /* --- MODAL CONTENT LAYOUT --- */
                .modal-content-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
                    gap: 25px;
                }

                .section {
                  background-color: #ffffff;
                  border-radius: 8px;
                  padding: 20px;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                }

                .campaign-section p { margin: 5px 0 15px; line-height: 1.5; }
                .alignment-score { margin-top: 15px; }
                .alignment-score > span { font-weight: bold; color: #2F793D; font-size: 1.2em; margin-left: 10px; }
                .score-bar-container { background: #e0e0e0; border-radius: 10px; height: 10px; margin: 8px 0; overflow: hidden; }
                .score-bar { background: #2F793D; height: 100%; border-radius: 10px; }
                .alignment-score small { color: #777; }

                .stats-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 15px;
                    margin-top: 25px;
                }
                .stat-item { text-align: center; background-color: #f9f9fb; padding: 15px; border-radius: 5px; }
                .stat-value { font-size: 2em; font-weight: 600; color: #0d51a1; }
                .stat-label { font-size: 0.9em; color: #666; }

                .chart-container {
                    height: 280px; /* Consistent height for charts */
                    position: relative;
                }

                .widget-container.loading { padding: 20px; text-align: center; color: #555; font-style: italic; }
                .error-message { background-color: #f8d7da; color: #721c24; padding: 10px; border: 1px solid #f5c6cb; border-radius: 5px; margin-bottom: 20px; }
            `}</style>
            
            <button onClick={toggleModal} className="sb-button">
                View Post Analytics
            </button>

            <div className={`modal-overlay ${isOpen ? "open" : ""}`} onClick={toggleModal}>
                <div className="analytics-modal" onClick={(e) => e.stopPropagation()}>
                    <button onClick={toggleModal} className="close-button">&times;</button>
                    {error && <div className="error-message">{error}</div>}
                    {data && (
                        <>
                            <h2 className="modal-title">
                                Post Analytics
                                <em>{data.post.title}</em>
                            </h2>
                            
                            <div className="modal-content-grid">
                                {/* --- LEFT COLUMN --- */}
                                <div className="grid-col-1">
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

                                {/* --- RIGHT COLUMN --- */}
                                <div className="grid-col-2">
                                    <div className="section">
                                        <div className="chart-container">
                                            <Bar data={groupBarChartData} options={groupBarChartOptions} />
                                        </div>
                                    </div>
                                    <div className="section">
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