/*!
 * Copyright 2021, Staffbase GmbH and contributors.
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

import { UiSchema } from "@rjsf/core";
import { JSONSchema7 } from "json-schema";

/**
 * schema used for generation of the configuration dialog
 * see https://react-jsonschema-form.readthedocs.io/en/latest/ for documentation
 */
export const configurationSchema: JSONSchema7 = {
  properties: {
    title: {
      type: "string",
      title: "Title",
    },
    fieldfilter: {
      type: "string",
      title: "Filter Profile Field ID"
    },
    fieldvalue: {
      type: "string",
      title: "Filter Profile Field Value"
    },
    /*
    groupid: {
      type: "string",
      title: "Group ID",
    },
    */
    numbertoshow: {
      type: "number",
      title: "Height (px)",
    },
    anniversaryprofilefieldid: {
      type: "string",
      title: "Celebration Profile Field ID"
    },
    dateformat: {
      type: "string",
      enum: ["DD.MM", "MM.DD"],
      title: "Day/Month Order",
      default: "MM.DD"
    },
    showdate: {
      type: "boolean",
      title: "Show Celebration Date?",
      default: true
    },
    hideemptywidget: {
      type: "boolean",
      title: "Hide widget if empty",
      default: false
    },
    /*
    imageurl: {
      type: "string",
      title: "Default Profile Picture Image URL"
    },
    */
    loadingmessage: {
      type: "string",
      title: "Message when the widget is still loading",
    },
    noinstancesmessage: {
      type: "string",
      title: "Message when there are no applicable users",
    },
    yearword: {
      type: "string",
      title: "Year Word"
    },
    yearwordplural: {
      type: "string",
      title: "Year Word Plural"
    },
    includeyear: {
      type: "boolean",
      title: "Split by Year"
    },
    /*
    todaytitle: {
      type: "string",
      title: "Greeting for Celebrations Today",
    },
    */
    showdaysbefore: {
      type: "number",
      title: "Number of Days Before Celebrations",
      default: 0
    },
    /*
    daysbeforetitle: {
      type: "string",
      title: "Days Before Title",
    },
    */
    showdaysafter: {
      type: "number",
      title: "Number of Days After Celebrations",
      default: 30
    },
    /*
    daysaftertitle: {
      type: "string",
      title: "Days After Title",
    },
    */
    specialyears: {
      type: "string",
      title: "Special Years",
    },
    headercolor: {
      type: "string",
      title: "Header Color",
    },
    hideyearheader: {
      type: "boolean",
      title: "Hide year header",
      default: false
    },
    optoutfield: {
      type: "string",
      title: "Profile Field ID for Opt Out Field"
    },
    optoutvalue: {
      type: "string",
      title: "Value for Opt Out Field"
    },
/*
    showwholemonth: {
      type: "boolean",
      title: "Show Celebrations from the Whole Month?",
      default: false
    },
    showwholemonthforxdays: {
      type: "number",
      title: "Number of days to show Month of Celebrations",
    },

    linktochat: {
      type: "boolean",
      title: "Link to Chat?",
      default: false
    },
    limit: {
      type: "number",
      title: "Maximum Users to Show",
    },
    additionalfieldsdisplayed: {
      type: "string",
      title: "Additional Profile Fields to Display",
    },
    
    optoutgroupid: {
      type: "string",
      title: "Opt Out GroupIDs",
    },
    */
    includepending: {
      type: "boolean",
      title: "Include Pending Users",
      default: false
    }
  },
  required : ["anniversaryprofilefieldid", "dateformat"],
  dependencies: {
    /*
    limit: {
      properties: {
        fullpageid: {
          type: "string",
          title: "Page ID",
        },
        fullpagetext: {
          type: "string",
          title: "Message Link to Full page",
        }
      }
    },
    */
    includepending: {
      oneOf: [
        {
          properties: {
            includepending: {
              enum: [ true ]
            },
            networkid: {
              type: "string",
              title: "Network Plugin ID",
            }
          },
          required: [
            "networkid"
          ]
        }
      ]
    },
  }
};

/**
 * schema to add more customization to the form's look and feel
 * @see https://react-jsonschema-form.readthedocs.io/en/latest/api-reference/uiSchema/
 */
export const uiSchema: UiSchema = {
  anniversaryprofilefieldid: {
    "ui:help": "Enter the profile field ID of the field that holds the date information",
  },
  groupid: {
    "ui:help": "The group ID for the group of users who should be shown"
  },
  dateformat: {
    "ui:help": "Enter the order of day and month here"
  },
  includepending: {
    "ui:help": "Check to include pending users",
    "ui:hidden": true
  },
  title: {
    "ui:help": "The title of the widget",
  },
  todaytitle: {
    "ui:help": "The wording that will be shown above the users whose celebration is today",
  },
  loadingmessage: {
    "ui:help": "The message that will be shown while the widget is still loading",
  },
  noinstancesmessage: {
    "ui:help": "Text that will be shown in the event that there are no applicable users",
  },
  yearword: {
    "ui:help": "The word to use for the instance (Anniversary, Birthday, Year, etc)",
  },
  yearwordplural: {
    "ui:help": "The word to use for the instance plural (Anniversaries, Birthdays, Years, etc)",
  },
  showdate: {
    "ui:help": "Select to show the user's date next to the user's name",
  },
  hideemptywidget: {
    "ui:help": "If enabled and no applicable user is found, the widget will be hidden.",
  },
  showwholemonth: {
    "ui:help": "Select to show all celebrations for the current month",
  },
  showwholemonthforxdays: {
    "ui:help": "Number of days that the month's worth of celebrations should be shown (starting at the beginning of the month)",
  },
  showdaysbefore: {
    "ui:help": "The number of previous days for which corresponding instances should be shown",
  },
  daysbeforetitle: {
    "ui:help": "The message that appears at the top of previous celebrations section",
  },
  showdaysafter: {
    "ui:help": "The number of upcoming days for which corresponding instances should be shown",
  },
  daysaftertitle: {
    "ui:help": "The message that appears at the top of upcoming celebrations section",
  },
  specialyears: {
    "ui:help": "If only certain years of celebrations should be shown, enter numbers separated by commas",
  },
  hideyearheader: {
    "ui:help": "Especially useful if you are showing only one special year and the title is redundant",
  },
  fieldfilter: {
    "ui:help": "The profile field ID that will be used to filter users",
  },
  fieldvalue: {
    "ui:help": "The profile field value that will be used to filter users",
  },
  /*
  linktochat: {
    "ui:help": "Select if the link to a chat message should be shown, default is a link to the user's profile",
  },
  limit: {
    "ui:help": "Maximum number of users to be shown",
  },
  fullpageid: {
    "ui:help": "Page ID to the page with the full list of celebrations shown",
  },
  fullpagetext: {
    "ui:help": "Link text to link to page with the full list of celebrations",
  },
  */
  headercolor: {
    "ui:help": "Hexcode color of the Header",
  },
  additionalfieldsdisplayed: {
    "ui:help": "Profile Field IDs to show next to user's name separated by commas",
  },
  optoutgroupid: {
    "ui:help": "Group ID of opt out group. Users in this group will not be shown in the widget",
  },
  includeyear: {
    "ui:help": "Split by year and show year of celebration",
  },
  numbertoshow : {
    "ui: help": "Enter the height of the widget (in pixels) Each profile is approximately 80 px. If left blank, all profiles will be shown."
  },
  optoutfield: {
    "ui:help": "Profile Field ID for Opt Out Field"
  },
};
