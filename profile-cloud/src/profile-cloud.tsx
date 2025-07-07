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

import React, { ReactElement, useState, useEffect, useRef, useMemo } from "react";
// Corrected the import statement to only include types
import { BlockAttributes } from "@staffbase/widget-sdk";

// Declare `we` as a global constant to inform TypeScript it will exist at runtime
declare const we: any;

/**
 * React Component
 */
export interface ProfileCloudProps extends BlockAttributes {
  profilefieldmappings: string;
  defaultprofilefield: string;
  coloroptions: string;
}

// Sample data to be used when API fails or for development
const sampleData = {
    "entries":[
        {"type":"user","id":"6827719c65069a389ee2e0af","authorId":"6827719c65069a389ee2e0af","title":"Sminu Abraham","profile":{"ispeak": "English"}},
        {"type":"user","id":"6827719c65069a389ee2e0b0","authorId":"6827719c65069a389ee2e0b0","title":"Nicole Adams","profile":{"ispeak": "English, German, Spanish", "skill": "Communication, Content Creation", "location": "New York"}},
        {"type":"user","id":"6827719c6b2c40606e89bf27","authorId":"6827719c6b2c40606e89bf27","title":"Patrick Anderson","profile":{"ispeak": "English, German", "skill": "Machine operation, Quality inspection", "location": "London"}},
        {"type":"user","id":"6827719c6b2c40606e89bf28","authorId":"6827719c6b2c40606e89bf28","title":"Maria Apathangelou","profile":{"ispeak": "English", "skill": "Production Planning, Lean Manufacturing", "department": "Production"}},
        {"type":"user","id":"6827719cf5d2917eb2a9bde0","authorId":"6827719cf5d2917eb2a9bde0","title":"Mohammed Ashour","profile":{"ispeak": "English", "skill": "Operations, Project Management", "location": "New York", "hobby": "Gaming"}},
        {"type":"user","id":"6827719c6b2c40606e89bf2c","authorId":"6827719c6b2c40606e89bf2c","title":"Marcus Barlow","profile":{"ispeak": "English", "skill": "Sensor Expert", "department": "Engineering", "hobby": "Soccer"}},
    ],
};

export const ProfileCloud = ({ profilefieldmappings, defaultprofilefield, coloroptions }: ProfileCloudProps): ReactElement => {
    const [isFallback, setIsFallback] = useState<boolean>(false);

    // This logic now adapts based on whether the widget is in fallback mode.
    const { availableOptions, displayMap } = useMemo(() => {
        const map: { [key: string]: string } = {};
        const options: { slug: string; name: string }[] = [];

        if (isFallback) {
            // If API fails, use a hardcoded map that works with the sample data.
            const fallbackMappings = {
                ispeak: "Language (Sample)",
                skill: "Skill (Sample)",
                location: "Location (Sample)",
                department: "Department (Sample)",
                hobby: "Hobby (Sample)",
            };
            for (const [slug, name] of Object.entries(fallbackMappings)) {
                options.push({ slug, name });
                map[slug] = name;
            }
        } else {
            // Otherwise, parse the configuration from the widget settings.
            if (profilefieldmappings) {
                profilefieldmappings.split('\n').forEach(line => {
                    const parts = line.split(':');
                    if (parts.length === 2) {
                        const slug = parts[0].trim();
                        const name = parts[1].trim();
                        if (slug && name) {
                            options.push({ slug, name });
                            map[slug] = name;
                        }
                    }
                });
            }
        }
        return { availableOptions: options, displayMap: map };
    }, [profilefieldmappings, isFallback]);

    // Parse the colors from the configuration string
    const colorPalette = useMemo(() => {
        const defaultPalette = ["#0d47a1", "#1976d2", "#2196f3", "#64b5f6", "#bbdefb"];
        console.log(coloroptions);
        if (coloroptions) {
            const parsedColors = coloroptions.split(/[,\n]+/).map(c => c.trim()).filter(c => /^#([0-9A-F]{3}){1,2}$/i.test(c));
            if (parsedColors.length > 0) {
                return parsedColors;
            }
        }
        return defaultPalette;
    }, [coloroptions]);

    console.log(colorPalette);

    const [users, setUsers] = useState<any[]>([]);
    const [wordData, setWordData] = useState<{ text: string; value: number }[]>([]);
    const [selectedField, setSelectedField] = useState<string>(defaultprofilefield || (availableOptions.length > 0 ? availableOptions[0].slug : ''));
    const [selectedWord, setSelectedWord] = useState<string | null>(null);
    const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
    const selectRef = useRef<HTMLSelectElement>(null);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const getAllUsers = async (limit: number, offset: number, userList: any[]): Promise<any[]> => {
                    const loadedUsers = await we.api.getUsers({ status: 'activated', limit, offset });
                    const all = userList.concat(loadedUsers.data);

                    if (loadedUsers.total > limit + offset) {
                        return await getAllUsers(limit, limit + offset, all);
                    }
                    return all;
                };

                const fetchedUsers = await getAllUsers(1000, 0, []);
                setUsers(fetchedUsers);
                setIsFallback(false); // Ensure fallback is off if API call succeeds
            } catch (error) {
                console.error("Failed to fetch users, using sample data:", error);
                setUsers(sampleData.entries);
                setIsFallback(true); // Turn on fallback mode
            }
        };

        fetchUsers();
    }, []);
    
    // This effect ensures the selected field is valid if the dropdown options change
    useEffect(() => {
        const currentSelectionIsValid = availableOptions.some(opt => opt.slug === selectedField);
        if (!currentSelectionIsValid && availableOptions.length > 0) {
            setSelectedField(availableOptions[0].slug);
        }
    }, [availableOptions]);

    useEffect(() => {
        if (users.length > 0 && selectedField) {
            const counts: { [key: string]: number } = {};
            const fieldSlug = selectedField; 

            users.forEach((user) => {
                if (user.profile && user.profile[fieldSlug]) {
                    const terms = String(user.profile[fieldSlug]).split(',').map((term: string) => term.trim());
                    terms.forEach((term: string) => {
                        if (term) {
                            counts[term] = (counts[term] || 0) + 1;
                        }
                    });
                }
            });

            const formattedData = Object.keys(counts).map(key => ({
                text: key,
                value: counts[key]
            }));

            setWordData(formattedData);
        } else {
            setWordData([]);
        }
    }, [users, selectedField]);

    const handleWordClick = (word: string) => {
        const fieldSlug = selectedField;
        const filteredUsers = users.filter(user =>
            user.profile &&
            user.profile[fieldSlug] &&
            String(user.profile[fieldSlug]).split(',').map((term: string) => term.trim()).includes(word)
        );
        setSelectedWord(word);
        setSelectedUsers(filteredUsers);
    };

    const handleIconClick = () => {
        selectRef.current?.focus();
    };

    const maxFontSize = 50;
    const minFontSize = 14;
    const counts = wordData.map(d => d.value);
    const minValue = Math.min(...counts, Infinity);
    const maxValue = Math.max(...counts, -Infinity);

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
                 <label htmlFor="profile-select" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <svg onClick={handleIconClick} aria-hidden="true" viewBox="0 0 24 24" width="1.5em" height="1.5em" fill="currentColor" style={{ marginRight: '10px' }}>
                        <path d="M20.59,9.328a6.057,6.057,0,0,0,.91-2.919V4.159c0-1.246-2.515-4.066-10-4.066S1.5,2.91,1.5,4.159v2.25a6.024,6.024,0,0,0,1.562,3.767L9.5,16.616v5.793a1.5,1.5,0,0,0,1.5,1.5h1a1.5,1.5,0,0,0,1.5-1.5V19.893A6.481,6.481,0,0,0,20.59,9.328ZM11.5,2.093c4.963,0,8,1.559,8,2.407s-3.037,2.409-8,2.409S3.5,5.35,3.5,4.5,6.537,2.093,11.5,2.093ZM16,18.409a4.53,4.53,0,0,1-2.374-.677.251.251,0,0,1-.126-.217v-.8a.251.251,0,0,1,.073-.177l5.5-5.5a.251.251,0,0,1,.369.016A4.45,4.45,0,0,1,20.5,13.909,4.505,4.505,0,0,1,16,18.409Z"></path>
                    </svg>
                    {availableOptions.length > 0 ? (
                        <select id="profile-select" ref={selectRef} value={selectedField} onChange={(e) => setSelectedField(e.target.value)} style={{ fontSize: '16px', padding: '5px' }}>
                            {availableOptions.map(opt => (
                                <option key={opt.slug} value={opt.slug}>{opt.name}</option>
                            ))}
                        </select>
                    ) : <p>No fields configured.</p>}
                </label>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', minHeight: '150px', padding: '10px' }}>
                {wordData.length > 0 ? wordData.map((word, index) => {
                    const scale = maxValue > minValue ? (word.value - minValue) / (maxValue - minValue) : 0;
                    const fontSize = minFontSize + (maxFontSize - minFontSize) * scale;
                    const color = colorPalette[index % colorPalette.length];

                    return (
                        <span
                            key={index}
                            style={{
                                fontSize: `${fontSize}px`,
                                color: color,
                                margin: '10px',
                                cursor: 'pointer',
                                transition: 'transform 0.2s',
                            }}
                            onClick={() => handleWordClick(word.text)}
                            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            {word.text}
                        </span>
                    );
                }) : <p>No data to display for the selected filter.</p>}
            </div>
             {selectedUsers.length > 0 && (
                <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                    <h3 style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 10px'}}>
                        Users with {displayMap[selectedField] || 'attribute'}: "{selectedWord}"
                        <button onClick={() => {setSelectedUsers([]); setSelectedWord(null);}} style={{border: 'none', background: 'transparent', fontSize: '1.5em', cursor: 'pointer', padding: '0' }}>&times;</button>
                    </h3>
                    <ul style={{listStyleType: 'none', padding: '0 10px', margin: '10px 0'}}>
                        {selectedUsers.map(user => (
                            <li key={user.id} style={{padding: '5px 0', borderBottom: '1px solid #f2f2f2'}}><a href={`/profile/${user.id}`} target="_blank" rel="noopener noreferrer" style={{textDecoration: 'none', color: '#3498db'}}>{user.title}</a></li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};