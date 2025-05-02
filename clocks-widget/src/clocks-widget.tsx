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

import React from "react";
import { BlockAttributes } from "widget-sdk";
import CSS from "csstype";

// digital clock
// https://github.com/pvoznyuk/react-live-clock
import { default as DigitalClock } from 'react-live-clock';

// analog clock
// custom component
import { AnalogClock } from "./AnalogClock";

/**
 * React Component
 */
export interface ClocksWidgetProps extends BlockAttributes {
  timezone: string;
  heading: string;
  showheading: boolean;
  headingplacement: "top" | "bottom";
  headingcolor: string;
  headingfontsize: number;
  usedigitalclockstyle: boolean;
  digitalclockformat: string;
  digitalclockcolor: string;
  digitalclockfontsize: string;
  useanalogclockstyle: boolean;
  analogclocksize: number | 125;
  analogclockbackgroundcolor: string;
  analogclockbordercolor: string;
  analogclockshowhournotchonly: boolean;
  analogclocknotchcolor: string;
  analogclocknotchcolorhour: string;
  analogclockhandcolorhour: string;
  analogclockhandcolorminute: string;
  analogclockhandcolorsecond: string;
}

export const ClocksWidget: React.FC<ClocksWidgetProps> = ({ contentLanguage, showheading, heading, headingplacement, headingcolor, headingfontsize, timezone, useanalogclockstyle, analogclocksize, analogclockbackgroundcolor, analogclockbordercolor, analogclockshowhournotchonly, analogclocknotchcolor, analogclocknotchcolorhour, analogclockhandcolorhour, analogclockhandcolorminute, analogclockhandcolorsecond, usedigitalclockstyle, digitalclockformat, digitalclockcolor, digitalclockfontsize }: ClocksWidgetProps): React.ReactElement => {

  /* =============================================================================
  = BOOLEAN CHECKS ===============================================================
  ================================================================================ */

  const showHeading = typeof showheading == "string" ? showheading === "true" : !!showheading;
  const showDigitalClock = typeof usedigitalclockstyle == "string" ? usedigitalclockstyle === "true" : !!usedigitalclockstyle;
  const showAnalogClock = typeof useanalogclockstyle == "string" ? useanalogclockstyle === "true" : !!useanalogclockstyle;
  const analogClockHourNotchesOnly = typeof analogclockshowhournotchonly == "string" ? analogclockshowhournotchonly === "true" : !!analogclockshowhournotchonly;

  /* =============================================================================
  = STYLING ======================================================================
  ================================================================================ */

  const stylesWidget: CSS.Properties = {
    textAlign: "center",
    width: "100%",
  };

  const stylesHeading: CSS.Properties = {
    color: headingcolor,
    fontSize: headingfontsize + "px",
    paddingTop: (!showAnalogClock || showDigitalClock) ? "10px" : "0px",
    paddingBottom: !showAnalogClock ? "10px" : "0px",
  };

  const stylesAnalogClockContainer: CSS.Properties = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: "10px",
    paddingBottom: "10px",
  };

  const stylesDigitalClockContainer: CSS.Properties = {
    padding: "0px",
  };

  const stylesDigitalClock: CSS.Properties = {
    color: digitalclockcolor,
    fontSize: digitalclockfontsize + "px",
  };

  /* =============================================================================
  = Rendering of the Component ===================================================
  ================================================================================ */

  return <div className="clocks-widget" style={stylesWidget}>
    {showHeading && headingplacement === "top" ? <div className="heading" style={stylesHeading}>{heading}</div> : null}

    {showAnalogClock ?
      <div className="analogclock-container" style={stylesAnalogClockContainer}>
        <AnalogClock timezone={timezone} analogclocksize={analogclocksize} analogclockbackgroundcolor={analogclockbackgroundcolor} analogclockbordercolor={analogclockbordercolor} analogclockshowhournotchonly={analogClockHourNotchesOnly} analogclocknotchcolor={analogclocknotchcolor} analogclocknotchcolorhour={analogclocknotchcolorhour} analogclockhandcolorhour={analogclockhandcolorhour} analogclockhandcolorminute={analogclockhandcolorminute} analogclockhandcolorsecond={analogclockhandcolorsecond} contentLanguage={contentLanguage} />
      </div> : null
    }

    {showDigitalClock && digitalclockformat ?
      <div className="digitalclock-container" style={stylesDigitalClockContainer}>
        <DigitalClock className="digitalclock-clock" style={stylesDigitalClock} locale={contentLanguage} format={digitalclockformat} ticking={true} timezone={timezone} />
      </div> : null
    }

    {showHeading && headingplacement === "bottom" ? <div className="heading" style={stylesHeading}>{heading}</div> : null}
  </div>;
};

