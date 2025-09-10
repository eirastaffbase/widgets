import React from "react"
import {screen, render} from "@testing-library/react"

import {AnalyticsTrafficSourceAggregate} from "./analytics-traffic-source-aggregate";

describe("AnalyticsTrafficSourceAggregate", () => {
    it("should render the component", () => {
        render(<AnalyticsTrafficSourceAggregate contentLanguage="en_US" message="World"/>);

        expect(screen.getByText(/Hello World/)).toBeInTheDocument();
    })
})
