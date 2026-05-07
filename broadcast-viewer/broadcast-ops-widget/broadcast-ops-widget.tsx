import {
  BlockFactory,
  BlockDefinition,
  ExternalBlockDefinition,
  BaseBlock,
} from "@staffbase/widget-sdk";

import { JSONSchema7 } from "json-schema";
import { UiSchema } from "@rjsf/utils";
import React from "react";
import ReactDOM from "react-dom/client";
import BroadcastOpsWidget from "./src";

const configurationSchema: JSONSchema7 = {
  properties: {
    defaultrole: {
      type: "string",
      title: "Default Role",
      enum: ["station", "hq"],
      default: "station",
    },
  },
};

const uiSchema: UiSchema = {
  defaultrole: {
    "ui:widget": "select",
    "ui:help": "Default user role shown on load (station or HQ)",
  },
};

const factory: BlockFactory = (BaseBlockClass, _widgetApi) => {
  return class BroadcastOpsWidgetBlock extends BaseBlockClass implements BaseBlock {
    private root: ReturnType<typeof ReactDOM.createRoot> | null = null;

    constructor() {
      super();
    }

    async renderBlock(container: any) {
      // Inject Tailwind CSS CDN if not already present
      if (!document.getElementById("tailwind-cdn")) {
        const script = document.createElement("script");
        script.id = "tailwind-cdn";
        script.src = "https://cdn.tailwindcss.com";
        document.head.appendChild(script);
      }

      this.root = ReactDOM.createRoot(container);
      this.root.render(React.createElement(BroadcastOpsWidget));
    }

    disconnectedCallback() {
      if (this.root) {
        this.root.unmount();
        this.root = null;
      }
    }

    static get observedAttributes() {
      return ["defaultrole"];
    }
  };
};

const blockDefinition: BlockDefinition = {
  name: "broadcast-ops-widget",
  label: "Broadcast Operations",
  attributes: ["defaultrole"],
  factory: factory,
  configurationSchema: configurationSchema,
  uiSchema: uiSchema,
  blockLevel: "block",
  iconUrl: "",
};

const externalBlockDefinition: ExternalBlockDefinition = {
  blockDefinition,
  author: "Broadcast Ops Team",
  version: "1.0.0",
};

window.defineBlock(externalBlockDefinition);
