/*!
 * Copyright 2024, Staffbase GmbH and contributors.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { screen } from "@testing-library/dom";

import "../dev/bootstrap";

describe("Widget test", () => {
  beforeAll(() => {
    document.body.innerHTML = `
        <div id="preview"></div>
        <div id="config"></div>
        `;
  });

  it("should render the widget", async () => {
    const widget = document.createElement("chat-widget");
    widget.setAttribute("message", "World");
    await import("./index");
    document.body.appendChild(widget);

    expect(await screen.findByText(/Hello World/)).toBeInTheDocument();
    expect(screen.getByText(/en_US/)).toBeInTheDocument();
    expect(screen.getByLabelText('Chat Widget')).toBeInTheDocument();
  });
});
