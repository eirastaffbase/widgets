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
          "dueDate": "today"
        },
        {
          "title": "Submit Monthly Expense Report",
          "dueDate": "today+1"
        },
        {
          "title": "Schedule Q3 Performance Review",
          "dueDate": "today+7"
        },
        {
            "title": "Finalize Project Proposal",
            "dueDate": "today"
        },
        {
            "title": "Book Flights for Conference",
            "dueDate": "today+1"
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
    "ui:help": "Enter tasks as a JSON array. Each task needs a 'title' (string) and 'dueDate' (string: 'YYYY-MM-DD', 'today', or 'today+N').",
    "ui:options": {
      rows: 15,
    }
  },
};
