# Inspection Dashboard Editing Screen - Frontend Improvement Plan

## Current Issues
1. **Confusing workflow**: User has to select which image to view/edit, unclear which image is being edited
2. **Poor visual hierarchy**: All images shown in small grid, hard to compare
3. **Unclear actions**: "Replace" button opens file picker instead of using drawn image
4. **No clear comparison**: Hard to compare Original vs AI images side by side
5. **Increment workflow unclear**: Not obvious how to create increment from edited original

## User Requirements

### Workflow 1: Fix AI Image Boxes
1. Inspector views **Original image** and **AI Image 1/2** side by side
2. If AI image boxes are incorrect, inspector draws rectangles/circles/text on **Original image**
3. Click button: **"Replace AI Image 1 with Edited Original"** or **"Replace AI Image 2 with Edited Original"**
4. System exports the edited original (with drawings) and replaces the AI image

### Workflow 2: Create Increment Image
1. Inspector views **Original image** and **Previous Day image** side by side
2. If there's an error, inspector draws on **Original image**
3. Click button: **"Set as Increment Image"**
4. System exports the edited original and sets it as the increment image

## Solution Architecture

### Layout Restructure
```
┌─────────────────────────────────────────────────────────────┐
│ Header: Car Info, Zoom Controls, Back Button               │
├──────────────────────┬──────────────────────────────────────┤
│                      │                                       │
│  EDITABLE CANVAS     │   COMPARISON PANEL                   │
│  (Original Image)    │   ┌─────────────────────────────┐   │
│                      │   │ AI Model 1 (Reference)      │   │
│  [Drawing Tools]     │   │ [Replace with Edited]       │   │
│  - Rectangle         │   └─────────────────────────────┘   │
│  - Circle            │   ┌─────────────────────────────┐   │
│  - Arrow             │   │ AI Model 2 (Reference)      │   │
│  - Text              │   │ [Replace with Edited]       │   │
│                      │   └─────────────────────────────┘   │
│  [Action Buttons]    │   ┌─────────────────────────────┐   │
│  - Replace AI 1      │   │ Previous Day (Reference)    │   │
│  - Replace AI 2      │   │                             │   │
│  - Set as Increment  │   └─────────────────────────────┘   │
│                      │                                       │
│  [Comments Section]  │   [Comments for each image]          │
│                      │                                       │
└──────────────────────┴──────────────────────────────────────┘
```

### Key Design Principles

1. **Always Edit Original**: The canvas always shows the original image. This is the source of truth.
2. **Side-by-Side Comparison**: AI images and Previous Day shown as reference on the right
3. **Clear Action Buttons**: Prominent buttons to replace AI images or set increment
4. **Visual Feedback**: 
   - Highlight which AI image is being compared
   - Show loading states during upload
   - Success/error notifications
5. **Workflow Clarity**: 
   - Clear labels: "Edit Original" vs "Reference Images"
   - Action buttons only appear when drawings exist
   - Tooltips explaining what each action does

### Component Structure

```
ReviewScreen
├── HeaderSection
│   ├── BackButton
│   ├── ImageInfo
│   └── ZoomControls
├── MainContent (Grid: 2 columns)
│   ├── LeftColumn (Editable Canvas)
│   │   ├── CanvasContainer
│   │   │   ├── Canvas (Original Image + Drawings)
│   │   │   └── ImageOverlay (for zoom/pan)
│   │   ├── DrawingToolsPanel
│   │   │   ├── ToolButtons (Rect, Circle, Arrow, Text)
│   │   │   ├── ColorPicker
│   │   │   ├── LineWidthSlider
│   │   │   └── ClearButton
│   │   └── ActionButtonsPanel
│   │       ├── ReplaceAI1Button (only if drawings exist)
│   │       ├── ReplaceAI2Button (only if drawings exist)
│   │       └── SetIncrementButton (only if drawings exist)
│   └── RightColumn (Comparison Panel)
│       ├── AI1Card
│       │   ├── ImagePreview
│       │   ├── StatusBadge
│       │   ├── ReplaceButton
│       │   └── CommentInput
│       ├── AI2Card
│       │   ├── ImagePreview
│       │   ├── StatusBadge
│       │   ├── ReplaceButton
│       │   └── CommentInput
│       └── PreviousDayCard
│           ├── ImagePreview
│           ├── StatusBadge
│           └── CommentInput
└── FooterSection
    ├── SaveCommentsButton
    └── ApproveButton
```

### State Management

```typescript
// Editing state
const [editingMode, setEditingMode] = useState<'original' | null>('original');
const [drawings, setDrawings] = useState<Drawing[]>([]);
const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

// Comparison state
const [comparingWith, setComparingWith] = useState<'ai1' | 'ai2' | 'previous' | null>(null);

// Action state
const [replacingAI, setReplacingAI] = useState<'model1' | 'model2' | null>(null);
const [settingIncrement, setSettingIncrement] = useState(false);
```

### User Flow

1. **Initial Load**:
   - Original image loads in canvas (left)
   - AI images and Previous Day load in comparison panel (right)
   - Drawing tools enabled
   - Action buttons hidden (no drawings yet)

2. **Inspector Draws on Original**:
   - Drawings appear on canvas
   - Action buttons appear: "Replace AI Image 1", "Replace AI Image 2", "Set as Increment"
   - Visual indicator shows "Unsaved changes"

3. **Inspector Clicks "Replace AI Image 1"**:
   - Button shows loading state
   - Canvas exported as blob
   - Uploaded to S3
   - API call to replace AI image
   - Success notification
   - AI Image 1 updates in comparison panel
   - Drawings remain on canvas (can continue editing)

4. **Inspector Clicks "Set as Increment"**:
   - Similar flow to replace AI
   - Increment image updates
   - Success notification

### Technical Implementation Details

1. **Canvas Management**:
   - Always render original image in canvas
   - Drawings stored in image coordinates (not screen coordinates)
   - Export function already exists (`exportCanvasAsImage`)
   - Use existing `handleUseDrawnImageAs` function

2. **Image Loading**:
   - Keep existing blob URL management
   - Use existing `fetchImageAsBlob` function
   - Maintain image stream URL logic

3. **API Integration**:
   - Use existing `replaceAIImage` endpoint
   - Use existing `uploadIncrementImage` endpoint
   - Keep existing error handling

4. **UX Enhancements**:
   - Add confirmation dialogs for destructive actions
   - Show preview before replacing
   - Add undo/redo functionality (future)
   - Keyboard shortcuts (future)

### Visual Design

1. **Color Scheme**:
   - Original canvas: White border, highlighted when active
   - AI images: Blue border when selected for comparison
   - Action buttons: Green for "Set as Increment", Blue for "Replace AI"
   - Warning states: Yellow/Orange for unsaved changes

2. **Spacing & Layout**:
   - Left column: 60% width (editing area needs space)
   - Right column: 40% width (comparison images)
   - Responsive: Stack on mobile, side-by-side on desktop

3. **Typography**:
   - Clear labels: "Edit Original Image" vs "Reference Images"
   - Button text: Action-oriented ("Replace AI Image 1 with Edited Original")
   - Help text: Tooltips explaining workflows

### Error Handling

1. **Network Errors**: Show retry button, maintain state
2. **Upload Failures**: Clear error message, allow retry
3. **Lock Conflicts**: Show message, prevent action
4. **Image Load Failures**: Show placeholder, retry option

### Accessibility

1. **Keyboard Navigation**: Tab through tools, Enter to activate
2. **Screen Readers**: Proper ARIA labels
3. **Focus Management**: Clear focus indicators
4. **Color Contrast**: WCAG AA compliant

### Performance Considerations

1. **Image Optimization**: Compress before upload
2. **Canvas Rendering**: Use requestAnimationFrame for smooth drawing
3. **Lazy Loading**: Load comparison images on demand
4. **Debouncing**: Debounce comment saves

## Implementation Steps

1. **Phase 1: Layout Restructure**
   - Split into left (canvas) and right (comparison) columns
   - Move drawing tools to left column
   - Create comparison panel component

2. **Phase 2: Action Buttons**
   - Add "Replace AI 1/2" buttons
   - Add "Set as Increment" button
   - Wire up to existing `handleUseDrawnImageAs` function
   - Add loading states

3. **Phase 3: Visual Feedback**
   - Add unsaved changes indicator
   - Add success/error notifications
   - Add comparison highlighting

4. **Phase 4: Polish**
   - Improve spacing and typography
   - Add tooltips
   - Add confirmation dialogs
   - Test all workflows

## Success Metrics

- Inspector can complete "Replace AI Image" workflow in < 3 clicks
- Inspector can complete "Set Increment" workflow in < 3 clicks
- Zero confusion about which image is being edited
- Clear visual feedback for all actions
- All existing functionality preserved

