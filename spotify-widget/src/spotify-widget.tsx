/*!
 * Copyright 2023, Staffbase GmbH and contributors.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { ReactElement } from "react";
import { BlockAttributes } from "widget-sdk";
import CSS from "csstype";

/**
 * React Component
 */
export interface SpotifyWidgetProps extends BlockAttributes {
  src: string;
  width: string;
  size: string;
}

export const SpotifyWidget = ({ src, size, width }: SpotifyWidgetProps): ReactElement => {

const spotifyStyleNormal: CSS.Properties = {
    borderRadius: "12px",
    height: "352px"
  };

const spotifyStyleCompact: CSS.Properties = {
    borderRadius: "12px",
    height: "152px"
  };

  spotifyStyleCompact.width = width;
  spotifyStyleNormal.width = width;

let spotifyStyle : CSS.Properties = spotifyStyleNormal;

if (size == "Normal") 
  spotifyStyle = spotifyStyleNormal;
else if (size == "Compact")
  spotifyStyle = spotifyStyleCompact;

return <iframe style={spotifyStyle} src={src} allow='autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture' loading='lazy'></iframe>;
};