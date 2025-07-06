/*!
 * Copyright 2024, Staffbase GmbH and contributors.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/-licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import React, { ReactElement, useEffect, useState } from "react";
import { BlockAttributes } from "widget-sdk";

// Define the shape of a Salesforce Opportunity
interface Opportunity {
  Id: string;
  Name: string;
  StageName: string;
  Amount: number | null;
  CloseDate: string;
}

// Dummy data for fallback
const dummyOpportunities: Opportunity[] = [
  {
    Id: "0068d00000AaBbCc1",
    Name: "Apex Corporation - 1000 Widgets",
    StageName: "Prospecting",
    Amount: 75000,
    CloseDate: "2025-09-20",
  },
  {
    Id: "0068d00000AaBbCc2",
    Name: "Globex Inc. - Cloud Services Contract",
    StageName: "Needs Analysis",
    Amount: 120000,
    CloseDate: "2025-08-15",
  },
  {
    Id: "0068d00000AaBbCc3",
    Name: "Stark Industries - Consulting Deal",
    StageName: "Proposal/Price Quote",
    Amount: 250000,
    CloseDate: "2025-07-30",
  },
  {
    Id: "0068d00000AaBbCc4",
    Name: "Wayne Enterprises - Security Upgrade",
    StageName: "Closed Won",
    Amount: 550000,
    CloseDate: "2025-06-01",
  },
];

// Helper to format dates (e.g., "Jun 20")
const getFormattedDate = (dateStr: string): string => {
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    // Appending T00:00:00 prevents timezone shifts
    return new Date(dateStr + "T00:00:00").toLocaleDateString('en-US', options);
};

/**
 * Determines the styling for the stage bubble based on its name.
 * @param {string} stageName - The name of the opportunity stage.
 * @returns An object with the color properties for the bubble.
 */
const getStageDisplay = (stageName: string) => {
    const stage = stageName.toLowerCase();
    if (stage.includes('closed won')) {
        return { backgroundColor: '#C8E6C9', color: '#2E7D32' }; // Green
    }
    if (stage.includes('closed lost')) {
        return { backgroundColor: '#FFCDD2', color: '#C62828' }; // Red
    }
    if (stage.includes('proposal') || stage.includes('quote')) {
        return { backgroundColor: '#B3E5FC', color: '#0277BD' }; // Blue
    }
    if (stage.includes('negotiation') || stage.includes('review')) {
        return { backgroundColor: '#FFF9C4', color: '#F9A825' }; // Yellow
    }
    return { backgroundColor: '#E0E0E0', color: '#424242' }; // Gray for others
};

export interface SalesforceViewerProps extends BlockAttributes {
  salesforceloginurl: string;
  salesforceusername: string;
  salesforcepassword: string;
  salesforceconsumerkey: string;
  salesforceconsumersecret: string;
}

export const SalesforceViewer = (props: SalesforceViewerProps): ReactElement => {
  const {
    salesforceloginurl,
    salesforceusername,
    salesforcepassword,
    salesforceconsumerkey,
    salesforceconsumersecret,
  } = props;

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [instanceUrl, setInstanceUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!salesforceusername || !salesforceconsumerkey) {
        setError("Using dummy data. Please configure Salesforce credentials.");
        setOpportunities(dummyOpportunities);
        setLoading(false);
        return;
      }
      
      try {
        const sanitizedLoginUrl = salesforceloginurl.replace(/\/$/, "");
        const authUrl = `${sanitizedLoginUrl}/services/oauth2/token`;
        const authParams = new URLSearchParams({
          grant_type: "password",
          client_id: salesforceconsumerkey,
          client_secret: salesforceconsumersecret,
          username: salesforceusername,
          password: salesforcepassword,
        });

        const authResponse = await fetch(authUrl, {
          method: "POST",
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: authParams,
        });

        const authData = await authResponse.json();
        if (!authResponse.ok) throw new Error(`Auth Error: ${authData.error_description || 'Unknown'}`);
        
        setInstanceUrl(authData.instance_url); // Save instance_url for the footer link
        
        const query = "SELECT Id, Name, StageName, Amount, CloseDate FROM Opportunity WHERE IsClosed = false ORDER BY Amount DESC LIMIT 10";
        const queryUrl = `${authData.instance_url}/services/data/v59.0/query/?q=${encodeURIComponent(query)}`;

        const queryResponse = await fetch(queryUrl, {
          headers: { Authorization: `Bearer ${authData.access_token}` },
        });

        const queryData = await queryResponse.json();
        if (!queryResponse.ok) throw new Error(`API Error: ${queryData[0]?.message || 'Unknown'}`);

        setOpportunities(queryData.records);

      } catch (err: any) {
        console.error(err);
        setError(err.message);
        setOpportunities(dummyOpportunities); // Show dummy data on error
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [props]);

  // Styles mimicked from the StaticTasks widget
  const containerStyle: React.CSSProperties = {
    fontFamily: "'Inter', sans-serif",
    backgroundColor: '#F8F9FA',
    borderRadius: "16px",
    padding: '16px',
    color: '#333',
  };

  const dynamicStyles = `
    .sfdc-table {
      width: 100%;
      border-collapse: collapse;
      white-space: nowrap;
    }
    .sfdc-table th, .sfdc-table td {
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1px solid #E0E0E0;
    }
    .sfdc-table th {
      font-weight: 500;
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
    }
    .sfdc-table tbody tr {
      transition: background-color 0.2s ease-in-out;
    }
    .sfdc-table tbody tr:hover {
      background-color: #F1F3F4;
    }
    .sfdc-table tbody tr:last-child td {
      border-bottom: none;
    }
    .sfdc-footer {
        text-align: center;
        padding-top: 16px;
    }
    .sfdc-footer-link {
        color: #0070d2;
        text-decoration: none;
        font-weight: 500;
        font-size: 14px;
        transition: text-decoration 0.2s ease;
    }
    .sfdc-footer-link:hover {
        text-decoration: underline;
    }
  `;

  if (loading) {
    return <div style={containerStyle}>Loading Salesforce opportunities...</div>;
  }

  return (
    <>
      <style>{dynamicStyles}</style>
      <div style={containerStyle}>
        {error && <div style={{ color: 'orange', marginBottom: '15px', padding: '10px', border: '1px solid orange', borderRadius: '4px' }}><strong>Info:</strong> {error}</div>}
        
        <table className="sfdc-table">
          <thead>
            <tr>
              <th>Opportunity Name</th>
              <th>Stage</th>
              <th>Amount</th>
              <th>Close Date</th>
            </tr>
          </thead>
          <tbody>
            {opportunities.map((opp) => {
              const stageStyle = getStageDisplay(opp.StageName);
              return (
                <tr key={opp.Id}>
                  <td style={{ fontWeight: 500 }}>{opp.Name}</td>
                  <td>
                    <span style={{
                      padding: "4px 12px",
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: 500,
                      backgroundColor: stageStyle.backgroundColor,
                      color: stageStyle.color,
                    }}>
                      {opp.StageName}
                    </span>
                  </td>
                  <td>
                    {opp.Amount 
                      ? opp.Amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
                      : 'N/A'
                    }
                  </td>
                  <td>{getFormattedDate(opp.CloseDate)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {instanceUrl && (
          <div className="sfdc-footer">
            <a href={`${instanceUrl}/lightning/o/Opportunity/list`} target="_blank" rel="noopener noreferrer" className="sfdc-footer-link">
              View all in Salesforce →
            </a>
          </div>
        )}
      </div>
    </>
  );
};