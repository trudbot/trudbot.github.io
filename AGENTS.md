# Project Skills & Architecture Documentation

## 1. Tech Stack Overview
- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Bundler**: Turbopack (`--turbo` for dev)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **UI Library**: [React 19](https://react.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Animation**: [Framer Motion](https://www.framer.com/motion/) & `tw-animate-css`
- **Component Primitives**: [Radix UI](https://www.radix-ui.com/) (via Shadcn UI)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Utilities**: `clcx`, `tailwind-merge`, `date-fns`

## 2. Design System

### Color Palette (OKLCH)
The project uses the modern **OKLCH** color space for better perceptual uniformity and vibrant colors.
- **Primary**: Fresh Cyan/Green (`oklch(0.55 0.18 160)`)
- **Secondary**: Warm Coral/Orange (`oklch(0.65 0.15 45)`)
- **Accent**: Soft Blue/Purple (`oklch(0.7 0.16 280)`)
- **Background**: Off-white / Deep Dark Blue

### Typography
- **Sans**: Geist Sans (Clean, modern system font)
- **Mono**: Geist Mono (For code/data)
- **Handwriting**: Caveat (For playful, personal touches) - configured via `--font-handwriting`

### Visual Style
- **Core Philosophy**:
    - **Artistic & Individualistic**: Strong personal identity with an artistic touch.
    - **Geometry-Driven**: Emphasis on geometric shapes and compositions.
    - **Anti-Pattern**: Avoid generic design tropes (standard cards, muddy gradients, unexplained shadows).
    - **Childlike Wonder**: Fresh, bright colors reminiscent of a child's stick figure drawing - clean, innocent, and vivid.
- **Glassmorphism**: Extensive use of transparency and blur effects.
- **Rounded Corners**: Large border radius (`--radius: 1.5rem`) for a friendly, organic feel.
- **Dark Mode**: Fully supported with a custom CSS variable strategy.

## 3. Project Architecture

### Directory Structure
```
app/
├── (home)/          # Route group for the landing page
├── json/            # Feature: JSON Editor & Formatter
├── share/           # Feature: Sharing functionality
├── layout.tsx       # Root layout with ThemeProvider & Global Styles
└── globals.css      # Tailwind v4 configuration & CSS Variables
components/
├── ui/              # Atomic design components (Button, Card, Input...)
├── theme-provider.tsx # Next-themes integration
└── [feature].tsx    # Feature-specific components
lib/
└── utils.ts         # CN helper (clsx + tailwind-merge)
```

### Key Architectural Decisions
1.  **Atomic Design**: UI components are separated into `components/ui` for maximum reusability.
2.  **Route Grouping**: Uses parentheses folders like `(home)` to organize routes without affecting the URL structure.
3.  **Client/Server Split**: Explicit use of `"use client"` for interactive components (like the JSON editor), keeping the default as Server Components for performance.

## 4. Best Practices Adopted

- **Strict TypeScript**: Ensures type safety across the application.
- **Tailwind v4**: Utilizes the latest CSS-first configuration approach (no `tailwind.config.js` needed for most cases).
- **Accessibility (a11y)**: Built on Radix UI primitives ensuring keyboard navigation and screen reader support.
- **Performance**:
    - `next/dynamic` for heavy client-side libraries (e.g., `react-json-view`).
    - Turbopack for instant development feedback.
- **Code Quality**:
    - Pre-configured ESLint (v9 compatible configurations may be needed in future).
    - Separation of concerns (Hooks, Components, Utilities).

## 5. Feature Spotlights

### JSON Editor (`app/json/`)
- **Dual Mode**: Supports both Standard JSON and JSON5 (lax) parsing.
- **Auto-Repair**: Integrated `jsonrepair` to fix common formatting errors.
- **Bi-directional Sync**: Visual tree editing updates the raw text, and vice-versa.

### Theme System
- Built on `next-themes`.
- CSS variables defined in `:root` and `.dark` selectors within `globals.css` allow for instant, flicker-free theme switching.

### ROUTING
[ROUTING_GUIDE.md](./ROUTING_GUIDE.md)

### PAGES
[PAGES](./PAGES.md)