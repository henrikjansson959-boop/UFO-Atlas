import React, { useState, useEffect } from 'react';
import { SavedSearch } from '../types';
import { CronValidator } from '../utils/cronValidator';
import { scheduleAPI } from '../services/api';

/**
 * Configuration for a saved search schedule
 */
export interface ScheduleConfig {
  scheduleEnabled: boolean;
  cronExpression: string | null;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
}

/**
 * Props for the ScheduleEditor component
 */
export interface ScheduleEditorProps {
  savedSearch: SavedSearch;
  onSave: (config: ScheduleConfig) => Promise<void>;
  onCancel: () => void;
}

/**
 * Internal state for the ScheduleEditor component
 */
interface ScheduleEditorState {
  scheduleEnabled: boolean;
  cronExpression: string;
  validationError: string | null;
  nextRunPreview: Date | null;
  isSaving: boolean;
}

/**
 * ScheduleEditor Component
 * 
 * Provides a UI for configuring cron-based schedules for saved searches.
 * Allows admins to enable/disable scheduling, configure cron expressions,
 * and preview next execution times.
 * 
 * @param props - Component props including saved search data and callbacks
 */
export const ScheduleEditor: React.FC<ScheduleEditorProps> = ({
  savedSearch,
  onSave,
  onCancel,
}) => {
  // Initialize state using useState hook
  // Load existing schedule configuration if available
  const [state, setState] = useState<ScheduleEditorState>({
    scheduleEnabled: (savedSearch as any).scheduleEnabled || false,
    cronExpression: (savedSearch as any).cronExpression || '',
    validationError: null,
    nextRunPreview: null,
    isSaving: false,
  });

  // Create CronValidator instance
  const cronValidator = new CronValidator();

  // Validate initial cron expression if one exists
  useEffect(() => {
    if (state.cronExpression && state.scheduleEnabled) {
      validateAndPreview(state.cronExpression);
    }
  }, []); // Run only on mount

  /**
   * Validate cron expression and update preview
   * Implements Requirements 4.1, 4.2
   * Calls CronValidator.calculateNextRun to get next execution time
   */
  const validateAndPreview = (cronExpression: string): void => {
    // Clear preview if expression is empty
    if (!cronExpression.trim()) {
      setState(prev => ({
        ...prev,
        validationError: null,
        nextRunPreview: null,
      }));
      return;
    }

    // Use CronValidator for validation and next run calculation
    const validation = cronValidator.validateCronExpression(cronExpression);

    setState(prev => ({
      ...prev,
      validationError: validation.error || null,
      nextRunPreview: validation.nextRun || null,
    }));
  };

  /**
   * Handle enable/disable toggle
   * Implements Requirements 2.1, 2.2, 2.3
   * Preserves cron expression when toggling off
   */
  const handleToggle = (enabled: boolean): void => {
    setState(prev => ({
      ...prev,
      scheduleEnabled: enabled,
      // Preserve cron expression when toggling off (Requirement 2.3)
      // Only clear validation errors and preview when disabling
      validationError: enabled ? prev.validationError : null,
      nextRunPreview: enabled ? prev.nextRunPreview : null,
    }));
  };

  /**
   * Handle cron expression input changes
   * Updates state and triggers validation/preview in real-time
   * Implements client-side validation as per Requirements 3.3, 10.2
   */
  const handleCronExpressionChange = (value: string) => {
    setState(prev => ({ ...prev, cronExpression: value }));
    
    // Validate and update preview in real-time as user types
    validateAndPreview(value);
  };

  /**
   * Handle form submission
   * Implements Requirements 1.2, 1.4
   * Calls POST /api/saved-searches/:id/schedule endpoint
   * Handles API validation errors and displays to user
   * Shows loading state during save operation
   * Closes editor on successful save
   */
  const handleSubmit = async (): Promise<void> => {
    // Set saving state
    setState(prev => ({ ...prev, isSaving: true }));

    try {
      // Prepare schedule configuration for API call
      const config = {
        scheduleEnabled: state.scheduleEnabled,
        cronExpression: state.scheduleEnabled ? state.cronExpression : null,
      };

      // Call API to update schedule
      await scheduleAPI.updateSchedule(savedSearch.savedSearchId, config);

      // Prepare full schedule config for parent callback
      const fullConfig: ScheduleConfig = {
        scheduleEnabled: state.scheduleEnabled,
        cronExpression: state.scheduleEnabled ? state.cronExpression : null,
        nextRunAt: state.nextRunPreview,
        lastRunAt: null,
      };

      // Call onSave prop to notify parent component
      await onSave(fullConfig);

      // Success - editor will be closed by parent component
    } catch (error) {
      // Handle API validation errors
      let errorMessage = 'Failed to save schedule. Please try again.';
      
      if (error instanceof Error) {
        // API client already extracts the error message from response
        errorMessage = error.message;
      }

      // Display error to user
      setState(prev => ({
        ...prev,
        validationError: errorMessage,
        isSaving: false,
      }));
    }
  };

  /**
   * Format timestamp in user-friendly format
   * Implements Requirement 4.1
   * 
   * @param date - Date to format
   * @returns Formatted string like "Tomorrow at 3:00 PM" or "Today at 5:30 PM"
   */
  const formatNextRunTime = (date: Date): string => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Check if it's today
    const isToday = date.toDateString() === now.toDateString();
    
    // Check if it's tomorrow
    const isTomorrow = date.toDateString() === tomorrow.toDateString();
    
    // Format time
    const timeString = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    
    // Format date
    const dateString = date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    
    if (isToday) {
      return `Today at ${timeString}`;
    } else if (isTomorrow) {
      return `Tomorrow at ${timeString}`;
    } else {
      return `${dateString} at ${timeString}`;
    }
  };

  // Check if form is valid for submission
  const isFormValid = state.scheduleEnabled &&
                      state.cronExpression.trim() !== '' &&
                      !state.validationError;

  return (
    <div className="schedule-editor max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">
        Schedule Configuration for "{savedSearch.searchName}"
      </h2>

      <div className="space-y-6">
        {/* Enable/Disable Toggle - Task 8.4 */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <label className="text-sm font-medium text-gray-900">
              Enable Scheduling
            </label>
            <p className="text-xs text-gray-500 mt-1">
              {state.scheduleEnabled 
                ? 'This search will run automatically based on the schedule below'
                : 'Enable to configure automated execution'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={state.scheduleEnabled}
            onClick={() => handleToggle(!state.scheduleEnabled)}
            disabled={state.isSaving}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              state.scheduleEnabled ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                state.scheduleEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Cron Expression Input - Task 8.2 */}
        {state.scheduleEnabled && (
          <div className="space-y-2">
            <label htmlFor="cron-expression" className="block text-sm font-medium text-gray-700">
              Cron Expression
            </label>
            <input
              id="cron-expression"
              type="text"
              value={state.cronExpression}
              onChange={(e) => handleCronExpressionChange(e.target.value)}
              placeholder="*/15 * * * * (every 15 minutes)"
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 ${
                state.validationError
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
              }`}
              disabled={state.isSaving}
            />

            {/* Validation Error Message */}
            {state.validationError && (
              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800 whitespace-pre-line">
                  {state.validationError}
                </p>
              </div>
            )}

            {/* Help Text with Examples */}
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm font-medium text-blue-900 mb-2">
                Valid Cron Expression Examples:
              </p>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li><code className="bg-blue-100 px-1 rounded">*/15 * * * *</code> - Every 15 minutes (minimum allowed)</li>
                <li><code className="bg-blue-100 px-1 rounded">0 * * * *</code> - Every hour</li>
                <li><code className="bg-blue-100 px-1 rounded">0 9 * * *</code> - Daily at 9:00 AM</li>
                <li><code className="bg-blue-100 px-1 rounded">0 9 * * 1</code> - Every Monday at 9:00 AM</li>
                <li><code className="bg-blue-100 px-1 rounded">0,30 * * * *</code> - Twice per hour (at 0 and 30 minutes)</li>
              </ul>
              <p className="text-xs text-blue-700 mt-2">
                Format: minute hour day month weekday
              </p>
            </div>

            {/* Next Run Preview - Task 8.3 */}
            {state.nextRunPreview && !state.validationError && (
              <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm text-green-800">
                  <span className="font-medium">Next execution:</span>{' '}
                  {formatNextRunTime(state.nextRunPreview)}
                </p>
                <p className="text-xs text-green-700 mt-1">
                  {state.nextRunPreview.toLocaleString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Show preserved cron expression when disabled */}
        {!state.scheduleEnabled && state.cronExpression && (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Saved schedule:</span>{' '}
              <code className="bg-gray-100 px-2 py-1 rounded text-xs">{state.cronExpression}</code>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Enable scheduling above to activate this schedule
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button
            type="button"
            onClick={onCancel}
            disabled={state.isSaving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isFormValid || state.isSaving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {state.isSaving ? 'Saving...' : 'Save Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}

