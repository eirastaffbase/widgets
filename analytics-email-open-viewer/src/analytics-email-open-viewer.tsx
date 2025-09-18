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

import React, { ReactElement, useState, useEffect, useMemo } from "react";
import { BlockAttributes } from "widget-sdk";
import { getEmailPerformanceData, getSentEmailsData } from "./api";
import { RecipientInteraction, SentEmail } from "./types";
import { FaCaretRight, FaCaretLeft } from "react-icons/fa";

// Centralized color palette
const staffbaseColors = {
    blue: '#0d51a1',
    lightBlue: '#4594E0',
    green: '#2F793D',
    greenBg: '#dff0d8',
    yellowBg: '#fff3cd',
    yellowText: '#856404',
    gray: '#545459',
    mediumGray: '#888',
    lightGray: '#B0B0B0',
    lighterGray: '#f0f0f0',
    tableHeaderBg: '#f9f9fb',
    detailRowBg: '#fdfdfd',
    borderColor: '#F0F0F0',
    disabledBg: '#ccc',
    disabledColor: '#f7f7f7',
    disabledBorder: '#eee',
    detailLiBg: '#f4f8fd',
    textColor: '#333',
    darkerText: '#111',
    mediumText: '#666',
    lightText: '#aaa',
    sentBg: '#d9edf7',
    sentText: '#31708f',
    unknownBg: '#f2f2f2',
    unknownText: '#777',
};

const toInputDateTimeString = (date: Date): string => {
    const pad = (num: number) => num.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatDisplayDateTime = (isoString: string): string => {
    return new Date(isoString).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};

export interface AnalyticsEmailOpenViewerProps extends BlockAttributes {
    emailid?: string;
    domain?: string;
    allemailsview?: boolean;
    emaillistlimit?: number;
}

const DefaultAvatarIcon = ({ className }: { className?: string }) => (
    <div className={`${className} user-avatar-placeholder`}>
        <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 18 18">
            <path fill="#E0E0E0" d="M9 0a9 9 0 0 0-9 9 8.654 8.654 0 0 0 .05.92 9 9 0 0 0 17.9 0A8.654 8.654 0 0 0 18 9a9 9 0 0 0-9-9zm5.42 13.42c-.01 0-.06.08-.07.08a6.975 6.975 0 0 1-10.7 0c-.01 0-.06-.08-.07-.08a.512.512 0 0 1-.09-.27.522.522 0 0 1 .34-.48c.74-.25 1.45-.49 1.65-.54a.16.16 0 0 1 .03-.13.49.49 0 0 1 .43-.36l1.27-.1a2.077 2.077 0 0 0-.19-.79v-.01a2.814 2.814 0 0 0-.45-.78 3.83 3.83 0 0 1-.79-2.38A3.38 3.38 0 0 1 8.88 4h.24a3.38 3.38 0 0 1 3.1 3.58 3.83 3.83 0 0 1-.79 2.38 2.814 2.814 0 0 0-.45.78v.01a2.077 2.077 0 0 0-.19.79l1.27.1a.49.49 0 0 1 .43.36.16.16 0 0 1 .03.13c.2.05.91.29 1.65.54a.49.49 0 0 1 .25.75z"/>
        </svg>
    </div>
);

const PlaceholderThumbnailIcon = ({ className }: { className?: string }) => (
    <div className={`${className} placeholder-thumbnail`} style={{ backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 171 171" width="60%" height="60%">
            <g>
                <circle cx="85.5" cy="85.5" r="85.5" fill="#e0e0e0"/>
                <path d="M49.2,53.9,78.8,87a8.94,8.94,0,0,0,6.7,3,9.1,9.1,0,0,0,6.7-3l29.1-32.6a1.56,1.56,0,0,1,.8-.6,10.57,10.57,0,0,0-4-.8H52.9a10.06,10.06,0,0,0-3.9.8A.35.35,0,0,0,49.2,53.9Z" fill="#fff"/>
                <path d="M126.5,58a1.8,1.8,0,0,1-.6.9l-29,32.5a15.38,15.38,0,0,1-11.4,5.1,15.54,15.54,0,0,1-11.4-5.1L44.6,58.3l-.2-.2A9.75,9.75,0,0,0,43,63.2V108a9.94,9.94,0,0,0,10,9.9h65a9.94,9.94,0,0,0,10-9.9V63.2a10.19,10.19,0,0,0-1.5-5.2" fill="#fff"/>
            </g>
        </svg>
    </div>
);

const RecipientRow = ({ interaction }: { interaction: RecipientInteraction }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const isExpandable = interaction.sentTime || interaction.opens.length > 0;

    return (
        <>
            <tr className={`recipient-row ${isExpandable ? 'expandable' : ''}`} onClick={() => isExpandable && setIsExpanded(!isExpanded)}>
                <td><div className="user-info">{interaction.user.avatarUrl ? <img src={interaction.user.avatarUrl} alt={`${interaction.user.firstName} ${interaction.user.lastName}`} className="user-avatar" /> : <DefaultAvatarIcon className="user-avatar" />}<span>{interaction.user.firstName} {interaction.user.lastName}</span></div></td>
                <td><div className="status-cell">{interaction.wasOpened ? <span className="status-badge opened">Opened{interaction.opens.length > 1 && <span className="open-count">({interaction.opens.length}x)</span>}</span> : interaction.sentTime ? <span className="status-badge sent">Sent</span> : <span className="status-badge unknown">Unknown</span>}{isExpandable && <span className={`chevron ${isExpanded ? 'expanded' : ''}`}>&#9654;</span>}</div></td>
            </tr>
            {isExpanded && isExpandable && (
                <tr className="details-row"><td colSpan={2}><div className="details-container"><h4 style={{ color: '#333', fontSize: '1.15rem', fontWeight: 'bold', paddingBottom: '0.7rem' }}> Interaction Details</h4>{interaction.sentTime && <div className="detail-block"><p><strong>Sent at:</strong> {formatDisplayDateTime(interaction.sentTime)}</p></div>}{interaction.opens.map((open, index) => <div key={index} className="detail-block"><p><strong>Opened at:</strong> {formatDisplayDateTime(open.openTime)}</p>{open.clicks.length > 0 && <ul>{open.clicks.map((click, cIndex) => <li key={cIndex}><strong>Clicked link at {formatDisplayDateTime(click.clickTime)}</strong><a href={click.targetUrl} target="_blank" rel="noopener noreferrer">{click.targetUrl}</a></li>)}</ul>}</div>)}</div></td></tr>
            )}
        </>
    );
};

export const AnalyticsEmailOpenViewer = ({ emailid, domain = "app.staffbase.com", allemailsview = true, emaillistlimit = 20 }: AnalyticsEmailOpenViewerProps): ReactElement => {
    const [currentView, setCurrentView] = useState<'list' | 'detail'>(allemailsview ? 'list' : 'detail');
    const [selectedEmailId, setSelectedEmailId] = useState<string | undefined>(allemailsview ? undefined : emailid);
    const [allEmails, setAllEmails] = useState<SentEmail[]>([]);
    const [recipientData, setRecipientData] = useState<RecipientInteraction[] | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [recipientSearchTerm, setRecipientSearchTerm] = useState("");
    const [emailListPage, setEmailListPage] = useState(0);
    const [recipientPage, setRecipientPage] = useState(0);
    const [untilDate, setUntilDate] = useState(new Date());
    const [sinceDate, setSinceDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; });
    const [detailUntilDate, setDetailUntilDate] = useState(new Date());
    const [detailSinceDate, setDetailSinceDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; });
    const [emailStats, setEmailStats] = useState<{ totalRecipients: number; totalOpens: number; uniqueOpens: number } | null>(null);
    const [sortConfig, setSortConfig] = useState<{key: 'recipient' | 'status' | null, direction: 'ascending' | 'descending' | 'original'}>({ key: null, direction: 'original' });

    const nowString = toInputDateTimeString(new Date());

    useEffect(() => {
        setCurrentView(allemailsview ? 'list' : 'detail');
        setSelectedEmailId(allemailsview ? undefined : emailid);
    }, [allemailsview, emailid]);

    useEffect(() => {
        const fetchAllEmails = async () => {
            setLoading(true); setError(null);
            try {
                const result = await getSentEmailsData(domain, emaillistlimit);
                setAllEmails(result);
            } catch (err) {
                setError("Failed to fetch sent emails."); setAllEmails([]);
            } finally { setLoading(false); }
        };

        const fetchRecipientData = async (id: string, since: string, until: string) => {
            setLoading(true); setError(null); setRecipientData(null); setRecipientSearchTerm(""); setRecipientPage(0);
            try {
                const result = await getEmailPerformanceData(id, domain, since, until);
                setRecipientData(result);
            } catch (err) {
                setError("Failed to fetch analytics data.");
            } finally { setLoading(false); }
        };

        if (currentView === 'list' && allemailsview) { fetchAllEmails(); }
        else if (currentView === 'detail' && selectedEmailId) { fetchRecipientData(selectedEmailId, detailSinceDate.toISOString(), detailUntilDate.toISOString()); }
        else { setLoading(false); }
    }, [domain, currentView, selectedEmailId, emaillistlimit, allemailsview, detailSinceDate, detailUntilDate]);

    useEffect(() => {
        if (recipientData && selectedEmailId && allEmails.length > 0) {
            const selectedEmail = allEmails.find(e => e.id === selectedEmailId);
            const totalRecipients = selectedEmail?.targetAudience?.totalRecipients ?? 0;
            const totalOpens = recipientData.reduce((sum, interaction) => sum + interaction.opens.length, 0);
            const uniqueOpens = recipientData.filter(interaction => interaction.wasOpened).length;
            setEmailStats({ totalRecipients, totalOpens, uniqueOpens });
        } else if (selectedEmailId && allEmails.length > 0) {
            const selectedEmail = allEmails.find(e => e.id === selectedEmailId);
            const totalRecipients = selectedEmail?.targetAudience?.totalRecipients ?? 0;
            setEmailStats({ totalRecipients, totalOpens: 0, uniqueOpens: 0 });
        } else {
            setEmailStats(null);
        }
    }, [recipientData, selectedEmailId, allEmails]);

    const handleEmailSelect = (id: string) => {
        const selectedEmail = allEmails.find(email => email.id === id);
        if (!selectedEmail) return;

        const sentAtDate = new Date(selectedEmail.sentAt);
        const now = new Date();
        const thirtyDaysInMillis = 30 * 24 * 60 * 60 * 1000;

        const newSince = new Date(sentAtDate.getTime() - 60 * 1000); // 1 minute before sent time
        const sentAtPlus30Days = new Date(sentAtDate.getTime() + thirtyDaysInMillis);

        const newUntil = sentAtPlus30Days < now ? sentAtPlus30Days : now;

        setDetailSinceDate(newSince);
        setDetailUntilDate(newUntil);
        
        setSelectedEmailId(id);
        setCurrentView('detail');
    };

    const handleBackToList = () => { setSelectedEmailId(undefined); setCurrentView('list'); setRecipientData(null); setSortConfig({ key: null, direction: 'original' }); };

    const handleDetailDateChange = (value: string, type: 'since' | 'until') => {
        const newDate = new Date(value);
        let since = type === 'since' ? newDate : detailSinceDate;
        let until = type === 'until' ? newDate : detailUntilDate;
        const thirtyDaysInMillis = 30 * 24 * 60 * 60 * 1000;
        const diff = until.getTime() - since.getTime();
        if (diff > thirtyDaysInMillis) {
            if (type === 'since') {
                until = new Date(since.getTime() + thirtyDaysInMillis);
            } else {
                since = new Date(until.getTime() - thirtyDaysInMillis);
            }
        }
        setDetailSinceDate(since);
        setDetailUntilDate(until);
        setRecipientPage(0);
    };

    const handleSort = (key: 'recipient' | 'status') => {
        setSortConfig(prev => {
            const isNewKey = prev.key !== key;
            if (key === 'recipient') {
                if (isNewKey) return { key: 'recipient', direction: 'ascending' };
                if (prev.direction === 'ascending') return { key: 'recipient', direction: 'descending' };
                return { key: null, direction: 'original' };
            }
            if (key === 'status') {
                if (isNewKey) return { key: 'status', direction: 'descending' };
                if (prev.direction === 'descending') return { key: 'status', direction: 'ascending' };
                return { key: null, direction: 'original' };
            }
            return { key: null, direction: 'original' };
        });
        setRecipientPage(0);
    };

    const sortedRecipients = useMemo(() => {
        if (!recipientData) return [];
        const sortableData = [...recipientData];

        if (sortConfig.key && sortConfig.direction !== 'original') {
            sortableData.sort((a, b) => {
                if (sortConfig.key === 'recipient') {
                    const nameA = `${a.user.firstName} ${a.user.lastName}`;
                    const nameB = `${b.user.firstName} ${b.user.lastName}`;
                    return sortConfig.direction === 'ascending' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
                }
                if (sortConfig.key === 'status') {
                    const getStatusScore = (item: RecipientInteraction) => {
                        if (item.wasOpened) return item.opens.length;
                        if (item.sentTime) return 0;
                        return -1;
                    };
                    const scoreA = getStatusScore(a);
                    const scoreB = getStatusScore(b);
                    return sortConfig.direction === 'descending' ? scoreB - scoreA : scoreA - scoreB;
                }
                return 0;
            });
        }
        return sortableData;
    }, [recipientData, sortConfig]);


    const RECIPIENTS_PER_PAGE = 5;
    const EMAILS_PER_PAGE = 5;

    const filteredEmails = useMemo(() => allEmails.filter(email => {
        const sent = new Date(email.sentAt);
        return sent >= sinceDate && sent <= untilDate;
    }), [allEmails, sinceDate, untilDate]);

    const filteredRecipients = sortedRecipients.filter(r => `${r.user.firstName} ${r.user.lastName}`.toLowerCase().includes(recipientSearchTerm.toLowerCase()));
    const recipientPageCount = Math.ceil(filteredRecipients.length / RECIPIENTS_PER_PAGE);
    const paginatedRecipients = filteredRecipients.slice(recipientPage * RECIPIENTS_PER_PAGE, (recipientPage + 1) * RECIPIENTS_PER_PAGE);
    const emailPageCount = Math.ceil(filteredEmails.length / EMAILS_PER_PAGE);
    const paginatedEmails = filteredEmails.slice(emailListPage * EMAILS_PER_PAGE, (emailListPage + 1) * EMAILS_PER_PAGE);

    const selectedEmailTitle = allEmails.find(e => e.id === selectedEmailId)?.title || "Email";
    
    return (
        <div className="email-performance-widget">
            <style>{`
            .email-performance-widget { font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #fff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); padding: 20px; color: ${staffbaseColors.textColor}; }
            .widget-header { display: flex; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 15px; border-bottom: 1px solid ${staffbaseColors.borderColor}; padding-bottom: 15px; }
            .widget-header.list-view { justify-content: space-between; }
            .widget-title { font-size: 1.2em; font-weight: 600; color: ${staffbaseColors.blue}; margin: 0; flex-grow: 1; }
            .message-container { text-align: center; padding: 40px 20px; color: ${staffbaseColors.unknownText}; }
            .back-button { background-color: ${staffbaseColors.blue}; border: none; color: white; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 1.2em; display: flex; align-items: center; justify-content: center; padding: 0; transition: background-color 0.2s; margin-right: 15px; }
            .back-button:hover { background-color: ${staffbaseColors.lightBlue}; }
            .date-controls { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
            .date-controls label { font-size: 0.9em; font-weight: 500; }
            .date-controls input { border: 1px solid #ccc; border-radius: 4px; padding: 5px 8px; font-family: inherit; width: auto; }
            .detail-view-controls { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 20px; }
            .filter-and-date-container { display: flex; align-items: center; gap: 15px; flex-wrap: wrap; }
            .recipient-filter input { background-color: #fff; border: 1px solid #ccc; border-radius: 4px; padding: 8px; width: 100%; max-width: 250px; box-sizing: border-box; }
            .date-picker-group { display: flex; align-items: center; gap: 8px; }
            .date-picker-group label { font-size: 0.9em; color: ${staffbaseColors.mediumText}; }
            .date-picker-group input { border: 1px solid #ccc; border-radius: 4px; padding: 5px 8px; font-family: inherit; }
            .email-stats-container { display: flex; gap: 25px; background-color: ${staffbaseColors.tableHeaderBg}; padding: 10px 20px; border-radius: 8px; border: 1px solid ${staffbaseColors.borderColor}; }
            .stat-item { text-align: center; }
            .stat-value { display: block; font-size: 1.6em; font-weight: 600; color: ${staffbaseColors.blue}; }
            .stat-label { font-size: 0.8em; color: ${staffbaseColors.mediumText}; text-transform: uppercase; letter-spacing: 0.5px; }
            .email-list-item { display: flex; align-items: center; gap: 15px; padding: 15px; border-bottom: 1px solid ${staffbaseColors.borderColor}; cursor: pointer; transition: background-color 0.2s; border-radius: 4px; }
            .email-list-item:hover { background-color: ${staffbaseColors.tableHeaderBg}; }
            .email-thumbnail { width: 80px; height: 60px; object-fit: cover; border-radius: 4px; flex-shrink: 0; border: 1px solid #eee; }
            .email-info { flex-grow: 1; }
            .email-title { font-size: 1.05em; font-weight: 600; margin: 0 0 4px 0; color: ${staffbaseColors.darkerText}; }
            .email-meta { font-size: 0.85em; color: ${staffbaseColors.mediumText}; margin: 0; }
            .email-chevron { font-size: 1em; color: ${staffbaseColors.lightText}; transform: translateX(0); transition: transform 0.2s; }
            .email-list-item:hover .email-chevron { transform: translateX(5px); }
            .performance-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            .performance-table th { background-color: ${staffbaseColors.tableHeaderBg}; text-align: left; padding: 12px 15px; font-weight: 600; border-bottom: 2px solid ${staffbaseColors.borderColor}; }
            .performance-table th[role="button"] { cursor: pointer; }
            .recipient-row.expandable { cursor: pointer; }
            .recipient-row.expandable:hover { background-color: ${staffbaseColors.tableHeaderBg}; }
            .performance-table td { padding: 12px 15px; border-bottom: 1px solid ${staffbaseColors.borderColor}; vertical-align: middle; }
            .user-info { display: flex; align-items: center; gap: 12px; }
            .user-avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; }
            .user-avatar-placeholder { display: flex; align-items: center; justify-content: center; background-color: ${staffbaseColors.borderColor}; padding: 5px; box-sizing: border-box; }
            .status-cell { display: flex; justify-content: space-between; align-items: center; }
            .status-badge { padding: 4px 10px; border-radius: 12px; font-size: 0.8em; font-weight: 600; white-space: nowrap; }
            .status-badge .open-count { font-weight: 500; opacity: 0.8; margin-left: 4px; }
            .status-badge.opened { background-color: ${staffbaseColors.greenBg}; color: ${staffbaseColors.green}; }
            .status-badge.sent { background-color: ${staffbaseColors.sentBg}; color: ${staffbaseColors.sentText}; }
            .status-badge.unknown { background-color: ${staffbaseColors.unknownBg}; color: ${staffbaseColors.unknownText}; }
            .chevron { font-size: 0.8em; color: ${staffbaseColors.mediumGray}; transition: transform 0.2s ease-in-out; display: inline-block; }
            .chevron.expanded { transform: rotate(90deg); }
            .details-row td { background-color: ${staffbaseColors.detailRowBg}; padding: 0; }
            .details-container { padding: 15px 25px; border-left: 3px solid ${staffbaseColors.lightBlue}; }
            .detail-block { margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px dashed #e0e0e0; }
            .detail-block:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
            .detail-block p { margin: 0 0 5px 0; }
            .detail-block ul { list-style-type: none; padding-left: 0; margin: 10px 0 0; }
            .detail-block li { background-color: ${staffbaseColors.detailLiBg}; padding: 10px; border-radius: 6px; margin-bottom: 8px; font-size: 0.9em; }
            .detail-block li strong { display: block; margin-bottom: 4px; color: ${staffbaseColors.gray}; font-size: 0.9em; }
            .detail-block a { color: ${staffbaseColors.blue}; text-decoration: none; word-break: break-all; }
            .detail-block a:hover { text-decoration: underline; }
            .pagination-controls { display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-top: 20px; }
            .pagination-controls button { background-color: ${staffbaseColors.blue}; border: none; color: white; border-radius: 50%; width: 32px; height: 32px; font-size: 1.2em; display: flex; align-items: center; justify-content: center; padding: 0; cursor: pointer; transition: background-color 0.2s; }
            .pagination-controls button:hover:not(:disabled) { background-color: ${staffbaseColors.lightBlue}; }
            .pagination-controls button:disabled { background-color: ${staffbaseColors.disabledBg}; color: ${staffbaseColors.disabledColor}; cursor: not-allowed; }
            .pagination-controls button:disabled:hover { background-color: ${staffbaseColors.disabledBg}; }
            `}</style>
            {loading && <div className="message-container">Loading...</div>}
            {error && <div className="message-container">{error}</div>}

            {!loading && !error && currentView === 'list' && (
                <>
                    <div className="widget-header list-view">
                        <h3 className="widget-title">Sent Email Overview</h3>
                        <div className="date-controls">
                            <label htmlFor="sinceDate">From:</label>
                            <input type="datetime-local" id="sinceDate" value={toInputDateTimeString(sinceDate)} onChange={e => { setEmailListPage(0); setSinceDate(new Date(e.target.value)) }} max={nowString} />
                            <label htmlFor="untilDate">To:</label>
                            <input type="datetime-local" id="untilDate" value={toInputDateTimeString(untilDate)} onChange={e => { setEmailListPage(0); setUntilDate(new Date(e.target.value)) }} max={nowString} />
                        </div>
                    </div>
                    {paginatedEmails.length > 0 ? (
                        <>
                            <div className="email-list-container">
                                {paginatedEmails.map(email => (
                                    <div key={email.id} className="email-list-item" onClick={() => handleEmailSelect(email.id)}>
                                        {email.thumbnailUrl ? <img src={email.thumbnailUrl} alt="" className="email-thumbnail" /> : <PlaceholderThumbnailIcon className="email-thumbnail" />}
                                        <div className="email-info">
                                            <h4 className="email-title">{email.title}</h4>
                                            <p className="email-meta">Sent by {email.sender.name} on {formatDisplayDateTime(email.sentAt)}</p>
                                        </div>
                                        <span className="email-chevron">&#8250;</span>
                                    </div>
                                ))}
                            </div>
                            {emailPageCount > 1 && (
                                <div className="pagination-controls">
                                    <button onClick={() => setEmailListPage(p => Math.max(0, p - 1))} disabled={emailListPage === 0}><FaCaretLeft /></button>
                                    <button onClick={() => setEmailListPage(p => Math.min(emailPageCount - 1, p + 1))} disabled={emailListPage >= emailPageCount - 1}><FaCaretRight /></button>
                                </div>
                            )}
                        </>
                    ) : <div className="message-container">No emails found for the selected period.</div>}
                </>
            )}

            {!loading && !error && currentView === 'detail' && (
                <>
                    <div className="widget-header">
                        {allemailsview && <button className="back-button" onClick={handleBackToList}><FaCaretLeft /></button>}
                        <h3 className="widget-title">"{selectedEmailTitle}" Performance</h3>
                    </div>
                    <>
                        <div className="detail-view-controls">
                            <div className="filter-and-date-container">
                                <div className="recipient-filter">
                                    <input type="text" placeholder="Filter recipients by name..." value={recipientSearchTerm} onChange={e => { setRecipientSearchTerm(e.target.value); setRecipientPage(0); }} />
                                </div>
                                <div className="date-picker-group">
                                    <label htmlFor="detailSinceDate">From:</label>
                                    <input type="datetime-local" id="detailSinceDate" value={toInputDateTimeString(detailSinceDate)} onChange={e => handleDetailDateChange(e.target.value, 'since')} max={nowString} />
                                    <label htmlFor="detailUntilDate">To:</label>
                                    <input type="datetime-local" id="detailUntilDate" value={toInputDateTimeString(detailUntilDate)} onChange={e => handleDetailDateChange(e.target.value, 'until')} max={nowString} />
                                </div>
                            </div>
                             {emailStats && (
                                <div className="email-stats-container">
                                    <div className="stat-item">
                                        <span className="stat-value">{emailStats.totalRecipients}</span>
                                        <span className="stat-label">Recipients</span>
                                    </div>
                                    <div className="stat-item">
                                        <span className="stat-value">{emailStats.uniqueOpens}</span>
                                        <span className="stat-label">Unique Opens</span>
                                    </div>
                                    <div className="stat-item">
                                        <span className="stat-value">{emailStats.totalOpens}</span>
                                        <span className="stat-label">Total Opens</span>
                                    </div>
                                </div>
                            )}
                        </div>
                        {paginatedRecipients.length > 0 ? (
                            <>
                                <table className="performance-table">
                                    <thead><tr>
                                        <th role="button" onClick={() => handleSort('recipient')}>Recipient</th>
                                        <th role="button" style={{ width: '120px' }} onClick={() => handleSort('status')}>Status</th>
                                    </tr></thead>
                                    <tbody>{paginatedRecipients.map(i => <RecipientRow key={i.user.id} interaction={i} />)}</tbody>
                                </table>
                                {recipientPageCount > 1 && (
                                    <div className="pagination-controls">
                                        <button onClick={() => setRecipientPage(p => Math.max(0, p - 1))} disabled={recipientPage === 0}><FaCaretLeft /></button>
                                        <button onClick={() => setRecipientPage(p => Math.min(recipientPageCount - 1, p + 1))} disabled={recipientPage >= recipientPageCount - 1}><FaCaretRight /></button>
                                    </div>
                                )}
                            </>
                        ) : <div className="message-container">{recipientData ? 'No matching recipients found.' : 'No recipient data available for this email in the selected date range.'}</div>}
                    </>
                </>
            )}
        </div>
    );
};