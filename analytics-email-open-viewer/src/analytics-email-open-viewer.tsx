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
import { getEmailPerformanceData } from "./api";
import { RecipientInteraction } from "./types";

// Helper function to format ISO date string to YYYY-MM-DD for input fields
const toInputDateString = (date: Date): string => {
    return date.toISOString().split('T')[0];
};

// Helper function to format date-time for display
const formatDisplayDateTime = (isoString: string): string => {
    return new Date(isoString).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};

export interface AnalyticsEmailOpenViewerProps extends BlockAttributes {
  emailid?: string;
}

// --- NEW: Fallback SVG component for users without an avatar ---
const DefaultAvatarIcon = ({ className }: { className?: string }) => (
    <div className={`${className} user-avatar-placeholder`}>
        <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 18 18">
            <path fill="#B0B0B0" d="M9 0a9 9 0 0 0-9 9 8.654 8.654 0 0 0 .05.92 9 9 0 0 0 17.9 0A8.654 8.654 0 0 0 18 9a9 9 0 0 0-9-9zm5.42 13.42c-.01 0-.06.08-.07.08a6.975 6.975 0 0 1-10.7 0c-.01 0-.06-.08-.07-.08a.512.512 0 0 1-.09-.27.522.522 0 0 1 .34-.48c.74-.25 1.45-.49 1.65-.54a.16.16 0 0 1 .03-.13.49.49 0 0 1 .43-.36l1.27-.1a2.077 2.077 0 0 0-.19-.79v-.01a2.814 2.814 0 0 0-.45-.78 3.83 3.83 0 0 1-.79-2.38A3.38 3.38 0 0 1 8.88 4h.24a3.38 3.38 0 0 1 3.1 3.58 3.83 3.83 0 0 1-.79 2.38 2.814 2.814 0 0 0-.45.78v.01a2.077 2.077 0 0 0-.19.79l1.27.1a.49.49 0 0 1 .43.36.16.16 0 0 1 .03.13c.2.05.91.29 1.65.54a.49.49 0 0 1 .25.75z"/>
        </svg>
    </div>
);

const RecipientRow = ({ interaction }: { interaction: RecipientInteraction }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <>
            <tr className="recipient-row" onClick={() => setIsExpanded(!isExpanded)}>
                <td>
                    <div className="user-info">
                        {/* --- MODIFIED: Conditional rendering for the avatar --- */}
                        {interaction.user.avatarUrl ? (
                            <img src={interaction.user.avatarUrl} alt={`${interaction.user.firstName} ${interaction.user.lastName}`} className="user-avatar" />
                        ) : (
                            <DefaultAvatarIcon className="user-avatar" />
                        )}
                        <span>{interaction.user.firstName} {interaction.user.lastName}</span>
                    </div>
                </td>
                <td>
                    <div className="status-cell">
                        {interaction.wasOpened ? (
                            <span className="status-badge opened">Opened</span>
                        ) : interaction.wasSent ? (
                            <span className="status-badge sent">Sent</span>
                        ) : (
                            <span className="status-badge unknown">Unknown</span>
                        )}
                        {interaction.opens.length > 0 && (
                             <span className={`chevron ${isExpanded ? 'expanded' : ''}`}>&#9654;</span>
                        )}
                    </div>
                </td>
            </tr>
            {isExpanded && interaction.opens.length > 0 && (
                <tr className="details-row">
                    <td colSpan={2}>
                        <div className="details-container">
                            <h4>Interaction Details</h4>
                            {interaction.opens.map((open, index) => (
                                <div key={index} className="open-block">
                                    <p><strong>Opened at:</strong> {formatDisplayDateTime(open.openTime)}</p>
                                    {open.clicks.length > 0 && (
                                        <ul>
                                            {open.clicks.map((click, cIndex) => (
                                                <li key={cIndex}>
                                                    <strong>Clicked at:</strong> {formatDisplayDateTime(click.clickTime)}
                                                    <br/>
                                                    <a href={click.targetUrl} target="_blank" rel="noopener noreferrer">{click.targetUrl}</a>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            ))}
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
};


export const AnalyticsEmailOpenViewer = ({ emailid }: AnalyticsEmailOpenViewerProps): ReactElement => {
    const [data, setData] = useState<RecipientInteraction[] | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // State for date range
    const [untilDate, setUntilDate] = useState(new Date());
    const [sinceDate, setSinceDate] = useState(() => {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        return date;
    });

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            
            const since = sinceDate.toISOString();
            const until = untilDate.toISOString();
            
            try {
                const result = await getEmailPerformanceData(emailid, since, until);
                setData(result);
            } catch (err) {
                setError("Failed to fetch analytics data. Please check the Email ID and your connection.");
                console.error(err);
                setData(null);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [emailid, sinceDate, untilDate]);
    
    return (
        <div className="email-performance-widget">
            <style>{`
                .email-performance-widget { font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #fff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); padding: 20px; color: #333; }
                .widget-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 15px; }
                .widget-title { font-size: 1.2em; font-weight: 600; color: #0d51a1; margin: 0; }
                .date-controls { display: flex; align-items: center; gap: 10px; }
                .date-controls label { font-size: 0.9em; font-weight: 500; }
                .date-controls input { border: 1px solid #ccc; border-radius: 4px; padding: 5px 8px; font-family: inherit; }
                .performance-table { width: 100%; border-collapse: collapse; }
                .performance-table th { background-color: #f9f9fb; text-align: left; padding: 12px 15px; font-weight: 600; border-bottom: 2px solid #eef0f2; }
                .recipient-row { cursor: pointer; transition: background-color 0.2s ease; }
                .recipient-row:hover { background-color: #f9f9fb; }
                .performance-table td { padding: 12px 15px; border-bottom: 1px solid #eef0f2; vertical-align: middle; }
                .user-info { display: flex; align-items: center; gap: 12px; }
                .user-avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; }
                /* --- NEW: Style for the SVG placeholder --- */
                .user-avatar-placeholder { display: flex; align-items: center; justify-content: center; background-color: #eef0f2; padding: 5px; box-sizing: border-box; }
                .status-cell { display: flex; justify-content: space-between; align-items: center; }
                .status-badge { padding: 4px 10px; border-radius: 12px; font-size: 0.8em; font-weight: 600; }
                .status-badge.opened { background-color: #dff0d8; color: #2F793D; }
                .status-badge.sent { background-color: #d9edf7; color: #31708f; }
                .status-badge.unknown { background-color: #f2f2f2; color: #777; }
                .chevron { font-size: 0.8em; color: #888; transition: transform 0.2s ease-in-out; display: inline-block; }
                .chevron.expanded { transform: rotate(90deg); }
                .details-row td { background-color: #fdfdfd; padding: 0; }
                .details-container { padding: 15px 25px; border-left: 3px solid #4594E0; }
                .details-container h4 { margin-top: 0; margin-bottom: 10px; color: #0d51a1; }
                .open-block { margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px dashed #e0e0e0; }
                .open-block:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
                .open-block p { margin: 0 0 5px 0; }
                .open-block ul { list-style-type: none; padding-left: 20px; margin: 5px 0 0; }
                .open-block li { background-color: #f4f8fd; padding: 8px; border-radius: 4px; margin-bottom: 5px; font-size: 0.9em; }
                .open-block a { color: #0d51a1; text-decoration: none; word-break: break-all; }
                .open-block a:hover { text-decoration: underline; }
                .message-container { text-align: center; padding: 40px 20px; color: #777; }
            `}</style>
            
            <div className="widget-header">
                <h3 className="widget-title">Email Performance (Last 30 Days)</h3>
                <div className="date-controls">
                    <label htmlFor="sinceDate">From:</label>
                    <input type="date" id="sinceDate" value={toInputDateString(sinceDate)} onChange={e => setSinceDate(new Date(e.target.value))} />
                    <label htmlFor="untilDate">To:</label>
                    <input type="date" id="untilDate" value={toInputDateString(untilDate)} onChange={e => setUntilDate(new Date(e.target.value))} />
                </div>
            </div>

            {loading ? (
                <div className="message-container">Loading...</div>
            ) : error ? (
                <div className="message-container">{error}</div>
            ) : !data || data.length === 0 ? (
                <div className="message-container">No email interaction data found for the selected period.</div>
            ) : (
                <table className="performance-table">
                    <thead>
                        <tr>
                            <th>Recipient</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map(interaction => (
                            <RecipientRow key={interaction.user.id} interaction={interaction} />
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};