# Safety

Non-negotiable rules (from `README.md` Section 4). Details of the pre-flight spec are written in Phase 3.

- Geofence and altitude ceiling are enforced on the drone's autopilot, not just in the UI.
- Return-to-home on low battery, lost link or user command.
- A physical/RC override always exists; software must never remove the pilot's ability to take control.
- Pre-flight check must pass before arming. Every command is logged.
- Spraying and any payload release need an explicit extra confirmation.
- Remind the operator to follow local aviation regulations and required permissions.
- Simulated data (`SimDriver`, fake image sets) must be labeled "Simulated" in the UI.
