/** Snippet types — safe for client and server imports. */

export interface Snippet {
  id: string;
  title: string;
  code: string;
  language: string;
  tags: string;         // comma-separated
  createdAt: number;    // epoch ms
  updatedAt: number;
}
