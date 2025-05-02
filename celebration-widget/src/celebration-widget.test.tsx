import React from "react"
import {screen, render} from "@testing-library/react"

import {CelebrationWidget} from "./celebration-widget";

describe("CelebrationWidget", () => {
    it("should render the component", () => {
        render(<CelebrationWidget contentLanguage="en_US" message="World"/>);

        expect(screen.getByText(/Hello World/)).toBeInTheDocument();
    })
})
