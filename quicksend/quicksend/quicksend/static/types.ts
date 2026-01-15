export interface FileItem {
  name: string;
  size: number;
  mtime: number;
  uploader: string;
  has_password?: boolean;
  group_id?: string;
}

export interface IpResponse {
  ip: string;
  port: number;
  is_host?: boolean;
  mode?: 'share' | 'oneway';
  upload_dir?: string;
  allow_remote_group_create?: boolean;
  use_source_date?: boolean;
  version?: string;
}

export interface TextItem {
  id: string;
  content?: string;
  uploader: string;
  uploader_id?: string;
  mtime: number;
  has_password?: boolean;
}

export interface GroupItem {
  id: string;
  name: string;
  parent_id?: string | null;
  mtime?: number;
  children?: string[];
  hidden?: boolean;
  is_pinned?: boolean;
}
