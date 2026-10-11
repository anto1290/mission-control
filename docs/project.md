# PROJECT: REALISTIC 3D VIRTUAL OFFICE WITH AUTONOMOUS AI EMPLOYEES

## ROLE

Act as a senior Three.js engineer, React Three Fiber specialist, character animation engineer, game AI programmer, and technical artist.

Your task is to transform the existing application into a realistic 3D virtual office populated by animated virtual employees that perform believable office activities.

Use the provided office reference image as the visual foundation. Recreate its architectural characteristics: a modern corporate office, open-plan workstations, computer desks, ergonomic chairs, large windows, glass meeting-room partitions, a lounge area, and realistic interior lighting.

The result must be an actual interactive 3D application, not a static image, video, or decorative mockup.

Inspect the existing repository, implement the required functionality, run the application, and verify the rendered result.

Do not stop after producing a plan.

---

## 1. PRODUCT VISION

Build a persistent virtual office where each virtual employee represents an actual AI agent or an application-defined worker.

Employees must be capable of:

- Walking between office locations.
- Approaching and sitting at their assigned desks.
- Typing on keyboards.
- Looking at computer monitors.
- Standing up and leaving their desks.
- Walking to meeting rooms.
- Participating in simulated meetings.
- Interacting with other employees through predefined behaviors.
- Returning to their workstations.
- Displaying their current activity and agent status.

Employees should not move randomly without a purpose.

Each movement and animation must be driven by an explicit behavior state, task assignment, scheduled event, or real application event.

The application should feel like a living office simulation while remaining responsive and easy to understand.

## 2. REFERENCE ENVIRONMENT

Recreate the visual language of the provided reference:

- Modern corporate office architecture.
- Light neutral walls and flooring.
- Large black-framed windows.
- Glass partitions with dark metal frames.
- White and light-gray desks.
- Multiple computer monitors.
- Ergonomic office chairs.
- A dedicated meeting room.
- A lounge or collaboration area.
- Plants and restrained architectural decoration.
- Soft daylight entering through the windows.
- Realistic shadows, reflections, and material variation.

Improve the composition where necessary while retaining the overall architectural concept.

Do not make the scene excessively futuristic, cartoonish, or neon-colored.

The environment should resemble a high-quality architectural visualization with believable human scale.

## 3. REQUIRED TECHNICAL STACK

First inspect the existing project and preserve its framework wherever possible.

Preferred technologies:

- React.
- TypeScript.
- Three.js.
- React Three Fiber.
- @react-three/drei, if already installed or justified.
- GLTF/GLB for character and environment assets.
- SkinnedMesh and skeletal animation for rigged characters.
- THREE.AnimationMixer or React Three Fiber-compatible animation utilities.
- A navigation mesh or graph-based navigation system for walking.
- React state management or the project's existing state architecture.

> **Note:** the current implementation uses raw **Three.js** in a custom rAF renderer (not React Three Fiber), with primitive characters instead of GLB. R3F/GLB/SkinnedMesh remain the target for the character-upgrade phase; the navigation graph (grid A*) is already in place.

Use the existing dependency versions and conventions.

Do not blindly upgrade dependencies or introduce duplicate rendering systems.

If character assets are missing, identify a suitable rigged GLB asset with compatible animation clips or establish a clearly documented asset integration strategy.

Do not invent asset URLs or assume that an arbitrary model includes a compatible skeleton.

## 4. 3D OFFICE ENVIRONMENT

Build the office as modular scene components.

Suggested components:

- OfficeScene
- OfficeFloor
- OfficeWalls
- WindowSystem
- GlassPartition
- OfficeDoor
- Desk
- Monitor
- Keyboard
- OfficeChair
- MeetingRoom
- MeetingTable
- LoungeArea
- Plant
- EmployeeSpawnPoint
- EmployeeDestination

Requirements:

1. Establish a consistent world scale.
2. Align desks, chairs, monitors, and room geometry correctly.
3. Create sufficient walking space between desks.
4. Ensure doors and passageways are accessible.
5. Use reusable geometries and materials.
6. Add realistic contact shadows where practical.
7. Avoid excessive reflective surfaces.
8. Prevent visible geometry intersections and z-fighting.
9. Use instancing for repeated static objects when beneficial.
10. Optimize texture sizes and model complexity.

Separate architectural geometry from interactive objects and employee navigation data.

Represent important locations using stable IDs and explicit world-space coordinates or scene references.

Examples:

- desk_alice
- desk_bob
- meeting_room_a
- lounge_area
- printer_station

These identifiers must be connected to the application's actual data model when one exists.

## 5. VIRTUAL EMPLOYEE CHARACTERS

Every employee must be a genuine animated 3D character.

Prefer rigged humanoid GLB assets with a compatible skeleton and animation clips.

Do not represent employees solely as colored cubes, floating spheres, or static human-shaped placeholders in the final implementation.

Each employee should have:

- A stable employee or agent ID.
- A character model.
- A unique name.
- An assigned workstation or role.
- A current behavior state.
- A current activity.
- A target destination when moving.
- An animation controller.
- A selection state.
- A current task or associated application data when available.

Allow the character's appearance to vary through supported assets, materials, or accessories without requiring an entirely separate animation implementation for every employee.

Use appropriate character scale and foot placement.

Ensure that characters do not float above the floor, sink through surfaces, or penetrate desks and chairs.

### Asset strategy

Inspect the available project assets first.

If no suitable character model exists:

1. Define the required rig and animation compatibility.
2. Integrate an appropriate licensed or otherwise authorized rigged GLB asset.
3. Document its source, license, and required animation clips.
4. Keep asset loading asynchronous.
5. Provide a graceful loading or fallback state.

Do not embed a static image in place of an animated character.

Do not claim that a character is fully animated if its model has no usable animation clips.

## 6. EMPLOYEE ANIMATION SYSTEM

Implement a reusable character animation controller.

Support these animation categories when compatible clips are available:

- Idle.
- Walk.
- Sit down.
- Seated idle.
- Typing.
- Mouse interaction.
- Look at monitor.
- Stand up.
- Turn in place.
- Talk or gesture.
- Meeting idle.
- Read or inspect documents.

Use semantic animation states and map them to the actual clip names in each imported model.

Do not assume every GLB uses identical animation names.

### Animation transitions

Use AnimationMixer or a compatible animation system to blend between clips.

Requirements:

- Smooth transitions between walking and idle.
- Smooth transitions between standing and sitting.
- Appropriate playback speed.
- Controlled animation weights.
- Correct loop behavior.
- Proper cleanup when characters are removed.
- No uncontrolled accumulation of AnimationMixer instances.

For a character walking, its body orientation must match its movement direction.

When the character reaches its destination, it should stop at an appropriate location and transition into the correct activity animation.

### Important distinction

Walking is a locomotion behavior. Typing and sitting are workstation behaviors.

Do not blend incompatible full-body animations indiscriminately. Use appropriate clip layering, masks, or compatible animation sequences where available.

If a model lacks a required animation, implement a reasonable fallback only when technically appropriate and document the limitation.

## 7. EMPLOYEE STATE MACHINE

Implement an explicit finite state machine for every employee.

Suggested states:

- IDLE
- WALKING_TO_DESK
- SITTING_DOWN
- WORKING
- STANDING_UP
- WALKING_TO_MEETING
- IN_MEETING
- WALKING_TO_LOUNGE
- TAKING_BREAK
- RETURNING_TO_DESK
- ERROR

Not every project needs every state, but state transitions must be explicit and validated.

Example transition flow:

IDLE
→ WALKING_TO_DESK
→ SITTING_DOWN
→ WORKING
→ STANDING_UP
→ WALKING_TO_MEETING
→ IN_MEETING
→ RETURNING_TO_DESK
→ SITTING_DOWN
→ WORKING

Another example:

WORKING
→ STANDING_UP
→ WALKING_TO_LOUNGE
→ TAKING_BREAK
→ RETURNING_TO_DESK
→ SITTING_DOWN
→ WORKING

Each transition should define:

- The trigger.
- The destination, if applicable.
- The animation to play.
- The next valid state.
- Any necessary interaction with workstation occupancy.
- The completion condition.

Avoid contradictory states, such as a character simultaneously walking and typing at a desk.

Ensure state changes do not create infinite transition loops.

Use event-driven transitions where possible rather than generating arbitrary random behavior every frame.

## 8. NAVIGATION AND PATHFINDING

Characters must walk through the office rather than teleporting between locations.

Implement a navigation system appropriate for the office layout.

Preferred options:

- A baked navigation mesh with a compatible pathfinding implementation.
- A waypoint graph for a fixed office layout.
- A navigation grid with obstacle avoidance for simpler environments.

Choose the simplest robust option for the current architecture.

The navigation system must understand:

- Walkable floor areas.
- Desks and furniture as obstacles.
- Glass partitions and walls.
- Doorways.
- Meeting-room entrances.
- Restricted areas.
- Employee destinations.

### Movement requirements

1. Calculate a valid path to the destination.
2. Move the character along the path at a configurable walking speed.
3. Rotate the character toward its direction of travel.
4. Slow down or stop near the destination.
5. Avoid walking through walls and furniture.
6. Handle blocked paths gracefully.
7. Prevent employees from standing inside desks or chairs.
8. Use appropriate approach points for sitting and meeting activities.

Do not move characters by instantly assigning the destination position.

Use frame delta time for movement so speed remains independent of frame rate.

Avoid recalculating expensive paths on every frame.

For a fixed office layout, a waypoint graph is an acceptable first implementation if it produces reliable movement and respects obstacles.

### Multi-agent movement

When multiple employees share the office:

- Prevent employees from occupying the same chair simultaneously.
- Assign workstation occupancy explicitly.
- Avoid obvious character overlap.
- Use destination reservations, simple local avoidance, or staggered movement when necessary.
- Keep collision handling computationally reasonable.

A full crowd-simulation engine is not required unless the project already uses one.

## 9. WORKSTATION INTERACTIONS

Characters should interact with their environment in a spatially believable way.

### Sitting at a desk

When an employee starts working:

1. Find the assigned workstation.
2. Navigate to its approach point.
3. Align with the chair.
4. Rotate toward the desk and monitor.
5. Play a sitting animation.
6. Transition into seated idle or typing.
7. Remain in the workstation's seated position until an event requires leaving.

The seated character must be aligned with the actual desk and chair.

Do not simply lower the character's Y coordinate and assume that it is sitting correctly.

Use a designated seating transform and account for the character's rig, root motion, and animation conventions.

### Working animation

While in WORKING:

- Play a typing animation if available.
- Occasionally switch to a monitor-focused idle animation if supported.
- Keep the character anchored to the workstation.
- Display a corresponding activity label.
- Do not trigger a walk animation unless a valid departure transition occurs.

Use restrained variations in animation timing to prevent multiple employees from looking perfectly synchronized.

## 10. AI AGENT INTEGRATION

The visual simulation must remain separate from the actual AI execution system.

The behavior controller consumes agent state and events. It does not automatically execute AI tasks just because a character is animated.

Map actual application events to visual behaviors.

Example mappings:

- Agent starts a task → character transitions to WORKING.
- Agent becomes idle → character transitions to an idle behavior.
- Agent receives a meeting assignment → character navigates to the meeting room.
- Agent completes a task → character may display a completion state.
- Agent encounters an error → character displays an error indicator or contextual status.
- Agent resumes work → character returns to its workstation.

These are example mappings. Adapt them to the real application data and event model.

If the application does not yet expose these events, implement a clearly separated simulation mode with deterministic demo scenarios.

Do not fabricate real agent execution results.

### Behavior scheduling

Use a behavior scheduler or event-driven controller to decide what each employee should do.

The scheduler may use:

- Real agent events.
- Explicit task assignments.
- Meeting schedules.
- Configured break intervals.
- Deterministic demo scenarios.

Keep scheduling separate from rendering and character animation.

Never make network calls, invoke an LLM, or perform expensive business logic inside useFrame.

## 11. VIRTUAL OFFICE DASHBOARD

Redesign the surrounding interface as a premium SaaS application.

The 3D office is the primary workspace, with a cohesive dashboard around it.

### Sidebar

Include supported navigation for:

- Overview.
- Virtual office.
- Agents.
- Tasks.
- Activity.
- Settings.

Use existing routes where available. Do not create dead navigation controls.

### Top toolbar

Display useful information, such as:

- Workspace name.
- Online agent count.
- Active task count.
- Current simulation status.
- Camera and viewport controls.

All counts and statuses must use real application state or clearly labeled simulation data.

### Employee detail panel

When an employee is selected, show:

- Name.
- Role or agent identifier.
- Current state.
- Current activity.
- Assigned desk or location.
- Current task, if available.
- Relevant runtime information.
- Supported actions.

Provide a useful empty state when no employee is selected.

### Activity timeline

Show real events when available.

In simulation mode, show only explicitly simulated events and label the mode appropriately.

### Employee nameplates

Display lightweight nameplates above or near characters.

Include a name and concise activity or status indicator.

Keep labels readable and prevent excessive overlap.

Use HTML overlays or Drei Html when appropriate, with controlled distance behavior and viewport clipping.

Avoid turning the office into a sea of floating UI cards.

## 12. CAMERA AND USER CONTROLS

Implement a polished navigation experience.

Support, where appropriate:

- Orbit around the office.
- Zoom in and out.
- Pan across the floor.
- Focus on a selected employee.
- Focus on a department or meeting room.
- Return to the default overview camera.

Add reasonable camera limits and smooth transitions.

Do not let camera movement cause the user to lose the entire office.

When a character is selected, provide a clear selection indicator.

Optionally provide a follow-camera mode, but make it explicit and easy to disable.

Ensure the application remains usable with both mouse and keyboard where practical.

## 13. PERFORMANCE AND RENDERING

The application must remain responsive with multiple animated employees.

Inspect the scene's actual rendering cost before optimizing.

Consider:

- Reusing geometries and materials.
- Instancing repeated static props.
- Loading GLB assets asynchronously.
- Reusing compatible animation resources.
- Caching paths where appropriate.
- Limiting unnecessary React state updates.
- Avoiding allocations in hot animation loops.
- Reducing expensive shadows on minor objects.
- Using a capped device pixel ratio.
- Disposing of resources correctly.
- Rendering static portions efficiently.

Do not put every frame of character movement into React component state.

Use refs, Three.js objects, and frame updates for high-frequency transforms.

Use React state or the existing state manager for meaningful application-level changes, such as selection and agent status.

Do not disable shadows or reduce model quality globally without checking the visual impact.

Test with a representative number of employees and document the tested configuration.

## 14. DEVELOPMENT PHASES

Implement the project in these phases.

> **Current status (as of last verification):**
>
> | Phase | Scope | Status |
> |-------|-------|--------|
> | A | Repository audit | ✅ Done |
> | B | Office environment | ✅ Done — `app/components/office/environment.ts` (Three.js scene: floor, walls, windows, glass partitions, desks, monitors, chairs, meeting/lounge, plants, lighting, seats) |
> | C | Character integration | ⚠️ Partial — characters are primitive THREE.js figures (cylinders + glow ring) driven by a procedural animation loop in `Office3D.tsx`, **not** rigged GLB/SkinnedMesh/AnimationMixer as the spec prefers. No external asset license yet. |
> | D | Movement system | ✅ Done — `app/components/office/pathfinding.ts` (grid A*), `test-pathfinding.ts` passes; walking uses frame-delta time and routes through door gaps, no wall clipping observed |
> | E | Behavior system | ⚠️ Partial — data-driven target resolution in `Office3D.tsx` (status/room/task → destination + behavior state); room rotation in `lib/api-remote.ts` is time-slot driven (5-min window), not calendar/agent-event driven |
> | F | Dashboard | ⚠️ Partial — agent roster, active-count badge, legend, hover/select raycasting, nameplates; no dedicated employee detail panel or activity timeline yet |
> | G | Performance & QA | ⏳ Ongoing — production build clean, no console errors in the live scene; multi-agent simultaneous movement verified |

Do not stop after writing files. Run the application and verify the integration.

## 15. ACCEPTANCE CRITERIA

### Environment

- [ ] The office is a real interactive 3D scene.
- [ ] The scene resembles the supplied modern corporate office reference.
- [ ] Desks, chairs, windows, partitions, and rooms are correctly positioned.
- [ ] Lighting and materials create believable spatial depth.
- [ ] Walkable areas and destinations are explicitly defined.

### Characters

- [ ] Employees use actual 3D character assets.
- [ ] Compatible skeletal animation clips are loaded and verified.
- [ ] Walking produces continuous spatial movement.
- [ ] Characters rotate in the direction of travel.
- [ ] Characters can reach their assigned desks.
- [ ] Sitting and working states are spatially aligned with workstations.
- [ ] Characters can leave their desks and travel to other destinations.
- [ ] Animation transitions are smooth enough to avoid obvious snapping.
- [ ] Employees do not consistently clip through walls or furniture.

### Behavior

- [ ] Each employee has a stable identity and explicit state.
- [ ] State transitions follow defined rules.
- [ ] Movement is triggered by meaningful events or configured simulation scenarios.
- [ ] Employees do not perform contradictory activities.
- [ ] Workstation occupancy is managed.
- [ ] Simulation data is distinguishable from real AI agent data.

### Dashboard

- [ ] Selecting an employee updates the detail panel.
- [ ] Employee state is visible in the UI.
- [ ] Camera controls work correctly.
- [ ] Nameplates are readable.
- [ ] Navigation controls perform real actions.
- [ ] Panels remain visible at the target viewport size.

### Technical validation

- [ ] The application starts using the project's documented workflow.
- [ ] No new runtime or console errors are introduced.
- [ ] Character assets and animation clips load successfully.
- [ ] Existing supported functionality is preserved.
- [ ] Movement is based on frame delta time.
- [ ] Multiple employees can operate simultaneously.
- [ ] Resources and animation controllers are cleaned up correctly.
- [ ] Performance is tested and remaining limitations are documented.

## 16. MANDATORY VISUAL AND BEHAVIOR QA

Run the actual application.

Inspect at least:

1. The default office view.
2. An employee sitting and typing.
3. An employee standing up and walking to another location.
4. An employee entering a meeting room.
5. Multiple employees moving simultaneously.
6. An employee selected in the dashboard.
7. The application at a narrower viewport.

Capture screenshots or short recordings if available.

Check:

- Character scale and foot placement.
- Animation quality and transitions.
- Walking paths.
- Orientation and destination alignment.
- Furniture collisions.
- Desk and chair alignment.
- Camera composition.
- Nameplate readability.
- Dashboard layout.
- Runtime errors and performance.

After the first inspection, fix the three highest-impact problems and inspect again.

Do not claim that an animation, navigation system, or visual result was tested unless it was actually observed.

If a required asset or tool is unavailable, document the limitation and complete the remaining feasible work.

## 17. FINAL REPORT

Provide:

- Summary of implemented features.
- Files added and modified.
- Character asset sources and licenses.
- Available animation clips and any missing clips.
- Navigation approach.
- Employee state machine and event mappings.
- Actual AI integration versus simulation-only behavior.
- Commands and tests executed.
- Visual QA results.
- Known limitations and next steps.

### As-implemented (current state)

- **Files added / modified:**
  - `app/components/office/environment.ts` — Three.js office scene builder (geometry, lighting, `OfficeSeat` layout).
  - `app/components/office/pathfinding.ts` — grid A* (`Pathfinder`), bounds `x:[-20,20] z:[-12,12]`, wall/door obstacles; `test-pathfinding.ts` verifies routes pass through door gaps.
  - `app/components/Office3D.tsx` — WebGL renderer (rAF loop), procedural characters, raycast select/hover, walk-path following, behavior-state animation.
  - `app/office/page.tsx` — dashboard shell (roster, active count, legend, selection state) around `<Office3D>`.
  - `lib/api-remote.ts` — time-slot room rotation (`slot = floor(Date.now()/300_000)`, `(index+slot)%5` → Meeting/Lounge/Workspace) drives which room each task-less agent is sent to.
  - `office3d.b64` deleted (superseded by the live Three.js scene). `lib/office-renderer.ts` remains but is unused/dead — superseded by `Office3D.tsx`; candidate for deletion.

- **Character assets & animation:** none loaded from an external source. Characters are procedurally built Three.js primitives with a hand-rolled animation loop (arm swing on walk, typing on `working`, etc.). No SkinnedMesh/GLB, no AnimationMixer. This is the main gap against §5/§6.

- **Navigation:** grid A* (Phase D approach from §8's "navigation grid" option). Path is computed on target change, not per frame; movement uses frame delta time; orientation set to travel direction.

- **Behavior:** data-driven, not random. Target = f(status, room, task); transitions only when the input signature changes. Room rotation is simulation-only (time slot), clearly not real agent events.

- **AI vs simulation:** simulation-only for room placement; agent status/room/task reflect the real data returned by the office API.

- **Commands/tests executed:** `tsc --noEmit` clean; `node test-pathfinding.ts` PASS; production `next build` clean; live scene inspected in browser (10 agents rendered, cross-room paths observed, no console errors).

- **Known limitations / next steps:**
  1. Replace primitive characters with rigged GLB + AnimationMixer (§5/§6) — highest remaining visual gap.
  2. Add an employee detail panel and activity timeline (§11).
  3. Drive room placement from real agent events/calendar rather than a time slot (§10).
  4. Delete dead `lib/office-renderer.ts`.
  5. Add follow-camera + per-employee focus (§12) if required.

FINAL REQUIREMENT:

Deliver a working virtual office with animated 3D employees, believable movement, workstation interactions, explicit behavior states, and a polished dashboard.

Prioritize a reliable end-to-end implementation over a large collection of incomplete features.
