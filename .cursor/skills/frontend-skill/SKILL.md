---
name: frontend-dev
description: Frontend development with Next.js, React components, API client usage. Use when working on dashboard features, UI components, frontend bugs, or API integration.
---

# Frontend Development Guide

## Project Structure

```
dashboard/
├── app/                    # Next.js App Router
│   ├── page.tsx           # Home page (/)
│   ├── auth/              # Auth pages
│   │   ├── login/
│   │   ├── signup/
│   │   └── reset-password/
│   ├── admin/             # Admin pages (protected)
│   └── ...
├── components/
│   ├── ui/               # Reusable UI components
│   └── features/         # Feature-specific components
└── lib/
    └── api.ts            # API client
```

## API Client Usage

Import from `@/lib/api.ts`:

```typescript
import { api } from "@/lib/api";

// GET request
const tasks = await api.get("/api/tasks");

// POST request
const newTask = await api.post("/api/tasks", {
  title: "New task",
  status: "pending",
});

// PATCH request
const updated = await api.patch(`/api/tasks/${id}`, {
  status: "completed",
});

// DELETE request
await api.delete(`/api/tasks/${id}`);
```

The API client automatically handles:
- Adding `Authorization` header from localStorage
- Parsing JSON responses
- Handling errors

## Authentication Flow

### Login

```typescript
const response = await api.post("/api/auth/login", {
  email,
  password,
  remember_me: false,
});

// Store tokens
localStorage.setItem("token", response.accessToken);
localStorage.setItem("refreshToken", response.refreshToken);
```

### Protected Routes

Use middleware or client-side checks:

```typescript
"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ProtectedPage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/auth/login");
    }
  }, [router]);

  return <div>Protected content</div>;
}
```

### Logout

```typescript
localStorage.removeItem("token");
localStorage.removeItem("refreshToken");
router.push("/auth/login");
```

## Component Patterns

### Server Component (default)

```typescript
// app/tasks/page.tsx
export default async function TasksPage() {
  const tasks = await api.get("/api/tasks");

  return (
    <div>
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} />
      ))}
    </div>
  );
}
```

### Client Component (interactive)

```typescript
"use client";
// components/TaskForm.tsx
"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";

export function TaskForm() {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (data) => {
    setLoading(true);
    try {
      await api.post("/api/tasks", data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return <Button onClick={handleSubmit} disabled={loading}>Submit</Button>;
}
```

## Tailwind CSS

Use utility classes for styling:

```typescript
<div className="flex items-center justify-between p-4 bg-white rounded-lg shadow">
  <h1 className="text-xl font-semibold text-gray-900">Title</h1>
  <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
    Action
  </button>
</div>
```

## Error Handling

```typescript
try {
  await api.post("/api/tasks", data);
  toast.success("Task created");
} catch (error: any) {
  const message = error.response?.data?.error || "Failed to create task";
  toast.error(message);
}
```

## Running the Frontend

```bash
cd dashboard
npm run dev
```

The frontend runs on `http://localhost:3000` by default.

## Environment Variables

Create `dashboard/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:4000
```
