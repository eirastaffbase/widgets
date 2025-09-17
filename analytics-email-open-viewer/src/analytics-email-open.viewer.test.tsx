import React from "react"
import {screen, render} from "@testing-library/react"

import {AnalyticsEmailOpenViewer} from "./analytics-email-open-viewer";

describe("AnalyticsEmailOpenViewer", () => {
    it("should render the component", () => {
        render(<AnalyticsEmailOpenViewer contentLanguage="en_US" message="World"/>);

        expect(screen.getByText(/Hello World/)).toBeInTheDocument();
    })
})
