import React from "react"
import {screen, render} from "@testing-library/react"

import {WeatherTimeGeolocation} from "./weather-time-geolocation";

describe("WeatherTimeGeolocation", () => {
    it("should render the component", () => {
        render(<WeatherTimeGeolocation contentLanguage="en_US" city="New York" allowcityoverride="true"/>);

        expect(screen.getByText(/Hello World/)).toBeInTheDocument();
    })
})
