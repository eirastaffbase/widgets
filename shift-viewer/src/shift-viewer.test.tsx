import React from "react"
import {screen, render} from "@testing-library/react"

import {ShiftViewer} from "./shift-viewer";

describe("ShiftViewer", () => {
    it("should render the component", () => {
        render(<ShiftViewer contentLanguage="en_US" message="World"/>);

        expect(screen.getByText(/Hello World/)).toBeInTheDocument();
    })
})
