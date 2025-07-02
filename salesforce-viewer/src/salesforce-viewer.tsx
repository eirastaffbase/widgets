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

// Define the shape of a Salesforce Opportunity
interface Opportunity {
  Id: string;
  Name: string;
  StageName: string;
  Amount: number;
  CloseDate: string;
}

// Update the props for the component to match the new schema
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

  useEffect(() => {
    // A function to fetch data from Salesforce
    const fetchData = async () => {
      // Guard against running without credentials
      if (!salesforceusername || !salesforcepassword || !salesforceconsumerkey || !salesforceconsumersecret) {
        setError("Missing Salesforce credentials in widget configuration.");
        setLoading(false);
        return;
      }
      
      try {
        // Step 1: Authenticate and get an Access Token
        const authUrl = `${salesforceloginurl}/services/oauth2/token`;
        const authParams = new URLSearchParams();
        authParams.append("grant_type", "password");
        authParams.append("client_id", salesforceconsumerkey);
        authParams.append("client_secret", salesforceconsumersecret);
        authParams.append("username", salesforceusername);
        authParams.append("password", salesforcepassword);

        const authResponse = await fetch(authUrl, {
          method: "POST",
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: authParams,
        });

        const authData = await authResponse.json();
        
        if (!authResponse.ok) {
          throw new Error(`Authentication failed: ${authData.error_description || 'Unknown error'}`);
        }
        
        const { access_token, instance_url } = authData;
        
        // Step 2: Query for Opportunities using the Access Token
        const query = "SELECT Id, Name, StageName, Amount, CloseDate FROM Opportunity WHERE IsClosed = false ORDER BY Amount DESC LIMIT 10";
        const queryUrl = `${instance_url}/services/data/v58.0/query/?q=${encodeURIComponent(query)}`;

        const queryResponse = await fetch(queryUrl, {
          headers: {
            Authorization: `Bearer ${access_token}`,
          },
        });

        const queryData = await queryResponse.json();
        
        if (!queryResponse.ok) {
            throw new Error(`Failed to fetch data: ${queryData[0]?.message || 'Unknown error'}`);
        }

        setOpportunities(queryData.records);

      } catch (err: any) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [props]); // Re-run effect if props change

  if (loading) {
    return <div>Loading Salesforce opportunities...</div>;
  }

  if (error) {
    return <div style={{ color: 'red' }}>Error: {error}</div>;
  }

  return (
    <div>
      <h3>Salesforce Opportunities</h3>
      {opportunities.length > 0 ? (
        <ul style={{ listStyleType: 'none', padding: 0 }}>
          {opportunities.map((opp) => (
            <li key={opp.Id} style={{ border: '1px solid #ccc', borderRadius: '4px', padding: '10px', marginBottom: '10px' }}>
              <div style={{ fontWeight: 'bold' }}>{opp.Name}</div>
              <div><strong>Stage:</strong> {opp.StageName}</div>
              <div><strong>Amount:</strong> ${opp.Amount?.toLocaleString()}</div>
              <div><strong>Close Date:</strong> {opp.CloseDate}</div>
            </li>
          ))}
        </ul>
      ) : (
        <p>No open opportunities found.</p>
      )}
    </div>
  );
};