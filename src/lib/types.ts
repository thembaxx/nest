import { z } from "zod";
export const topics = [
  "Design",
  "Development",
  "Reading",
  "Inspiration",
  "Life & living",
  "Unsorted",
] as const;
export type Topic = (typeof topics)[number];
export const bookmarkSchema = z.object({
  id: z.string().max(100),
  url: z
    .url()
    .max(4000)
    .refine((v) => /^https?:\/\//i.test(v)),
  title: z.string().max(500),
  description: z.string().max(2000).default(""),
  topic: z.enum(topics),
  tags: z.array(z.string().max(80)).max(30),
  listIds: z.array(z.string().max(100)).max(50),
  favorite: z.boolean(),
  archived: z.boolean(),
  read: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number(),
  deletedAt: z.number().optional(),
  status: z.enum(["unchecked", "healthy", "unreachable", "dead"]),
  lastChecked: z.number().optional(),
  failures: z.number().default(0),
  image: z.string().max(4000).optional(),
  art: z.string().max(40).optional(),
  demo: z.boolean().optional(),
  note: z.string().max(5000).optional(),
});
export type Bookmark = z.infer<typeof bookmarkSchema>;
export const listSchema = z.object({
  id: z.string().max(100),
  name: z.string().min(1).max(80),
  color: z.string().max(40),
  updatedAt: z.number(),
  deletedAt: z.number().optional(),
});
export type BookmarkList = z.infer<typeof listSchema>;
export const librarySchema = z.object({
  bookmarks: z.array(bookmarkSchema).max(10000),
  lists: z.array(listSchema).max(200),
});
export type Library = z.infer<typeof librarySchema>;
export type Settings = {
  theme: "system" | "light" | "dark";
  autoSort: boolean;
  syncKey?: string;
  onboarded: boolean;
  model?: string;
  healthChecks: boolean;
  effects: boolean;
};
export const defaultSettings: Settings = {
  theme: "system",
  autoSort: true,
  onboarded: false,
  healthChecks: true,
  effects: true,
};
export type View =
  | "all"
  | "favorites"
  | "unread"
  | "archive"
  | "dead"
  | `list:${string}`
  | `topic:${Topic}`;
