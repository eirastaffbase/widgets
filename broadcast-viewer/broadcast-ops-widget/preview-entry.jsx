import React from "react";
import { createRoot } from "react-dom/client";
import BroadcastOpsWidget from "../broadcast_ops_widget";

const container = document.getElementById("widget-root");
createRoot(container).render(React.createElement(BroadcastOpsWidget));
