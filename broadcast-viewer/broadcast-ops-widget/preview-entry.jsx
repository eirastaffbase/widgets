import React from "react";
import { createRoot } from "react-dom/client";
import BroadcastOpsWidget from "./src";

const container = document.getElementById("widget-root");
createRoot(container).render(React.createElement(BroadcastOpsWidget));
