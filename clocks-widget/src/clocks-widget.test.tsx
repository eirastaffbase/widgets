import React from "react"
import {screen, render} from "@testing-library/react"

import {ClocksWidget} from "./clocks-widget";

describe("ClocksWidget", () => {
    it("should render the component", () => {
        render(<ClocksWidget timezone={""} heading={""} showheading={false} headingplacement={"top"} headingcolor={""} headingfontsize={0} usedigitalclockstyle={false} digitalclockformat={""} digitalclockcolor={""} digitalclockfontsize={""} useanalogueclockstyle={false} analogueclocksize={0} analogueclockbasecolor={""} analogueclockbordercolor={""} analogueclockcentercolor={""} analogueclocknotchcolor={""} analogueclockhandcolorhour={""} analogueclockhandcolorminute={""} analogueclockhandcolorsecond={""} contentLanguage={""} />);
        
    })
})
