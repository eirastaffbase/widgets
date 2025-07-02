import React from "react"
import {screen, render} from "@testing-library/react"

import {LinkedinViewer} from "./linkedin-viewer";

describe("LinkedinViewer", () => {
    it("should render the component", () => {
        render(<LinkedinViewer contentLanguage="en_US" message="World"/>);

        expect(screen.getByText(/Hello World/)).toBeInTheDocument();
    })
})
