import React from "react"
import {screen, render} from "@testing-library/react"

import {StaticTasks} from "./static-tasks";

describe("StaticTasks", () => {
    it("should render the component", () => {
        render(<StaticTasks contentLanguage="en_US" message="World"/>);

        expect(screen.getByText(/Hello World/)).toBeInTheDocument();
    })
})
