import React from "react"
import {screen, render} from "@testing-library/react"

import {ProfileCloud} from "./profile-cloud";

describe("ProfileCloud", () => {
    it("should render the component", () => {
        render(<ProfileCloud contentLanguage="en_US" message="World"/>);

        expect(screen.getByText(/Hello World/)).toBeInTheDocument();
    })
})
