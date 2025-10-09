import React from "react"
import {screen, render} from "@testing-library/react"

import {ChatWidget} from "./chat-widget";

describe("ChatWidget", () => {
    it("should render the component", () => {
        render(<ChatWidget contentLanguage="en_US" message="World"/>);

        expect(screen.getByText(/Hello World/)).toBeInTheDocument();
    })
})
