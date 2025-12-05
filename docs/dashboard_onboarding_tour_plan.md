## Dashboard Onboarding Tutorial Plan

### Plan

#### Goal

Create an in-app walkthrough that automatically guides first-time users through the main dashboard controls and can be replayed later via a persistent “Tutorial” button (repurposed from the current notifications icon).

#### Scope

- Trigger the overlay only the first time a user lands on the dashboard after registering/logging in.
- Step the user through the following UI elements in order:
  1. Theme toggle
  2. Account menu (profile & logout)
  3. Quick Check-In card
  4. Text Chat
  5. Voice Call/Chat
  6. Sessions Completed counter
  7. Mood Trend chart
  8. Current Streak
  9. Recent Sessions
  10. Mental Health Assessments
  11. Find a Therapist
- Provide navigation controls (`Next`, `Back`, `Skip`, `Finish`).
- Replace the notification bell with a “Tutorial” button that replays the walkthrough on demand.

#### Proposed Implementation Steps

1. **Persist Tutorial State**

   - Add a `dashboard_tour_seen` boolean directly to the `User` model so the backend knows whether to auto-launch the tutorial.
   - Update registration defaults and profile serializer logic to expose the flag.
   - Add a lightweight `/users/me/dashboard-tour` style endpoint to mark the tutorial as completed when the user finishes or intentionally skips it.

2. **Frontend State & Triggering**

   - Extend the auth/user context to include the `dashboard_tour_seen` flag.
   - On initial dashboard render, auto-start the tour if the flag is false.
   - When the user finishes/skips, call the backend endpoint and update local state to prevent re-triggering.

3. **Overlay/Tour Component**

   - Choose an existing lightweight guided-tour solution (e.g. `react-joyride`) or implement a custom overlay using portals.
   - Define the ordered steps, each referencing a specific DOM target (using `data-tour-id` attributes on the relevant components).
   - Provide consistent styling across light/dark modes and ensure keyboard/escape support.

4. **Tutorial Button Integration**

   - Replace the notification icon in the header with a “Tutorial” icon/button.
   - Hook its click handler to start the tour regardless of the stored flag.

5. **Testing & Accessibility**

   - Verify the tour works across responsive breakpoints (desktop/tablet; mobile if supported).
   - Ensure focus management and `aria` attributes are compliant so the tour remains accessible.
   - Confirm that replaying the tour does not re-flip the `dashboard_tour_seen` flag unless it was previously false.

6. **Documentation & Partner README**
   - Update partner setup docs to mention the new migration (if any) and the expected tutorial behaviour.
   - Include QA tips for verifying the first-login walkthrough and manual replay button.

#### Implementation Notes

- Tutorial progress is stored directly on the `User` model—no separate settings table.
- The walkthrough auto-launches only on the very first dashboard visit; afterwards it runs solely when the user taps the Tutorial button, so no “Don’t show again” control is required.
- The step list tracks today’s dashboard and ends by pointing at the replay button so users know how to revisit the tour. It remains easy to extend if more widgets arrive later.

---

### Execution Log

1. Added `dashboard_tour_seen` to the `User` model, generated migration `0011_user_dashboard_tour_flag`, and exposed the flag in login/profile responses plus a new `/api/users/dashboard-tour/` endpoint for marking completion.
2. Extended the authentication context and login flow to persist the new flag locally, and introduced the `apiUpdateDashboardTour` helper so the frontend can mark completion.
3. Built a custom `DashboardTour` overlay component that highlights each dashboard feature, supports keyboard shortcuts, and includes Skip/Don’t show again/Next controls.
4. Tagged dashboard widgets with `data-tour-target` markers, replaced the notification bell with a replayable tutorial button, and wired auto-launch/manual replay logic on the dashboard page.
5. Styled the global highlight effect and updated documentation so partners know how to verify the first-login tour and replay it on demand.
