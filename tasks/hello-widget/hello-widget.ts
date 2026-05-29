/*

This is an attempt to provide the simplest possible example of a custom block, with some commentary on the various pieces.

Commented documentation by Deane Barker (deane.barker@staffbase.com)

To use:

1. "npm install" from the directory
2. "npm run build" from the directory

The file that appears in /dist is the custom widget that can be registered.

*/

import {
  BlockFactory,
  BlockDefinition,
  ExternalBlockDefinition,
  BaseBlock,
} from "@staffbase/widget-sdk";

import { JSONSchema7 } from "json-schema";
import { UiSchema } from "@rjsf/utils";

/*
This object defines the properties that will be captured from the editor
Each of these will be mapped to an attribute on the element

Notes:

1. You have to provide a "type" and "title" for each
2. The properies have to be lower-case. If they have any uppercase characters, they will not be retained.
3. You have to provide at least one property, or the widget won't register.

*/
const configurationSchema: JSONSchema7 = {
  properties: {
    name: {
      type: "string",
      title: "Name",
    },
  },
};

// This is not technically required, but helpful and usually always provided
const uiSchema: UiSchema = {
  name: {
    "ui:widget": "textarea",
    "ui:help": "Enter your name here",
  },
};

// This is the factory method that returns the custom element
// You have to extend from BaseBlockClass, because object instantiation appears to be done using a "call()" syntax which won't execute the constructor correctly
const factory: BlockFactory = (BaseBlockClass, _widgetApi) => {
  return class HelloWidget extends BaseBlockClass implements BaseBlock {
    constructor() {
      super();
    }

    // THIS IS THE FUNCTION THAT EXECUTES WHEN THE BLOCK RENDERS.
    // Do literally whatever you want in here.
    async renderBlock(container: any) {
      container.innerHTML = `Hello ${this.getAttribute("name")}!`;
    }

    // You have to define this static method, otherwise the widget won't register
    static get observedAttributes() {
      return ["name"];
    }
  };
};

// This is the block definition that will be registered with the custom element registry
const blockDefinition: BlockDefinition = {
  name: "hello-widget", // The custom element name
  label: "Hello Widget", // How it appears in the editor menu
  attributes: ["name"], // You have to have at least ONE attribute; it will not register otherwise
  factory: factory,
  configurationSchema: configurationSchema,
  uiSchema: uiSchema,
  blockLevel: "block", // You can do "inline" too, and the widget will be rendered as inline-block
  iconUrl: "", // You technically don't have to provide this, but it looks weird without it
};

// This just extends the above with a couple other properties
const externalBlockDefinition: ExternalBlockDefinition = {
  blockDefinition,
  author: "Deane Barker",
  version: "1.0.0",
};

window.defineBlock(externalBlockDefinition);
