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

// Helper to format dates (e.g., "Jun 20")
const getFormattedDate = (date: Date): string => {
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
};

/**
 * Parses a due date string, allowing for dynamic dates like "today" or "today+7".
 * @param {string} dueDateStr - The due date string from the JSON.
 * @returns {Date} The calculated date object, normalized to the start of the day.
 */
const parseDueDate = (dueDateStr: string): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize today to midnight for accurate comparisons

  // Regex to match "today" or "today+N" (case-insensitive, allows spaces)
  const match = dueDateStr.trim().match(/^today(?:\s*\+\s*(\d+))?$/i);

  if (match) {
    const daysToAdd = match[1] ? parseInt(match[1], 10) : 0;
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + daysToAdd);
    return targetDate;
  }

  // Fallback for standard date strings like "YYYY-MM-DD"
  // Appending T00:00:00 prevents timezone-related date shifts
  return new Date(dueDateStr + "T00:00:00");
};


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

  /**
   * Determines the text and styling for the due date bubble based on the date.
   * @param {string} dueDateStr - The raw due date string (e.g., "today+1", "2025-09-15").
   * @returns An object with the display text and color properties.
   */
  const getDateDisplay = (dueDateStr: string) => {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Normalize dates to midnight for consistent comparisons
    today.setHours(0, 0, 0, 0);
    tomorrow.setHours(0, 0, 0, 0);

    const dueDate = parseDueDate(dueDateStr);

    if (dueDate.getTime() === today.getTime()) {
      return { text: "Today", color: "#FEDDBA", textColor: "#492F17" };
    }
    if (dueDate.getTime() === tomorrow.getTime()) {
      return { text: "Tomorrow", color: "#B3E5FC", textColor: "#01579B" };
    }
    return { text: getFormattedDate(dueDate), color: "#A2D5A6", textColor: "#2c512e" };
  };

  // ======================= CHANGES START HERE =======================

  // 1. CSS for item hover effects and to give the container a background
  //    The container's background will be the color that shows in the gaps.
  const dynamicStyles = `
  .tasks-widget__item {
    background-color: rgb(225,225,228,0.25);
  }
  .tasks-widget__item:hover {
    background-color: rgb(215,215,228,0.3); /* Slightly darker on hover */
  }

  `;

  // 2. Base styles for the main container
  const containerStyle: React.CSSProperties = {
    maxWidth: 500,
    fontFamily: "'Inter', sans-serif",
    borderRadius: "16px",
    padding: '8px',      // Padding creates space around the list
    overflow: 'hidden',
  };

  // Filter tasks to get only visible ones
  const visibleTasks = tasks.filter(task => !task.checked);

  return (
    <>
      <style>{dynamicStyles}</style>
      <div
          className="tasks-widget tasks-widget__container" // Use a class for the background
          style={containerStyle}
      >
        <ul className="tasks-widget__list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {tasks.map((task, index) => { // Keep mapping all tasks for animation purposes
            const { text, color, textColor } = getDateDisplay(task.dueDate);

            const isFirstVisibleItem = visibleTasks.length > 0 && visibleTasks[0].id === task.id;
            const isLastVisibleItem = visibleTasks.length > 0 && visibleTasks[visibleTasks.length - 1].id === task.id;
            const totalVisibleTasks = visibleTasks.length;

            // 3. Conditionally set the border-radius for the single-block illusion
            const getBorderRadius = () => {
              const radius = "16px";
              if (totalVisibleTasks === 0) return "0"; // No visible tasks, no radius needed
              if (totalVisibleTasks === 1) return radius; // All corners if only one visible item
              if (isFirstVisibleItem) return `${radius} ${radius} 0 0`; // Top corners only
              if (isLastVisibleItem) return `0 0 ${radius} ${radius}`; // Bottom corners only
              return "0"; // No rounding for middle items
            };

            const itemStyle: React.CSSProperties = {
              display: "flex",
              alignItems: "center",
              padding: "16px",
              borderRadius: getBorderRadius(), // Apply the conditional radius
              // Use margin to create the gap. It disappears when the task is checked.
              marginBottom: task.checked ? '0px' : (isLastVisibleItem ? '0px' : '2px'), // Adjust margin for visible last item
              overflow: "hidden",
              transition: "all 0.4s ease-in-out",
              opacity: task.checked ? 0 : 1,
              maxHeight: task.checked ? "0px" : "100px",
              paddingTop: task.checked ? 0 : "16px",
              paddingBottom: task.checked ? 0 : "16px",
              transform: task.checked ? "translateY(-25%)" : "translateY(0)",
            };

            // If the task is checked and its animation has completed, we can consider not rendering it
            // This is a subtle optimization for performance on very long lists,
            // but the CSS transitions already handle the visual disappearance well.
            // For simplicity and smoother transitions, we'll keep rendering it until it's effectively hidden.
            // if (task.checked && itemStyle.maxHeight === "0px") {
            //   return null; // Don't render if completely hidden
            // }


            // ======================== CHANGES END HERE ========================

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
                    border: task.checked ? "2px solid #4CAF50" : "2px dashed #ccc",
                    backgroundColor: task.checked ? "#4CAF50" : "transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: "16px",
                    transition: "all 0.2s ease-in-out"
                  }}
                >
                  <svg
                      className="tasks-widget__checkbox-icon"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={task.checked ? "white" : "#ccc"}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <span className="tasks-widget__title" style={{ flexGrow: 1, color: "#333", marginRight: "16px" }}>{task.title}</span>
                <span
                  className={`tasks-widget__due-date`}
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
    </>
  );
};