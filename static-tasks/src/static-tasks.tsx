/*!
 * Copyright 2024, Staffbase GmbH and contributors.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/-licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import React, { ReactElement, useState, useEffect } from "react";
import { BlockAttributes } from "widget-sdk";

// Helper to format dates
const getFormattedDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

// Define the structure of a single task
interface Task {
  title: string;
  dueDate: string;
  id: string;
  checked?: boolean;
}

// Define the props for our component
export interface StaticTasksProps extends BlockAttributes {
  tasksjson: string;
}

// The main component
export const StaticTasks = ({ tasksjson }: StaticTasksProps): ReactElement => {
  const [tasks, setTasks] = useState<Task[]>([]);

  // Effect to parse the JSON string from props and initialize state
  useEffect(() => {
    let parsedTasks: Omit<Task, 'id'>[] = [];
    try {
      if (tasksjson) {
        parsedTasks = JSON.parse(tasksjson);
      }
    } catch (error) {
      console.error("Error parsing tasks JSON:", error);
      parsedTasks = [];
    }
    setTasks(
      parsedTasks.map((task, index) => ({
        ...task,
        id: `${task.title}-${index}`,
        checked: false,
      }))
    );
  }, [tasksjson]);

  // Function to handle checking/unchecking a task
  const handleToggleCheck = (id: string) => {
    setTasks(
      tasks.map((task) =>
        task.id === id ? { ...task, checked: !task.checked } : task
      )
    );
  };

  // Function to determine date display properties
  const getDateDisplay = (dueDateStr: string) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dueDate = new Date(dueDateStr + "T00:00:00");

    today.setHours(0, 0, 0, 0);
    tomorrow.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    if (dueDate.getTime() === today.getTime()) {
      return { text: "Today", className: "today", color: "#FFDDA7", textColor: "#6C4A00" };
    }
    if (dueDate.getTime() === tomorrow.getTime()) {
      return { text: "Tomorrow", className: "tomorrow", color: "#B3E5FC", textColor: "#01579B" };
    }
    return { text: getFormattedDate(dueDate), className: "other-day", color: "#C8E6C9", textColor: "#2E7D32" };
  };

  return (
    <div className="tasks-widget" style={{ maxWidth: 500, fontFamily: "'Inter', sans-serif" }}>
      <ul className="tasks-widget__list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {tasks.map((task) => {
          const { text, className: dateClassName, color, textColor } = getDateDisplay(task.dueDate);

          const itemStyle: React.CSSProperties = {
            display: "flex",
            alignItems: "center",
            padding: "16px 8px",
            borderBottom: "1px solid #eee",
            overflow: "hidden",
            transition: "opacity 0.4s ease-out, max-height 0.5s ease-in-out, transform 0.4s ease-out, padding 0.5s ease-in-out",
            opacity: task.checked ? 0 : 1,
            maxHeight: task.checked ? "0px" : "60px",
            paddingTop: task.checked ? 0 : "16px",
            paddingBottom: task.checked ? 0 : "16px",
            transform: task.checked ? "translateY(-100%)" : "translateY(0)",
          };
          
          return (
             <li
                key={task.id}
                className={`tasks-widget__item ${task.checked ? "tasks-widget__item--checked" : ""}`}
                style={itemStyle}
             >
              <div
                className={`tasks-widget__checkbox ${task.checked ? "tasks-widget__checkbox--checked" : ""}`}
                onClick={() => handleToggleCheck(task.id)}
                style={{
                  minWidth: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  border: `2px solid ${task.checked ? "#4CAF50" : "#ccc"}`,
                  backgroundColor: task.checked ? "#4CAF50" : "transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: "16px",
                  transition: "all 0.2s ease-in-out"
                }}
              >
                {task.checked && (
                   <svg
                      className="tasks-widget__checkbox-icon"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                   >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                )}
              </div>
              <span className="tasks-widget__title" style={{ flexGrow: 1, color: "#333" }}>{task.title}</span>
              <span
                className={`tasks-widget__due-date tasks-widget__due-date--${dateClassName}`}
                style={{
                  padding: "4px 12px",
                  borderRadius: "12px",
                  fontSize: "12px",
                  fontWeight: 500,
                  backgroundColor: color,
                  color: textColor,
                  whiteSpace: "nowrap"
                }}
              >
                {text}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};