export interface User {
  id: string;
  username: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
}

export interface Effect {
  type: "text" | "watermark" | "color_filter" | "subtitle";
  params: Record<string, unknown>;
}

export interface Transition {
  type: "cut" | "fade" | "dissolve";
  duration: number;
}

export interface Clip {
  id: string;
  asset_id: string;
  track_id: string;
  timeline_start: number;
  timeline_end: number;
  source_in: number;
  source_out: number;
  effects: Effect[];
  transition_in: Transition | null;
  transition_out: Transition | null;
}

export interface Track {
  id: string;
  type: "video" | "audio" | "subtitle";
  index: number;
  clips: Clip[];
}

export interface TimelineState {
  duration: number;
  zoom: number;
  playhead_position: number;
  tracks: Track[];
}

export interface Project {
  id: string;
  name: string;
  owner: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  timeline_state: TimelineState | null;
  thumbnail_url: string | null;
}

export interface MediaAsset {
  id: string;
  project_id: string;
  filename: string;
  asset_type: "video" | "audio" | "image";
  file_url: string;
  proxy_url: string | null;
  thumbnail_url: string | null;
  duration: number | null;
  resolution: string | null;
  fps: number | null;
  codec: string | null;
  file_size: number;
  status: "uploading" | "processing" | "ready" | "error";
  created_at: string;
}

export interface ExportJob {
  id: string;
  project_id: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress: number;
  resolution: "480p" | "720p" | "1080p";
  format: "mp4" | "webm";
  bitrate: "low" | "medium" | "high";
  fps: 24 | 30 | 60;
  subtitle_burn_in: boolean;
  output_url: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}
