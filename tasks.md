# Tasks: Apply Memory Modal Styling to Conversations Modal

## Objective
Update the conversation modal to use the same visual styling as the memory modals, ensuring consistency across the admin interface.

## Changes to make:

### 1. Update conversations.html
- Add link to modal-override.css to ensure the global modal styles are applied
- Update modal structure to match the memory modal pattern

### 2. Update conversations.css
- Remove conflicting modal styles that override the global modal styles
- Keep conversation-specific content styles (transcript, messages, etc.)
- Ensure the modal uses the glass-morphism effect from modal-override.css

### 3. Key styling elements to preserve from modal-override.css:
- Full viewport coverage with proper z-index
- Glass-morphism background effect
- Centered modal dialog with smooth animations
- Consistent padding and spacing
- Proper backdrop blur effect

## Specific implementation steps:

### Step 1: In conversations.html
- Add `<link rel="stylesheet" href="css/modal-override.css?v=5">` after the conversations.css link
- Update the transcript modal structure to match the memory modal pattern

### Step 2: In conversations.css
- Remove the `.modal`, `.modal-overlay`, `.modal-container` base styles (lines 540-580)
- Keep the conversation-specific styles like:
  - `.transcript-container`
  - `.messages-container`
  - `.conversation-header`
  - `.conversation-meta`
  - `.message` styles
  - `.emotional-timeline`
  - `.care-indicators`
- Ensure the modal classes align with the global modal system

### Expected outcome:
Both memory and conversation modals will have the same professional glass-morphism appearance with proper positioning and animations, creating a consistent user experience across the admin interface.