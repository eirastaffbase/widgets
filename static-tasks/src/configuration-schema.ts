import { UiSchema } from "@rjsf/utils";
import { JSONSchema7 } from "json-schema";

export const configurationSchema: JSONSchema7 = {
  properties: {
    tasksjson: {
      type: "string",
      title: "Tasks JSON",
      default: `[
        {
          "title": "Complete Required Safety Training",
          "dueDate": "${new Date().toISOString().split('T')[0]}"
        },
        {
          "title": "Submit Monthly Expense Report",
          "dueDate": "${new Date(Date.now() + 86400000).toISOString().split('T')[0]}"
        },
        {
          "title": "Schedule Q3 Performance Review",
          "dueDate": "2025-09-15"
        },
        {
            "title": "Finalize Project Proposal",
            "dueDate": "${new Date().toISOString().split('T')[0]}"
        },
        {
            "title": "Book Flights for Conference",
            "dueDate": "${new Date(Date.now() + 86400000).toISOString().split('T')[0]}"
        },
        {
            "title": "Update Client Contact Information",
            "dueDate": "2025-07-28"
        }
      ]`,
    },
  },
};

export const uiSchema: UiSchema = {
  tasksjson: {
    "ui:widget": "textarea",
    "ui:help": "Enter tasks as a JSON array. Each task object must have a 'title' (string) and a 'dueDate' (string in YYYY-MM-DD format).",
    "ui:options": {
      rows: 15,
    }
  },
};