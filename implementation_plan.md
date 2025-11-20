# UI Redesign & Bug Fix Implementation Plan

## Goal
Redesign the Secure Chat interface to match the provided "Dark Grid" reference, fix the message sending refresh bug, and add logout functionality.

## User Review Required
> [!IMPORTANT]
> **UI Overhaul**: The entire `index.html` and `style.css` will be rewritten to match the reference image.
> **Logout**: "Logout" will disconnect the WebSocket, clear memory keys, and return to the initial setup screen. It will NOT delete the keys from the user's computer (since we don't store them persistently anyway).

## Proposed Changes

### Frontend
#### [MODIFY] [index.html](file:///Users/itzaditya/Codez/SecChat/index.html)
- **Structure**:
    - **Background**: Grid pattern.
    - **Header**: "PGP Secure Chat" + Status + GitHub Link.
    - **Layout**: Two-column grid (Sidebar 300px, Chat 1fr).
    - **Sidebar**:
        - Search Bar.
        - "Your ID" Card.
        - Accordion Menu: "PGP Keys" (Setup), "Add Friend", "Friends List".
    - **Chat Area**:
        - Empty State / Chat Messages.
        - Bottom Input Bar (Textarea + Send Button).
- **Logout**: Add a Logout button in the Header or Settings.

#### [MODIFY] [style.css](file:///Users/itzaditya/Codez/SecChat/style.css)
- **Theme**: Dark Mode, Grid Background, Rounded Corners, Subtle Borders.
- **Components**:
    - Accordions for sidebar sections.
    - Modern input fields.
    - Glassmorphism effects if applicable.

#### [MODIFY] [script.js](file:///Users/itzaditya/Codez/SecChat/script.js)
- **Bug Fix**: Ensure `sendMessage` does not trigger a page refresh (likely due to form submission or unhandled event).
- **Logout Logic**: `socket.close()`, reset `state` object, toggle UI visibility.
- **UI Logic**: Handle accordion toggles.

## Verification Plan
1.  **Visual Check**: Compare result with reference image.
2.  **Bug Check**: Send a message and ensure page DOES NOT reload.
3.  **Feature Check**: Click Logout and verify return to setup screen.
