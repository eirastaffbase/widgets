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
import React, { ReactElement, useEffect, useState } from "react";
import { BlockAttributes } from "widget-sdk";

// --- TYPES AND DUMMY DATA ---
type SObjectRecord = { [key: string]: any };
interface Opportunity extends SObjectRecord {
  Id: string;
  Name: string;
  StageName: string;
  Amount: number | null;
  CloseDate: string;
  Owner: { Name: string; Id?: string }; // Owner Id is optional for linking
}

// Helper function to create the updated dummy data
const createDummyData = (): Opportunity[] => {
    const owners = ["Eira Tope", "Mina Bojic", "Claire Ma", "Fizzah Mansoor", "Josie Lopez", "Jessica Scull", "Jon Lam", "Nicole Adams", "Patrick Anderson"];
    const records = [{"attributes":{"type":"Opportunity","url":"/services/data/v59.0/sobjects/Opportunity/006gK000002aKKUQA2"},"Name":"United Oil Plant Standby Generators","StageName":"Needs Analysis","Amount":675000.0,"CloseDate":"2025-05-01","Owner":{"attributes":{"type":"User","url":"/services/data/v59.0/sobjects/User/005gK000003XnD8QAK"},"Name":"OrgFarm EPIC"}},{"attributes":{"type":"Opportunity","url":"/services/data/v59.0/sobjects/Opportunity/006gK000002aKKFQA2"},"Name":"United Oil Installations","StageName":"Negotiation/Review","Amount":270000.0,"CloseDate":"2025-04-03","Owner":{"attributes":{"type":"User","url":"/services/data/v59.0/sobjects/User/005gK000003XnD8QAK"},"Name":"OrgFarm EPIC"}},{"attributes":{"type":"Opportunity","url":"/services/data/v59.0/sobjects/Opportunity/006gK000002aKK6QAM"},"Name":"United Oil Refinery Generators","StageName":"Proposal/Price Quote","Amount":270000.0,"CloseDate":"2025-05-22","Owner":{"attributes":{"type":"User","url":"/services/data/v59.0/sobjects/User/005gK000003XnD8QAK"},"Name":"OrgFarm EPIC"}},{"attributes":{"type":"Opportunity","url":"/services/data/v59.0/sobjects/Opportunity/006gK000002aKK8QAM"},"Name":"Grand Hotels Guest Portable Generators","StageName":"Value Proposition","Amount":250000.0,"CloseDate":"2025-06-06","Owner":{"attributes":{"type":"User","url":"/services/data/v59.0/sobjects/User/005gK000003XnD8QAK"},"Name":"OrgFarm EPIC"}},{"attributes":{"type":"Opportunity","url":"/services/data/v59.0/sobjects/Opportunity/006gK000002aKK2QAM"},"Name":"United Oil Office Portable Generators","StageName":"Negotiation/Review","Amount":125000.0,"CloseDate":"2025-04-07","Owner":{"attributes":{"type":"User","url":"/services/data/v59.0/sobjects/User/005gK000003XnD8QAK"},"Name":"OrgFarm EPIC"}},{"attributes":{"type":"Opportunity","url":"/services/data/v59.0/sobjects/Opportunity/006gK000002aKKMQA2"},"Name":"Express Logistics SLA","StageName":"Perception Analysis","Amount":120000.0,"CloseDate":"2025-03-02","Owner":{"attributes":{"type":"User","url":"/services/data/v59.0/sobjects/User/005gK000003XnD8QAK"},"Name":"OrgFarm EPIC"}},{"attributes":{"type":"Opportunity","url":"/services/data/v59.0/sobjects/Opportunity/006gK000002aKKLQA2"},"Name":"University of AZ Installations","StageName":"Proposal/Price Quote","Amount":100000.0,"CloseDate":"2025-03-04","Owner":{"attributes":{"type":"User","url":"/services/data/v59.0/sobjects/User/005gK000003XnD8QAK"},"Name":"OrgFarm EPIC"}},{"attributes":{"type":"Opportunity","url":"/services/data/v59.0/sobjects/Opportunity/006gK000002aKKBQA2"},"Name":"Pyramid Emergency Generators","StageName":"Prospecting","Amount":100000.0,"CloseDate":"2025-04-15","Owner":{"attributes":{"type":"User","url":"/services/data/v59.0/sobjects/User/005gK000003XnD8QAK"},"Name":"OrgFarm EPIC"}},{"attributes":{"type":"Opportunity","url":"/services/data/v59.0/sobjects/Opportunity/006gK000002aKKCQA2"},"Name":"Express Logistics Portable Truck Generators","StageName":"Value Proposition","Amount":80000.0,"CloseDate":"2025-03-01","Owner":{"attributes":{"type":"User","url":"/services/data/v59.0/sobjects/User/005gK000003XnD8QAK"},"Name":"OrgFarm EPIC"}},{"attributes":{"type":"Opportunity","url":"/services/data/v59.0/sobjects/Opportunity/006gK000002aKKDQA2"},"Name":"GenePoint Lab Generators","StageName":"Id. Decision Makers","Amount":60000.0,"CloseDate":"2025-05-31","Owner":{"attributes":{"type":"User","url":"/services/data/v59.0/sobjects/User/005gK000003XnD8QAK"},"Name":"OrgFarm EPIC"}},{"attributes":{"type":"Opportunity","url":"/services/data/v59.0/sobjects/Opportunity/006gK000002aKKVQA2"},"Name":"Edge Emergency Generator","StageName":"Id. Decision Makers","Amount":35000.0,"CloseDate":"2025-06-12","Owner":{"attributes":{"type":"User","url":"/services/data/v59.0/sobjects/User/005gK000003XnD8QAK"},"Name":"OrgFarm EPIC"}},{"attributes":{"type":"Opportunity","url":"/services/data/v59.0/sobjects/Opportunity/006gK000002aKK5QAM"},"Name":"Grand Hotels Kitchen Generator","StageName":"Id. Decision Makers","Amount":15000.0,"CloseDate":"2025-02-26","Owner":{"attributes":{"type":"User","url":"/services/data/v59.0/sobjects/User/005gK000003XnD8QAK"},"Name":"OrgFarm EPIC"}},{"attributes":{"type":"Opportunity","url":"/services/data/v59.0/sobjects/Opportunity/006gK000002aKK1QAM"},"Name":"Dickenson Mobile Generators","StageName":"Qualification","Amount":15000.0,"CloseDate":"2025-04-19","Owner":{"attributes":{"type":"User","url":"/services/data/v59.0/sobjects/User/005gK000003XnD8QAK"},"Name":"OrgFarm EPIC"}}];

    return records.map(record => ({
        Name: record.Name,
        StageName: record.StageName,
        Amount: record.Amount,
        CloseDate: record.CloseDate,
        Owner: owners[Math.floor(Math.random() * owners.length)]
    }));
};

const dummyOpportunities: Opportunity[] = createDummyData();

// --- HELPER FUNCTIONS ---
const getNestedValue = (obj: SObjectRecord, path: string): any => path.split('.').reduce((acc, part) => acc && acc[part], obj);

const formatHeader = (header: string): string => {
    const headerMap: { [key: string]: string } = { "Owner.Name": "Owner", "StageName": "Stage", "CloseDate": "Close Date" };
    return headerMap[header] || header.replace(/__/g, " ");
};

const getStageDisplay = (stageName: string = "") => {
    const stage = stageName.toLowerCase();
    if (stage.includes('prospecting') || stage.includes('qualification')) return { backgroundColor: '#E1BEE7', color: '#6A1B9A' }; // Purple
    if (stage.includes('needs analysis') || stage.includes('perception analysis')) return { backgroundColor: '#FFCCBC', color: '#D84315' }; // Orange
    if (stage.includes('id. decision makers') || stage.includes('value proposition')) return { backgroundColor: '#BBDEFB', color: '#1565C0' }; // Blue
    if (stage.includes('closed won')) return { backgroundColor: '#C8E6C9', color: '#2E7D32' }; // Green
    if (stage.includes('closed lost')) return { backgroundColor: '#FFCDD2', color: '#C62828' }; // Red
    if (stage.includes('proposal') || stage.includes('quote')) return { backgroundColor: '#B3E5FC', color: '#0277BD' }; // Light Blue
    if (stage.includes('negotiation') || stage.includes('review')) return { backgroundColor: '#FFF9C4', color: '#F9A825' }; // Yellow
    return { backgroundColor: '#E0E0E0', color: '#424242' }; // Gray
};

// --- CHILD COMPONENTS ---
const CellRenderer = ({ record, header, sObjectName, instanceUrl }: { record: SObjectRecord, header: string, sObjectName: string | null, instanceUrl: string | null }) => {
    const value = getNestedValue(record, header);

    if (sObjectName === 'Opportunity') {
        if (header === 'Name' && instanceUrl) {
            return <a href={`${instanceUrl}/${record.Id}`} target="_blank" rel="noopener noreferrer" className="sfdc-record-link">{value}</a>;
        }
        if (header === 'Owner.Name' && instanceUrl && record.Owner?.Id) {
            return <a href={`${instanceUrl}/${record.Owner.Id}`} target="_blank" rel="noopener noreferrer" className="sfdc-record-link">{value}</a>;
        }
        if (header === 'StageName') {
            const style = getStageDisplay(value);
            return <span style={{ padding: "4px 12px", borderRadius: "12px", fontSize: "12px", fontWeight: 500, ...style }}>{value}</span>;
        }
        if (header === 'Amount' && typeof value === 'number') {
            return <>{value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</>;
        }
    }
    if (value === null || typeof value === 'undefined') return <>N/A</>;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value)) {
        return <>{new Date(value + "T00:00:00").toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>;
    }
    if (typeof value === 'object') return <>{JSON.stringify(value)}</>;
    return <>{String(value)}</>;
};

const SalesforceCloudIcon = () => (
  <svg fill="#fff" width="18px" height="18px" viewBox="0 0 24 24" role="img" xmlns="http://www.w3.org/2000/svg"><title>Salesforce icon</title>
    <path d="M10.005 5.416c.75-.796 1.845-1.306 3.046-1.306 1.56 0 2.954.9 3.689 2.205.63-.3 1.35-.45 2.101-.45 2.849 0 5.159 2.34 5.159 5.22s-2.311 5.22-5.176 5.22c-.345 0-.689-.044-1.02-.104-.645 1.17-1.875 1.95-3.3 1.95-.6 0-1.155-.15-1.65-.375-.659 1.546-2.189 2.624-3.975 2.624-1.859 0-3.45-1.169-4.05-2.819-.27.061-.54.075-.825.075-2.204 0-4.005-1.8-4.005-4.05 0-1.5.811-2.805 2.01-3.51-.255-.57-.39-1.2-.39-1.846 0-2.58 2.1-4.649 4.65-4.649 1.53 0 2.85.704 3.72 1.8"/>
  </svg>
);

// --- MAIN COMPONENT ---
export interface SalesforceViewerProps extends BlockAttributes {
  salesforceloginurl: string;
  salesforceconsumerkey: string;
  salesforceconsumersecret: string;
  soqlquery: string;
}

export const SalesforceViewer = (props: SalesforceViewerProps): ReactElement => {
  const { soqlquery, salesforceloginurl, salesforceconsumerkey, salesforceconsumersecret } = props;

  const [records, setRecords] = useState<SObjectRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<SObjectRecord[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [sObjectName, setSObjectName] = useState<string | null>(null);
  const [filters, setFilters] = useState<{ [key: string]: string }>({});
  const [isFilterRowVisible, setFilterRowVisible] = useState<boolean>(false);
  const [visibleCount, setVisibleCount] = useState<number>(5);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [instanceUrl, setInstanceUrl] = useState<string | null>(null);

  useEffect(() => {
    const initialLoad = async () => {
        setLoading(true);

        const fromMatch = soqlquery?.match(/FROM\s+([a-zA-Z0-9_]+)/i);
        const sObjectName = fromMatch ? fromMatch[1] : 'Opportunity';
        setSObjectName(sObjectName);

        const selectMatch = soqlquery?.match(/SELECT\s+([\s\S]+?)\s+FROM/i);
        const headers = selectMatch ? selectMatch[1].split(',').map(f => f.trim()) : Object.keys(dummyOpportunities[0]);
        setHeaders(headers);

        if (!salesforceconsumerkey) {
            setRecords(dummyOpportunities);
            setInstanceUrl("https://your-salesforce-instance.lightning.force.com"); // Dummy URL for links
            setLoading(false);
            return;
        }

        try {
            const authUrl = `${salesforceloginurl.replace(/\/$/, "")}/services/oauth2/token`;
            const authParams = new URLSearchParams({ grant_type: "client_credentials", client_id: salesforceconsumerkey, client_secret: salesforceconsumersecret });
            const authResponse = await fetch(authUrl, { method: "POST", headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: authParams });
            const authData = await authResponse.json();
            if (!authResponse.ok) throw new Error(`Auth Error: ${authData.error_description || 'Unknown'}`);
            
            setInstanceUrl(authData.instance_url);
            
            const queryUrl = `${authData.instance_url}/services/data/v59.0/query/?q=${encodeURIComponent(soqlquery)}`;
            const queryResponse = await fetch(queryUrl, { headers: { Authorization: `Bearer ${authData.access_token}` } });
            const queryData = await queryResponse.json();
            if (!queryResponse.ok) throw new Error(`API Error: ${queryData[0]?.message || 'Unknown'}`);
            setRecords(queryData.records);
        } catch (err: any) {
            setError(err.message); 
            setRecords(dummyOpportunities);
            setInstanceUrl("https://your-salesforce-instance.lightning.force.com");
        } finally {
            setLoading(false);
        }
    };
    initialLoad();
  }, [props]);

  useEffect(() => {
    const filtered = records.filter(record =>
      Object.entries(filters).every(([header, value]) => {
        if (!value) return true;
        const stringValue = (getNestedValue(record, header)?.toString() ?? '').toLowerCase();
        return stringValue.includes(value.toLowerCase());
      })
    );
    setFilteredRecords(filtered);
    setVisibleCount(5);
  }, [records, filters]);

  const wrapperStyle: React.CSSProperties = { fontFamily: "'Inter', sans-serif", color: '#333' };
  const containerStyle: React.CSSProperties = { backgroundColor: '#F8F9FA', borderRadius: "16px", padding: '16px' };
  const dynamicStyles = `
    .sfdc-table { width: 100%; border-collapse: collapse; table-layout: auto; }
    .sfdc-table th, .sfdc-table td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #E0E0E0; }
    .sfdc-table th { font-weight: 500; font-size: 12px; color: #666; text-transform: uppercase; }
    .sfdc-table th.stage-column, .sfdc-table td.stage-column { white-space: nowrap; width: 1%; } /* Stage column styling */
    .sfdc-table tbody tr:hover { background-color: #F1F3F4; }
    .sfdc-table tbody tr:last-child td { border-bottom: none; }
    .sfdc-header-content { display: flex; justify-content: space-between; align-items: center; }
    .sfdc-filter-toggle { background: transparent; border: none; cursor: pointer; padding: 0; font-size: 12px; color: #666; margin-left: 8px; }
    .sfdc-filter-input { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; margin-top: 4px; }
    .sfdc-footer { display: flex; justify-content: center; align-items: center; padding-top: 16px; }
    .sfdc-footer-links { display: flex; gap: 20px; }
    .sfdc-footer-link { color: #00A1E0; text-decoration: none; font-weight: 500; font-size: 14px; cursor: pointer; }
    .sfdc-button-container { text-align: center; margin-top: 16px; }
    .sfdc-view-button { background-color: #00A1E0; color: white; border-radius: 4px; padding: 10px 20px; font-size: 14px; font-weight: 500; text-decoration: none; display: inline-flex; align-items: center; border: none; cursor: pointer; }
    .sfdc-view-button:hover { background-color: #005fb2; text-decoration: none; }
    .sfdc-record-link { color: inherit; text-decoration: none; } /* Link styling */
    .sfdc-record-link:hover { text-decoration: underline; } /* Underline on hover */
  `;

  if (loading) return <div style={{ ...wrapperStyle, ...containerStyle }}>Loading Salesforce data...</div>;

  return (
    <div style={wrapperStyle}>
      <style>{dynamicStyles}</style>
      <div style={containerStyle}>
        {error && <div style={{ color: 'orange', marginBottom: '15px', padding: '10px', border: '1px solid orange', borderRadius: '4px' }}><strong>Info:</strong> {error}</div>}
        
        <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="sfdc-table">
                <thead>
                    <tr>
                        {headers.map((header, index) => (
                            <th key={header} className={header === 'StageName' ? 'stage-column' : ''}>
                                <div className="sfdc-header-content">
                                    <span>{formatHeader(header)}</span>
                                    {index === headers.length - 1 && (
                                        <button className="sfdc-filter-toggle" title="Toggle Filters" onClick={() => setFilterRowVisible(prev => !prev)}>▼</button>
                                    )}
                                </div>
                            </th>
                        ))}
                    </tr>
                    {isFilterRowVisible && (
                        <tr>
                            {headers.map(header => (
                                <th key={`${header}-filter`}>
                                    <input type="text" placeholder="Filter..." className="sfdc-filter-input"
                                        onChange={(e) => setFilters(p => ({ ...p, [header]: e.target.value }))} />
                                </th>
                            ))}
                        </tr>
                    )}
                </thead>
                <tbody>
                    {filteredRecords.slice(0, visibleCount).map((record) => (
                        <tr key={record.Id}>
                            {headers.map(header => (
                                <td key={`${record.Id}-${header}`} title={String(getNestedValue(record, header))} className={header === 'StageName' ? 'stage-column' : ''}>
                                    <CellRenderer record={record} header={header} sObjectName={sObjectName} instanceUrl={instanceUrl} />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        <div className="sfdc-footer">
            <div className="sfdc-footer-links">
                {filteredRecords.length > visibleCount && (
                    <a onClick={() => setVisibleCount(prev => prev + 5)} className="sfdc-footer-link">
                        Show {Math.min(5, filteredRecords.length - visibleCount)} more...
                    </a>
                )}
                {visibleCount > 5 && (
                     <a onClick={() => setVisibleCount(5)} className="sfdc-footer-link">
                        Show less
                    </a>
                )}
            </div>
        </div>
      </div>
      
      <div className="sfdc-button-container">
        {instanceUrl && sObjectName && (
            <a href={`${instanceUrl}/lightning/o/${sObjectName}/list`} target="_blank" rel="noopener noreferrer" className="sfdc-view-button">
                <SalesforceCloudIcon />
                <span style={{ color: "#fff", fontWeight: "bold", paddingLeft: "5px" }}> View in Salesforce</span>
            </a>
        )}
      </div>
    </div>
  );
};