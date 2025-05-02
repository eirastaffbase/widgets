import React from "react"
import {screen, render} from "@testing-library/react"

import {SpotifyWidget} from "./spotify-widget";

describe("SpotifyWidget", () => {
    it("should render the component", () => {
        render(<SpotifyWidget contentLanguage="en_US" message="World"/>);

        expect(screen.getByText(/Hello World/)).toBeInTheDocument();
    })
})
