import React from "react"
import {screen, render} from "@testing-library/react"

import {SalesforceViewer} from "./salesforce-viewer";

describe("SalesforceViewer", () => {
    it("should render the component", () => {
        render(<SalesforceViewer contentLanguage="en_US" message="World"/>);

        expect(screen.getByText(/Hello World/)).toBeInTheDocument();
    })
})
