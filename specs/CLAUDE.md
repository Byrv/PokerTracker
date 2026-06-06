# A Human-Understandable Guide to Building Apps with AI

This is a simple, repeatable workflow for going from a one-line idea to a working application by letting AI do the heavy lifting — without losing control of what gets built.

The whole flow is just three files: `requirements.md` → `plan.md` → `execution.md`.

---

## Step 1: Build `requirements.md`

This file captures *what* you are building. It has three sections.

### Functional Requirements
- What features do you want?
- How do these features connect to each other?
- What is the end goal once these features are in place?

### Technical Requirements
- Frontend: e.g. Next.js
- Backend: e.g. Express.js
- Architecture: monolith or microservices
- What each piece is responsible for

### Design Requirements
- Minimal UI
- Liquid glass UI
- Whatever look, feel, and UX you want the application to have

### How to actually write `requirements.md`

Start with a one-line prompt. Don't overthink it.

> Example: *"Let's build a weather app."*

Drop that one line into `requirements.md`. Then prompt the AI:

> *"Refine `requirements.md`."*

The AI will expand it — adding features and asking clarifying questions. You then:
1. Delete what you don't want.
2. Keep what you do want.
3. Add anything new that comes to mind.
4. Prompt *"refine `requirements.md`"* again.

Repeat until the file feels complete and every requirement you care about is captured.

---

## Step 2: Build `plan.md`

Once requirements are locked in, prompt:

> *"Use `requirements.md` and outline a detailed implementation plan that covers every aspect of it."*

`plan.md` describes *how* you will build it:
- How each feature will be implemented
- How the pieces tie together
- An overview of the final application
- The folder structure
- Phases of work and what is needed for each

This is the file you come back to whenever you need to make changes to the app's direction.

---

## Step 3: Build `execution.md`

Now prompt the AI to turn the plan into a script:

> *"Use `plan.md` to generate `execution.md`."*

`execution.md` is the runbook for the AI. It contains:
- Every tool call the AI needs to make
- Every file edit
- Every action required to build the app
- Tests and verification steps

It can be as long as it needs to be — the more precise, the better.

---

## Step 4: Execute

Prompt:

> *"Execute `execution.md`."*

Then watch the app build itself.

---

## Why this works

Each file has one job:
- **`requirements.md`** — decide *what*.
- **`plan.md`** — decide *how*.
- **`execution.md`** — decide *exactly which steps*.

Splitting the work this way keeps the AI focused, makes it easy for you to review and course-correct at each stage, and means you never hand off a half-formed idea to an autonomous build step.
